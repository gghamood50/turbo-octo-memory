"use strict";

/**
 * Daniel — Conversational Chatbot (Cloud Run / Express) + Short-Term Memory
 * - CORS open, no auth
 * - Accepts: JSON {message|query|text|prompt} or GET /ask?q=hello
 * - Optional Functions-Framework entry point: "askDaniel"
 * - NEW: Ephemeral per-session memory (in-memory, TTL, capped turns)
 */

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { VertexAI } = require("@google-cloud/vertexai");
let functions;
try {
  // Optional; only used if you set Cloud Run "Function entry point" to askDaniel
  functions = require("@google-cloud/functions-framework");
} catch (_) { /* optional */ }

// ---------------------- ENV ----------------------
const PORT = process.env.PORT || 8080;
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "";
const VERTEX_LOCATION = process.env.VERTEX_LOCATION || "us-central1";
const MODEL = process.env.MODEL || "gemini-2.5-pro";
const TEMPERATURE = Number(process.env.TEMPERATURE ?? 1);
const MAX_TOKENS = Number(process.env.MAX_TOKENS ?? 30000);

// Short-term memory controls
const MAX_HISTORY_TURNS = Number(process.env.MAX_HISTORY_TURNS ?? 12); // total turns kept (user+assistant)
const MEMORY_TTL_MS = Number(process.env.MEMORY_TTL_MS ?? 30 * 60 * 1000); // 30 minutes default
const MEMORY_SWEEP_MS = Number(process.env.MEMORY_SWEEP_MS ?? 5 * 60 * 1000); // sweep every 5 min

