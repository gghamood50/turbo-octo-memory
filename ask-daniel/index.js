// 1. SETUP: Import necessary libraries
const { onRequest } = require("firebase-functions/v2/https");
const { VertexAI } = require('@google-cloud/vertexai');
const admin = require('firebase-admin');

// 2. INITIALIZATION: Connect to Firebase and Vertex AI
admin.initializeApp();
const db = admin.firestore();

const vertex_ai = new VertexAI({ project: 'safewayos2', location: 'us-central1' });
const model = 'gemini-2.5-pro';

// 3. DEFINE THE AI's TOOL: What the AI is allowed to do
const tools = [{
    functionDeclarations: [{
        name: 'getJobByDispatchNumber',
        description: "Gets all available details for a single job from the Firestore database using its unique dispatch or PO number.",
        parameters: {
            type: 'OBJECT',
            properties: {
                dispatchOrPoNumber: {
                    type: 'STRING',
                    description: 'The dispatch or PO number of the job to find.'
                }
            },
            required: ['dispatchOrPoNumber']
        }
    }]
}];

// 4. DEFINE THE TOOL's LOGIC: The code that runs when the tool is used
const functionHandlers = {
    'getJobByDispatchNumber': async ({ dispatchOrPoNumber }) => {
        console.log(`Firestore Query: Searching for job with dispatch number: ${dispatchOrPoNumber}`);
        try {
            // This assumes your collection is named 'jobs'
            const jobsRef = db.collection('jobs');
            // This assumes the field in your document is named 'dispatchOrPoNumber'
            const snapshot = await jobsRef.where('dispatchOrPoNumber', '==', dispatchOrPoNumber).limit(1).get();

            if (snapshot.empty) {
                return { result: `I couldn't find any job with the dispatch number '${dispatchOrPoNumber}'. Please check the number and try again.` };
            }

            const jobData = snapshot.docs[0].data();
            // Convert Firestore Timestamps to a more readable format if they exist
            // This is a common extra step that improves the AI's response
            for (const key in jobData) {
                if (jobData[key] instanceof admin.firestore.Timestamp) {
                    jobData[key] = jobData[key].toDate().toISOString();
                }
            }
            
            return { result: JSON.stringify(jobData) };

        } catch (error) {
            console.error("Error executing Firestore query:", error);
            return { result: "An unexpected error occurred while searching the database." };
        }
    }
};

// 5. THE MAIN FUNCTION: This is the core of the chatbot backend
exports.askDaniel = onRequest({ cors: true }, async (req, res) => {
    if (req.method === "OPTIONS") {
        res.status(204).send('');
        return;
    }

    try {
        const { query, history = [] } = req.body;
        if (!query) {
            res.status(400).send({ message: "Request body must contain a 'query' field." });
            return;
        }

        const generativeModel = vertex_ai.getGenerativeModel({ model: model, tools: tools });

        const systemPrompt = `You are "Daniel," an AI assistant for a company called Dispatch Geeks. Your purpose is to provide quick and accurate information to the dispatcher about jobs. You are professional and concise. Today's date is ${new Date().toLocaleDateString()}.`;

        const chat = generativeModel.startChat({
            history: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "Understood. I am Daniel, ready to assist with job information." }] },
                ...history
            ]
        });

        const result = await chat.sendMessage(query);
        const functionCalls = result.response.functionCalls;
        const call = functionCalls ? functionCalls[0] : undefined;

        if (call) {
            const handler = functionHandlers[call.name];
            if (handler) {
                const toolResponse = await handler(call.args);
                const functionResponseResult = await chat.sendMessage([{ functionResponse: { name: call.name, response: toolResponse } }],);
                const textResponse = functionResponseResult.response.candidates?.[0]?.content?.parts?.[0]?.text;
                res.status(200).send({ response: textResponse });
            } else {
                res.status(500).send({ message: `Error: AI requested an unknown function: ${call.name}` });
            }
        } else {
            const textResponse = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
            res.status(200).send({ response: textResponse });
        }
    } catch (error) {
        console.error("An error occurred in the askDaniel function:", error);
        res.status(500).send({ message: "Internal Server Error", details: error.message });
    }
});
