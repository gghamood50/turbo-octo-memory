const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { Firestore, Timestamp } = require('@google-cloud/firestore');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const twilio = require('twilio');

admin.initializeApp();

const firestore = new Firestore();
const secretManagerClient = new SecretManagerServiceClient();

// Define the full resource names for the secrets
const TWILIO_SID_SECRET_NAME = 'projects/216681158749/secrets/twilio-account-sid/versions/latest';
const TWILIO_TOKEN_SECRET_NAME = 'projects/216681158749/secrets/twilio-auth-token/versions/latest';
const TWILIO_PHONE_SECRET_NAME = 'projects/216681158749/secrets/twilio-phone-number/versions/latest';

exports['send-manual-scheduling-links'] = onRequest({ cors: true }, async (req, res) => {
    // Add this log to see the request body for debugging
    console.log("--- DEBUGGING: 'send-manual-scheduling-links' function triggered. Body: ", req.body);

    try {
        const { jobId } = req.body; // Destructure jobId from the request body
        let jobsSnapshot;

        if (jobId) {
            // If a specific jobId is provided, fetch only that job
            console.log(`DEBUGGING: Processing single job with ID: ${jobId}`);
            const jobDoc = await firestore.collection('jobs').doc(jobId).get();
            if (!jobDoc.exists) {
                console.error(`DEBUGGING: Job with ID ${jobId} not found.`);
                res.status(404).send({ message: "Job not found." });
                return;
            }
            // Create a snapshot-like object to maintain a consistent structure
            jobsSnapshot = {
                empty: false,
                size: 1,
                docs: [jobDoc],
                forEach: (callback) => [jobDoc].forEach(callback)
            };
        } else {
            // If no jobId is provided, fetch all jobs needing scheduling (original behavior)
            console.log("DEBUGGING: No specific jobId provided. Fetching all jobs with 'Needs Scheduling' status.");
            const jobsToProcessQuery = firestore.collection('jobs').where('status', '==', 'Needs Scheduling');
            jobsSnapshot = await jobsToProcessQuery.get();
        }

        if (jobsSnapshot.empty) {
            console.log("DEBUGGING: No jobs found to process.");
            res.status(200).send({ message: "No jobs needed a scheduling link." });
            return;
        }
        console.log(`DEBUGGING: Found ${jobsSnapshot.size} job(s) to process.`);

        // Securely fetch Twilio credentials
        const [sidVersion] = await secretManagerClient.accessSecretVersion({ name: TWILIO_SID_SECRET_NAME });
        const [tokenVersion] = await secretManagerClient.accessSecretVersion({ name: TWILIO_TOKEN_SECRET_NAME });
        const [phoneVersion] = await secretManagerClient.accessSecretVersion({ name: TWILIO_PHONE_SECRET_NAME });

        const accountSid = sidVersion.payload.data.toString('utf8');
        const authToken = tokenVersion.payload.data.toString('utf8');
        const twilioPhoneNumber = phoneVersion.payload.data.toString('utf8');
        
        // --- NEW: Log credentials for verification (temporary) ---
        console.log(`DEBUGGING: Initializing Twilio with Account SID: ${accountSid}`);
        
        const twilioClient = twilio(accountSid, authToken);

        const promises = [];
        const batch = firestore.batch();

        jobsSnapshot.forEach(doc => {
            const jobData = doc.data();
            const jobId = doc.id;

            if (jobData.phone) {
                console.log(`DEBUGGING: Preparing to send SMS for job ID: ${jobId} to number: ${jobData.phone}`);
                const schedulingUrl = `https://safewayos2.firebaseapp.com/scheduling.html?jobId=${jobId}`;
                const messageBody = `Hello ${jobData.customer || 'Valued Customer'}, this is Safeway Garage Solutions. Please use this link to schedule your service appointment: ${schedulingUrl}`;

                const smsPromise = twilioClient.messages.create({
                    body: messageBody,
                    from: twilioPhoneNumber,
                    to: jobData.phone
                }).then(message => {
                    // --- NEW: Log success for each specific message ---
                    console.log(`DEBUGGING: Twilio reported SUCCESS for job ${jobId}. Message SID: ${message.sid}`);
                    const jobRef = firestore.collection('jobs').doc(jobId);
                    batch.update(jobRef, { status: "Link Sent!" });
                }).catch(err => {
                    // --- NEW: Log the specific error from Twilio ---
                    console.error(`DEBUGGING: Twilio reported an ERROR for job ${jobId}. Error: ${err.message}`);
                });

                promises.push(smsPromise);
            } else {
                console.log(`DEBUGGING: Skipping job ID: ${jobId} because it has no phone number.`);
            }
        });

        console.log(`DEBUGGING: Attempting to process ${promises.length} SMS promises.`);
        await Promise.all(promises);
        await batch.commit();

        const successMessage = `Function finished. Processed ${promises.length} potential jobs. Check logs for individual Twilio success or failure messages.`;
        console.log(successMessage);
        res.status(200).send({ message: successMessage });

    } catch (error) {
        console.error("DEBUGGING: A critical error occurred in the main function body:", error);
        res.status(500).send({ message: "An internal error occurred.", error: error.message });
    }
});