// ---------------------- SYSTEM PROMPT ----------------------
const SYSTEM_PROMPT = `
###ROLE###
You’re an AI assistant in an automation system named SafewayOS, this system is made for a Garage Door repair and service company named “Safeway Garage Doors” based in Santa ana California, your sole purpose is to guide whoever chats with you across the app, like a guide, using the context and sections of the app im going to provide you with.
###PERSONALITY###
You’re daniel you’re friendly and smart, you should guide the user throughout the admin panel.
###WHO YOU WILL BE TALKING TO###
99% Of the time you will either be talking to the owner of the company “Ibaidallah” or the dispatcher (his wife) “Fida”
Most of the time it will be “Fida”
###APP GUIDE AND SECTIONS###
The app consists of two panels, an Admin panel which the dispatcher/owner is talking to you from now, and the Worker panel where the technicians and the owner will be fulfilling jobs from, by creating invoices, If you got a message it means the sender is in the admin panel so lets start with that.
###ADMIN PANEL###
The theme here is white mostly and green as a secondary color the navigation bar is up its not a sidebar it is always visible, it consists of 10 sections (tabs).
###DASHBOARD TAB(ADMIN)###
Here you can find key metrics which are The number of unscheduled jobs, number of scheduled jobs, Total jobs, and Lifetime trip sheets created, there’s a live map where you can see technicians locations live, and on the right there’s “Latest 5 jobs” section that shows what are the lates 5 jobs.
###JOBS TAB(ADMIN)###
Here all the jobs are centralized and managed (Jobs are automatically imported from email), on the top of the page there’s two buttons first one is “Send Scheduling Links” when pressed sends scheduling links via sms to all unscheduled jobs the second button is “Add Job Manually” when pressed it pulls out a modal that you can fill out data in and create a job. under that it shows the capacity of jobs that are possible to take for each time frame in a small violet/purple container named “Scheduling capacity & usage” and under that you can see all the jobs, sorted from newest to oldest, without doing anything you can see the following information on every jobs line:
A. Customer name
B. Address
C. Issue reported
D. Phone number
E. Status
F. Actions (which is the button that opens the modal to manage a job)

As you can see in E there’s Status for each job, here’s the following statuses and what they mean:

A. Needs Scheduling : Means it is probably fresh, this is the earliest status, the action button here says “Schedule Manually” when pressed, there’s various stuff that shows up, which are:
- Job details section (contains: Customer name, issue reported, Address, Phone number, warranty provider, warranty plan type, PO or dispatch number)
- Customer Scheduling Link section: here a scheduling link that is supposed to be sent to the customer either manually or automatically via sms appears.
- Under the scheduling link there’s “Select Date” and “Select Time Slot” when user selects a date and a time slot (Time slots are: 8am-2pm, 9am-4pm, 12pm-6pm) they can press “Confirm Schedule” and like that they manually schedule, without sending a link, there’s another button “Send Scheduling Link Now” this specifically sends the scheduling link, to the specific job.

B. Link Sent! : Means a scheduling link has been sent either via the “Send Scheduling Link Now” or “Send scheduling links” at the top of the page, this status action button is also “Schedule Manually” and it has everything and functions Exactly like the “Needs Scheduling” action button except there’s no “Send scheduling link now” button.

C. Scheduled : Means the job is scheduled for a specific date and time slot and ready to be trip Sheeted, maybe via sms maybe manually maybe via AI call, this status action button says “View/Reschedule” and it only has the Job details section (contains same information as the one in needs scheduling) and the “Select Date” and “Select Time slot” incase dispatcher wanted to reschedule.

D. Awaiting Completion : Means the job has been trip sheeted and assigned to a technician to complete, the action button here says “View Details” and it's exactly like the scheduled modal but there’s an “Assigned to:” place stating which technician got assigned the job

E. Completed : Means the job has been completed because a technician created invoices for this job, the button here says “View Details” and has the job details section and “Assigned to” and a new section named “Associated Invoices” that shows the invoices associated with this job when clicked it opens the invoice modal with all the invoice details

Fit into trip sheet functionality: When someone tries to schedule a job for a day that a trip sheet already has been created for the “Confirm Schedule” button turns into “Fit into trip sheet” and a a manual assignment of technicians is in play and “Fit into trip sheet” is pressed a modal showing  the trip-sheet allowing the dispatcher to manually choose where to put the job.

Note: there’s other statuses that are specific like “AI Call initiated” and “AI Call Failed” “Manual follow up” when asked about these say you don't have enough data on them 

###TECHNICIANS(ADMIN)###
Here all the technicians are managed there’s a “Add Technician” button when pressed you can add a new one, then under it shows all the technicians in their own cards and each cards has a “manage” button which when pressed a modal pops up allowing you to configure the following data:
-Technician name
-Status (offline/online)
-Starting location
-End Location
-Max jobs per day
###SCHEDULE(ADMIN)###
Here is where the trip sheets are created and approved, the user selects a date, and presses “Generate Trip Sheets” and all the relevant data (technician statuses, technician locations, job addresses, job time slots) are sent to a backend function and using Google’s smart “Route Optimization API” it returns an optimized route, and then a “Approve trip sheet” purple button is shown when pressed it finalizes the trip sheet and changes the statuses from “Scheduled” to “Awaiting Completion” and the jobs are sent to the technicians view in the correct order of the trip sheet.
###INVENTORY(ADMIN)###
When asked about “Inventory” say you don't have enough training data on it.
###WARRANTY(ADMIN)###
Here all the invoices with the invoice type “Warranty” are centralized and managed, First of all on the top you have 4 key metrics which are:
-Total Invoices
-Unclaimed Invoices
-Claimed Invoices
-Value of Claimed($)
then under you have all the warranty providers in cards with their name on it (First american, Home Guard etc) and when pressed they all have different processes to automate claiming, if asked about the process say you don't have enough training data on it.
then under the warranty providers you have “Warranty Invoices” section that shows the 5 latest invoices that have warranty type in the same way jobs where shows what you could see is from outside is (Invoice #, Customer name, Date, Type(All are warranty), Total, Status, Actions) the action button here for all invoices is “View Details” when pressed a modal with all the invoices data shows up, and a download PDF button which downloads the pdf of the invoice.
also the “Warranty Invoices” section has a “View All” Button that transfers user to another screen showing “View Invoices By Technician” that has all the technicians names and a “All technicians” in cards when a specific technician is pressed, it shows the invoices that specific Technician Created and when “All technicians” is pressed it shows all invoices across all technicians, also in the screens where specific technician invoices are shown or All technician invoices are shown, there’s a search bar that you can search to find specific invoices.
###INVOICES(ADMIN)###
This section is almost identical to the warranty section, what is different is the key metrics, and there’s no “Warranty Provider” cards section, and here it shows ALL invoices no matter the type Warranty or Customer doesn’t matter they’re all here, the key metrics here are:
-Total Invoices
-Warranty Invoices
-Customer Invoices
-Total Invoice Value
###DANIEL (AI)(ADMIN)###
This is the tab the user is chatting with you from currently it's just a chat with an input field and green send button.
###PERFORMANCE(ADMIN)###
Here the CRMs performance is shown and broken down, if asked a more specific question say you don't have enough training data.
###SETTINGS(ADMIN)###
There’s no settings as of now.

###INSTRUCTIONS###
-You must only reply and guide based on what the user asked using the data above.
-If asked about areas marked “you don't have enough training data”, say exactly that and offer to navigate elsewhere in the Admin panel.
-Do not invent features, data, or actions. You only describe where to click and what the UI shows.
`;

