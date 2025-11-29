const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * CloudEvent Handler for "google.cloud.firestore.document.v1.created"
 * Trigger: tripSheets/{docId}
 */
functions.cloudEvent('sendTripSheetNotification', async (event) => {
  try {
    const eventId = event.id;
    console.log(`Processing Event ${eventId} for sendTripSheetNotification`);

    // The raw Firestore payload is in event.data.value.fields
    // Example: { technicianId: { stringValue: "..." }, date: { stringValue: "2023-10-27" } }
    
    // Check if event data is present and has fields
    const value = event.data && event.data.value;
    const fields = value && value.fields;
    
    if (!fields) {
      console.error('Invalid event data: missing fields');
      return;
    }

    const technicianId = fields.technicianId?.stringValue;
    const dateStr = fields.date?.stringValue; // "YYYY-MM-DD"

    if (!technicianId || !dateStr) {
      console.error('Missing technicianId or date in trip sheet document.');
      return;
    }

    // Format the date: "2023-11-29" -> "November 29th"
    const formattedDate = formatReadableDate(dateStr);

    console.log(`Sending notification to technician ${technicianId} for date ${dateStr} (${formattedDate})`);

    // Query worker tokens by technicianId
    const tokensSnapshot = await db.collection('worker_fcm_tokens')
      .where('technicianId', '==', technicianId)
      .get();

    if (tokensSnapshot.empty) {
      console.log(`No tokens found for technician ${technicianId}.`);
      return;
    }

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(t => t);
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      console.log('No valid tokens to send to.');
      return;
    }

    const payload = {
      notification: {
        title: 'Your Trip-sheet is Ready',
        body: `A Trip-sheet for ${formattedDate} has been sent to you!`
      },
      data: {
        date: dateStr,
        url: '/' // Helper to open the app
      },
      tokens: uniqueTokens
    };

    const response = await admin.messaging().sendEachForMulticast(payload);
    console.log(`Sent ${response.successCount} messages. Failed: ${response.failureCount}`);

    // Cleanup invalid tokens
    if (response.failureCount > 0) {
      const batch = db.batch();
      let hasDeletes = false;
      response.responses.forEach((resp, idx) => {
        if (!resp.success && (
          resp.error.code === 'messaging/registration-token-not-registered' ||
          resp.error.code === 'messaging/invalid-argument'
        )) {
          const badToken = uniqueTokens[idx];
          console.log(`Removing invalid token: ${badToken}`);
          batch.delete(db.collection('worker_fcm_tokens').doc(badToken));
          hasDeletes = true;
        }
      });
      if (hasDeletes) await batch.commit();
    }

  } catch (error) {
    console.error('Error in sendTripSheetNotification:', error);
    // Rethrow to allow Cloud Functions to retry if configured (optional)
    throw error;
  }
});

/**
 * Helper to format date string YYYY-MM-DD to "Month Day(st/nd/rd/th)"
 * e.g., "2023-11-29" -> "November 29th"
 */
function formatReadableDate(dateString) {
  // Use UTC to prevent timezone shifts when parsing "YYYY-MM-DD"
  const [year, month, day] = dateString.split('-').map(Number);
  // Note: Month is 0-indexed in JS Date
  const date = new Date(year, month - 1, day);
  
  const monthName = date.toLocaleString('default', { month: 'long' });
  const dayNum = date.getDate();
  const suffix = getOrdinalSuffix(dayNum);
  
  return `${monthName} ${dayNum}${suffix}`;
}

function getOrdinalSuffix(i) {
  const j = i % 10;
  const k = i % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}
