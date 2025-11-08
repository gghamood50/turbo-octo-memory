// Cloud Run + Eventarc (Firestore) — CloudEvents handler
const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');

admin.initializeApp();

// Handles Firestore "document created" events for jobs/{jobId}
functions.cloudEvent('sendNewJobNotification', async (event) => {
  try {
    // Useful breadcrumbs in logs
    console.log('Event type:', event.type); // expect: google.cloud.firestore.document.v1.created
    console.log('Subject:', event.subject); // e.g. .../documents/jobs/{jobId}

    // Extract jobId from the subject path if present
    const jobId = (event.subject || '').split('/').pop();
    if (jobId) console.log('New job created:', jobId);

    const db = admin.firestore();

    // Fetch admin tokens
    const snapshot = await db.collection('admin_fcm_tokens').get();
    if (snapshot.empty) {
      console.log('No admin FCM tokens found.');
      return;
    }

    const tokens = snapshot.docs.map(d => d.get('token')).filter(Boolean);
    if (!tokens.length) {
      console.log('No valid tokens in admin_fcm_tokens.');
      return;
    }

    // Send multicast push
    const message = {
      notification: { title: 'New Job Alert!', body: 'A new job just landed!' },
      tokens
    };

    const res = await admin.messaging().sendMulticast(message);
    console.log('Push result:', { successCount: res.successCount, failureCount: res.failureCount });

    if (res.failureCount > 0) {
      const failedTokens = res.responses.map((r, i) => (!r.success ? tokens[i] : null)).filter(Boolean);
      console.log('Failed tokens:', failedTokens);
    }
  } catch (err) {
    console.error('Error handling Firestore event:', err);
  }
});
