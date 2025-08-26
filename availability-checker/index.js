const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

// Initialize the Firebase Admin SDK if it hasn't been already.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * An HTTP-triggered Cloud Function that checks appointment availability for a given date.
 * It calculates technician capacity against booked jobs and returns available time slots.
 *
 * @param {functions.https.Request} req - The HTTP request object. Expects a 'date' query parameter (e.g., ?date=YYYY-MM-DD).
 * @param {functions.Response} res - The HTTP response object.
 */
exports.availabilityChecker = functions.https.onRequest((req, res) => {
  // Use CORS middleware to handle cross-origin requests.
  cors(req, res, async () => {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // --- 1. Input Validation ---
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Invalid or missing 'date' parameter. Please provide a date in YYYY-MM-DD format.",
      });
    }

    try {
      // --- 2. Fetch Technicians and Calculate Capacity ---
      const techniciansSnapshot = await db.collection("technicians").where("status", "==", "Online").get();
      const onlineTechs = techniciansSnapshot.docs.map(doc => doc.data());

      if (onlineTechs.length === 0) {
        // If no techs are online, no slots are available.
        return res.status(200).json({
            primary_gap: null,
            secondary_gap: null,
            final_gap: null
        });
      }

      const totalCapacity = onlineTechs.reduce((sum, tech) => sum + (tech.maxJobs || 0), 0);

      // Distribute total capacity across the three main time slots.
      const base = Math.floor(totalCapacity / 3);
      const remainder = totalCapacity % 3;

      let slot1_capacity = base; // 8am-2pm
      let slot2_capacity = base; // 9am-4pm
      let slot3_capacity = base; // 12pm-6pm

      if (remainder === 1) {
        slot2_capacity += 1;
      } else if (remainder === 2) {
        slot1_capacity += 1;
        slot2_capacity += 1;
      }

      const capacities = {
        "8am to 2pm": slot1_capacity,
        "9am to 4pm": slot2_capacity,
        "12pm to 6pm": slot3_capacity,
      };

      // --- 3. Count Booked Jobs for the Given Date ---
      const jobsQuery = db.collection("jobs")
        .where("scheduledDate", "==", date)
        .where("status", "in", ["Scheduled", "Awaiting completion"]);

      const jobsSnapshot = await jobsQuery.get();
      const bookedJobs = jobsSnapshot.docs.map(doc => doc.data());

      const bookedCounts = {
        "8am to 2pm": bookedJobs.filter(j => j.timeSlot === "8am to 2pm").length,
        "9am to 4pm": bookedJobs.filter(j => j.timeSlot === "9am to 4pm").length,
        "12pm to 6pm": bookedJobs.filter(j => j.timeSlot === "12pm to 6pm").length,
      };

      // --- 4. Determine Availability and Construct Response ---
      const slotsWithAvailability = [];

      // Calculate remaining spaces for each slot and add it to a list if available
      const slot1Remaining = capacities["8am to 2pm"] - bookedCounts["8am to 2pm"];
      if (slot1Remaining > 0) {
          slotsWithAvailability.push({ name: "8am to 2pm", remaining: slot1Remaining });
      }

      const slot2Remaining = capacities["9am to 4pm"] - bookedCounts["9am to 4pm"];
      if (slot2Remaining > 0) {
          slotsWithAvailability.push({ name: "9am to 4pm", remaining: slot2Remaining });
      }

      const slot3Remaining = capacities["12pm to 6pm"] - bookedCounts["12pm to 6pm"];
      if (slot3Remaining > 0) {
          slotsWithAvailability.push({ name: "12pm to 6pm", remaining: slot3Remaining });
      }

      // Sort the list so the slot with the most remaining spaces is first
      slotsWithAvailability.sort((a, b) => b.remaining - a.remaining);

      // Assign the sorted slots to the primary, secondary, and final gaps
      const responseJson = {
          primary_gap: slotsWithAvailability[0] ? slotsWithAvailability[0].name : null,
          secondary_gap: slotsWithAvailability[1] ? slotsWithAvailability[1].name : null,
          final_gap: slotsWithAvailability[2] ? slotsWithAvailability[2].name : null,
      };

      return res.status(200).json(responseJson);

    } catch (error) {
      console.error("Error in availability-checker function:", error);
      return res.status(500).json({
        error: "An internal server error occurred while checking availability.",
      });
    }
  });
});
