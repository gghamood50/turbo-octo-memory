// index.js
"use strict";

/**
 * Ask-Daniel backend — Agent Mode
 * - Express server on Cloud Run
 * - CORS per spec
 * - Vertex Gemini 2.5 Pro with function-calling to tools:
 *     - algoliaFindJobs
 *     - algoliaCountScheduledJobs
 *     - getJobByDispatchNumber
 * - Falls back gracefully if Vertex or Algolia are not configured
 */

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const algoliasearch = require("algoliasearch");
const { VertexAI } = require("@google-cloud/vertexai");

// ---------------------- ENV ----------------------
const PORT = process.env.PORT || 8080;
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID || "";
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY || "";
const ALGOLIA_INDEX_JOBS = process.env.ALGOLIA_INDEX_JOBS || "jobs";
const VERTEX_LOCATION = process.env.VERTEX_LOCATION || "us-central1";
const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "";

// ---------------------- INIT ----------------------
try { admin.initializeApp(); } catch (_) {}
const db = admin.firestore();

let algoliaClient = null;
let algoliaJobsIndex = null;
if (ALGOLIA_APP_ID && ALGOLIA_API_KEY) {
  algoliaClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
  algoliaJobsIndex = algoliaClient.initIndex(ALGOLIA_INDEX_JOBS);
}

const vertexAI =
  PROJECT_ID && VERTEX_LOCATION
    ? new VertexAI({ project: PROJECT_ID, location: VERTEX_LOCATION })
    : null;

const generativeModel = vertexAI
  ? vertexAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      systemInstruction: {
        role: "system",
        parts: [
          {
            text: [
              "You are Daniel, a production chatbot for a garage-door service backend.",
              "Decide when to call tools vs. reply conversationally.",
              "Use tools for:",
              "- finding or listing jobs (fuzzy name/phone/address queries) → algoliaFindJobs",
              "- counts of scheduled jobs → algoliaCountScheduledJobs",
              "- exact dispatch lookups → getJobByDispatchNumber",
              "When the user greets or makes small talk, respond briefly and offer how you can help.",
              "Return short, precise answers. Do not ask unnecessary questions.",
              "If a tool returns no data, say so and suggest one extra hint (e.g., last 4 digits).",
              "Classification rules:",
              " scheduled if status in {scheduled,rescheduled,confirmed,assigned,dispatch assigned,on route} or has a valid scheduled date.",
              " awaiting completion if status contains that phrase.",
              " excluded if status in {completed,canceled,cancelled,no show,duplicate,on hold,void,refused,do not service,dns}.",
            ].join("\n"),
          },
        ],
      },
      tools: [
        {
          functionDeclarations: [
            {
              name: "algoliaFindJobs",
              description:
                "Fuzzy jobs retrieval by name, phone last-4, address contains, technician, warranty provider, etc.",
              parameters: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  dispatchOrPoNumber: { type: "STRING" },
                  phoneEndsWith: { type: "STRING" },
                  addressContains: { type: "STRING" },
                  statusContains: { type: "STRING" },
                  technician: { type: "STRING" },
                  warrantyProvider: { type: "STRING" },
                  timeSlot: { type: "STRING" },
                  planType: { type: "STRING" },
                  freeText: { type: "STRING" },
                  limit: { type: "NUMBER" }
                }
              }
            },
            {
              name: "algoliaCountScheduledJobs",
              description:
                "Precise scheduled-counts and breakdown by date. Prefer Algolia facets; fallback to Firestore.",
              parameters: {
                type: "OBJECT",
                properties: {
                  dateFrom: { type: "STRING", description: "YYYY-MM-DD" },
                  dateTo: { type: "STRING", description: "YYYY-MM-DD" },
                  futureOnly: { type: "BOOLEAN" }
                }
              }
            },
            {
              name: "getJobByDispatchNumber",
              description:
                "Exact Firestore lookup by dispatchOrPoNumber; returns authoritative details.",
              parameters: {
                type: "OBJECT",
                properties: {
                  dispatchOrPoNumber: { type: "STRING" }
                },
                required: ["dispatchOrPoNumber"]
              }
            }
          ]
        }
      ],
    })
  : null;

