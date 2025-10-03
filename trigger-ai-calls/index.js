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

  const pathwayId = "616618c3-8ddb-4e78-a77f-c84423286886";
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

// === Quiet-hours configuration (California) ===
// Defaults to 09:00–21:00 America/Los_Angeles. Can be overridden via env for ops flexibility.
const CALL_WINDOW = Object.freeze({
  startHour: Number(process.env.CALL_WINDOW_START_HOUR ?? 9),   // inclusive
  endHour:   Number(process.env.CALL_WINDOW_END_HOUR   ?? 21),  // exclusive
  timeZone: 'America/Los_Angeles',
});

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
  // Quiet-hours guard: block outbound AI calls outside 09:00–21:00 LA time.
  if (!isWithinCallWindowNow(CALL_WINDOW)) {
    const nowLA = formatNowInTZ(CALL_WINDOW.timeZone);
    const hourLA = getLocalHour(CALL_WINDOW.timeZone);
    console.log(
      `[QuietHours] Skipping call placement. Now in LA: ${nowLA} (hour=${hourLA}). ` +
      `Allowed window: ${CALL_WINDOW.startHour}:00–${CALL_WINDOW.endHour}:00 ${CALL_WINDOW.timeZone}.`
    );
    // Optionally, you could mark eligible jobs as "Waiting for Call Window" here,
    // but we intentionally return early to avoid extra reads/writes and costs.
    return res.status(200).send('OK: Quiet hours in California; no calls placed.');
  }

  console.log("Starting trigger-ai-calls job.");

  try {
    // 1. Get the current server timestamp.
    const now = admin.firestore.Timestamp.now();

    // 2. Calculate the cutoff timestamp for one hour ago.
    const oneHourAgo = new admin.firestore.Timestamp(now.seconds - 3600, now.nanoseconds);

    // 3. Query the 'jobs' collection.
    const jobsToUpdateQuery = db.collection("jobs")
      .where("status", "==", "Link Sent!")
      .where("linkSentAt", "<=", oneHourAgo);

    const snapshot = await jobsToUpdateQuery.get();

    if (snapshot.empty) {
      console.log("No jobs found to update.");
      // Always send a success response to the trigger.
      return res.status(200).send("OK: No jobs to update.");
    }

    // 4. Process each job individually.
    const promises = [];
    snapshot.forEach(doc => {
      const jobData = doc.data();
      const jobId = doc.id;
      const jobRef = db.collection("jobs").doc(jobId);

      // The main logic for each job is wrapped in a promise.
      // This allows us to process jobs in parallel and wait for all to complete.
      const processingPromise = (async () => {
        try {
          console.log(`Processing job with ID: ${jobId}`);

          // Step 1: Get API Key and Availability
          const blandAiApiKey = await getBlandApiKey();
          const dateNextDay = getTomorrowInLosAngeles();
          const availability = await getAvailability(dateNextDay);
          const { primary_gap, secondary_gap, final_gap } = availability;

          // Step 2: Construct the payload for Bland AI
          const customer_name = jobData.customer;
          const phone = jobData.phone;
          // Use a test number for the specific customer number, otherwise use the job's phone.
          const phone_to_call = (phone === '+18777804236') ? '+971507471805' : phone;

          const blandAiPayload = {
            customer_name: customer_name,
            date_next_day: dateNextDay,
            primary_gap: primary_gap,
            secondary_gap: secondary_gap,
            final_gap: final_gap,
            callback_num: "+971507471805", // Static callback number
            phone_to_call: phone_to_call,
          };

          // Step 3: Prepare and send the API request
          const blandAiRequest = prepareBlandAiRequest(blandAiApiKey, blandAiPayload);
          const call_id = await sendBlandAiCall(blandAiRequest);

          // Step 4: Update the job with the success status and call ID
          await jobRef.update({
            status: "AI Call Initiated",
            blandCallId: call_id,
          });

          console.log(`Successfully initiated AI call for job ${jobId}. Call ID: ${call_id}`);

        } catch (error) {
          // If any step fails, log the error and update the job status to "AI Call Failed".
          console.error(`Failed to process job ${jobId}:`, error.message);
          await jobRef.update({
            status: "AI Call Failed",
            errorReason: error.message,
          });
        }
      })();
      promises.push(processingPromise);
    });

    // Wait for all job processing promises to settle.
    await Promise.all(promises);

    // 5. Log the result and send a success response.
    const count = snapshot.size;
    console.log(`Attempted to process ${count} job(s).`);
    res.status(200).send(`OK: Attempted to process ${count} job(s). Check logs for details.`);

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
