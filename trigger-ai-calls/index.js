const admin = require("firebase-admin");
const express = require('express');
const app = express();

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

    // 4. Use a batch write to update the documents.
    const batch = db.batch();
    snapshot.forEach(doc => {
      const jobRef = db.collection("jobs").doc(doc.id);
      batch.update(jobRef, { status: "Trigger call" });
    });

    await batch.commit();

    // 5. Log the result and send a success response.
    const count = snapshot.size;
    console.log(`Updated ${count} job(s) to 'Trigger call'.`);
    res.status(200).send(`OK: Updated ${count} job(s).`);

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
