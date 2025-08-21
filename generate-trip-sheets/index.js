const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Google Maps Route Optimization API client
const { RouteOptimizationClient } = require("@googlemaps/routeoptimization").v1;
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");

// --- INITIALIZE SERVICES ---
try {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
} catch (e) {
  console.warn("Firebase Admin SDK initialization caught:", e.message);
}

const firestore = admin.firestore();
const routeOptimizationClient = new RouteOptimizationClient();
const secretManagerClient = new SecretManagerServiceClient();

// --- CONFIGURATION ---
const MAPS_API_KEY_SECRET_NAME =
  "projects/216681158749/secrets/google-maps-api-key/versions/latest";
const GCP_PROJECT_ID = "safewayos2";

/* ============================== Helpers ============================== */

// Convert JS Date -> protobuf Timestamp { seconds, nanos }
function toProtoTimestamp(date) {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanos: 0,
  };
}

// Geocode a free-form address -> { latitude, longitude }
async function geocodeAddress(address) {
  if (!address || typeof address !== "string") {
    throw new Error(`Geocoding: invalid address "${address}"`);
  }
  const apiKey = await getMapsApiKey();
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${apiKey}`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Geocoding HTTP ${r.status}`);
  const j = await r.json();
  if (j.status !== "OK" || !j.results?.[0]?.geometry?.location) {
    throw new Error(`Geocoding failed for "${address}" (${j.status})`);
  }
  const { lat, lng } = j.results[0].geometry.location;
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error(
      `Geocoding for address "${address}" returned invalid coordinates. Received: lat=${lat}, lng=${lng}`
    );
  }
  // google.type.LatLng expects {latitude, longitude}
  return { latitude: lat, longitude: lng };
}

function convertTimeSlotToDateTime(timeSlot, date) {
  const [startTimeStr, endTimeStr] = timeSlot.replace(/ /g, "").split("to");

  const parseTime = (timeStr) => {
    let [hour, period] = timeStr.match(/(\d+)([ap]m)/).slice(1);
    hour = parseInt(hour, 10);
    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    return hour;
  };

  const startHour = parseTime(startTimeStr);
  const endHour = parseTime(endTimeStr);

  // Build times in UTC so they're stable across environments
  const startDate = new Date(`${date}T00:00:00Z`);
  startDate.setUTCHours(startHour, 0, 0, 0);

  const endDate = new Date(`${date}T00:00:00Z`);
  endDate.setUTCHours(endHour, 0, 0, 0);

  return {
    start: toProtoTimestamp(startDate),
    end: toProtoTimestamp(endDate),
  };
}

/**
 * Fetches the Google Maps API Key securely from Secret Manager.
 */
const getMapsApiKey = async () => {
  const [version] = await secretManagerClient.accessSecretVersion({
    name: MAPS_API_KEY_SECRET_NAME,
  });
  const apiKey = version.payload.data.toString("utf8");
  if (!apiKey) {
    throw new Error("API Key from Secret Manager is empty.");
  }
  return apiKey;
};

/* ============================== Cloud Function ============================== */

