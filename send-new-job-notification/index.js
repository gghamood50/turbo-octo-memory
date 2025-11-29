const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * CloudEvent Handler for "google.cloud.firestore.document.v1.created"
 */
functions.cloudEvent('sendNewJobNotification', async (event) => {
  try {
    const eventId = event.id; // Unique ID for this specific trigger event
    const eventRef = db.collection('processed_events').doc(eventId);

    // --- 1. IDEMPOTENCY CHECK (The Protection against Duplicates) ---
    // This ensures that even if the function accidentally runs twice, 
    // the second run will fail this check and stop.
    try {
      await db.runTransaction(async (t) => {
        const doc = await t.get(eventRef);
        if (doc.exists) {
          throw new Error('ALREADY_PROCESSED');
        }
        // Mark as processed with a 24-hour expiration (optional cleanup logic for later)
        t.set(eventRef, {
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          jobPath: event.subject || 'unknown'
        });
      });
    } catch (e) {
      if (e.message === 'ALREADY_PROCESSED') {
        console.log(`Event ${eventId} already processed. Exiting to prevent duplicate notification.`);
        return; 
      }
      throw e; // Rethrow real errors so Google knows to retry if it was a crash
    }

    console.log(`--- Processing Event ${eventId} ---`);

    // --- 2. Extract Job ID ---
    const jobId = event.subject ? event.subject.split('/').pop() : 'UnknownJobId';
    console.log(`Target Job ID: ${jobId}`);

    // --- 3. Fetch Tokens ---
    const snapshot = await db.collection('admin_fcm_tokens').get();

    if (snapshot.empty) {
      console.log('No admin tokens found in Firestore.');
      return; 
    }

    // --- 4. Extract & Deduplicate Tokens ---
    const rawTokens = snapshot.docs
      .map(doc => doc.data().token || doc.get('token'))
      .filter(t => t && typeof t === 'string');

    const uniqueTokens = [...new Set(rawTokens)];

    if (uniqueTokens.length === 0) {
      console.log('No valid token strings found.');
      return;
    }

    console.log(`Sending to ${uniqueTokens.length} unique device(s).`);

    // --- 5. Notification Payload (Visible) ---
    // We use 'notification' so the OS handles display (fixing the 0 notification issue).
    const message = {
      notification: {
        title: 'New Job Alert!',
        body: 'A new job just landed! Check the dashboard.',
      },
      data: {
        jobId: jobId,
        url: '/' // Used by Service Worker to open the app
      },
      tokens: uniqueTokens
    };

    // --- 6. SENDING ---
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log('Batch Send Result:', {
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    // --- 7. Auto-Cleanup Invalid Tokens ---
    if (response.failureCount > 0) {
      const batch = db.batch();
      let hasDeletes = false;
      response.responses.forEach((resp, idx) => {
        if (!resp.success && (
            resp.error.code === 'messaging/registration-token-not-registered' || 
            resp.error.code === 'messaging/invalid-argument')) {
          const badToken = uniqueTokens[idx];
          console.log(`Removing invalid token: ${badToken}`);
          batch.delete(db.collection('admin_fcm_tokens').doc(badToken));
          hasDeletes = true;
        }
      });
      if (hasDeletes) await batch.commit();
    }

  } catch (error) {
    console.error('CRITICAL FAILURE in sendNewJobNotification:', error);
    throw error;
  }
});
