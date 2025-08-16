/**
 * ==================================================================================
 * Main Orchestrator: Two-Phase Trip Sheet Optimization Algorithm
 * ==================================================================================
 * This is the primary function to generate highly optimized trip sheets.
 * It operates in two distinct phases:
 * 1.  **Construction Phase:** Builds a good, feasible set of routes using an
 * insertion heuristic. It intelligently adds jobs one by one to the best
 * possible slot in any technician's route.
 * 2.  **Refinement Phase:** Takes the good routes from the construction phase
 * and attempts to improve them using a 2-opt swap heuristic. This phase
 * looks for and "uncrosses" inefficient route segments to further reduce
 * travel time.
 *
 * @param {Array<object>} technicians - Array of technician objects. Each must have id, name, startLocation, endLocation, maxJobs.
 * @param {Array<object>} jobs - Array of job objects. Each must have id, address, timeSlot.
 * @param {object} matrix - The pre-computed Google Maps Distance Matrix result.
 * @returns {Array<object>} An array of the final, optimized trip sheets.
 */
const generateOptimizedTripSheets = (technicians, jobs, matrix) => {
    console.log("Algorithm starting...");

    // A single, indexed list of all locations is needed for the matrix.
    // This order MUST be consistent for all matrix lookups.
    const techStarts = technicians.map(t => ({ id: `start_${t.id}`, address: t.startLocation, type: 'tech_start' }));
    const techEnds = technicians.map(t => ({ id: `end_${t.id}`, address: t.endLocation, type: 'tech_end' }));
    const allJobPoints = jobs.map(j => ({ ...j, type: 'job' }));
    const allPoints = [...techStarts, ...techEnds, ...allJobPoints];

    // ==============================================================================
    // PHASE 1: CONSTRUCTION (Build a good initial solution)
    // ==============================================================================
    console.log("Phase 1: Constructing initial routes...");

    const assignments = new Map();
    technicians.forEach(tech => {
        assignments.set(tech.id, {
            technicianId: tech.id,
            technicianName: tech.name,
            route: [
                { id: `start_${tech.id}`, address: tech.startLocation, type: 'tech_start' },
                { id: `end_${t.id}`, address: t.endLocation, type: 'tech_end' }
            ]
        });
    });

    let unassignedJobs = [...jobs];

    while (unassignedJobs.length > 0) {
        let bestInsertion = { cost: Infinity, jobId: null, techId: null, insertIndex: -1 };

        for (const job of unassignedJobs) {
            for (const tech of technicians) {
                const assignment = assignments.get(tech.id);
                const currentRoute = assignment.route;

                if (currentRoute.length - 2 >= tech.maxJobs) continue;

                for (let i = 0; i < currentRoute.length - 1; i++) {
                    const prevStop = currentRoute[i];
                    const nextStop = currentRoute[i + 1];
                    
                    const cost = calculateInsertionCost(prevStop, nextStop, job, matrix, allPoints);
                    
                    if (cost < bestInsertion.cost) {
                        const tempRoute = [...currentRoute.slice(0, i + 1), { ...job, type: 'job'}, ...currentRoute.slice(i + 1)];
                        if (isRouteFeasible(tempRoute, matrix, allPoints)) {
                            bestInsertion = { cost, jobId: job.id, techId: tech.id, insertIndex: i + 1 };
                        }
                    }
                }
            }
        }

        if (bestInsertion.jobId) {
            const jobToInsert = unassignedJobs.find(j => j.id === bestInsertion.jobId);
            const assignment = assignments.get(bestInsertion.techId);
            assignment.route.splice(bestInsertion.insertIndex, 0, { ...jobToInsert, type: 'job'});
            unassignedJobs = unassignedJobs.filter(j => j.id !== bestInsertion.jobId);
        } else {
            console.error("Could not assign all jobs. Remaining:", unassignedJobs.map(j => j.id));
            break;
        }
    }
    console.log("Phase 1: Construction complete.");

    // ==============================================================================
    // PHASE 2: REFINEMENT (Polish the routes with 2-Opt swaps)
    // ==============================================================================
    console.log("Phase 2: Refining routes with 2-Opt swaps...");

    assignments.forEach(assignment => {
        let improvementMade = true;
        let currentRoute = assignment.route;
        
        // Keep iterating until no more improvements can be found
        while (improvementMade) {
            improvementMade = false;
            let bestRoute = [...currentRoute];
            let bestDuration = calculateRouteDuration(bestRoute, matrix, allPoints);

            // We only consider swapping jobs, so we ignore start (i=0) and end points.
            for (let i = 1; i < currentRoute.length - 2; i++) {
                for (let j = i + 1; j < currentRoute.length - 1; j++) {
                    // Create a new route by performing the 2-Opt swap (uncrossing)
                    const newRoute = twoOptSwap(currentRoute, i, j);
                    
                    // Check if the new route is both shorter and still feasible
                    const newDuration = calculateRouteDuration(newRoute, matrix, allPoints);
                    if (newDuration < bestDuration && isRouteFeasible(newRoute, matrix, allPoints)) {
                        bestDuration = newDuration;
                        bestRoute = newRoute;
                        improvementMade = true;
                    }
                }
            }
            currentRoute = bestRoute;
        }
        assignment.route = currentRoute; // Update with the refined route
    });
    console.log("Phase 2: Refinement complete.");

    // ==============================================================================
    // FINAL FORMATTING
    // ==============================================================================
    const finalTripSheets = [];
    assignments.forEach(sheet => {
        const finalRoute = sheet.route.filter(stop => stop.type === 'job');
        if (finalRoute.length > 0) {
            finalTripSheets.push({
                technicianId: sheet.technicianId,
                technicianName: sheet.technicianName,
                route: finalRoute.map(({ id, address, customer, timeSlot }) => ({ id, address, customer, timeSlot })) // Clean up the object
            });
        }
    });

    console.log("Algorithm finished successfully.");
    return finalTripSheets;
};


