const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { Firestore, Timestamp } = require('@google-cloud/firestore');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const twilio = require('twilio');

admin.initializeApp();

const firestore = admin.firestore();
const secretManagerClient = new SecretManagerServiceClient();

// Define the full resource names for the secrets
const TWILIO_SID_SECRET_NAME = 'projects/216681158749/secrets/twilio-account-sid/versions/latest';
const TWILIO_TOKEN_SECRET_NAME = 'projects/216681158749/secrets/twilio-auth-token/versions/latest';
const TWILIO_PHONE_SECRET_NAME = 'projects/216681158749/secrets/twilio-phone-number/versions/latest';

exports['send-manual-scheduling-links'] = onRequest({ cors: true }, async (req, res) => {
    console.log("--- 'send-manual-scheduling-links' function triggered. Body: ", req.body);

    const { jobId, messageType } = req.body;

    // --- Single Job Logic ---
    if (jobId) {
        try {
            console.log(`Processing single job with ID: ${jobId}, messageType: ${messageType}`);
            const jobDoc = await firestore.collection('jobs').doc(jobId).get();
            if (!jobDoc.exists) {
                console.error(`Job with ID ${jobId} not found.`);
                return res.status(404).send({ success: false, message: "Job not found." });
            }

            const jobData = jobDoc.data();
            if (!jobData.phone) {
                console.error(`Job ${jobId} has no phone number.`);
                return res.status(400).send({ success: false, message: "This job does not have a phone number." });
            }

            // Securely fetch Twilio credentials
            const [sidVersion] = await secretManagerClient.accessSecretVersion({ name: TWILIO_SID_SECRET_NAME });
            const [tokenVersion] = await secretManagerClient.accessSecretVersion({ name: TWILIO_TOKEN_SECRET_NAME });
            const [phoneVersion] = await secretManagerClient.accessSecretVersion({ name: TWILIO_PHONE_SECRET_NAME });

            const accountSid = sidVersion.payload.data.toString('utf8');
            const authToken = tokenVersion.payload.data.toString('utf8');
            const twilioPhoneNumber = phoneVersion.payload.data.toString('utf8');
            const twilioClient = twilio(accountSid, authToken);
            
            let messageBody;
            let updateData;

            if (messageType === 'onMyWay') {
                messageBody = `Hey ${jobData.customer || "Valued Customer"} the technician will reach your location in approximately 30 minutes!`;
                updateData = { onMyWayMessageSent: true };
            } else {
                const schedulingUrl = `https://safewayos2.firebaseapp.com/scheduling.html?jobId=${jobId}`;
                messageBody = `Hello ${jobData.customer || 'Valued Customer'}, this is Safeway Garage Solutions. Please use this link to schedule your service appointment: ${schedulingUrl}`;
                updateData = { status: "Link Sent!", linkSentAt: admin.firestore.FieldValue.serverTimestamp() };
            }

            const message = await twilioClient.messages.create({
                body: messageBody,
                from: twilioPhoneNumber,
                to: jobData.phone
            });
            
            console.log(`Twilio reported SUCCESS for job ${jobId}. Message SID: ${message.sid}`);
            
            const jobRef = firestore.collection('jobs').doc(jobId);
            await jobRef.update(updateData);
            
            const successMessage = messageType === 'onMyWay' ? "'On my way!' message sent successfully." : "Scheduling link sent successfully!";
            return res.status(200).send({ success: true, message: successMessage });

        } catch (err) {
            console.error(`A critical error occurred while processing job ${jobId}:`, err);
            if (err.code) { 
                 return res.status(500).send({ success: false, message: `Failed to send SMS: ${err.message}` });
            }
            return res.status(500).send({ success: false, message: "An internal server error occurred." });
        }
    }

    // --- Bulk Sending Logic (Original logic with minor logging improvements) ---
    try {
        console.log("No specific jobId provided. Fetching all jobs with 'Needs Scheduling' status.");
        const jobsToProcessQuery = firestore.collection('jobs').where('status', '==', 'Needs Scheduling');
        const jobsSnapshot = await jobsToProcessQuery.get();

        if (jobsSnapshot.empty) {
            console.log("No jobs found to process in bulk.");
            return res.status(200).send({ success: true, message: "No jobs needed a scheduling link." });
        }
        console.log(`Found ${jobsSnapshot.size} job(s) to process in bulk.`);

        // Securely fetch Twilio credentials
        const [sidVersion] = await secretManagerClient.accessSecretVersion({ name: TWILIO_SID_SECRET_NAME });
        const [tokenVersion] = await secretManagerClient.accessSecretVersion({ name: TWILIO_TOKEN_SECRET_NAME });
        const [phoneVersion] = await secretManagerClient.accessSecretVersion({ name: TWILIO_PHONE_SECRET_NAME });
        
        const accountSid = sidVersion.payload.data.toString('utf8');
        const authToken = tokenVersion.payload.data.toString('utf8');
        const twilioPhoneNumber = phoneVersion.payload.data.toString('utf8');
        const twilioClient = twilio(accountSid, authToken);

        const promises = [];
        const batch = firestore.batch();
        const jobIdsToUpdate = [];

        jobsSnapshot.forEach(doc => {
            const jobData = doc.data();
            const currentJobId = doc.id;

            if (jobData.phone) {
                const schedulingUrl = `https://safewayos2.firebaseapp.com/scheduling.html?jobId=${currentJobId}`;
                const messageBody = `Hello ${jobData.customer || 'Valued Customer'}, this is Safeway Garage Solutions. Please use this link to schedule your service appointment: ${schedulingUrl}`;

                const smsPromise = twilioClient.messages.create({
                    body: messageBody,
                    from: twilioPhoneNumber,
                    to: jobData.phone
                }).then(message => {
                    console.log(`Twilio reported SUCCESS for bulk job ${currentJobId}. Message SID: ${message.sid}`);
                    jobIdsToUpdate.push(currentJobId); // Add to list for batch update on success
                }).catch(err => {
                    console.error(`Twilio reported an ERROR for bulk job ${currentJobId}. Error: ${err.message}`);
                    // We will not add this job to the batch update.
                });
                promises.push(smsPromise);
            } else {
                console.log(`Skipping bulk job ID: ${currentJobId} because it has no phone number.`);
            }
        });

        await Promise.allSettled(promises);

        if (jobIdsToUpdate.length > 0) {
            jobIdsToUpdate.forEach(id => {
                const jobRef = firestore.collection('jobs').doc(id);
                batch.update(jobRef, { status: "Link Sent!", linkSentAt: admin.firestore.FieldValue.serverTimestamp() });
            });
            await batch.commit();
        }

        const successMessage = `Bulk function finished. Successfully sent ${jobIdsToUpdate.length} of ${promises.length} possible links.`;
        console.log(successMessage);
        return res.status(200).send({ success: true, message: successMessage });

    } catch (error) {
        console.error("A critical error occurred in the bulk sending function body:", error);
        return res.status(500).send({ success: false, message: "An internal error occurred during bulk processing.", error: error.message });
    }
});
