/**
 * This Google Cloud Function is triggered via HTTP POST request.
 * It is designed to send one or more invoices as PDF attachments to a customer.
 *
 * @requires @google-cloud/secret-manager - To securely access the SendGrid API key.
 * @requires @sendgrid/mail - The official SendGrid library for sending emails.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const sgMail = require('@sendgrid/mail');

// --- INITIALIZE SHARED CLIENTS ---
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
    // This is the resource name of the secret in Google Cloud Secret Manager.
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
 * An HTTP-triggered Cloud Function to email invoices to a customer.
 * Expects a POST request with the pendingInvoices array in the body.
 */
exports.sendInvoicesToCustomer = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send({ success: false, message: 'Method Not Allowed' });
    }

    // The body of the request should be the `pendingInvoices` array from the frontend.
    const invoices = req.body;

    // --- Input Validation ---
    if (!Array.isArray(invoices) || invoices.length === 0) {
        return res.status(400).send({ success: false, message: 'Bad Request: Missing invoices array.' });
    }

    const firstInvoice = invoices[0];
    const customerEmail = firstInvoice.customerEmail;
    const customerName = firstInvoice.customerName;

    if (!customerEmail) {
        return res.status(400).send({ success: false, message: 'Bad Request: Customer email is missing from the invoice data.' });
    }

    try {
        // --- Initialize SendGrid ---
        const apiKey = await getSendGridApiKey();
        sgMail.setApiKey(apiKey);

        // --- Prepare Attachments ---
        const attachments = invoices.map(invoice => {
            // The frontend sends the final, non-watermarked PDF data.
            const pdfBase64 = invoice.base64Pdf.startsWith('data:application/pdf;base64,')
                ? invoice.base64Pdf.split(',')[1]
                : invoice.base64Pdf;

            return {
                content: pdfBase64,
                filename: `invoice-${invoice.invoiceNumber}-${invoice.invoiceType}.pdf`,
                type: 'application/pdf',
                disposition: 'attachment',
            };
        });
        
        console.log(`Prepared ${attachments.length} PDF attachment(s) for ${customerEmail}.`);

        // --- Construct the Email ---
        const msg = {
            to: customerEmail,
            from: {
                email: 'safewayoperationsystem@gmail.com', // Verified SendGrid sender
                name: 'Safeway Garage Solutions'
            },
            subject: `Invoices for ${customerName}!`,
            text: "Thank you for choosing Safeway Garage Doors!, Here's your invoices.",
            html: `<p>Hello ${customerName},</p><p>Thank you for choosing Safeway Garage Doors!, Here's your invoices.</p><p>Please find your invoice(s) attached to this email.</p><p>Sincerely,</p><p>The Safeway Garage Solutions Team</p>`,
            attachments: attachments,
        };

        // --- Send the Email ---
        await sgMail.send(msg);
        console.log(`Email sent successfully to ${customerEmail}.`);

        res.status(200).send({ success: true, message: `Successfully sent invoices to ${customerEmail}.` });

    } catch (error) {
        console.error(`Failed to send invoices to ${customerEmail}:`, error);
        
        // Log more detailed error if available from SendGrid
        if (error.response) {
            console.error('SendGrid Error Body:', error.response.body);
        }
        
        res.status(500).send({ success: false, message: `Internal Server Error: ${error.message}` });
    }
});
