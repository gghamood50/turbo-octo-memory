const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');

// Initialize the Firebase Admin SDK
admin.initializeApp();

/**
 * CloudEvent function that triggers on the creation of a new Firestore document in the 'jobs' collection.
 *
 * @param {object} cloudEvent The CloudEvent object.
 * @param {object} cloudEvent.data The data payload from the event.
 */
functions.cloudEvent('sendNewJobNotification', async (cloudEvent) => {
    const { jobId } = cloudEvent.params;
    console.log(`New job document created: ${jobId}`);

    try {
        // Fetch all admin FCM tokens from the 'admin_fcm_tokens' collection.
        const tokensSnapshot = await admin.firestore().collection('admin_fcm_tokens').get();
        if (tokensSnapshot.empty) {
            console.log('No admin FCM tokens found. Exiting function.');
            return;
        }

        const tokens = tokensSnapshot.docs.map(doc => doc.data().token).filter(Boolean);
        if (tokens.length === 0) {
            console.log('Tokens array is empty. Exiting function.');
            return;
        }
        console.log(`Found ${tokens.length} admin tokens to send notification to.`);

        // Construct the FCM message payload.
        const message = {
            notification: {
                title: 'New Job Alert!',
                body: 'A new job just landed!'
            },
            tokens: tokens,
        };

        // Send the multicast message.
        const response = await admin.messaging().sendMulticast(message);
        console.log(`${response.successCount} messages were sent successfully.`);

        // Handle and log any failed messages.
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                    console.error(`Failed to send notification to token: ${tokens[idx]}`, resp.error);
                }
            });
            console.log('List of tokens that caused failures: ' + failedTokens.join(', '));
        }
    } catch (error) {
        console.error('Fatal error sending new job notification:', error);
    }
});
