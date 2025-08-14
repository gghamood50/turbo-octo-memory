const express = require("express");
const cors = require("cors");
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

// Bucket config
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "safewayos2.firebasestorage.app";
const bucket = admin.storage().bucket(storageBucket);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "25mb" }));

/**
 * ---------------------------------------------------------------------------
 * HELPERS
 * ---------------------------------------------------------------------------
 */

// --- Email Sending Logic (Merged from send-invoices-to-customer) ---
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

async function sendCustomerEmailWithAttachment(invoiceData) {
    if (!invoiceData || invoiceData.invoiceType !== 'customer' || !invoiceData.base64Pdf) {
        console.log(`Skipping email for invoice #${invoiceData.invoiceNumber} (Type: ${invoiceData.invoiceType}).`);
        return;
    }

    if (!invoiceData.customerEmail) {
        console.warn(`Cannot send email for invoice #${invoiceData.invoiceNumber}: Customer email is missing.`);
        return;
    }

    console.log(`Preparing email for invoice #${invoiceData.invoiceNumber} to ${invoiceData.customerEmail}`);
    await getSendGridApiKey(); // Ensure API key is loaded

    const msg = {
        to: invoiceData.customerEmail,
        from: {
            email: 'safewayoperationsystem@gmail.com', // Your verified SendGrid sender
            name: 'Safeway Garage Solutions'
        },
        subject: `Your Invoice from Safeway Garage Solutions (#${invoiceData.invoiceNumber})`,
        html: `<p>Hello ${invoiceData.customerName},</p><p>Thank you for your business! Please find your invoice attached.</p><p>Sincerely,<br/>The Safeway Garage Solutions Team</p>`,
        attachments: [{
            content: invoiceData.base64Pdf.split(',').pop(), // Remove data URI prefix
            filename: `invoice-${invoiceData.invoiceNumber}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment',
        }],
    };

    try {
        await sgMail.send(msg);
        console.log(`Email sent successfully to ${invoiceData.customerEmail}.`);
    } catch (error) {
        console.error(`Failed to send invoice email to ${invoiceData.customerEmail}:`, error.response?.body || error);
        // We don't throw an error here, because the invoice is already saved.
        // The failure to email should be logged, but not fail the whole operation.
    }
}


// --- PDF and Firestore Logic ---
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
    metadata: {
      contentType: "application/pdf",
      cacheControl: "public, max-age=31536000",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  const encodedPath = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

async function addInvoiceToCollection({ jobId, variant, invoiceNumber, url, filePath, filename, invoiceData }) {
    const docData = {
        ...invoiceData,
        jobId,
        invoiceNumber,
        invoiceType: variant,
        url,
        path: filePath,
        filename,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'Saved', // Set a clear initial status
    };

    // **THE FIX:** Remove ALL base64-encoded PDF data before saving to Firestore.
    delete docData.base64Pdf;
    delete docData.pdfDataURL; // This was the missing line causing the error.

    await firestore.collection("invoices").add(docData);
}

/**
 * ---------------------------------------------------------------------------
 * MAIN ROUTE
 * ---------------------------------------------------------------------------
 */
app.post("/warranties/upload", async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [req.body];
    if (!items.length) {
      return res.status(400).send({ error: "No items provided." });
    }

    // Upfront validation
    for (const item of items) {
      if (!item.jobId || !item.invoiceNumber || !item.variant || !item.base64Pdf || !item.invoiceData) {
        return res.status(400).send({ error: "Each item must have jobId, invoiceNumber, variant, base64Pdf, and invoiceData." });
      }
    }

    const results = await Promise.all(
      items.map(async (item, idx) => {
        try {
          const { safeJob, safeVariant, safeNumber, filename, filePath } = buildFileInfo({
            jobId: item.jobId,
            invoiceNumber: item.invoiceNumber,
            variant: item.variant,
          });

          const pdfBuffer = decodeBase64Pdf(item.base64Pdf);
          const url = await uploadPdfAndGetUrl(filePath, pdfBuffer);

          await addInvoiceToCollection({
            jobId: safeJob,
            variant: safeVariant,
            invoiceNumber: safeNumber,
            url,
            filePath,
            filename,
            invoiceData: item.invoiceData || {},
          });
          
          // After successfully saving, attempt to send the customer email
          await sendCustomerEmailWithAttachment(item.invoiceData);

          return { ok: true, variant: safeVariant, invoiceNumber: safeNumber, url };
        } catch (e) {
          console.error(`Error processing item at index ${idx}:`, e);
          return { ok: false, index: idx, error: e?.message || String(e) };
        }
      })
    );

    const failed = results.filter(r => !r.ok);
    const succeeded = results.filter(r => r.ok);

    if (succeeded.length === 0) {
      return res.status(500).send({ error: "All uploads failed.", results });
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
  console.log(`Warranty Invoice API (with Email) listening on ${port}.`);
});
