const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

/**
 * CloudEvent Handler for "google.cloud.firestore.document.v1.created"
 * This function runs automatically when a new document appears in Firestore.
 */
functions.cloudEvent('sendNewJobNotification', async (event) => {
  try {
    console.log('--- Fresh Container Started ---');
    console.log('Event Type:', event.type);
    console.log('Event Subject:', event.subject); 

    // 1. Extract Job ID from the resource path (e.g. "documents/jobs/JOB_ID_HERE")
    // We do NOT look in req.body because Eventarc sends metadata, not a JSON body.
    const jobId = event.subject ? event.subject.split('/').pop() : 'UnknownJobId';
    console.log(`Target Job ID: ${jobId}`);

    const db = admin.firestore();

    // 2. Fetch Tokens
    // We look in the 'admin_fcm_tokens' collection as per your app setup.
    const snapshot = await db.collection('admin_fcm_tokens').get();

    if (snapshot.empty) {
      console.log('No admin tokens found in Firestore.');
      return; 
    }

    // 3. Filter Valid Tokens
    const tokens = snapshot.docs
      .map(doc => doc.data().token || doc.get('token'))
      .filter(t => t && typeof t === 'string');

    if (tokens.length === 0) {
      console.log('Token documents existed, but contained no valid token strings.');
      return;
    }

    console.log(`Preparing to send to ${tokens.length} device(s).`);

    // 4. Notification Payload
    const message = {
      notification: {
        title: 'New Job Alert!',
        body: 'A new job just landed! Check the dashboard.'
      },
      data: {
        jobId: jobId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      tokens: tokens
    };

    // 5. SENDING (The Critical Fix)
    // We utilize sendEachForMulticast() which avoids the deprecated batch API
    // that causes the "404 /batch" error in the logs.
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log('Batch Send Result:', {
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    // 6. Log specific errors if any failed
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push({
            index: idx,
            error: resp.error.message
          });
        }
      });
      console.log('Failed Delivery Details:', JSON.stringify(failedTokens, null, 2));
    }

  } catch (error) {
    console.error('CRITICAL FAILURE in sendNewJobNotification:', error);
    // Re-throwing ensures Eventarc knows the delivery failed
    throw error;
  }
});