// ==================================================================================
// HELPER FUNCTIONS
// ==================================================================================

/**
 * Calculates the additional travel time from inserting a job between two stops.
 */
const calculateInsertionCost = (prevStop, nextStop, jobToInsert, matrix, allPoints) => {
    const prevIndex = allPoints.findIndex(p => p.id === prevStop.id);
    const nextIndex = allPoints.findIndex(p => p.id === nextStop.id);
    const jobIndex = allPoints.findIndex(p => p.id === jobToInsert.id);

    // Get travel durations from the matrix (origin rows, destination columns)
    const timePrevToJob = matrix.rows[prevIndex].elements[jobIndex].duration.value;
    const timeJobToNext = matrix.rows[jobIndex].elements[nextIndex].duration.value;
    const timePrevToNext = matrix.rows[prevIndex].elements[nextIndex].duration.value;

    return (timePrevToJob + timeJobToNext) - timePrevToNext;
};

/**
 * Calculates the total travel duration for an entire route.
 */
const calculateRouteDuration = (route, matrix, allPoints) => {
    let totalDuration = 0;
    for (let i = 0; i < route.length - 1; i++) {
        const originIndex = allPoints.findIndex(p => p.id === route[i].id);
        const destIndex = allPoints.findIndex(p => p.id === route[i + 1].id);
        totalDuration += matrix.rows[originIndex].elements[destIndex].duration.value;
    }
    return totalDuration;
};

/**
 * Performs a 2-Opt swap on a route. This takes a segment of the route
 * and reverses it, effectively "uncrossing" the path.
 * Example: [Start, A, B, C, D, End] with i=1, j=3 becomes [Start, A, C, B, D, End]
 */
const twoOptSwap = (route, i, j) => {
    const newRoute = [...route.slice(0, i)];
    newRoute.push(...route.slice(i, j + 1).reverse());
    newRoute.push(...route.slice(j + 1));
    return newRoute;
};

/**
 * Checks if a proposed route is feasible regarding time windows.
 * This is the critical "rule checker" for the algorithm.
 */
const isRouteFeasible = (route, matrix, allPoints) => {
    const AVERAGE_SERVICE_DURATION = 3600; // 1 hour in seconds
    const DAY_START_TIME = 8 * 3600; // 8:00 AM in seconds from midnight
    let currentTime = DAY_START_TIME;

    const timeWindowToSeconds = (slot) => {
        if (!slot) return { start: 0, end: Infinity }; // Should not happen for jobs
        const parts = slot.toLowerCase().match(/(\d{1,2})am to (\d{1,2})pm/);
        if (!parts) return { start: 0, end: Infinity }; // Fallback for bad data
        const startHour = parseInt(parts[1]);
        const endHour = parseInt(parts[2]);
        const start = (startHour === 12 ? 12 : startHour) * 3600; // 12am is 0, but we assume 12pm
        const end = (endHour === 12 ? 12 : endHour + 12) * 3600; // Convert pm to 24h
        return { start, end };
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
            
            // If we arrive before the window opens, we must wait.
            currentTime = Math.max(currentTime, window.start);

            // If the earliest we can START service is after the window closes, it's impossible.
            if (currentTime > window.end) return false;

            // Add service time
            currentTime += AVERAGE_SERVICE_DURATION;
        }
    }
    return true; // The entire route is valid.
};

// This line makes the function available for the Google Cloud Functions runtime.
exports.generateOptimizedTripSheets = generateOptimizedTripSheets;
