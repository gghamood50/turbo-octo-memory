const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

/**
 * CloudEvent Handler for "google.cloud.firestore.document.v1.created"
 */
functions.cloudEvent('sendNewJobNotification', async (event) => {
  try {
    console.log('--- Fresh Container Started ---');

    // --- 🔍 IDENTITY DEBUG CHECK 🔍 ---
    try {
      const response = await fetch(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email', 
        { headers: { 'Metadata-Flavor': 'Google' } }
      );
      const email = await response.text();
      console.log(`Running as: [ ${email} ]`);
    } catch (e) {
      console.log('Could not verify identity:', e.message);
    }
    // ----------------------------------

    console.log('Event Subject:', event.subject); 

    // 1. Extract Job ID
    const jobId = event.subject ? event.subject.split('/').pop() : 'UnknownJobId';
    console.log(`Target Job ID: ${jobId}`);

    const db = admin.firestore();

    // 2. Fetch Tokens
    const snapshot = await db.collection('admin_fcm_tokens').get();

    if (snapshot.empty) {
      console.log('No admin tokens found in Firestore.');
      return; 
    }

    // 3. Extract & Deduplicate Tokens
    // We use a Set to ensure each token string appears only once.
    const rawTokens = snapshot.docs
      .map(doc => doc.data().token || doc.get('token'))
      .filter(t => t && typeof t === 'string');

    const uniqueTokens = [...new Set(rawTokens)];

    if (uniqueTokens.length === 0) {
      console.log('No valid token strings found.');
      return;
    }

    console.log(`Found ${rawTokens.length} raw tokens. Sending to ${uniqueTokens.length} unique device(s).`);

    // 4. Notification Payload
    const message = {
      data: {
        title: 'New Job Alert!',
        body: 'A new job just landed! Check the dashboard.',
        jobId: jobId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      tokens: uniqueTokens // Use the unique list
    };

    // 5. SENDING
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log('Batch Send Result:', {
      successCount: response.successCount,
      failureCount: response.failureCount
    });

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
    throw error;
  }
});
