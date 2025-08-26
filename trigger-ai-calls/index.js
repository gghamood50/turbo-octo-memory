const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize the Firebase Admin SDK if it hasn't been already.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * A Cloud Function that triggers AI calls for jobs where the link was sent more than an hour ago.
 * This function is scheduled to run every 5 minutes.
 */
exports.triggerAiCalls = functions.pubsub.schedule("every 5 minutes").onRun(async (context) => {
  console.log("Starting trigger-ai-calls function run.");

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
      return null;
    }

    // 4. Use a batch write to update the documents.
    const batch = db.batch();
    snapshot.forEach(doc => {
      const jobRef = db.collection("jobs").doc(doc.id);
      batch.update(jobRef, { status: "Trigger call" });
    });

    await batch.commit();

    // 5. Log the result.
    const count = snapshot.size;
    console.log(`Updated ${count} job(s) to 'Trigger call'.`);

  } catch (error) {
    console.error("Error in trigger-ai-calls function:", error);
  }

  return null;
});