// ---------------------- EXPRESS ----------------------
const app = express();

// Strict CORS (file:// allowed)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  next();
});
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));
app.options("*", (req, res) => res.status(204).send(""));

app.get("/", (req, res) => res.type("text/plain").send("ask-daniel up"));

// ---------------------- HELPERS ----------------------
const toStr = (v) => (v === undefined || v === null ? "" : String(v));
const lower = (s) => toStr(s).toLowerCase();
const digits = (s) => toStr(s).replace(/\D/g, "");
const last4 = (s) => digits(s).slice(-4);

const SCHEDULED_SET = new Set([
  "scheduled",
  "rescheduled",
  "confirmed",
  "assigned",
  "dispatch assigned",
  "on route",
]);
const EXCLUDED_SET = new Set([
  "completed",
  "canceled",
  "cancelled",
  "no show",
  "duplicate",
  "on hold",
  "void",
  "refused",
  "do not service",
  "dns",
]);

function isDateLike(v) {
  return v && (v._seconds || v instanceof admin.firestore.Timestamp || v instanceof Date || (typeof v === "string" && !Number.isNaN(Date.parse(v))));
}
function toISO(v) {
  try {
    if (!v) return null;
    if (v._seconds) return new Date(v._seconds * 1000).toISOString();
    if (v instanceof admin.firestore.Timestamp) return v.toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "string") return new Date(v).toISOString();
  } catch {}
  return null;
}
function toISODate(v) {
  const iso = toISO(v);
  return iso ? iso.slice(0, 10) : null;
}
function selectKeyFields(hit) {
  return {
    dispatchOrPoNumber: hit.dispatchOrPoNumber ?? hit.dispatch ?? null,
    customer: hit.customer ?? null,
    address: hit.address ?? null,
    phone: hit.phone ?? null,
    status: hit.status ?? null,
    createdAt: isDateLike(hit.createdAt) ? toISO(hit.createdAt) : toISO(hit.created_at),
    scheduledDate: isDateLike(hit.scheduledDate) ? toISO(hit.scheduledDate) : toISO(hit.scheduled_date),
    assignedTechnicianName: hit.assignedTechnicianName ?? hit.technician ?? null,
    warrantyProvider: hit.warrantyProvider ?? null,
    timeSlot: hit.timeSlot ?? null,
    planType: hit.planType ?? null,
    scheduledDateISO: hit.scheduledDateISO ?? toISODate(hit.scheduledDate) ?? null,
    createdAtTimestamp: hit.createdAtTimestamp ?? null,
  };
}

