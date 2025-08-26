const admin = require("firebase-admin");
const express = require('express');
const https = require('https');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const app = express();

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
    const batch = db.batch();
    const promises = [];
    snapshot.forEach(doc => {
      const jobData = doc.data();
      const jobId = doc.id;

      // Add a status update to the batch for this job.
      const jobRef = db.collection("jobs").doc(doc.id);
      batch.update(jobRef, { status: "Trigger call" });

      // The main logic will be wrapped in a promise and added to the promises array.
      const processingPromise = (async () => {
        console.log(`Processing job with ID: ${jobId}`);
        
        const dateNextDay = getTomorrowInLosAngeles();

        // Call the availability checker API and get the gaps.
        const availability = await getAvailability(dateNextDay);
        const { primary_gap, secondary_gap, final_gap } = availability;

        // 4. Construct and log the final JSON payload.
        const customer_name = jobData.customer;
        const phone = jobData.phone;
        const phone_to_call = (phone === '+18777804236') ? '+971507471805' : phone;

        const logPayload = {
          message: "Prepared to call job",
          jobId: jobId,
          blandAiPayload: {
            customer_name: customer_name,
            date_next_day: dateNextDay,
            primary_gap: primary_gap,
            secondary_gap: secondary_gap,
            final_gap: final_gap,
            callback_num: "+971507471805",
            phone_to_call: phone_to_call,
          }
        };

        // Log the final object to the console.
        console.log(JSON.stringify(logPayload, null, 2));
      })();
      promises.push(processingPromise);
    });

    // Wait for all jobs to be processed (i.e., for all logging to complete).
    await Promise.all(promises);

    // Commit the batch update to change the status of all jobs.
    await batch.commit();

    // 5. Log the result and send a success response.
    const count = snapshot.size;
    console.log(`Processed and updated ${count} job(s) to 'Trigger call'.`);
    res.status(200).send(`OK: Processed and updated ${count} job(s).`);

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