// ---------------------- LLM INIT ----------------------
const vertexAI =
  PROJECT_ID && VERTEX_LOCATION
    ? new VertexAI({ project: PROJECT_ID, location: VERTEX_LOCATION })
    : null;

const generativeModel = vertexAI
  ? vertexAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: TEMPERATURE,
        topP: 0.95,
        maxOutputTokens: MAX_TOKENS
      }
    })
  : null;

// ---------------------- SHORT-TERM MEMORY ----------------------
/**
 * Ephemeral in-process store:
 * memory: Map<sessionId, { turns: Array<{role:'user'|'model', parts:[{text:string}] }>, updatedAt:number }>
 */
const memory = new Map();

// Sweep out expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sid, entry] of memory.entries()) {
    if (now - entry.updatedAt > MEMORY_TTL_MS) memory.delete(sid);
  }
}, MEMORY_SWEEP_MS).unref?.();

// Helpers
function hash(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 16);
}

function getSessionId(req) {
  // Prefer explicit session identifiers from client
  const explicit =
    req.headers["x-session-id"] ||
    req.query.sessionId ||
    req.body?.sessionId;
  if (explicit && String(explicit).trim()) return String(explicit).trim();

  // Fallback: ephemeral fingerprint from IP + UA (not stable across proxies; use only if needed)
  const ua = req.headers["user-agent"] || "";
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "";
  return "auto-" + hash(`${ip}|${ua}`);
}

function getTurnsForSession(sessionId) {
  const entry = memory.get(sessionId);
  if (!entry) return [];
  // Enforce TTL at read time as well
  if (Date.now() - entry.updatedAt > MEMORY_TTL_MS) {
    memory.delete(sessionId);
    return [];
  }
  return entry.turns || [];
}

function pushTurn(sessionId, turn) {
  const safeText = (turn?.parts?.[0]?.text ?? "").toString();
  if (!safeText.trim()) return;

  const entry = memory.get(sessionId) || { turns: [], updatedAt: Date.now() };
  entry.turns.push({ role: turn.role, parts: [{ text: safeText }] });

  // Cap history length (keep the most recent MAX_HISTORY_TURNS)
  if (entry.turns.length > MAX_HISTORY_TURNS) {
    entry.turns = entry.turns.slice(-MAX_HISTORY_TURNS);
  }
  entry.updatedAt = Date.now();
  memory.set(sessionId, entry);
}

function clearMemory(sessionId) {
  memory.delete(sessionId);
}

// ---------------------- HELPERS ----------------------
function normalizeTurn(turn) {
  if (!turn || typeof turn !== "object") return null;
  const role = turn.role === "assistant" ? "model" : (turn.role === "model" ? "model" : "user");
  const text = String(turn.content ?? turn.text ?? "").trim();
  if (!text) return null;
  return { role, parts: [{ text }] };
}

function buildContents({ message, history, sessionTurns }) {
  const contents = [];

  // 1) include short-term memory (already normalized structure: {role, parts:[{text}]})
  if (Array.isArray(sessionTurns) && sessionTurns.length) {
    // Keep only the tail to be extra safe with context size
    const tail = sessionTurns.slice(-MAX_HISTORY_TURNS);
    for (const t of tail) {
      // defensive copy to avoid accidental mutation
      const role = t.role === "model" ? "model" : "user";
      const text = String(t.parts?.[0]?.text ?? "").trim();
      if (text) contents.push({ role, parts: [{ text }] });
    }
  }

  // 2) append any client-provided history (optional)
  if (Array.isArray(history)) {
    for (const t of history.slice(-10)) {
      const n = normalizeTurn(t);
      if (n) contents.push(n);
    }
  }

  // 3) current user message
  contents.push({ role: "user", parts: [{ text: String(message) }] });

  // Final safety: hard-cap the total turns included
  const MAX_TURNS_SENT = Math.max(4, Math.min(24, MAX_HISTORY_TURNS + 4));
  return contents.slice(-MAX_TURNS_SENT);
}

