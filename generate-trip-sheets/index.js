const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const fetch = require("node-fetch");

const { RouteOptimizationClient } = require("@googlemaps/routeoptimization").v1;
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");

try { if (admin.apps.length === 0) admin.initializeApp(); } catch (e) {}
const firestore = admin.firestore();
const routeOptimizationClient = new RouteOptimizationClient();
const secretManagerClient = new SecretManagerServiceClient();

const MAPS_API_KEY_SECRET_NAME = "projects/216681158749/secrets/google-maps-api-key/versions/latest";
const GCP_PROJECT_ID = "safewayos2";

/* ============================== utils ============================== */

function toProtoTimestamp(date) {
  return { seconds: Math.floor(date.getTime() / 1000), nanos: 0 };
}

let cachedMapsApiKey = null;
const getMapsApiKey = async () => {
  if (cachedMapsApiKey) return cachedMapsApiKey;
  const [version] = await secretManagerClient.accessSecretVersion({ name: MAPS_API_KEY_SECRET_NAME });
  const apiKey = version.payload.data.toString("utf8");
  if (!apiKey) throw new Error("API Key from Secret Manager is empty.");
  cachedMapsApiKey = apiKey;
  return apiKey;
};

async function geocodeAddress(address) {
  if (!address || typeof address !== "string" || address.trim() === "") return null;
  const apiKey = await getMapsApiKey();
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Geocoding HTTP ${r.status}`);
    const j = await r.json();
    if (j.status !== "OK" || !j.results?.[0]?.geometry?.location) return null;
    const { lat, lng } = j.results[0].geometry.location;
    return { latitude: lat, longitude: lng };
  } catch { return null; }
}

/** Parse "8am-2pm" | "9am-4pm" | "12pm-6pm" to timestamps on a given ISO date */
function convertTimeSlotToDateTime(timeSlot, dateISO, tzOffset = "-07:00") {
  const fallbackStart = new Date(`${dateISO}T08:00:00${tzOffset}`);
  const fallbackEnd   = new Date(`${dateISO}T18:00:00${tzOffset}`);
  if (!timeSlot) return { start: toProtoTimestamp(fallbackStart), end: toProtoTimestamp(fallbackEnd) };

  const [startStr, endStr] = timeSlot.replace(/\s+/g, "").split(/[–-]|to/);
  const parseHour = (s) => {
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?([ap]m)$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ampm = m[3].toLowerCase();
    if (ampm === "pm" && h !== 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    return { h, min };
  };
  const s = parseHour(startStr), e = parseHour(endStr);
  if (!s || !e) return { start: toProtoTimestamp(fallbackStart), end: toProtoTimestamp(fallbackEnd) };
  const sdt = new Date(`${dateISO}T00:00:00${tzOffset}`); sdt.setHours(s.h, s.min, 0, 0);
  const edt = new Date(`${dateISO}T00:00:00${tzOffset}`); edt.setHours(e.h, e.min, 0, 0);
  return { start: toProtoTimestamp(sdt), end: toProtoTimestamp(edt) };
}

/* ============================== geometry & clustering ============================== */

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2);
  const c = 2 * Math.asin(Math.sqrt(s1 * s1 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * s2 * s2));
  return R * c;
}

function centroid(points) {
  const n = points.length;
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.latitude, lng: acc.lng + p.longitude }), { lat: 0, lng: 0 });
  return { latitude: sum.lat / n, longitude: sum.lng / n };
}

/** Vanilla k-means with k-means++ init; returns array clusterIndex per point */
function kmeans(points, k, maxIter = 50) {
  if (points.length <= k) return points.map((_, i) => i); // trivial
  // k-means++ seeding
  const centers = [];
  centers.push(points[Math.floor(Math.random() * points.length)]);
  while (centers.length < k) {
    const d2 = points.map(p => Math.min(...centers.map(c => haversineMeters(p, c))) ** 2);
    const sum = d2.reduce((a, b) => a + b, 0);
    const r = Math.random() * sum;
    let acc = 0, idx = 0;
    for (; idx < d2.length; idx++) { acc += d2[idx]; if (acc >= r) break; }
    centers.push(points[Math.min(idx, points.length - 1)]);
  }

  let assignments = new Array(points.length).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    // assign
    let changed = false;
    for (let i = 0; i < points.length; i++) {
      const d = centers.map(c => haversineMeters(points[i], c));
      const best = d.indexOf(Math.min(...d));
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;
    // update centers
    for (let j = 0; j < k; j++) {
      const clusterPts = points.filter((_, i) => assignments[i] === j);
      if (clusterPts.length) centers[j] = centroid(clusterPts);
    }
  }
  return assignments;
}

/** Hungarian assignment (O(n^3)) for square cost matrices */
function hungarian(cost) {
  const n = cost.length;
  const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0), p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= n; j++) if (!used[j]) {
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const assignment = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j]) assignment[p[j] - 1] = j - 1;
  return assignment;
}

/* ============================== main solve ============================== */

exports.generateOptimizedTripSheets = functions
  .runWith({ timeoutSeconds: 300, memory: "1GB" })
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      if (req.method !== "POST") return res.status(405).send({ message: "Method Not Allowed" });

      try {
        const { date: targetDate } = req.body;
        if (!targetDate) return res.status(400).send({ message: "Date is required." });

        // 1) Load techs + jobs
        const [techsSnapshot, jobsSnapshot] = await Promise.all([
          firestore.collection("technicians").where("status", "==", "Online").get(),
          firestore.collection("jobs").where("scheduledDate", "==", targetDate).where("status", "==", "Scheduled").get(),
        ]);
        if (techsSnapshot.empty) return res.status(400).send({ message: "No online technicians available." });
        if (jobsSnapshot.empty)  return res.status(200).send({ message: "No scheduled jobs found.", tripSheets: [] });

        const technicians = techsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const jobs = jobsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const K = Math.min(technicians.length, 8);

        // 2) Geocode
        const [jobLocs, techLocs] = await Promise.all([
          Promise.all(jobs.map(async j => ({ j, loc: await geocodeAddress(j.address) }))),
          Promise.all(technicians.map(async t => ({
            t, start: await geocodeAddress(t.startLocation), end: await geocodeAddress(t.endLocation || t.startLocation)
          })))
        ]);
        const geoJobs = jobLocs.filter(x => x.loc);
        const geoTechs = techLocs.filter(x => x.start && x.end);
        if (!geoJobs.length) return res.status(400).send({ message: "Could not geocode any job locations." });
        if (!geoTechs.length) return res.status(400).send({ message: "Could not geocode any technician locations." });

        // 3) CLUSTER jobs into K clusters
        const jobPoints = geoJobs.map(x => x.loc);
        const assignments = kmeans(jobPoints, K);
        const clusters = Array.from({ length: K }, () => []);
        geoJobs.forEach((x, idx) => clusters[assignments[idx]].push(x));
        const clusterCentroids = clusters.map(c => centroid(c.map(x => x.loc)));

        // 4) ASSIGN clusters to techs (Hungarian on distance from tech.start → cluster centroid)
        const n = Math.max(K, geoTechs.length);
        const BIG = 1e9;
        const cost = Array.from({ length: n }, (_, i) =>
          Array.from({ length: n }, (_, j) => {
            const tech = geoTechs[i % geoTechs.length];
            const cen  = clusterCentroids[j % K];
            return (i < geoTechs.length && j < K) ? haversineMeters(tech.start, cen) : BIG;
          })
        );
        const match = hungarian(cost).slice(0, geoTechs.length); // tech i -> cluster match[i]
        const techToCluster = {};
        geoTechs.forEach((entry, i) => {
          const j = match[i];
          if (j >= 0 && j < K) techToCluster[entry.t.id] = j;
        });

        // 5) REBALANCE for capacity (spill farthest to nearest tech with room)
        const cap = (t) => (t.maxJobs || 10);
        const clusterToTech = {}; Object.entries(techToCluster).forEach(([tid, c]) => { clusterToTech[c] = tid; });

        const perTechJobs = {}; geoTechs.forEach(({ t }) => { perTechJobs[t.id] = []; });
        geoJobs.forEach((x, idx) => {
          const c = assignments[idx];
          const assignedTid = clusterToTech[c];
          const tid = assignedTid || geoTechs.slice().sort((a, b) => haversineMeters(a.start, x.loc) - haversineMeters(b.start, x.loc))[0].t.id;
          perTechJobs[tid].push(x);
        });

        const techOrder = geoTechs.map(g => g.t.id);
        const techRoom = {}; techOrder.forEach(tid => techRoom[tid] = cap(technicians.find(t => t.id === tid)));
        techOrder.forEach(tid => techRoom[tid] -= perTechJobs[tid].length);

        let rounds = 0;
        while (rounds++ < 50) {
          const overTid = techOrder.find(tid => techRoom[tid] < 0);
          if (!overTid) break;
          const overJobs = perTechJobs[overTid];
          const techStart = geoTechs.find(g => g.t.id === overTid).start;
          overJobs.sort((a, b) => haversineMeters(b.loc, techStart) - haversineMeters(a.loc, techStart));
          const candidate = overJobs[0];
          const receiver = techOrder
            .filter(tid => techRoom[tid] > 0)
            .sort((A,B) => {
              const aS = geoTechs.find(g => g.t.id === A).start;
              const bS = geoTechs.find(g => g.t.id === B).start;
              return haversineMeters(aS, candidate.loc) - haversineMeters(bS, candidate.loc);
            })[0];
          if (!receiver) break;
          perTechJobs[overTid] = overJobs.slice(1);
          perTechJobs[receiver].push(candidate);
          techRoom[overTid] += 1; techRoom[receiver] -= 1;
        }

        // 6) STRICT TIME-SLOT ORDER per tech: chain mini-solves 8–2 → 9–4 → 12–6
        const tzOffset = "-07:00"; // LA summer
        const globalStart = toProtoTimestamp(new Date(`${targetDate}T06:00:00${tzOffset}`));
        const globalEnd   = toProtoTimestamp(new Date(`${targetDate}T20:00:00${tzOffset}`));

        const tripSheets = [];

        const slotRank = (s) => {
          if (!s) return 99;
          const p = s.replace(/\s+/g, "").toLowerCase();
          if (p.startsWith("8am") && p.includes("2pm")) return 1;
          if (p.startsWith("9am") && p.includes("4pm")) return 2;
          if (p.startsWith("12pm") && p.includes("6pm")) return 3;
          return 99;
        };

        for (const { t, start, end } of geoTechs) {
          const jobsForTech = perTechJobs[t.id] || [];
          if (!jobsForTech.length) continue;

          // Build groups in strict order (8–2, 9–4, 12–6). Ignore others or append after.
          const g1 = jobsForTech.filter(({ j }) => slotRank(j.timeSlot) === 1);
          const g2 = jobsForTech.filter(({ j }) => slotRank(j.timeSlot) === 2);
          const g3 = jobsForTech.filter(({ j }) => slotRank(j.timeSlot) === 3);
          const groups = [g1, g2, g3].filter(g => g.length);

          let currentStartLoc = start;
          let currentStartTs  = globalStart;
          const assembledRouteJobs = [];

          async function solvePhase(phaseJobs, isLastPhase) {
            if (!phaseJobs.length) return;
            const shipments = phaseJobs.map(({ j, loc }) => ({
              label: `job_${j.id}`,
              pickups: [{
                arrivalLocation: loc,
                timeWindows: [convertTimeSlotToDateTime(j.timeSlot, targetDate, tzOffset)],
                loadDemands: { jobs: { amount: 1 } }
              }]
            }));

            const model = {
              shipments,
              vehicles: [{
                label: `tech_${t.id}`,
                travelMode: "DRIVING",
                startLocation: currentStartLoc,
                endLocation: isLastPhase ? (end || start) : currentStartLoc,
                loadLimits: { jobs: { maxLoad: t.maxJobs || 10 } },
                costPerHour: 60,
                fixedCost: 0
              }],
              globalStartTime: currentStartTs,
              globalEndTime: globalEnd
            };

            const request = { parent: `projects/${GCP_PROJECT_ID}`, model, solvingMode: "DEFAULT_SOLVE" };
            const [resp] = await routeOptimizationClient.optimizeTours(request);

            const visits = (resp.routes?.[0]?.visits || []).filter(v => v.shipmentLabel);
            const ordered = visits
              .map(v => jobs.find(j => j.id === v.shipmentLabel.replace("job_", "")))
              .filter(Boolean);
            assembledRouteJobs.push(...ordered);

            const lastVisit = visits[visits.length - 1];
            if (lastVisit?.arrivalLocation) currentStartLoc = lastVisit.arrivalLocation;
            if (lastVisit?.arrivalTime)     currentStartTs  = lastVisit.arrivalTime;
          }

          for (let gi = 0; gi < groups.length; gi++) {
            const isLast = gi === groups.length - 1;
            // eslint-disable-next-line no-await-in-loop
            await solvePhase(groups[gi], isLast);
          }

          tripSheets.push({
            technicianId: t.id,
            technicianName: t.name || "Unknown",
            date: targetDate,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            route: assembledRouteJobs.map(job => ({
              id: job.id,
              address: job.address,
              customer: job.customer,
              issue: job.issue,
              timeSlot: job.timeSlot
            }))
          });
        }

        // 7) Save preview trip sheets
        const batch = firestore.batch();
        tripSheets.forEach((sheet) => {
          const docId = `${targetDate}_${sheet.technicianId}`;
          const ref = firestore.collection("previewTripSheets").doc(docId);
          batch.set(ref, sheet);
        });
        await batch.commit();

        return res.status(200).send({ message: "Trip sheets generated successfully!", tripSheets });

      } catch (error) {
        console.error(error);
        return res.status(500).send({ message: "Internal Server Error", error: error.message });
      }
    });
  });