// ---------------------- TOOLS ----------------------
async function algoliaFindJobsTool(args = {}) {
  console.log("[tool] algoliaFindJobs", JSON.stringify(args));
  if (!algoliaJobsIndex) {
    return { error: "Algolia not configured (ALGOLIA_APP_ID/API_KEY missing)." };
  }

  const {
    name,
    dispatchOrPoNumber,
    phoneEndsWith,
    addressContains,
    statusContains,
    technician,
    warrantyProvider,
    timeSlot,
    planType,
    freeText,
    limit = 10,
  } = args;

  // Pick a base query but avoid junk like "hi"
  let baseQuery = "";
  if (dispatchOrPoNumber) baseQuery = toStr(dispatchOrPoNumber);
  else if (name && name.trim().length >= 1) baseQuery = name.trim();
  else if (freeText && freeText.trim().length >= 3) baseQuery = freeText.trim();
  else if (addressContains && addressContains.trim().length >= 3) baseQuery = addressContains.trim();
  else baseQuery = ""; // empty = match all (facets), but we’ll rely on post-filters

  const hitsWanted = Math.min(Math.max(limit * 4, 50), 200);

  const searchParams = {
    hitsPerPage: hitsWanted,
    attributesToRetrieve: [
      "objectID",
      "dispatchOrPoNumber",
      "customer",
      "address",
      "phone",
      "status",
      "createdAt",
      "scheduledDate",
      "assignedTechnicianName",
      "warrantyProvider",
      "timeSlot",
      "planType",
      "scheduledDateISO",
      "createdAtTimestamp",
      "phoneDigits",
      "phoneLast4",
    ],
    attributesToHighlight: [],
    typoTolerance: "min",
    removeWordsIfNoResults: "allOptional",
    ignorePlurals: true,
    advancedSyntax: true,
  };

  const res = await algoliaJobsIndex.search(baseQuery, searchParams);
  let filtered = res.hits || [];

  // Post-filters only if provided (avoid filtering everything out)
  if (phoneEndsWith) {
    const suf = toStr(phoneEndsWith).trim();
    filtered = filtered.filter(
      (h) =>
        last4(h.phoneDigits || h.phone || "") === suf ||
        toStr(h.phoneLast4 || "").endsWith(suf)
    );
  }
  if (addressContains) {
    const needle = lower(addressContains);
    filtered = filtered.filter((h) => lower(h.address).includes(needle));
  }
  if (statusContains) {
    const needle = lower(statusContains);
    filtered = filtered.filter((h) => lower(h.status).includes(needle));
  }
  if (technician) {
    const needle = lower(technician);
    filtered = filtered.filter((h) =>
      lower(h.assignedTechnicianName).includes(needle)
    );
  }
  if (warrantyProvider) {
    const needle = lower(warrantyProvider);
    filtered = filtered.filter((h) =>
      lower(h.warrantyProvider).includes(needle)
    );
  }
  if (timeSlot) {
    const needle = lower(timeSlot);
    filtered = filtered.filter((h) => lower(h.timeSlot).includes(needle));
  }
  if (planType) {
    const needle = lower(planType);
    filtered = filtered.filter((h) => lower(h.planType).includes(needle));
  }

  // Ranking
  const dp = toStr(dispatchOrPoNumber || "");
  const nameQ = lower(toStr(name || ""));
  const addrQ = lower(toStr(addressContains || ""));
  const phoneQ = toStr(phoneEndsWith || "");

  const scored = filtered.map((h) => {
    let score = 0;
    if (dp && toStr(h.dispatchOrPoNumber) === dp) score += 100;
    if (nameQ) {
      const nm = lower(toStr(h.customer));
      if (nm.startsWith(nameQ)) score += 20;
      else if (nm.includes(nameQ)) score += 10;
    }
    if (addrQ && lower(toStr(h.address)).includes(addrQ)) score += 8;
    if (phoneQ) {
      const l4 = toStr(h.phoneLast4) || last4(h.phoneDigits || h.phone || "");
      if (toStr(l4).endsWith(phoneQ)) score += 15;
    }
    if (h.createdAtTimestamp) score += Math.min(5, Math.floor((h.createdAtTimestamp % 10000) / 2000));
    return { score, item: selectKeyFields(h) };
  });

  scored.sort((a, b) => b.score - a.score);
  const items = (scored.length ? scored : filtered.map((h) => ({ item: selectKeyFields(h) })))
    .slice(0, limit)
    .map((x) => x.item);

  return { items };
}

