const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');
const protobuf = require('protobufjs');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Helper to extract string value from Firestore protobuf field object.
 * After protobuf decode, fields look like: { stringValue: "some text" }
 */
function getStringValue(fieldObj) {
  if (!fieldObj) return undefined;
  return fieldObj.stringValue;
}

/**
 * CloudEvent Handler for "google.cloud.firestore.document.v1.updated"
 */
functions.cloudEvent('statusChangeNotification', async (event) => {
  try {
    const eventId = event.id;
    console.log(`--- Processing Status Change Event ${eventId} ---`);

    // Load and decode protobuf data
    console.log('Loading protos...');
    const root = await protobuf.load('data.proto');
    const DocumentEventData = root.lookupType(
      'google.events.cloud.firestore.v1.DocumentEventData'
    );

    console.log('Decoding data...');
    const firestoreReceived = DocumentEventData.decode(event.data);

    const newValue = firestoreReceived.value;
    const oldValue = firestoreReceived.oldValue;

    if (!newValue || !oldValue) {
      console.log('Invalid event data: missing value or oldValue after decode.');
      return;
    }

    const newFields = newValue.fields || {};
    const oldFields = oldValue.fields || {};

    const newStatus = getStringValue(newFields.status);
    const oldStatus = getStringValue(oldFields.status);

    // 1. Check if status actually changed
    if (newStatus === oldStatus) {
      console.log(`Status did not change (Old: ${oldStatus}, New: ${newStatus}). Skipping.`);
      return;
    }

    console.log(`Status changed from "${oldStatus}" to "${newStatus}"`);

    // 2. Extract Customer Name (Fallback to 'Unknown Customer' if missing)
    const customerName = getStringValue(newFields.customer) || 'Unknown Customer';

    // 3. Extract Job ID from event.subject or newValue.name
    // event.subject looks like: "documents/jobs/JOB_ID"
    // or newValue.name: "projects/PROJECT_ID/databases/(default)/documents/jobs/JOB_ID"
    const subject = event.subject || newValue.name || '';
    const jobId = subject.split('/').pop() || 'UnknownJobId';

    // 4. Fetch Admin Tokens
    const snapshot = await db.collection('admin_fcm_tokens').get();
    if (snapshot.empty) {
      console.log('No admin tokens found in Firestore.');
      return;
    }

    const rawTokens = snapshot.docs
      .map(doc => doc.data().token || doc.get('token'))
      .filter(t => t && typeof t === 'string');

    const uniqueTokens = [...new Set(rawTokens)];

    if (uniqueTokens.length === 0) {
      console.log('No valid token strings found.');
      return;
    }

    // 5. Construct Notification Payload
    const title = 'Status change!';
    const body = `${customerName}'s Job has changed status from ${oldStatus || 'Unknown'} to ${newStatus}`;

    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        jobId: jobId,
        url: '/'
      },
      tokens: uniqueTokens
    };

    console.log(`Sending notification to ${uniqueTokens.length} device(s): "${body}"`);

    // 6. Send Notifications
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log('Batch Send Result:', {
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    // 7. Cleanup Invalid Tokens
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
    console.error('CRITICAL FAILURE in statusChangeNotification:', error);
  }
});
