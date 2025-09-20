const admin = require('firebase-admin');
const { VertexAI } = require('@google-cloud/vertexai');
const { htmlToText } = require('html-to-text');
const express = require('express');
const multer = require('multer');

// --- INITIALIZATION ---
admin.initializeApp();
const firestore = admin.firestore();

const vertexAI = new VertexAI({ 
    project: 'safewayos2', 
    location: 'us-central1' 
});

const generativeModel = vertexAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash'
});

const app = express();
const upload = multer();

const AI_PROMPT = `
### ROLE ###
You are an expert data extraction system for a garage door company.
### TASK ###
Analyze the following email body and extract the job details into a structured JSON object.
### EXTRACTION FIELDS ###
- customer: The full name of the customer.
- address: The complete service address.
- phone: The customer's phone number.
- issue: The description of the problem or reason for the service call.
- warrantyProvider: The name of the warranty company.
- planType: The customer's warranty plan.
- dispatchOrPoNumber: The P.O. number, dispatch number, or claim ID.
### RULES ###
1. If a field is not mentioned, its value must be null.
2. Do not invent information.
3. Clean the extracted data. Remove labels like "Customer:" from the final values.
4. Your entire response MUST be only the JSON object, with no extra text or markdown.
`;

function extractJson(text) {
    const match = text.match(/```json\n([\s\S]*?)\n```|({[\s\S]*})/);
    if (!match) return null;
    try {
        return JSON.parse(match[1] || match[2]);
    } catch (e) {
        return null;
    }
}

// --- MAIN EXPRESS ROUTE ---
app.post('/', upload.any(), async (req, res) => {
    console.log('Received new email webhook from SendGrid.');
    try {
        const emailText = req.body.text;
        const cleanText = htmlToText(emailText, { wordwrap: false });

        if (!cleanText || cleanText.trim() === '') {
            console.log('Webhook received with an empty email body. Acknowledging and skipping.');
            return res.status(200).send('OK: Empty body.');
        }

        const request = {
            contents: [{ role: 'user', parts: [{ text: cleanText }] }],
            systemInstruction: { role: 'system', parts: [{ text: AI_PROMPT }] },
        };
        const result = await generativeModel.generateContent(request);
        const aiResponseText = result.response.candidates[0].content.parts[0].text;

        const jobData = extractJson(aiResponseText);

        if (!jobData) {
            throw new Error(`AI failed to return valid JSON. Raw response: ${aiResponseText}`);
        }

        if (jobData.dispatchOrPoNumber) {
            const jobsRef = firestore.collection('jobs');
            const snapshot = await jobsRef.where('dispatchOrPoNumber', '==', jobData.dispatchOrPoNumber).limit(1).get();
            if (!snapshot.empty) {
                console.log(`Skipping duplicate job with PO# ${jobData.dispatchOrPoNumber}.`);
                return res.status(200).send('OK: Duplicate job.');
            }
        }

        const newJob = {
            ...jobData,
            status: 'Needs Scheduling',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: 'email-sendgrid',
        };
        const docRef = await firestore.collection('jobs').add(newJob);
        console.log(`Successfully created job with ID: ${docRef.id}.`);
        res.status(200).send('OK: Job created successfully.');
    } catch (error) {
        console.error('Failed to process incoming email:', error);
        res.status(200).send('ERROR: See function logs for details.');
    }
});

// --- SERVER STARTUP ---
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
