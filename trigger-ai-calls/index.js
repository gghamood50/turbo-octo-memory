/**
 * Prepares the request object for making a call to the Bland AI API.
 *
 * @param {string} apiKey - The Bland AI API key.
 * @param {object} payload - The JSON object containing dynamic variables for the call.
 * @param {string} [payload.voice] - Optional voice for the call. Defaults to "Nat".
 * @returns {{body: object, headers: object}} An object containing the request body and headers.
 * @throws {Error} Throws an error if the API key or payload is missing, or if the phone number is missing from the payload.
 */
function prepareBlandAiRequest(apiKey, payload) {
  if (!apiKey) {
    throw new Error('API key is required.');
  }
  if (!payload) {
    throw new Error('Payload is required.');
  }
  if (!payload.phone_to_call) {
    throw new Error('Phone number is required in the payload.');
  }

  const pathwayId = "119a6020-e792-4307-8f3f-8020524a5697";
  const voice = payload.voice || "Nat";

  const body = {
    phone_number: payload.phone_to_call,
    pathway_id: pathwayId,
    webhook: 'https://bland-ai-webhook-216681158749.us-central1.run.app',
    request_data: payload,
    voice,
  };

  const headers = {
    'Content-Type': 'application/json',
    'authorization': apiKey,
  };

  console.log(`[Bland] Using voice: ${voice}`);
  return { body, headers };
}

/**
 * Sends a prepared request to the Bland AI API to initiate a call.
 *
 * @param {{body: object, headers: object}} request - The request object containing the body and headers.
 * @returns {Promise<string>} A promise that resolves with the call_id from the API response.
 * @throws {Error} Throws an error if the API call fails or returns a non-successful status.
 */
async function sendBlandAiCall(request) {
  const url = 'https://api.bland.ai/v1/calls';

  try {
    const response = await axios.post(url, request.body, { headers: request.headers });

    // THE FIX IS HERE: Check for status === 'success' instead of a boolean success field.
    if (response.data && response.data.status === 'success') {
      return response.data.call_id;
    } else {
      // Bland AI might return a 200 OK but with a non-success status.
      const errorMessage = response.data.message || 'Bland AI call was not successful.';
      throw new Error(errorMessage);
    }
  } catch (error) {
    // This will catch network errors and errors thrown from the try block.
    // Axios wraps the error, so we check for response data for more specific messages.
    const errorMessage = error.response?.data?.message || error.message;
    console.error('Bland AI API call failed:', errorMessage);
    throw new Error(`Bland AI API call failed: ${errorMessage}`);
  }
}

const admin = require("firebase-admin");
const express = require('express');
const https = require('https');
const axios = require('axios');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const app = express();
const cors = require('cors');

// Allow requests from your web app
const corsOptions = {
  origin: 'https://safewayos2.web.app',
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json()); // Middleware to parse JSON bodies

// === Quiet-hours configuration (California) ===
// Defaults to 09:00–21:00 America/Los_Angeles. Can be overridden via env for ops flexibility.
const CALL_WINDOW = Object.freeze({
  startHour: Number(process.env.CALL_WINDOW_START_HOUR ?? 9),   // inclusive
  endHour:   Number(process.env.CALL_WINDOW_END_HOUR   ?? 21),  // exclusive
  timeZone: 'America/Los_Angeles',
});

// === Caching & concurrency helpers ===
const DEFAULT_CONCURRENCY = Number(process.env.CALL_CONCURRENCY ?? 20);

let _cache = {
  apiKey: null,
  availabilityByDate: new Map(), // date -> availability object
};

async function getApiKeyCached() {
  if (_cache.apiKey) return _cache.apiKey;
  _cache.apiKey = await getBlandApiKey();
  return _cache.apiKey;
}

async function getAvailabilityCached(date) {
  if (_cache.availabilityByDate.has(date)) {
    return _cache.availabilityByDate.get(date);
  }
  const av = await getAvailability(date);
  _cache.availabilityByDate.set(date, av);
  return av;
}

