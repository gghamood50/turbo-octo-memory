const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const crypto = require("crypto");

// --- INITIALIZATION ---
if (!admin.apps.length) {
  admin.initializeApp({
    storageBucket: "safewayos2.firebasestorage.app",
  });
}

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "safewayos2.firebasestorage.app";
const bucket = admin.storage().bucket(storageBucket);

const app = express();
// Use CORS middleware and increase the JSON body limit to handle Base64 images
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// --- HELPERS ---
function decodeBase64Image(dataString) {
  const matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (matches.length !== 3) {
    throw new Error('Invalid input string');
  }
  return {
    type: matches[1],
    data: Buffer.from(matches[2], 'base64')
  };
}

// --- MAIN ROUTE ---
app.post("/upload", async (req, res) => {
  try {
    const { jobId, filename, imageDataUrl } = req.body;

    if (!jobId || !filename || !imageDataUrl) {
      return res.status(400).send({ error: "Missing required fields: jobId, filename, or imageDataUrl." });
    }

    const imageBuffer = decodeBase64Image(imageDataUrl);
    const filePath = `invoice-images/${jobId}/${Date.now()}-${filename}`;
    const token = crypto.randomUUID();

    const file = bucket.file(filePath);

    await file.save(imageBuffer.data, {
      resumable: false,
      metadata: {
        contentType: imageBuffer.type,
        cacheControl: "public, max-age=31536000",
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const encodedPath = encodeURIComponent(filePath);
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

    return res.status(200).send({
      message: "Image uploaded successfully.",
      url: downloadUrl,
    });

  } catch (err) {
    console.error("Critical Upload Error:", err);
    return res.status(500).send({ error: "Internal server error.", details: err?.message || String(err) });
  }
});

// --- SERVER STARTUP ---
const port = parseInt(process.env.PORT || "8080", 10);
app.listen(port, () => {
  console.log(`Invoice Image Upload API listening on ${port}.`);
});
