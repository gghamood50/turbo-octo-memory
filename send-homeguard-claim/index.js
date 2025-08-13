/**
 * This is a standalone Google Cloud Function designed to be triggered via HTTP.
 * It sends a warranty claim email for Home Guard and updates the corresponding
 * invoice document's status in the 'invoices' collection.
 *
 * @requires @google-cloud/firestore - To update invoice status.
 * @requires @google-cloud/secret-manager - To securely access the SendGrid API key.
 * @requires @sendgrid/mail - The official SendGrid library for sending emails.
 * @requires node-fetch - To download the PDF from the Cloud Storage URL.
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { Firestore, FieldValue } = require('@google-cloud/firestore'); // Import FieldValue
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const sgMail = require('@sendgrid/mail');
const fetch = require('node-fetch');

// --- INITIALIZE SHARED CLIENTS ---
if (!admin.apps.length) {
  admin.initializeApp();
}
const firestore = new Firestore();
const secretManagerClient = new SecretManagerServiceClient();

/**
 * Helper function to retrieve the SendGrid API Key from Secret Manager.
 * Caches the key to avoid multiple calls on warm instances.
 * @returns {Promise<string>} The SendGrid API key.
 */
let sendGridApiKey = null;
const getSendGridApiKey = async () => {
    if (sendGridApiKey) {
        return sendGridApiKey;
    }
    const name = 'projects/216681158749/secrets/sendgrid-api-key/versions/latest';
    try {
        const [version] = await secretManagerClient.accessSecretVersion({ name });
        sendGridApiKey = version.payload.data.toString('utf8');
        return sendGridApiKey;
    } catch (error) {
        console.error("FATAL: Could not retrieve SendGrid API Key from Secret Manager.", error);
        throw new Error("API Key configuration error.");
    }
};

/**
 * CORRECTED HELPER FUNCTION
 * Updates the status of a specific invoice document directly in the 'invoices' collection.
 * @param {string} invoiceId - The document ID of the invoice to update.
 * @param {string} newStatus - The new status to set (e.g., 'Claimed', 'Failed').
 * @param {string|null} error - An optional error message to store if the status is 'Failed'.
 * @returns {Promise<void>}
 */
const updateInvoiceStatusInDB = async (invoiceId, newStatus, error = null) => {
    // CORRECTED: Reference the 'invoices' collection directly.
    const invoiceRef = firestore.collection('invoices').doc(invoiceId);
    
    try {
        const updateData = {
            status: newStatus
        };

        if (error) {
            updateData.errorReason = error;
        } else {
            // Use FieldValue.delete() to remove any previous error on success.
            updateData.errorReason = FieldValue.delete();
        }

        await invoiceRef.update(updateData);
        console.log(`Successfully updated status for invoice doc ${invoiceId} to "${newStatus}".`);

    } catch (err) {
        console.error(`Error updating status for invoice doc ${invoiceId} in DB:`, err);
        throw new Error(`Failed to update invoice status in Firestore for invoice doc ${invoiceId}.`);
    }
};


/**
 * An HTTP-triggered Cloud Function to send a warranty claim email with a PDF attachment.
 */
exports.sendHomeGuardClaim = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send({ message: 'Method Not Allowed' });
    }

    // CORRECTED: The variable 'warrantyId' from the frontend is actually the 'invoiceId'.
    // Renaming for clarity.
    const { warrantyId: invoiceId, invoiceNumber, claimsEmail, pdfUrl } = req.body;

    // --- Input Validation ---
    if (!invoiceId || !invoiceNumber || !claimsEmail || !pdfUrl) {
        const missing = [
            !invoiceId && 'invoiceId (sent as warrantyId)',
            !invoiceNumber && 'invoiceNumber',
            !claimsEmail && 'claimsEmail',
            !pdfUrl && 'pdfUrl'
        ].filter(Boolean).join(', ');
        return res.status(400).send({ message: `Bad Request: Missing required fields: ${missing}` });
    }

    try {
        // --- Download PDF from Cloud Storage URL ---
        console.log(`Downloading PDF from: ${pdfUrl}`);
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) {
            throw new Error(`Failed to download PDF from storage. Status: ${pdfResponse.statusText}`);
        }
        const pdfBuffer = await pdfResponse.buffer();
        const pdfBase64 = pdfBuffer.toString('base64');
        console.log(`Successfully downloaded and encoded PDF for invoice #${invoiceNumber}.`);

        // --- Initialize SendGrid ---
        const apiKey = await getSendGridApiKey();
        sgMail.setApiKey(apiKey);

        // --- Construct the Email ---
        const msg = {
            to: claimsEmail,
            from: {
                email: 'safewayoperationsystem@gmail.com', // IMPORTANT: Replace with your verified SendGrid sender email.
                name: 'Safeway Garage Solutions'
            },
            subject: `Warranty Claim Submission: Invoice #${invoiceNumber}`,
            text: `This is an automated claim submission. Please find the attached invoice for your review. Invoice Number: ${invoiceNumber}.`,
            html: `<p>Hello,</p><p>This is an automated claim submission. Please find the attached invoice (#${invoiceNumber}) for your review.</p><p>Thank you,</p><p>Safeway Garage Solutions</p>`,
            attachments: [
                {
                    content: pdfBase64,
                    filename: `invoice-${invoiceNumber}.pdf`,
                    type: 'application/pdf',
                    disposition: 'attachment',
                },
            ],
        };

        // --- Send the Email and Update Status ---
        await sgMail.send(msg);
        console.log(`Email sent successfully for invoice #${invoiceNumber}.`);

        // CORRECTED: Pass the invoiceId to the updated helper function.
        await updateInvoiceStatusInDB(invoiceId, 'Claimed');

        res.status(200).send({ message: `Successfully sent and claimed invoice #${invoiceNumber}.` });

    } catch (error) {
        console.error(`Failed to process claim for invoice #${invoiceNumber}:`, error);

        try {
            // CORRECTED: Pass the invoiceId to the updated helper function on failure.
            await updateInvoiceStatusInDB(invoiceId, 'Failed', error.message);
        } catch (dbError) {
             console.error(`CRITICAL: Failed to send email AND failed to update status to 'Failed' for invoice #${invoiceNumber}. DB Error:`, dbError);
        }

        res.status(500).send({ message: `Internal Server Error: ${error.message}` });
    }
});