exports.generateOptimizedTripSheets = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send({ message: "Method Not Allowed" });
    }

    console.log("Function 'generateOptimizedTripSheets' triggered.");
    try {
      const { date: targetDate } = req.body;
      if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        return res.status(400).send({
          message: `Invalid or missing date. Expected YYYY-MM-DD. Body: ${JSON.stringify(
            req.body
          )}`,
        });
      }
      console.log(`Processing request for date: ${targetDate}`);

      const techsQuery = firestore
        .collection("technicians")
        .where("status", "==", "Online")
        .get();
      const jobsQuery = firestore
        .collection("jobs")
        .where("scheduledDate", "==", targetDate)
        .where("status", "==", "Scheduled")
        .get();

      const [techsSnapshot, jobsSnapshot] = await Promise.all([
        techsQuery,
        jobsQuery,
      ]);

      if (techsSnapshot.empty) {
        return res.status(400).send({
          message: "No online technicians available.",
        });
      }

      const technicians = techsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const jobs = jobsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (jobs.length === 0) {
        return res.status(200).send({
          message: `No scheduled jobs found for ${targetDate}.`,
          tripSheets: [],
        });
      }
      console.log(
        `Found ${technicians.length} technicians and ${jobs.length} jobs.`
      );

      const timeSlotOrder = ["8am to 2pm", "9am to 4pm", "12pm to 6pm"];
      let finalTripSheets = [];
      let lastLocations = {}; // Stores the last known location of each technician

      // Initialize last locations with start locations (addresses)
      technicians.forEach((tech) => {
        lastLocations[tech.id] = tech.startLocation;
      });

      for (const timeSlot of timeSlotOrder) {
        const jobsInTimeSlot = jobs.filter((job) => job.timeSlot === timeSlot);
        if (jobsInTimeSlot.length === 0) continue;

        const { optimizedRoutes, technicianLastLocations } =
          await optimizeRoutesForTimeSlot(
            technicians,
            jobsInTimeSlot,
            lastLocations,
            targetDate
          );

        // Merge routes
        optimizedRoutes.forEach((newRoute) => {
          const existingSheet = finalTripSheets.find(
            (sheet) => sheet.technicianId === newRoute.technicianId
          );
          if (existingSheet) {
            existingSheet.route.push(...newRoute.route);
          } else {
            finalTripSheets.push(newRoute);
          }
        });

        // Update last known locations for the next iteration (addresses)
        lastLocations = { ...lastLocations, ...technicianLastLocations };
      }

      const batch = firestore.batch();
      finalTripSheets.forEach((sheet) => {
        const docId = `${targetDate}_${sheet.technicianId}`;
        const docRef = firestore.collection("previewTripSheets").doc(docId);
        batch.set(docRef, {
          ...sheet,
          date: targetDate,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();

      console.log(
        `Successfully generated and saved ${finalTripSheets.length} trip sheets.`
      );
      res.status(200).send({
        message: `Trip sheets generated successfully!`,
        tripSheets: finalTripSheets,
      });
    } catch (error) {
      console.error("An error occurred in generateOptimizedTripSheets:", error);
      res.status(500).send({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  });
});

/* ==================== Route Optimization for a Single Time Slot ==================== */

async function optimizeRoutesForTimeSlot(
  technicians,
  jobs,
  startLocations,
  targetDate
) {
  const timeWindow = convertTimeSlotToDateTime(jobs[0].timeSlot, targetDate);

  // Geocode all job addresses -> LatLng
  const geoJobs = await Promise.all(
    jobs.map(async (job) => {
      const latLng = await geocodeAddress(job.address);
      return { job, latLng };
    })
  );

  // Geocode start & end addresses for all technicians -> LatLng
  const geoTechs = await Promise.all(
    technicians.map(async (tech) => {
      const start = await geocodeAddress(startLocations[tech.id]);
      const end = await geocodeAddress(tech.endLocation);
      return { tech, start, end };
    })
  );

  const model = {
    shipments: geoJobs.map(({ job, latLng }) => ({
      label: `job_${job.id}`,
      pickups: [
        {
          // Use LatLng directly (not nested under "location.latLng")
          arrivalLocation: latLng,
          timeWindows: [
            {
              startTime: timeWindow.start,
              endTime: timeWindow.end,
            },
          ],
          // demand of 1 "job" unit
          loadDemands: { jobs: { amount: 1 } },
        },
      ],
    })),
    vehicles: geoTechs.map(({ tech, start, end }) => ({
      label: `tech_${tech.id}`,
      travelMode: "DRIVING",
      // Use LatLng directly
      startLocation: start,
      endLocation: end,
      // capacity limit for "jobs" load type
      loadLimits: {
        jobs: { maxLoad: Number.isFinite(tech.maxJobs) ? tech.maxJobs : 9999 },
      },
    })),
    globalStartTime: toProtoTimestamp(new Date(`${targetDate}T00:00:00Z`)),
    globalEndTime: toProtoTimestamp(new Date(`${targetDate}T23:59:59Z`)),
  };

  const request = {
    parent: `projects/${GCP_PROJECT_ID}`,
    model,
    solvingMode: "DEFAULT_SOLVE",
  };

  const [response] = await routeOptimizationClient.optimizeTours(request);

  const optimizedRoutes = [];
  const technicianLastLocations = {};

  (response.routes || []).forEach((route) => {
    const techId = (route.vehicleLabel || "").replace("tech_", "");
    const technician = technicians.find((t) => t.id === techId);

    const jobRoute = (route.visits || [])
      .filter((visit) => (visit.shipmentLabel || "").startsWith("job_"))
      .map((visit) => {
        const jobId = visit.shipmentLabel.replace("job_", "");
        return jobs.find((j) => j.id === jobId);
      })
      .filter(Boolean);

    if (jobRoute.length > 0) {
      optimizedRoutes.push({
        technicianId: techId,
        technicianName: technician?.name || "",
        route: jobRoute.map((job) => ({
          id: job.id,
          address: job.address,
          customer: job.customer,
          issue: job.issue,
          timeSlot: job.timeSlot,
        })),
      });
      technicianLastLocations[techId] =
        jobRoute[jobRoute.length - 1].address;
    }
  });

  return { optimizedRoutes, technicianLastLocations };
}