async function algoliaCountScheduledJobsTool(args = {}) {
  console.log("[tool] algoliaCountScheduledJobs", JSON.stringify(args));
  const { dateFrom, dateTo, futureOnly = false } = args;

  // Prefer Algolia facets if available
  if (algoliaJobsIndex) {
    try {
      const res = await algoliaJobsIndex.search("", {
        hitsPerPage: 0,
        facets: ["scheduledDateISO", "statusNormalized"],
      });
      if (res?.facets?.scheduledDateISO) {
        const byDate = [];
        let total = 0;

        const today = new Date().toISOString().slice(0, 10);
        for (const [date, countRaw] of Object.entries(res.facets.scheduledDateISO)) {
          const cnt = Number(countRaw || 0);
          if (futureOnly && date < today) continue;
          if (dateFrom && date < dateFrom) continue;
          if (dateTo && date > dateTo) continue;
          total += cnt;
          byDate.push({ date, count: cnt });
        }
        byDate.sort((a, b) => (a.date < b.date ? -1 : 1));
        const awaitingCompletion = Number((res.facets.statusNormalized || {})["awaiting completion"] || 0);
        const summary = [
          `${total + awaitingCompletion} in total`,
          `${awaitingCompletion} awaiting completion`,
          ...byDate.map((d) => `${d.count} on ${d.date}`),
        ].join(", ");
        return { total: total + awaitingCompletion, awaitingCompletion, byDate, summary, source: "algolia-facets" };
      }
    } catch (e) {
      console.warn("[algolia facets] skipped:", e?.message || e);
    }
  }

  // Firestore fallback (subset for safety)
  const jobsCol = db.collection("jobs");
  const [snapA, snapB] = await Promise.allSettled([
    jobsCol.where("scheduledDate", ">", new Date("1970-01-01")).get(),
    jobsCol.where("status", "in", Array.from(SCHEDULED_SET)).get(),
  ]);

  const map = new Map();
  const addSnap = (s) => s.forEach((doc) => map.set(doc.id, doc.data()));
  if (snapA.status === "fulfilled") addSnap(snapA.value);
  if (snapB.status === "fulfilled") addSnap(snapB.value);

  let awaitingCompletion = 0;
  let totalScheduled = 0;
  const byDate = [];
  const dict = new Map();

  const today = new Date().toISOString().slice(0, 10);
  for (const data of map.values()) {
    const status = lower(toStr(data.status));
    const schedISO = toISODate(data.scheduledDate);
    const hasDate = !!schedISO;
    const isAwaiting = status.includes("awaiting completion");
    const isExcluded = EXCLUDED_SET.has(status);

    if (isAwaiting) awaitingCompletion++;
    else if (!isExcluded && (SCHEDULED_SET.has(status) || hasDate)) {
      if (schedISO) {
        if (futureOnly && schedISO < today) continue;
        if (dateFrom && schedISO < dateFrom) continue;
        if (dateTo && schedISO > dateTo) continue;
        dict.set(schedISO, (dict.get(schedISO) || 0) + 1);
      }
      totalScheduled++;
    }
  }
  for (const [date, count] of Array.from(dict.entries()).sort((a, b) =>
    a[0] < b[0] ? -1 : 1
  )) byDate.push({ date, count });

  const total = totalScheduled + awaitingCompletion;
  const summary = [
    `${total} in total`,
    `${awaitingCompletion} awaiting completion`,
    ...byDate.map((d) => `${d.count} on ${d.date}`),
  ].join(", ");
  return { total, awaitingCompletion, byDate, summary, source: "firestore-fallback" };
}

async function getJobByDispatchNumberTool(args = {}) {
  console.log("[tool] getJobByDispatchNumber", JSON.stringify(args));
  const { dispatchOrPoNumber } = args || {};
  if (!dispatchOrPoNumber) return { error: "dispatchOrPoNumber is required" };

  const snap = await db
    .collection("jobs")
    .where("dispatchOrPoNumber", "==", dispatchOrPoNumber)
    .limit(1)
    .get();
  if (snap.empty) return { error: `No job found for dispatch ${dispatchOrPoNumber}.` };

  const data = snap.docs[0].data();
  return {
    item: {
      dispatchOrPoNumber: data.dispatchOrPoNumber || null,
      customer: data.customer || null,
      address: data.address || null,
      phone: data.phone || null,
      status: data.status || null,
      createdAt: toISO(data.createdAt),
      scheduledDate: toISO(data.scheduledDate),
      assignedTechnicianName: data.assignedTechnicianName || null,
      warrantyProvider: data.warrantyProvider || null,
      timeSlot: data.timeSlot || null,
      planType: data.planType || null,
      id: snap.docs[0].id,
    },
  };
}

