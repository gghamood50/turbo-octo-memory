// backend/index.js

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const crypto = require("crypto");

/**
 * ---------------------------------------------------------------------------
 * INITIALIZATION
 * ---------------------------------------------------------------------------
 */
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

// Bucket config: default to your requested bucket name.
// NOTE: Use the bucket NAME only (no "gs://", no trailing paths).
const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET || "safewayos2.firebasestorage.app";
const bucket = admin.storage().bucket(storageBucket);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "25mb" })); // large enough for 2 base64 PDFs

/**
 * ---------------------------------------------------------------------------
 * HEALTH CHECK (prevents Cloud Run "didn't listen on PORT" errors)
 * ---------------------------------------------------------------------------
 */
app.get("/", (_req, res) => {
  res.status(200).send({
    ok: true,
    service: "warranty-invoice-uploader",
    bucket: bucket.name,
  });
});

/**
 * ---------------------------------------------------------------------------
 * HELPERS
 * ---------------------------------------------------------------------------
 */
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
  if (!ALLOWED_VARIANTS.has(safeVariant))
    throw new Error('variant must be "CUSTOMER" or "WARRANTY".');

  // Save under: gs://safewayos2.firebasestorage.app/invoices/{jobId}/{invoiceNumber}-{variant}.pdf
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

  // Download URL with token (works with default Firebase Storage rules).
  const encodedPath = encodeURIComponent(filePath);
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

  return { url: downloadUrl, token, path: filePath };
}


async function addInvoiceToCollection({
    jobId,
    variant,
    invoiceId,
    invoiceNumber,
    url,
    filePath,
    filename,
    invoiceData
}) {
    // Merge the provided invoice data with the file metadata
    const docData = {
        ...invoiceData, // Spread all fields from the form
        jobId,
        invoiceId: invoiceId || null,
        invoiceNumber,
        invoiceType: variant, // Overwrite invoiceType to ensure it's 'CUSTOMER' or 'WARRANTY'
        url,
        path: filePath,
        filename,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Remove the base64 PDF from the data before saving to Firestore
    delete docData.base64Pdf;

    // Add a new document with a generated ID to the "invoices" collection.
    await firestore.collection("invoices").add(docData);
}


/**
 * ---------------------------------------------------------------------------
 * ROUTE: Upload one or two PDFs and write to the 'invoices' collection
 * ---------------------------------------------------------------------------
 * Accepts either:
 * - { items: [ { jobId, invoiceId, invoiceNumber, variant, base64Pdf }, ... ] }
 * - { jobId, invoiceId, invoiceNumber, variant, base64Pdf } (single)
 */
app.post("/warranties/upload", async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [req.body];

    if (!items.length) {
      return res.status(400).send({ error: "No items provided." });
    }

    // upfront validation
    for (let i = 0; i < items.length; i++) {
      const item = items[i] || {};
      if (!item.jobId) return res.status(400).send({ error: `Item ${i}: 'jobId' is required.` });
      if (!item.invoiceNumber) return res.status(400).send({ error: `Item ${i}: 'invoiceNumber' is required.` });
      const v = String(item.variant || "").toUpperCase();
      if (!ALLOWED_VARIANTS.has(v)) {
        return res.status(400).send({ error: `Item ${i}: 'variant' must be 'CUSTOMER' or 'WARRANTY'.` });
      }
      if (!item.base64Pdf) return res.status(400).send({ error: `Item ${i}: 'base64Pdf' is required.` });
      if (!item.invoiceData) return res.status(400).send({ error: `Item ${i}: 'invoiceData' is required.` });
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
          const { url, path } = await uploadPdfAndGetUrl(filePath, pdfBuffer);

          // Add a record to the new "invoices" collection
          await addInvoiceToCollection({
            jobId: safeJob,
            variant: safeVariant,
            invoiceId: item.invoiceId || null,
            invoiceNumber: safeNumber,
            url,
            filePath: path,
            filename,
            invoiceData: item.invoiceData || {}, // Pass the full invoice data object here
          });


          return {
            ok: true,
            jobId: safeJob,
            variant: safeVariant,
            invoiceId: item.invoiceId || null,
            invoiceNumber: safeNumber,
            filename,
            path,
            url,
          };
        } catch (e) {
          return { ok: false, index: idx, error: e?.message || String(e) };
        }
      })
    );

    const failed = results.filter(r => !r.ok);
    const succeeded = results.filter(r => r.ok);

    if (succeeded.length === 0) {
      return res.status(500).send({ error: "All uploads failed.", results });
    }

    return res.status(200).send({
      message: "Processed",
      bucket: bucket.name,
      succeeded,
      failed,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).send({
      error: "Internal server error.",
      details: err?.message || String(err),
    });
  }
});

/**
 * ---------------------------------------------------------------------------
 * SERVER STARTUP
 * ---------------------------------------------------------------------------
 */
const port = parseInt(process.env.PORT || "8080", 10);
app.listen(port, () => {
  console.log(`Warranty Invoice API listening on ${port}. Bucket: ${bucket.name}`);
});
