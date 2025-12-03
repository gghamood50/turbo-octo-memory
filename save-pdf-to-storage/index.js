const express = require("express");
const admin = require("firebase-admin");
const crypto = require("crypto");
const sgMail = require('@sendgrid/mail');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

/**
 * ---------------------------------------------------------------------------
 * INITIALIZATION
 * ---------------------------------------------------------------------------
 */
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const secretManagerClient = new SecretManagerServiceClient();
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "safewayos2.firebasestorage.app";
const bucket = admin.storage().bucket(storageBucket);

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }
  next();
});
app.use(express.json({ limit: "25mb" }));

/**
 * ---------------------------------------------------------------------------
 * HELPERS
 * ---------------------------------------------------------------------------
 */

// --- Email Sending Logic ---
let sendGridApiKey = null;
const getSendGridApiKey = async () => {
    if (sendGridApiKey) return sendGridApiKey;
    const name = 'projects/216681158749/secrets/sendgrid-api-key/versions/latest';
    try {
        const [version] = await secretManagerClient.accessSecretVersion({ name });
        sendGridApiKey = version.payload.data.toString('utf8');
        sgMail.setApiKey(sendGridApiKey);
        return sendGridApiKey;
    } catch (error) {
        console.error("FATAL: Could not retrieve SendGrid API Key.", error);
        throw new Error("API Key configuration error.");
    }
};

/**
 * Sends a single email with one or more invoice PDF attachments.
 * @param {Array<object>} invoices - An array of processed invoice objects.
 * Each object must contain customerEmail, customerName, invoiceNumber, and base64Pdf.
 */