// Simple worker-pool for concurrency limiting (no deps)
async function mapWithConcurrency(items, limit, workerFn) {
  const results = new Array(items.length);
  let idx = 0;
  const workers = Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      results[i] = await workerFn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Returns the current hour (0–23) in the given IANA time zone.
 */
function getLocalHour(timeZone) {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false
  }).format(new Date()));
}

/**
 * Returns a formatted "now" string in the given time zone (for logs).
 */
function formatNowInTZ(timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date());
}

/**
 * True if current local hour is within [startHour, endHour) in the configured time zone.
 */
function isWithinCallWindowNow({ startHour, endHour, timeZone }) {
  const h = getLocalHour(timeZone);
  return h >= startHour && h < endHour;
}

/**
 * Fetches the Bland AI API key from Google Cloud Secret Manager.
 *
 * @returns {Promise<string>} A promise that resolves with the API key as a string.
 * @throws {Error} Throws an error if the secret cannot be accessed or found.
 */
async function getBlandApiKey() {
  const name = 'projects/216681158749/secrets/bland-ai-api-key/versions/latest';
  const client = new SecretManagerServiceClient();

  try {
    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload.data.toString('utf8');
    return payload;
  } catch (error) {
    console.error('Fatal: Could not fetch Bland AI API key from Secret Manager.', error);
    // Re-throw the error to halt execution, as the key is essential.
    throw error;
  }
}

/**
 * Fetches availability for a given date from the availability-checker service.
 * @param {string} date - The date in YYYY-MM-DD format.
 * @returns {Promise<object>} A promise that resolves with the availability data.
 */
function getAvailability(date) {
  return new Promise((resolve, reject) => {
    const url = `https://availability-checker-216681158749.us-central1.run.app?date=${date}`;
    
    https.get(url, (res) => {
      // Check for non-200 status codes
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`Status Code: ${res.statusCode}`));
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse JSON response.'));
        }
      });
      
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Calculates tomorrow's date in the 'America/Los_Angeles' timezone.
 * @returns {string} The date formatted as YYYY-MM-DD.
 */
