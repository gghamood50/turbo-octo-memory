const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const { Client } = require("@googlemaps/google-maps-services-js");
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// --- INITIALIZE SERVICES ---
try {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
} catch (e) {
    console.warn("Firebase Admin SDK initialization caught:", e.message);
}
const firestore = admin.firestore();
const mapsClient = new Client({});
const secretManagerClient = new SecretManagerServiceClient();

// --- CONFIGURATION ---
const MAPS_API_KEY_SECRET_NAME = 'projects/safewayos2/secrets/google-maps-api-key/versions/latest';

/**
 * Fetches the Google Maps API Key securely from Secret Manager.
 */
const getMapsApiKey = async () => {
    try {
        const [version] = await secretManagerClient.accessSecretVersion({ name: MAPS_API_KEY_SECRET_NAME });
        const apiKey = version.payload.data.toString('utf8');
        if (!apiKey) {
            throw new Error("API Key from Secret Manager is empty.");
        }
        return apiKey;
    } catch (error) {
        console.error("FATAL: Could not retrieve Google Maps API Key from Secret Manager.", error);
        throw new Error("API Key configuration error. Check secret path, permissions, and ensure the secret has a value.");
    }
};

/**
 * ==================================================================================
 * HTTP Cloud Function Entry Point (Gen 1 Syntax for Maximum Compatibility)
 * ==================================================================================
 */
exports.generateOptimizedTripSheets = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).send({ message: 'Method Not Allowed' });
        }

        console.log("Function 'generateOptimizedTripSheets' triggered.");
        try {
            const mapsApiKey = await getMapsApiKey();

            const { date: targetDate } = req.body;
            if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
                return res.status(400).send({ message: `Invalid or missing date. Expected YYYY-MM-DD. Body: ${JSON.stringify(req.body)}` });
            }
            console.log(`Processing request for date: ${targetDate}`);

            const techsQuery = firestore.collection('technicians').where('status', '==', 'Online').get();
            const jobsQuery = firestore.collection('jobs').where('scheduledDate', '==', targetDate).where('status', '==', 'Scheduled').get();
            
            const [techsSnapshot, jobsSnapshot] = await Promise.all([techsQuery, jobsQuery]);

            if (techsSnapshot.empty) {
                return res.status(400).send({ message: "No online technicians available." });
            }

            const allTechnicians = techsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const technicians = allTechnicians.filter(tech => {
                if (tech.startLocation && tech.endLocation) return true;
                console.warn(`Skipping technician ${tech.name} (ID: ${tech.id}) due to missing startLocation or endLocation.`);
                return false;
            });

            const allJobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const jobs = allJobs.filter(job => {
                if (job.address) return true;
                console.warn(`Skipping job for customer ${job.customer} (ID: ${job.id}) due to missing address.`);
                return false;
            });

            if (technicians.length === 0) {
                 return res.status(400).send({ message: "No online technicians with valid location data were found." });
            }
            if (jobs.length === 0) {
                return res.status(200).send({ message: `No scheduled jobs with valid addresses found for ${targetDate}.`, tripSheets: [] });
            }
            console.log(`Found ${technicians.length} valid technicians and ${jobs.length} valid jobs.`);

            const techStarts = technicians.map(t => ({ id: `start_${t.id}`, address: t.startLocation }));
            const techEnds = technicians.map(t => ({ id: `end_${t.id}`, address: t.endLocation }));
            const allJobPoints = jobs.map(j => ({ id: j.id, address: j.address }));
            
            const allPointsForMatrix = [...techStarts, ...techEnds, ...allJobPoints];
            const allLocations = allPointsForMatrix.map(p => p.address);

            const matrixPromises = allLocations.map(origin => {
                return mapsClient.distancematrix({
                    params: {
                        origins: [origin],
                        destinations: allLocations,
                        key: mapsApiKey,
                    }
                });
            });

            const matrixResults = await Promise.all(matrixPromises);
            const stitchedMatrix = {
                origin_addresses: matrixResults.flatMap(r => r.data.origin_addresses),
                destination_addresses: matrixResults[0]?.data.destination_addresses || [],
                rows: matrixResults.map(r => r.data.rows[0])
            };
            console.log("Distance Matrix built successfully.");

            const tripSheets = generateOptimizedTripSheets(technicians, jobs, stitchedMatrix);

            const batch = firestore.batch();
            tripSheets.forEach(sheet => {
                const docId = `${targetDate}_${sheet.technicianId}`;
                const docRef = firestore.collection('tripSheets').doc(docId);
                batch.set(docRef, { ...sheet, date: targetDate, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            });
            await batch.commit();

            console.log(`Successfully generated and saved ${tripSheets.length} trip sheets.`);
            res.status(200).send({ message: `Trip sheets generated successfully!`, tripSheets });

        } catch (error) {
            console.error("An error occurred in generateTripSheets:", error);
            res.status(500).send({ message: "Internal Server Error", error: error.message });
        }
    });
});


/**
 * ==================================================================================
 * Main Orchestrator: Single-Phase Trip Sheet Construction Algorithm
 * ==================================================================================
 */
