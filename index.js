/*
 * index.js
 * Main entry point for all SafewayOS Firebase Cloud Functions.
 * This file exports three independent functions:
 * 1. processWorkOrderEmail: Triggered by Pub/Sub to parse incoming emails.
 * 2. generateTripSheets: An HTTP-triggered function to run the "Smart Dispatcher" routing algorithm.
 * 3. askDaniel: An HTTP-triggered function that powers the AI chatbot with a new, scalable, function-calling approach.
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin'); // Added Firebase Admin SDK

// --- SHARED DEPENDENCIES ---
const { Firestore, Timestamp } = require('@google-cloud/firestore');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { google } = require('googleapis');
const { VertexAI } = require('@google-cloud/vertexai');
const { Client } = require("@googlemaps/google-maps-services-js");
const { BigQuery } = require('@google-cloud/bigquery'); // Added BigQuery

admin.initializeApp(); // Initialize Firebase Admin SDK

// --- INITIALIZE SHARED CLIENTS ---
const firestore = new Firestore();
const bigquery = new BigQuery(); // Initialized BigQuery client
const secretManagerClient = new SecretManagerServiceClient();
const vertex_ai = new VertexAI({ project: 'safewayos2', location: 'us-central1' });


// ========================================================================
// === FUNCTION 1: processWorkOrderEmail =================================
// ========================================================================

const GMAIL_USER_EMAIL = 'safewayoperationsystem@gmail.com';
const CLIENT_ID = '216681158749-06859m3glpepqmm4pt4ncdjdr73uffqd.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REFRESH_TOKEN_SECRET_NAME = 'projects/safewayos2/secrets/gmail-refresh-token/versions/latest';
const PROCESSED_LABEL_NAME = 'Processed';

// Helper function to find text part in email - Elevated and refactored
const findTextPartHelper = (parts, textObj) => {
    for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
            textObj.text = Buffer.from(part.body.data, 'base64').toString('utf8');
            return true;
        } else if (part.parts && findTextPartHelper(part.parts, textObj)) {
            return true;
        }
    }
    return false;
};

const createOAuth2Client = async () => {
    const [version] = await secretManagerClient.accessSecretVersion({ name: REFRESH_TOKEN_SECRET_NAME });
    const refreshToken = version.payload.data.toString('utf8');
    const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    return oAuth2Client;
};

const getEmailBody = (message) => {
    let textObj = { text: '' }; // Use an object to pass by reference

    if (message && message.payload) {
        if (message.payload.mimeType === 'text/plain' && message.payload.body && message.payload.body.data) {
            textObj.text = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
        } else if (message.payload.parts) {
            findTextPartHelper(message.payload.parts, textObj);
        }
    }
    if (!textObj.text && message && message.snippet) {
        textObj.text = message.snippet;
    }
    return textObj.text;
};

const parseEmailWithGemini = async (emailText) => {
    
    const generativeModel = vertex_ai.getGenerativeModel({ model: 'gemini-1.5-flash-preview-0514' }); 
    const prompt = `
        You are a highly-trained data extraction bot for a garage door company. Your sole purpose is to convert unstructured work order emails into a structured JSON object. You are precise and follow instructions perfectly.
        **Instructions:**
        1.  Analyze the "Email Text" below.
        2.  If it is a valid work order, extract the following fields: "customerName", "address", "phoneNumber", "jobDescription", "warrantyProvider", "planType", "dispatchOrPoNumber".
        3.  "dispatchOrPoNumber" may be referred to as "PO Number" or "Dispatch Number". Extract it under the key "dispatchOrPoNumber".
        4.  If any field (including "customerName", "address", "phoneNumber", "jobDescription", "warrantyProvider", "planType", "dispatchOrPoNumber") is missing, its value MUST be \`null\`. Do not invent data.
        5.  Normalize the phone number to the format (XXX) XXX-XXXX if possible.
        6.  If the email is NOT a work order (e.g., it's spam, a marketing email, or a personal conversation), you MUST return a JSON object with a single key: \`{"isWorkOrder": false}\`.
        7.  Your entire response MUST be a single, raw, valid JSON object. Do NOT include any explanatory text, markdown formatting like \`\`\`json\`\`\`, or anything else.
        ---
        **Now, process the following real email:**
        ---
        *Email Text:*
        ---
        ${emailText}
        ---
    `;
    const request = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
    try {
        const result = await generativeModel.generateContent(request); 
        if (!result || !result.response || !result.response.candidates || !result.response.candidates.length ||
            !result.response.candidates[0].content || !result.response.candidates[0].content.parts || !result.response.candidates[0].content.parts.length ||
            !result.response.candidates[0].content.parts[0].text) {
            console.error("Error during AI call or parsing: Malformed response from Gemini.", JSON.stringify(result.response));
            return null;
        }
        const responseText = result.response.candidates[0].content.parts[0].text;
        const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Error during AI call or parsing:", error);
        return null;
    }
};

exports.processWorkOrderEmail = onRequest(async (req, res) => {
    console.log("Function 'processWorkOrderEmail' triggered.");
    try {
        const authClient = await createOAuth2Client();
        const gmail = google.gmail({ version: 'v1', auth: authClient });
        const { data: { labels } } = await gmail.users.labels.list({ userId: 'me' });
        const processedLabel = labels.find(label => label.name === PROCESSED_LABEL_NAME);
        if (!processedLabel) throw new Error(`Label "${PROCESSED_LABEL_NAME}" not found.`);
        
        const { data: { messages } } = await gmail.users.messages.list({ userId: 'me', q: `in:inbox -label:${PROCESSED_LABEL_NAME}`, maxResults: 1 });
        if (!messages || messages.length === 0) {
            console.log('No new, unprocessed emails found.');
            res.status(200).send('No new emails to process.');
            return;
        }
        
        const messageId = messages[0].id;
        const { data: message } = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
        const emailContent = getEmailBody(message);
        if (!emailContent) throw new Error(`Could not extract text content from email ${messageId}.`);
        
        const parsedJob = await parseEmailWithGemini(emailContent);
        if (parsedJob && parsedJob.isWorkOrder === false) {
            console.log(`AI classified email ${messageId} as not a work order. Marking as processed.`);
            await gmail.users.messages.modify({ userId: 'me', id: messageId, requestBody: { addLabelIds: [processedLabel.id] } });
            res.status(200).send('Email was not a work order.');
            return;
        }
        
        if (!parsedJob || !parsedJob.customerName) throw new Error(`AI parsing failed for email ${messageId}.`);
        
        const newJob = {
            customer: parsedJob.customerName,
            address: parsedJob.address || 'Not specified',
            phone: parsedJob.phoneNumber || 'Not specified',
            issue: parsedJob.jobDescription || 'Not specified',
            warrantyProvider: parsedJob.warrantyProvider || null,
            planType: parsedJob.planType || null,
            dispatchOrPoNumber: parsedJob.dispatchOrPoNumber || null,
            status: 'Needs Scheduling',
            timeSlot: '',
            createdAt: Timestamp.now(), // Corrected: Use Firestore Timestamp
            gmailMessageId: messageId
        };
        await firestore.collection('jobs').add(newJob);
        
        await gmail.users.messages.modify({ userId: 'me', id: messageId, requestBody: { addLabelIds: [processedLabel.id] } });
        console.log(`Successfully processed email ${messageId}.`);
        res.status(200).send("Successfully processed email.");
    } catch (error) {
        console.error('An error occurred in processWorkOrderEmail:', error);
        res.status(500).send("Internal Server Error");
    }
});


// ========================================================================
// === NEW FUNCTION: sendwarrantyclaimemail ===============================
// ========================================================================
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const formData = require('form-data');
const Mailgun = require('mailgun.js');

// Helper function to find and update the specific invoice's status in the database
const updateInvoiceStatusInDB = async (warrantyId, invoiceNumber, newStatus, error = null) => {
    const warrantyRef = firestore.collection('warranties').doc(warrantyId);
    try {
        const doc = await warrantyRef.get();
        if (!doc.exists) {
            console.log(`Warranty doc ${warrantyId} not found.`);
            return;
        }

        const warrantyData = doc.data();
        const invoiceIndex = warrantyData.invoices.findIndex(i => i.invoiceNumber === invoiceNumber);
        if (invoiceIndex === -1) {
            console.log(`Invoice #${invoiceNumber} not found in warranty ${warrantyId}.`);
            return;
        }

        // Update the status and add an error message if one exists
        warrantyData.invoices[invoiceIndex].status = newStatus;
        if (error) {
            warrantyData.invoices[invoiceIndex].errorReason = error;
        } else {
            // Clear previous error reason on success
            delete warrantyData.invoices[invoiceIndex].errorReason;
        }
        
        // Write the changes back to Firestore
        return warrantyRef.update({ invoices: warrantyData.invoices });

    } catch(err) {
        console.error(`Error updating status for invoice #${invoiceNumber} in DB:`, err);
    }
};

// This is the main function that triggers when a warranty document is updated
exports.sendwarrantyclaimemail = onDocumentUpdated("warranties/{warrantyId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    const warrantyId = event.params.warrantyId;
    
    // Find which invoice was just changed to "processing"
    let triggeredInvoice = null;

    for (const newInv of newData.invoices) {
        // Find the corresponding invoice in the old data
        const oldInvoice = oldData.invoices.find(oldInv => oldInv.invoiceNumber === newInv.invoiceNumber);
        
        // We trigger if the new status is "processing" AND the old status was NOT "processing"
        if (newInv.status === 'processing' && (!oldInvoice || oldInvoice.status !== 'processing')) {
            triggeredInvoice = newInv;
            break; // Stop after finding the first triggered invoice
        }
    }

    // If no invoice was set to "processing", we don't need to do anything
    if (!triggeredInvoice) {
        return;
    }

    console.log(`Processing claim for invoice #${triggeredInvoice.invoiceNumber}.`);

    // --- TEMPORARY: Hardcoded keys for testing ---
    // ⚠️ WARNING: DO NOT USE IN PRODUCTION. REPLACE WITH SECRET MANAGER.
    const MAILGUN_API_KEY = "287266210d4dfb333ab9d7b3f1e6ae21-03fd4b1a-c2131d38";
    const MAILGUN_DOMAIN = "sandboxe8a77951186845dd89895be04967d32f.mailgun.org";
    // ---------------------------------------------
    
    // Check if the claims email exists on the invoice object
    if (!triggeredInvoice.claimsEmail) {
        const errorMsg = "Claims email is missing from the invoice data.";
        console.error(errorMsg);
        await updateInvoiceStatusInDB(warrantyId, triggeredInvoice.invoiceNumber, 'Failed', errorMsg);
        return;
    }
    
    try {
        const mailgun = new Mailgun(formData);
        const mg = mailgun.client({ username: 'api', key: MAILGUN_API_KEY });

        const emailData = {
            to: triggeredInvoice.claimsEmail,
            from: `Safeway OS Claims <claims@${MAILGUN_DOMAIN}>`,
            subject: `Warranty Claim Submission: Invoice #${triggeredInvoice.invoiceNumber}`,
            text: `This is an automated claim submission. Please process the claim for invoice number: ${triggeredInvoice.invoiceNumber}.`
        };

        await mg.messages.create(MAILGUN_DOMAIN, emailData);
        console.log(`Email sent successfully for invoice #${triggeredInvoice.invoiceNumber}.`);
        
        // If email sends, update status to "Claimed"
        await updateInvoiceStatusInDB(warrantyId, triggeredInvoice.invoiceNumber, 'Claimed');

    } catch (error) {
        console.error(`Failed to send email for invoice #${triggeredInvoice.invoiceNumber}:`, error);
        // If email fails, update status to "Failed" and log the error
        await updateInvoiceStatusInDB(warrantyId, triggeredInvoice.invoiceNumber, 'Failed', error.message);
    }
});

// ========================================================================
// === FIRESTORE-TO-BIGQUERY STREAMING FUNCTIONS ==========================
// ========================================================================

const BIGQUERY_DATASET = 'safeway_os_data';

// ========================================================================
// === FUNCTION 2: generateTripSheets (Unaltered) =========================
// ========================================================================

const mapsClient = new Client({});
const MAPS_API_KEY_SECRET_NAME = 'projects/safewayos2/secrets/google-maps-api-key/versions/latest';

const getMapsApiKey = async () => {
    try {
        const [version] = await secretManagerClient.accessSecretVersion({ name: MAPS_API_KEY_SECRET_NAME });
        return version.payload.data.toString('utf8');
    } catch (error) {
        console.error("FATAL: Could not retrieve Google Maps API Key from Secret Manager.", error);
        throw new Error("API Key configuration error.");
    }
};

const smartDispatcherAlgorithm = (technicians, jobs, matrix) => {
    const assignments = new Map();
    technicians.forEach(tech => assignments.set(tech.id, {
        technicianId: tech.id,
        technicianName: tech.name,
        route: [],
        capacity: tech.maxJobs
    }));

    const unassignedJobIds = new Set(jobs.map(j => j.id));

    console.log("Algorithm Phase 1: Anchoring morning jobs...");
    const morningJobs = jobs.filter(j => j.timeSlot === '8am to 2pm');
    
    morningJobs.forEach(job => {
        let bestFit = { techId: null, duration: Infinity };
        const jobIndex = jobs.findIndex(j => j.id === job.id);

        technicians.forEach((tech, techIndex) => {
            const assignment = assignments.get(tech.id);
            if (assignment.route.length < assignment.capacity) {
                const row = matrix.rows[techIndex];
                if (row && row.elements[jobIndex] && row.elements[jobIndex].duration) {
                    const duration = row.elements[jobIndex].duration.value;
                    if (duration < bestFit.duration) {
                        bestFit = { techId: tech.id, duration };
                    }
                }
            }
        });

        if (bestFit.techId) {
            assignments.get(bestFit.techId).route.push(job);
            unassignedJobIds.delete(job.id);
        }
    });
    console.log("Algorithm Phase 1 Complete.");

    console.log("Algorithm Phase 2: Building routes incrementally...");
    let jobsAssignedInLoop = true;
    while (jobsAssignedInLoop && unassignedJobIds.size > 0) {
        jobsAssignedInLoop = false;
        let bestNextStop = { techId: null, jobId: null, duration: Infinity };

        for (const assignment of assignments.values()) {
            if (assignment.route.length >= assignment.capacity) continue;

            const lastJob = assignment.route.length > 0 ? assignment.route[assignment.route.length - 1] : null;
            const originIndex = lastJob 
                ? technicians.length + jobs.findIndex(j => j.id === lastJob.id)
                : technicians.findIndex(t => t.id === assignment.technicianId);

            for (const jobId of unassignedJobIds) {
                const jobIndex = jobs.findIndex(j => j.id === jobId);
                const row = matrix.rows[originIndex];
                if (row && row.elements[jobIndex] && row.elements[jobIndex].status === 'OK') {
                    if (row.elements[jobIndex].duration.value < bestNextStop.duration) {
                        bestNextStop = { techId: assignment.technicianId, jobId, duration: row.elements[jobIndex].duration.value };
                    }
                }
            }
        }

        if (bestNextStop.jobId) {
            const jobToAdd = jobs.find(j => j.id === bestNextStop.jobId);
            assignments.get(bestNextStop.techId).route.push(jobToAdd);
            unassignedJobIds.delete(bestNextStop.jobId);
            jobsAssignedInLoop = true;
        }
    }
    console.log("Algorithm Phase 2 Complete.");
    
    console.log("Algorithm Phase 3: Performing final chronological sort...");
    const timeSlotOrder = { "8am to 2pm": 1, "9am to 4pm": 2, "12pm to 6pm": 3 };
    const finalTripSheets = [];

    assignments.forEach(sheet => {
        if (sheet.route.length > 0) {
            sheet.route.sort((a, b) => {
                const orderA = timeSlotOrder[a.timeSlot] || 99;
                const orderB = timeSlotOrder[b.timeSlot] || 99;
                return orderA - orderB;
            });
            finalTripSheets.push(sheet);
        }
    });
    console.log("Algorithm Phase 3 Complete.");

    return finalTripSheets;
};


exports.generateTripSheets = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    console.log("Function 'generateTripSheets' triggered.");
    try {
        const mapsApiKey = await getMapsApiKey();

        // **FIXED**: Determine the date for which to generate trip sheets
        let targetDate;
        if (req.body && req.body.date && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)) {
            targetDate = req.body.date;
            console.log(`Received valid target date from request: ${targetDate}`);
        } else {
            const errorMessage = `Invalid or missing date in request body. Expected YYYY-MM-DD format. Body: ${JSON.stringify(req.body)}`;
            console.error(errorMessage);
            return res.status(400).send({ message: errorMessage });
        }
        
        // **FIXED**: Firestore query now correctly filters by status AND the exact scheduledDate
        const jobsQuery = firestore.collection('jobs')
            .where('status', '==', 'Scheduled')
            .where('scheduledDate', '==', targetDate); 
            
        const techsQuery = firestore.collection('technicians').where('status', '==', 'Online');
        
        console.log(`Constructed jobsQuery for scheduledDate: ${targetDate}`);
        const [jobsSnapshot, techsSnapshot] = await Promise.all([jobsQuery.get(), techsQuery.get()]);

        console.log(`Fetched ${jobsSnapshot.size} jobs for date ${targetDate}.`);

        if (jobsSnapshot.empty) {
            const message = `No scheduled jobs found for ${targetDate}.`;
            console.log(message);
            // **IMPROVED**: Also clear any old trip sheets for this date to avoid confusion
            const oldSheetsQuery = firestore.collection('tripSheets').where('date', '==', targetDate);
            const oldSheetsSnapshot = await oldSheetsQuery.get();
            if (!oldSheetsSnapshot.empty) {
                const batch = firestore.batch();
                oldSheetsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                console.log(`Deleted ${oldSheetsSnapshot.size} old trip sheets for ${targetDate}.`);
            }
            return res.status(200).send({ message, tripSheets: [] });
        }

        const fetchedJobDetails = jobsSnapshot.docs.map(doc => ({id: doc.id, scheduledDate: doc.data().scheduledDate, customer: doc.data().customer }));
        console.log(`Details of fetched jobs for ${targetDate}:`, JSON.stringify(fetchedJobDetails, null, 2));

        if (techsSnapshot.empty) {
            const message = "No online technicians available.";
            console.log(message);
            return res.status(400).send({ message });
        }

        const jobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const technicians = techsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const techLocations = technicians.map(t => t.currentLocation);
        const jobLocations = jobs.map(j => j.address);
        
        if (jobLocations.length === 0) {
            const message = `No job locations to route for ${targetDate}.`;
            console.log(message);
            return res.status(200).send({ message, tripSheets: [] });
        }

        const allOrigins = [...techLocations, ...jobLocations];
        const allDestinations = jobLocations;
        
        console.log(`Building full distance matrix for ${targetDate} by batching ${allOrigins.length} origins and ${allDestinations.length} destinations.`);
        const matrixPromises = allOrigins.map(origin => {
            return mapsClient.distancematrix({
                params: {
                    origins: [origin],
                    destinations: allDestinations,
                    key: mapsApiKey,
                    departure_time: 'now'
                }
            });
        });

        const matrixResults = await Promise.all(matrixPromises);
        
        const stitchedMatrix = {
            origin_addresses: matrixResults.flatMap(r => r.data.origin_addresses),
            destination_addresses: matrixResults.length > 0 ? matrixResults[0].data.destination_addresses : [],
            rows: matrixResults.map(r => r.data.rows[0])
        };
        console.log(`Distance Matrix built successfully for ${targetDate}.`);

        const tripSheets = smartDispatcherAlgorithm(technicians, jobs, stitchedMatrix);

        const batch = firestore.batch();
        // **FIXED**: Use targetDate in docId and data payload to ensure correctness
        tripSheets.forEach(sheet => {
            const docId = `${targetDate}_${sheet.technicianId}`;
            const docRef = firestore.collection('tripSheets').doc(docId);
            batch.set(docRef, { ...sheet, date: targetDate, createdAt: Timestamp.now() });
        });
        await batch.commit();

        console.log(`Successfully generated and saved trip sheets for ${targetDate}.`);
        res.status(200).send({ message: `Trip sheets generated successfully for ${targetDate}!`, tripSheets });
    } catch (error) {
        console.error("An error occurred in generateTripSheets:", error);
        res.status(500).send({ message: "Internal Server Error", error: error.message });
    }
});


// ========================================================================
// === FUNCTION 3: askDaniel (Upgraded to BigQuery and Gemini 1.5 Pro) =====
// ========================================================================

const tools = [{
    functionDeclarations: [
        {
            name: 'query_bigquery',
            description: "Executes a GoogleSQL query against the company's BigQuery data warehouse. Use this to answer any questions about jobs, technicians, or inventory. Always use full table names: `safewayos2.safeway_os_data.jobs_raw_latest`, etc.",
            parameters: {
                type: 'OBJECT',
                properties: {
                    sql_query: {
                        type: 'STRING',
                        description: `The GoogleSQL query to execute.
                        
                        **CRITICAL QUERYING RULE:** All job data fields (like 'customer', 'status', 'dispatchOrPoNumber', etc.) are nested within a single STRING column named 'data'. To query any of these fields, you MUST first parse the string with PARSE_JSON() and then extract the value with JSON_VALUE().
                        
                        **CORRECT QUERY EXAMPLE:** "SELECT document_id, data FROM \`safewayos2.safeway_os_data.jobs_raw_latest\` WHERE JSON_VALUE(PARSE_JSON(data), '$.dispatchOrPoNumber') = '096969'"
                        
                        **DO NOT** query fields directly (e.g., "WHERE dispatchOrPoNumber = '096969'"). This will fail. You must use the PARSE_JSON and JSON_VALUE functions as shown in the example.`
                    }
                },
                required: ['sql_query']
            }
        }
    ]
}];

const functionHandlers = {
    'query_bigquery': async ({ sql_query }) => {
        console.log(`Executing query_bigquery: query="${sql_query}"`);
        if (!sql_query || typeof sql_query !== 'string' || sql_query.trim() === "") {
            console.error("Error in query_bigquery: sql_query is missing or invalid.");
            return { result: "Error: SQL query is missing or invalid. Please provide a valid GoogleSQL query string." };
        }
        try {
            const [rows] = await bigquery.query(sql_query);
            // Crucially, stringify the results for the model.
            // Models can sometimes struggle with large, complex JSON objects directly.
            return { result: JSON.stringify(rows) };
        } catch (error) {
            console.error("Error executing BigQuery query:", error);
            // Provide a more informative error message to the model.
            let errorMessage = `Error executing query: ${error.message}`;
            if (error.errors && error.errors.length > 0) {
                errorMessage += ` Details: ${JSON.stringify(error.errors)}`;
            }
            return { result: errorMessage };
        }
    }
};

exports.askDaniel = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    console.log("Function 'askDaniel' triggered with BigQuery and Gemini 1.5 Pro.");
    
    try {
        const { query: userQuery, history: clientHistoryParam = [], view } = req.body;
        if (!userQuery) {
            return res.status(400).send({ message: "Request must contain a 'query' field." });
        }
        
        const systemPromptText = `You are "Daniel," an expert-level AI data analyst for Safeway OS. Your purpose is to serve as a hyper-competent, proactive, and insightful partner to the dispatcher. Your intelligence surpasses that of a human with database access because you can instantly query, correlate, and analyze data while also understanding the nuances of how data is stored and how to overcome its limitations.PRIME DIRECTIVE: The Analyst's MindsetYour primary function is not just to answer questions, but to provide actionable intelligence. Before acting, you will internalize the following protocols. You will not just follow them; you will embody them.I. DATA QUERYING & ANALYSIS PROTOCOLRULE #1: MASTER THE DATA STRUCTUREThis is your most critical instruction. All primary job data is stored within a single JSON STRING column named data. You will NEVER attempt to query fields like customer or dispatchOrPoNumber directly. This will always fail.Your Method: You MUST use the PARSE_JSON() and JSON_VALUE() functions for every query that targets a nested field.Example: ... WHERE JSON_VALUE(PARSE_JSON(data), '$.customer') = 'Value'RULE #2: THINK LIKE A HUMAN, SEARCH LIKE A MACHINEHumans are imprecise. Data is rigid. You will bridge this gap. All text-based searches MUST be flexible and case-insensitive.Your Method: For any user-provided text (like a customer name or address), you MUST wrap both the database field and the user's value in LOWER() and TRIM() functions.Correct Name Search: WHERE LOWER(TRIM(JSON_VALUE(PARSE_JSON(data), '$.customer'))) = LOWER(TRIM('Mohammed Firas'))Failure to do this is a critical error.RULE #3: EMPLOY MULTI-STEP REASONING & PROACTIVE PROBLEM-SOLVINGIf a user's request is ambiguous or fails, you will not simply give up. You will become a proactive problem-solver.Your Method:First Attempt (Broad Search): Execute a flexible search based on the user's initial query (e.g., using LOWER() on the customer's name).If It Fails, Analyze & Pivot: If the first query yields no results, do not just report failure. Hypothesize why it failed and communicate this to the user.Suggest a Specific Alternative: Proactively suggest a more precise search.Example Dialogue:User: "Find the job for Mo Firas."Daniel (Internal Thought): "First, I will try a flexible search for 'mo firas'. If that fails, I will inform the user that an exact match wasn't found and recommend searching by a unique ID."Daniel (Response if failed): "I couldn't find an exact match for a customer named 'Mo Firas'. To ensure I get the right information, could you please provide a more specific identifier, like a dispatch number or job ID?"RULE #4: SYNTHESIZE, DON'T JUST REGURGITATEThe user does not want a raw data dump. They want insights.Your Method: After successfully retrieving data, you will synthesize it into a clear, human-readable summary. You will format your responses for maximum clarity using lists, bolding, and logical grouping of information.II. COMMUNICATION & CONTEXT PROTOCOLPersona: You are Daniel. You are professional, confident, and exceptionally helpful. You never refer to yourself as a large language model.Context is Key: You will always consider the conversation history and the user's current view (${view}) to understand their intent.Today's Date: For any time-sensitive queries, you will use ${new Date().toDateString()} as the current date.By adhering to this comprehensive protocol, you will operate not as a simple chatbot, but as an indispensable analytical mind.`;
        
        const generativeModel = vertex_ai.getGenerativeModel({
            model: 'gemini-1.5-pro-preview-0514', // Model upgraded
            tools: tools
        });
        
        const chatHistoryForSdk = clientHistoryParam.map(h => ({ 
            role: h.role, 
            parts: h.parts && Array.isArray(h.parts) ? h.parts.map(p => ({text: String(p.text || '')})) : [{text: ''}]
        })).filter(h => (h.role === 'user' || h.role === 'model') && h.parts.every(p => typeof p.text === 'string'));

        console.log("Sanitized History for startChat:", JSON.stringify(chatHistoryForSdk, null, 2));

        const chat = generativeModel.startChat({
            history: chatHistoryForSdk 
        });

        let messageToSendString;
        if (chatHistoryForSdk.length === 0 || (chatHistoryForSdk.length === 1 && chatHistoryForSdk[0].role === 'model')) {
            console.log("First user query, prepending system prompt.");
            messageToSendString = systemPromptText + "\n\nUSER QUESTION:\n" + userQuery;
        } else {
            console.log("Follow-up user query.");
            messageToSendString = userQuery;
        }
        
        console.log("Message string being sent to AI:", messageToSendString.substring(0, 200) + "..."); // Log beginning of message
        
        const result = await chat.sendMessage(messageToSendString); 
        
        if (!result || !result.response || !result.response.candidates || !result.response.candidates.length) {
            console.error("Error in askDaniel: AI response missing candidates.", JSON.stringify(result.response, null, 2));
            return res.status(500).send({ message: "AI response error: No candidates found in initial response." });
        }
        
        const candidate = result.response.candidates[0];
        if (candidate.finishReason && !['STOP', 'TOOL_CODE', 'FUNCTION_CALL'].includes(candidate.finishReason)) {
             console.warn(`AI response candidate finished with reason: ${candidate.finishReason}`, JSON.stringify(candidate, null, 2));
             if (candidate.safetyRatings) {
                return res.status(400).send({ message: `AI response blocked or incomplete. Reason: ${candidate.finishReason}`, safetyRatings: candidate.safetyRatings });
             }
             return res.status(500).send({ message: `AI response error: Finished with reason ${candidate.finishReason}.` });
        }

        if (!candidate.content || !candidate.content.parts || !candidate.content.parts.length) {
            console.error("Error in askDaniel: AI response candidate missing content or parts.", JSON.stringify(candidate, null, 2));
            return res.status(500).send({ message: "AI response error: Malformed content in initial response." });
        }

        const firstPart = candidate.content.parts[0];

        if (firstPart.functionCall) {
            const functionCall = firstPart.functionCall;
            const { name, args } = functionCall;

            console.log(`AI wants to call function "${name}" with args:`, args);

            const handler = functionHandlers[name];
            if (!handler) {
                console.error(`Unknown function call requested by AI: ${name}`);
                return res.status(500).send({ message: `Error: AI requested an unknown function: ${name}` });
            }
            
            const toolResponse = await handler(args);
            console.log("Function execution result:", toolResponse);

            const functionResponseResult = await chat.sendMessage([
                { functionResponse: { name: name, response: toolResponse }}
            ]);

            if (!functionResponseResult || !functionResponseResult.response || !functionResponseResult.response.candidates || !functionResponseResult.response.candidates.length) {
                console.error("Error in askDaniel: AI function response missing candidates.", JSON.stringify(functionResponseResult.response, null, 2));
                return res.status(500).send({ message: "AI function response error: No candidates found after tool call." });
            }

            const funcResponseCandidate = functionResponseResult.response.candidates[0];
             if (funcResponseCandidate.finishReason && funcResponseCandidate.finishReason !== 'STOP') {
                console.warn(`AI function response candidate finished with reason: ${funcResponseCandidate.finishReason}`, JSON.stringify(funcResponseCandidate, null, 2));
                 if (funcResponseCandidate.safetyRatings) {
                    return res.status(400).send({ message: `AI response blocked or incomplete after tool. Reason: ${funcResponseCandidate.finishReason}`, safetyRatings: funcResponseCandidate.safetyRatings });
                 }
                return res.status(500).send({ message: `AI function response error: Finished with reason ${funcResponseCandidate.finishReason}.` });
            }

            if (!funcResponseCandidate.content || !funcResponseCandidate.content.parts || !funcResponseCandidate.content.parts.length || !funcResponseCandidate.content.parts[0].text) {
                console.error("Error in askDaniel: AI function response candidate missing text.", JSON.stringify(funcResponseCandidate, null, 2));
                if (funcResponseCandidate.content && funcResponseCandidate.content.parts[0] && funcResponseCandidate.content.parts[0].functionCall) {
                    console.error("Error in askDaniel: AI attempted a chained function call.");
                    return res.status(500).send({ message: "AI response error: Chained function calls are not currently supported."});
                }
                return res.status(500).send({ message: "AI function response error: No text found in response after tool call." });
            }
            
            const finalResponseText = funcResponseCandidate.content.parts[0].text;
            res.status(200).send({ response: finalResponseText });

        } else if (firstPart.text) {
            const textResponse = firstPart.text;
            res.status(200).send({ response: textResponse });
        } else {
            console.error("Error in askDaniel: AI response part has no functionCall and no text.", JSON.stringify(firstPart, null, 2));
            return res.status(500).send({ message: "AI response error: No usable content in initial response." });
        }

    } catch (error) {
        console.error("An error occurred in askDaniel:", error);
        if (error.message && error.message.includes("Vertex AI") && error.details) {
             res.status(500).send({ message: `Vertex AI API Error: ${error.message}`, details: error.details });
        } else if (error.response && error.response.data) { 
            console.error("Underlying HTTP Error Data:", error.response.data);
            res.status(500).send({ message: "Internal Server Error communicating with AI service.", details: error.response.data });
        }
         else {
             console.error("Full error object in askDaniel:", error);
             res.status(500).send({ message: "Internal Server Error", error: error.message ? error.message : "An unknown error occurred." });
        }
    }
});