async function sendCombinedInvoiceEmail(invoices) {
    if (!invoices || invoices.length === 0) {
        console.log("No invoices provided to send email.");
        return;
    }

    const primaryInvoice = invoices[0];
    const { customerEmail, customerName } = primaryInvoice;

    if (!customerEmail) {
        console.warn(`Cannot send combined email for invoice #${primaryInvoice.invoiceNumber}: Customer email is missing.`);
        return;
    }

    await getSendGridApiKey();

    const attachments = invoices.map(inv => {
        if (!inv.base64Pdf) return null;
        return {
            content: inv.base64Pdf.split(',').pop(),
            filename: `invoice-${inv.invoiceNumber}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment',
        };
    }).filter(Boolean); // Remove any nulls if a PDF was missing

    if (attachments.length === 0) {
        console.warn("No valid PDFs to attach. Skipping email.");
        return;
    }
    
    // CUSTOM DOMAIN FIX: Replace the hardcoded gmail address with your verified SendGrid sender.
    const fromEmail = 'invoices@dispatchgeeks.com'; // <--- IMPORTANT: Use your verified domain email
    const fromName = 'Safeway Garage Solutions';

    const msg = {
        to: customerEmail,
        from: {
            email: fromEmail,
            name: fromName
        },
        subject: `Your Invoice(s) from Safeway Garage Solutions`,
        html: `<p>Hello ${customerName},</p><p>Thank you for your business! Please find your invoice(s) attached.</p><p>Sincerely,<br/>The ${fromName} Team</p>`,
        attachments: attachments,
    };

    try {
        await sgMail.send(msg);
        console.log(`Combined email with ${attachments.length} attachment(s) sent successfully to ${customerEmail}.`);
    } catch (error) {
        console.error(`Failed to send combined invoice email to ${customerEmail}:`, error.response?.body || error);
        // Log but do not throw, as the invoices are already saved.
    }
}


// --- PDF and Firestore Logic (No changes needed here) ---
const ALLOWED_VARIANTS = new Set(["CUSTOMER", "WARRANTY"]);

function decodeBase64Pdf(maybeDataUrl) {
  const str = typeof maybeDataUrl === "string" ? maybeDataUrl : "";
  const base64 = str.includes(",") ? str.split(",").pop() : str;
  return Buffer.from(base64, "base64");
}

function buildFileInfo({ jobId, invoiceNumber, variant }) {
  const safeVariant = String(variant || "").toUpperCase();
  const safeNumber = String(invoiceNumber || "").trim();
  const safeJob = String(jobId || "").trim();
  if (!safeJob) throw new Error("jobId is required.");
  if (!safeNumber) throw new Error("invoiceNumber is required.");
  if (!ALLOWED_VARIANTS.has(safeVariant)) throw new Error('variant must be "CUSTOMER" or "WARRANTY".');
  const filename = `${safeNumber}-${safeVariant}.pdf`;
  const filePath = `invoices/${safeJob}/${filename}`;
  return { safeJob, safeVariant, safeNumber, filename, filePath };
}

async function uploadPdfAndGetUrl(filePath, buffer) {
  const token = crypto.randomUUID();
  const file = bucket.file(filePath);
  await file.save(buffer, {
    resumable: false,
    metadata: { contentType: "application/pdf", cacheControl: "public, max-age=31536000", metadata: { firebaseStorageDownloadTokens: token } },
  });
  const encodedPath = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

async function addInvoiceToCollection({ jobId, variant, invoiceNumber, url, filePath, filename, invoiceData }) {
    const docData = { ...invoiceData, jobId, invoiceNumber, invoiceType: variant, url, path: filePath, filename, createdAt: admin.firestore.FieldValue.serverTimestamp(), status: 'Saved' };
    delete docData.base64Pdf;
    delete docData.pdfDataURL;
    await firestore.collection("invoices").add(docData);
}

/**
 * ---------------------------------------------------------------------------
 * MAIN ROUTE - REVISED LOGIC
 * ---------------------------------------------------------------------------
 */
app.post("/warranties/upload", async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).send({ error: "No invoice items provided." });
    }

    // --- NEW: Process all invoices first, then email ---
    const processedInvoicesForEmail = [];
    const results = [];

    for (const item of items) {
        try {
            if (!item.jobId || !item.invoiceNumber || !item.variant || !item.base64Pdf || !item.invoiceData) {
                throw new Error("An item is missing required fields (jobId, invoiceNumber, variant, base64Pdf, invoiceData).");
            }

            const { safeJob, safeVariant, safeNumber, filename, filePath } = buildFileInfo(item);
            const pdfBuffer = decodeBase64Pdf(item.base64Pdf);
            const url = await uploadPdfAndGetUrl(filePath, pdfBuffer);

            await addInvoiceToCollection({
                jobId: safeJob,
                variant: safeVariant,
                invoiceNumber: safeNumber,
                url,
filePath,
                filename,
                invoiceData: item.invoiceData,
            });

            // Collect data for the combined email
            processedInvoicesForEmail.push({
                ...item.invoiceData,
                base64Pdf: item.base64Pdf // Keep the PDF data for emailing
            });

            results.push({ ok: true, variant: safeVariant, invoiceNumber: safeNumber, url });

        } catch (e) {
            console.error(`Error processing an invoice item:`, e);
            results.push({ ok: false, error: e?.message || String(e) });
        }
    }

    // --- NEW: Send ONE email with all attachments ---
    if (processedInvoicesForEmail.length > 0) {
        await sendCombinedInvoiceEmail(processedInvoicesForEmail);
    }

    const failed = results.filter(r => !r.ok);
    const succeeded = results.filter(r => r.ok);

    if (succeeded.length === 0) {
      return res.status(500).send({ error: "All invoice uploads failed.", results });
    }

    return res.status(200).send({ message: "Processed", succeeded, failed });

  } catch (err) {
    console.error("Critical Upload Error:", err);
    return res.status(500).send({ error: "Internal server error.", details: err?.message || String(err) });
  }
});

/**
 * ---------------------------------------------------------------------------
 * SERVER STARTUP
 * ---------------------------------------------------------------------------
 */
const port = parseInt(process.env.PORT || "8080", 10);
app.listen(port, () => {
  console.log(`IMPROVED Warranty Invoice API listening on ${port}.`);
});