function getTomorrowInLosAngeles() {
  const now = new Date();
  // Get the date string in the LA timezone (e.g., "8/25/2025").
  const laDateStr = now.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
  // Create a date object representing the start of that day in LA.
  const laDate = new Date(laDateStr);
  // Add one day to get tomorrow.
  laDate.setDate(laDate.getDate() + 1);

  const year = laDate.getFullYear();
  // getMonth() is 0-indexed, so add 1. Pad with '0' if needed.
  const month = (laDate.getMonth() + 1).toString().padStart(2, '0');
  const day = laDate.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// Initialize the Firebase Admin SDK.
// In Cloud Run, it automatically finds the project credentials and ID.
admin.initializeApp();
const db = admin.firestore();

// Create a handler for POST requests, which is what Eventarc sends.
app.post('/', async (req, res) => {
    const { manualTrigger, jobId } = req.body;
    const isEventarc = req.headers['ce-specversion'];

    // If it's a scheduled run (from Eventarc) AND it's a manual trigger, don't run.
    // This prevents accidental runs if the scheduled job isn't disabled.
    if (isEventarc && !manualTrigger) {
        console.log("Skipping scheduled run. This function now only supports manual triggers.");
        return res.status(200).send("OK: Scheduled run skipped.");
    }
    
  // Quiet-hours guard: block outbound AI calls outside 09:00–21:00 LA time.
  if (!isWithinCallWindowNow(CALL_WINDOW)) {
    const nowLA = formatNowInTZ(CALL_WINDOW.timeZone);
    const hourLA = getLocalHour(CALL_WINDOW.timeZone);
    const message = `[QuietHours] Skipping call placement. Now in LA: ${nowLA} (hour=${hourLA}). Allowed window: ${CALL_WINDOW.startHour}:00–${CALL_WINDOW.endHour}:00 ${CALL_WINDOW.timeZone}.`;
    console.log(message);
    
    // If manually triggered, send a specific error code for the frontend to handle.
    if (manualTrigger) {
        return res.status(429).json({ success: false, message: "Calls cannot be made during quiet hours (9 PM - 9 AM California time)." });
    }
    
    return res.status(200).send('OK: Quiet hours in California; no calls placed.');
  }

  console.log("Starting trigger-ai-calls job.");

  try {
    let snapshot;
    if (jobId) {
         console.log(`Manual trigger for specific job: ${jobId}`);
         const jobDoc = await db.collection("jobs").doc(jobId).get();
         if (!jobDoc.exists) {
             console.log(`Job ${jobId} not found.`);
             return res.status(404).json({ success: false, message: "Job not found" });
         }
         // Construct a fake snapshot-like object (array of docs)
         snapshot = { empty: false, docs: [jobDoc], size: 1 };
    } else {
        // 3. Query the 'jobs' collection for jobs that need scheduling.
        const jobsToUpdateQuery = db.collection("jobs").where("status", "==", "Needs Scheduling");
        snapshot = await jobsToUpdateQuery.get();
    }

    if (snapshot.empty) {
      console.log("No jobs found to update.");
      return res.status(200).json({ message: "No jobs found to update." });
    }

    // Prefetch shared inputs ONCE per run
    const dateNextDay = getTomorrowInLosAngeles();
    const availability = await getAvailabilityCached(dateNextDay);
    const { primary_gap, secondary_gap, final_gap } = availability;
    const blandAiApiKey = await getApiKeyCached();

    const docs = snapshot.docs;

    await mapWithConcurrency(docs, DEFAULT_CONCURRENCY, async (doc) => {
      const currentJobId = doc.id;
      const jobRef = db.collection("jobs").doc(currentJobId);

      // --- Idempotency/lock: take a per-job lock via transaction ---
      const locked = await db.runTransaction(async (t) => {
        const snap = await t.get(jobRef);
        const d = snap.data() || {};
        
        // If jobId was provided explicitly, we bypass the "Needs Scheduling" check
        // But we still check callInProgress to avoid double-firing.
        const isTargeted = (jobId && jobId === currentJobId);
        
        // Only proceed if it's still eligible and not locked
        // Logic: if targeted, ignore status check. if not targeted, require "Needs Scheduling".
        // In ALL cases, require callInProgress !== true.
        
        if (d.callInProgress === true) {
             return false;
        }

        if (!isTargeted && d.status !== "Needs Scheduling") {
            return false;
        }

        t.update(jobRef, {
          callInProgress: true,
          callLockAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
      });

      if (!locked) {
        console.log(`Skip ${jobId}: already processed, not eligible, or locked.`);
        return;
      }

      try {
        console.log(`Processing job with ID: ${jobId}`);

        // Build payload using shared date/availability + per-job data
        const jobData = doc.data();
        const customer_name = jobData.customer;
        const phone = jobData.phone;
        const phone_to_call = (phone === '+18777804236') ? '+971507471805' : phone;
        const warranty_name = jobData.warrantyProvider || null;

        const blandAiPayload = {
          customer_name,
          date_next_day: dateNextDay,
          primary_gap,
          secondary_gap,
          final_gap,
          callback_num: "+971507471805",
          phone_to_call,
          warranty_name,
        };

        const blandAiRequest = prepareBlandAiRequest(blandAiApiKey, blandAiPayload);
        const call_id = await sendBlandAiCall(blandAiRequest);

        await jobRef.update({
          status: "AI Call Initiated",
          blandCallId: call_id,
          callInProgress: false,
          callAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Successfully initiated AI call for job ${jobId}. Call ID: ${call_id}`);
      } catch (error) {
        console.error(`Failed to process job ${jobId}:`, error.message);
        await jobRef.update({
          status: "AI Call Failed",
          errorReason: error.message,
          callInProgress: false,
          callAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    const count = snapshot.size;
    console.log(`Attempted to process ${count} job(s).`);
    res.status(200).json({ message: `Successfully initiated AI calls for ${count} job(s).` });

  } catch (error) {
    console.error("Error in trigger-ai-calls job:", error);
    // Send an error response so the logs show a failure.
    res.status(500).send("Error: See logs for details.");
  }
});

// Cloud Run provides the PORT environment variable.
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`trigger-ai-calls listening on port ${port}`);
});