// Tool registry (for function-calls)
const TOOL_IMPL = {
  algoliaFindJobs: algoliaFindJobsTool,
  algoliaCountScheduledJobs: algoliaCountScheduledJobsTool,
  getJobByDispatchNumber: getJobByDispatchNumberTool,
};

// ---------------------- AGENT LOOP ----------------------
async function runAgent({ query, history = [] }) {
  // If Vertex missing, fall back to a simple search behavior
  if (!generativeModel) {
    console.warn("[agent] Vertex not configured; falling back.");
    const { items, error } = await algoliaFindJobsTool({ freeText: query, limit: 10 });
    if (error) {
      return `I'm up, but search isn't configured: ${error}`;
    }
    if (!items || !items.length) {
      return "I didn’t find matches. Try adding a hint like the customer’s first name or the phone’s last 4 digits.";
    }
    return items
      .slice(0, 5)
      .map((it, i) => {
        const sched = it.scheduledDate ? new Date(it.scheduledDate).toISOString().slice(0, 10) : "-";
        return `${i + 1}. ${it.dispatchOrPoNumber || "-"} | ${it.customer || "-"} | ${it.address || "-"} | ${it.status || "-"} | scheduled: ${sched}`;
      })
      .join("\n");
  }

  // Build contents: include brief history if provided in shape [{role:'user'|'assistant',content:'...'}]
  const contents = [];
  if (Array.isArray(history)) {
    for (const turn of history.slice(-6)) {
      if (!turn || !turn.role || !turn.content) continue;
      const role = turn.role === "assistant" ? "model" : "user";
      contents.push({ role, parts: [{ text: String(turn.content) }] });
    }
  }
  contents.push({ role: "user", parts: [{ text: String(query) }] });

  // Up to 2 tool-call turns (that’s plenty here)
  let toolResponseParts = [];
  for (let step = 0; step < 2; step++) {
    const req = { contents: [...contents, ...toolResponseParts] };
    const resp = await generativeModel.generateContent(req);
    const cand = resp?.response?.candidates?.[0];
    if (!cand) {
      // No candidate: be graceful
      return "I’m here. How can I help with jobs? You can say things like: “Find a job for Mohammed on Sylvan” or “How many jobs are scheduled?”.";
    }

    const parts = cand.content?.parts || [];
    const call = parts.find((p) => p.functionCall);
    if (!call) {
      // No tool call → return text
      const text = parts.map((p) => p.text).filter(Boolean).join("\n").trim();
      return text || "Ready. What should I look up?";
    }

    // Execute the tool
    const { name, args } = call.functionCall;
    console.log(`[agent] functionCall: ${name}(${JSON.stringify(args)})`);
    const impl = TOOL_IMPL[name];
    let result;
    if (!impl) {
      result = { error: `Unknown tool: ${name}` };
    } else {
      try {
        result = await impl(args || {});
      } catch (e) {
        console.error(`[tool:${name}] error`, e);
        result = { error: e?.message || String(e) };
      }
    }

    // Provide the functionResponse back to model to format final answer
    toolResponseParts.push({
      role: "tool",
      parts: [{ functionResponse: { name, response: result } }],
    });
  }

  // If we reached here without a text answer, produce a concise fallback
  return "Done. (If you expected a list, try specifying a name, address piece, or phone last 4.)";
}

// ---------------------- ROUTES ----------------------
app.post(["/", "/ask"], async (req, res) => {
  try {
    const { query, history } = req.body || {};
    if (!query || typeof query !== "string") {
      return res.status(400).json({
        message: "Invalid request: 'query' (string) is required.",
        details: { got: req.body },
      });
    }
    const response = await runAgent({ query, history });
    return res.json({ response });
  } catch (err) {
    console.error("POST / error:", err);
    return res.status(500).json({
      message: "Internal error",
      details: err?.message || String(err),
    });
  }
});

// ---------------------- START ----------------------
app.listen(PORT, () => {
  console.log(`ask-daniel listening on :${PORT}`);
});