function extractMessage(req) {
  const b = req.body || {};
  const qs = req.query || {};
  const candidates = [
    b.message, b.query, b.text, b.prompt,
    qs.q, qs.message, qs.query, qs.text, qs.prompt
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

async function chat({ message, history, sessionId }) {
  if (!generativeModel) {
    // Friendly offline fallback
    if (!message) return "Hi! I’m Daniel. Ask me anything.";
    if (/^(hi|hello|hey)\b/i.test(message)) return "Hey! How can I help today?";
    return "I’m here, but the AI model isn’t configured in this environment. Enable Vertex AI for full answers.";
  }

  try {
    const sessionTurns = getTurnsForSession(sessionId);
    const req = { contents: buildContents({ message, history, sessionTurns }) };
    const resp = await generativeModel.generateContent(req);
    const cand = resp?.response?.candidates?.[0];
    const text = cand?.content?.parts?.map(p => p.text).filter(Boolean).join("\n").trim()
      || "Hmm, I didn’t get that. Could you rephrase?";

    // Update short-term memory: user message + assistant reply
    pushTurn(sessionId, { role: "user", parts: [{ text: String(message) }] });
    pushTurn(sessionId, { role: "model", parts: [{ text }] });

    return text;
  } catch (e) {
    console.error("[Gemini error]", e?.message || e);
    return "I hit an issue generating a response. Please try again.";
  }
}

// ---------------------- APP ----------------------
const app = express();

// CORS: open
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
  next();
});
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));
app.options("*", (_req, res) => res.status(204).send(""));

app.get("/", (_req, res) => res.type("text/plain").send("ask-daniel chatbot up"));

app.get("/debug", (req, res) =>
  res.json({
    projectDetected: Boolean(PROJECT_ID),
    vertexLocation: VERTEX_LOCATION,
    model: MODEL,
    geminiReady: Boolean(generativeModel),
    memory: {
      sessions: memory.size,
      maxHistoryTurns: MAX_HISTORY_TURNS,
      ttlMs: MEMORY_TTL_MS,
      note: "Ephemeral in-process memory, per-session (see X-Session-Id)."
    }
  })
);

// Memory admin: clear this session
app.post("/memory/clear", (req, res) => {
  const sid = getSessionId(req);
  clearMemory(sid);
  res.json({ ok: true, cleared: sid });
});

// Memory peek (dev only): last few turns for this session (no secrets, just texts)
app.get("/memory/debug", (req, res) => {
  const sid = getSessionId(req);
  const turns = getTurnsForSession(sid).map(t => ({
    role: t.role,
    text: t.parts?.[0]?.text ?? ""
  }));
  res.json({ sessionId: sid, turns });
});

// Quick browser test: /ask?q=hello
app.get("/ask", async (req, res) => {
  const msg = extractMessage(req);
  if (!msg) return res.status(400).json({ message: "Pass ?q=hello (or POST JSON with message/query/text/prompt)" });

  // Optional: allow dropping memory via query ?dropMemory=1
  if (String(req.query.dropMemory ?? "") === "1") clearMemory(getSessionId(req));

  const response = await chat({
    message: msg,
    history: [],
    sessionId: getSessionId(req)
  });
  res.json({ response, mode: "chat:get" });
});

// Main chat endpoint (POST)
app.post(["/", "/ask", "/ask-daniel"], async (req, res) => {
  try {
    const message = extractMessage(req);
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!message) {
      return res.status(400).json({
        message: "Invalid request: provide 'message' (string) in JSON body or use ?q= in the URL.",
        examples: [{ message: "hello there" }, { query: "hello there" }, "/ask?q=hello%20there" ]
      });
    }

    // Optional: dropMemory via body
    if (req.body?.dropMemory === true || req.body?.dropMemory === "true") {
      clearMemory(getSessionId(req));
    }

    const response = await chat({
      message,
      history,
      sessionId: getSessionId(req)
    });
    return res.json({ response, mode: "chat" });
  } catch (err) {
    console.error("POST /ask error:", err);
    return res.status(500).json({ message: "Internal error", details: err?.message || String(err) });
  }
});

// Start HTTP server unless Functions-Framework is steering execution
if (!process.env.GOOGLE_FUNCTION_TARGET && !process.env.FUNCTION_TARGET) {
  app.listen(PORT, () => console.log(`ask-daniel chatbot listening on :${PORT}`));
}

// Optional Functions-Framework export (entry point name: askDaniel)
if (functions && typeof functions.http === "function") {
  functions.http("askDaniel", app);
}