const generateOptimizedTripSheets = (technicians, jobs, matrix) => {
    console.log("Algorithm starting...");

    const techStarts = technicians.map(t => ({ id: `start_${t.id}`, address: t.startLocation, type: 'tech_start' }));
    const techEnds = technicians.map(t => ({ id: `end_${t.id}`, address: t.endLocation, type: 'tech_end' }));
    const allJobPoints = jobs.map(j => ({ ...j, type: 'job' }));
    const allPoints = [...techStarts, ...techEnds, ...allJobPoints];

    console.log("Constructing initial routes...");
    const assignments = new Map();
    technicians.forEach(tech => {
        assignments.set(tech.id, {
            technicianId: tech.id,
            technicianName: tech.name,
            route: [
                { id: `start_${tech.id}`, address: tech.startLocation, type: 'tech_start' },
                { id: `end_${tech.id}`, address: tech.endLocation, type: 'tech_end' }
            ]
        });
    });

    const timeSlotOrder = ["8am to 2pm", "9am to 4pm", "12pm to 6pm"];
    const jobGroups = new Map(timeSlotOrder.map(slot => [slot, []]));
    jobs.forEach(job => {
        if (jobGroups.has(job.timeSlot)) {
            jobGroups.get(job.timeSlot).push(job);
        } else {
            console.warn(`Job ${job.id} has an unrecognized time slot: ${job.timeSlot}`);
        }
    });

    for (const timeSlot of timeSlotOrder) {
        let jobsInCurrentWindow = jobGroups.get(timeSlot);
        
        while (jobsInCurrentWindow.length > 0) {
            let bestInsertion = { cost: Infinity, jobId: null, techId: null, insertIndex: -1 };

            for (const job of jobsInCurrentWindow) {
                for (const tech of technicians) {
                    const assignment = assignments.get(tech.id);
                    const currentRoute = assignment.route;

                    if (currentRoute.length - 2 >= tech.maxJobs) continue;

                    for (let i = 0; i < currentRoute.length - 1; i++) {
                        const prevStop = currentRoute[i];
                        const nextStop = currentRoute[i + 1];
                        const cost = calculateInsertionCost(prevStop, nextStop, job, matrix, allPoints);
                        
                        if (cost < bestInsertion.cost) {
                            const tempRoute = [...currentRoute.slice(0, i + 1), { ...job, type: 'job' }, ...currentRoute.slice(i + 1)];
                            if (isRouteFeasible(tempRoute, matrix, allPoints)) {
                                bestInsertion = { cost, jobId: job.id, techId: tech.id, insertIndex: i + 1 };
                            }
                        }
                    }
                }
            }

            if (bestInsertion.jobId) {
                const jobToInsert = jobsInCurrentWindow.find(j => j.id === bestInsertion.jobId);
                const assignment = assignments.get(bestInsertion.techId);
                assignment.route.splice(bestInsertion.insertIndex, 0, { ...jobToInsert, type: 'job' });
                jobsInCurrentWindow = jobsInCurrentWindow.filter(j => j.id !== bestInsertion.jobId);
            } else {
                console.error(`Could not find a feasible route for any remaining jobs in the ${timeSlot} window. Skipping.`);
                break;
            }
        }
    }
    console.log("Route construction complete.");

    // [FIX]: The problematic Phase 2 (Refinement) has been completely removed.
    
    const finalTripSheets = [];
    assignments.forEach(sheet => {
        const finalRoute = sheet.route.filter(stop => stop.type === 'job');
        if (finalRoute.length > 0) {
            finalTripSheets.push({
                technicianId: sheet.technicianId,
                technicianName: sheet.technicianName,
                route: finalRoute.map(({ id, address, customer, timeSlot }) => ({ id, address, customer, timeSlot }))
            });
        }
    });
    console.log("Algorithm finished successfully.");
    return finalTripSheets;
};

// --- HELPER FUNCTIONS ---
const calculateInsertionCost = (prevStop, nextStop, jobToInsert, matrix, allPoints) => {
    const prevIndex = allPoints.findIndex(p => p.id === prevStop.id);
    const nextIndex = allPoints.findIndex(p => p.id === nextStop.id);
    const jobIndex = allPoints.findIndex(p => p.id === jobToInsert.id);
    const timePrevToJob = matrix.rows[prevIndex].elements[jobIndex].duration.value;
    const timeJobToNext = matrix.rows[jobIndex].elements[nextIndex].duration.value;
    const timePrevToNext = matrix.rows[prevIndex].elements[nextIndex].duration.value;
    return (timePrevToJob + timeJobToNext) - timePrevToNext;
};

const isRouteFeasible = (route, matrix, allPoints) => {
    const AVERAGE_SERVICE_DURATION = 3600;
    const DAY_START_TIME = 8 * 3600;
    let currentTime = DAY_START_TIME;
    
    const timeWindowToSeconds = (slot) => {
        if (!slot) return { start: 0, end: Infinity };
        const parts = slot.toLowerCase().match(/(\d{1,2})(am|pm) to (\d{1,2})(am|pm)/);
        if (!parts) {
            console.warn(`Could not parse time slot: "${slot}". Treating as an all-day job.`);
            return { start: 0, end: Infinity };
        }

        const to24Hour = (hourStr, period) => {
            let hour = parseInt(hourStr, 10);
            if (period === 'pm' && hour !== 12) {
                hour += 12;
            }
            if (period === 'am' && hour === 12) {
                hour = 0;
            }
            return hour;
        };

        const startHour = to24Hour(parts[1], parts[2]);
        const endHour = to24Hour(parts[3], parts[4]);

        return {
            start: startHour * 3600,
            end: endHour * 3600
        };
    };

    for (let i = 0; i < route.length - 1; i++) {
        const currentStop = route[i];
        const nextStop = route[i + 1];
        const originIndex = allPoints.findIndex(p => p.id === currentStop.id);
        const destIndex = allPoints.findIndex(p => p.id === nextStop.id);
        const travelDuration = matrix.rows[originIndex].elements[destIndex].duration.value;
        currentTime += travelDuration;
        if (nextStop.type === 'job') {
            const window = timeWindowToSeconds(nextStop.timeSlot);
            currentTime = Math.max(currentTime, window.start);
            if (currentTime > window.end) return false;
            currentTime += AVERAGE_SERVICE_DURATION;
        }
    }
    return true;
};
