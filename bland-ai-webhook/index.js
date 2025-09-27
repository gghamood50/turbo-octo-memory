"use strict";

const functions = require("@google-cloud/functions-framework");
const { Firestore, FieldValue } = require("@google-cloud/firestore");
const { VertexAI } = require("@google-cloud/vertexai");

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "safewayos2";
const LOCATION = "us-central1";
const ALLOWED_SLOTS = new Set(["8am to 2pm", "9am to 4pm", "12pm to 6pm"]);

const firestore = new Firestore({ projectId: PROJECT_ID });
const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const generativeModel = vertexAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/** ✅ Safer, lenient-but-exact scheduling prompt */
const SYSTEM_PROMPT = `
You are an expert QA scheduler analyzing a PHONE CALL transcript between an AGENT and a CUSTOMER.

GOAL: Decide if an appointment was scheduled into one of these EXACT windows and extract the date.

Valid windows (canonical targets):
- "8am to 2pm"
- "9am to 4pm"
- "12pm to 6pm"

ACCEPTED EQUIVALENTS (normalize to the canonical forms above if clearly the same):
- "8 to 2", "8am-2pm", "8 am to 2 pm" → "8am to 2pm"
- "9 to 4", "9am-4pm", "9 am to 4 pm", "between 9 and 4" → "9am to 4pm"
- "12 to 6", "12pm-6pm", "12 pm to 6 pm" → "12pm to 6pm"

Decision rules:
1) "scheduled" ONLY if:
   - The CUSTOMER clearly accepts one (normalized) valid window, AND
   - The acceptance is not tentative (no "maybe", "later", "not sure").

2) If the AGENT says it's scheduled BUT there is no CUSTOMER acceptance, return "not_scheduled".

3) Voicemail/no answer/wrong number → "not_scheduled".

4) If multiple valid windows were discussed, choose the LAST window that the CUSTOMER accepted.

5) NEVER invent or infer a non-listed window. If a non-listed window appears, return "not_scheduled".

Date handling:
- You are given explicit context lines like:
  base_date=YYYY-MM-DD
  next_day=YYYY-MM-DD
  day_after=YYYY-MM-DD
  tz=Continent/City
- If the transcript says "tomorrow", use next_day. If "day after tomorrow", use day_after.
- If a full calendar date is spoken (e.g., "August 28, 2025" or "8/28/2025" or "Wednesday the 28th"), output ISO YYYY-MM-DD.
- If you cannot safely determine an absolute date but timing is clearly "tomorrow" or "day after", set scheduledDate=null and set relativeDay accordingly ("next_day" / "day_after").
- Otherwise leave both scheduledDate and relativeDay as null.

OUTPUT (JSON only, no comments, no prose):
{
  "outcome": "scheduled" | "not_scheduled",
  "timeSlot": "8am to 2pm" | "9am to 4pm" | "12pm to 6pm" | null,
  "scheduledDate": string | null,   // ISO YYYY-MM-DD if explicitly known
  "relativeDay": "next_day" | "day_after" | null
}

Constraints:
- If "outcome"="scheduled", "timeSlot" MUST be one of the 3 canonical slots.
- If "outcome"="not_scheduled", set timeSlot=null, scheduledDate=null, relativeDay=null.
`;

/** Robust JSON extractor: first balanced object only */
function extractFirstJsonObject(text) {
  if (!text) return null;
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = text.slice(start, i + 1);
        try { return JSON.parse(candidate); } catch {}
        // continue scanning if parse failed
        start = -1;
      }
    }
  }
  return null;
}

/** Normalize obvious slot equivalents to canonical allowed windows */
function normalizeSlot(s) {
  if (!s) return null;
  const t = String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  const simple = t
    .replace(/between\s+/g, '')     // "between 9 and 4" → "9 and 4"
    .replace(/\sam\s/g, 'am ')
    .replace(/\spm\s/g, 'pm ')
    .replace(/-/g, ' to ')
    .replace(/\s+and\s+/g, ' to ');
  if (/(^| )8( ?am)? to 2( ?pm)?$/.test(simple)) return "8am to 2pm";
  if (/(^| )9( ?am)? to 4( ?pm)?$/.test(simple)) return "9am to 4pm";
  if (/(^| )12( ?pm)? to 6( ?pm)?$/.test(simple)) return "12pm to 6pm";
  // also catch tight forms like "9 to 4"
  if (/^9 to 4$/.test(simple)) return "9am to 4pm";
  if (/^8 to 2$/.test(simple)) return "8am to 2pm";
  if (/^12 to 6$/.test(simple)) return "12pm to 6pm";
  return null;
}

function mentionsTomorrow(t) {
  if (!t) return false;
  return /\b(tomorrow|next day)\b/i.test(t);
}

/** Resolve job doc by blandCallId/callId/job id */
async function resolveJobRef(firestore, callId, request_data) {
  const tryColls = ["jobs", "Jobs"];

  for (const coll of tryColls) {
    let q = await firestore.collection(coll).where("blandCallId", "==", callId).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
  }
  for (const coll of tryColls) {
    let q = await firestore.collection(coll).where("callId", "==", callId).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
  }
  const possibleJobId = request_data?.job_id || request_data?.jobId || request_data?.id || null;
  if (possibleJobId) {
    for (const coll of tryColls) {
      const doc = await firestore.collection(coll).doc(String(possibleJobId)).get();
      if (doc.exists) return doc.ref;
    }
  }
  return null;
}

/** Normalize: copy snake_case → camelCase once, then delete snake_case */
async function normalizeJobDoc(jobRef, jobData) {
  if (!jobData) return;
  const updates = {};
  let needs = false;

  if (jobData.time_slot && !jobData.timeSlot) { updates.timeSlot = jobData.time_slot; needs = true; }
  if (jobData.scheduled_date && !jobData.scheduledDate) { updates.scheduledDate = jobData.scheduled_date; needs = true; }
  if ("time_slot" in jobData) { updates.time_slot = FieldValue.delete(); needs = true; }
  if ("scheduled_date" in jobData) { updates.scheduled_date = FieldValue.delete(); needs = true; }

  if (needs) {
    updates.updatedAt = FieldValue.serverTimestamp();
    await jobRef.set(updates, { merge: true });
    console.info(`Normalized job ${jobRef.id}`, updates);
  }
}

/** Status helper with guaranteed camelCase-only writes */
async function safeUpdateStatus(jobRef, status, errorReason = null, extra = {}) {
  if (!jobRef) return;
  const update = {
    status,
    errorReason: errorReason || FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
    time_slot: FieldValue.delete(),
    scheduled_date: FieldValue.delete(),
  };
  await jobRef.set(update, { merge: true });
}

const NO_ANSWER_TAGS = new Set([
  "no_answer","no-answer","voicemail","noanswer","busy","failed","not_connected","did_not_answer"
]);

// ... inside your handler:
functions.http("blandAiWebhook", async (req, res) => {
  const started = Date.now();
  const requestId = req.get("X-Request-Id") || `local-${started}`;
  const payload = req.body || {};
  const call_id = payload.call_id || payload.callId || null;
  const concatenated_transcript = payload.concatenated_transcript || "";
  const summary = payload.summary || null;
  const request_data = payload.request_data || {};

  const baseResponse = {
    summary,
    transcript: concatenated_transcript,
  };

  const dbUpdate = {
    summary,
    transcript: concatenated_transcript,
  };

  if (req.method !== "POST") {
    return res.status(405).json({ ...baseResponse, status: "error", error: "Method Not Allowed" });
  }

  console.info("Webhook received", {
    requestId,
    call_id,
    disposition_tag: payload.disposition_tag || null,
    transcriptLen: concatenated_transcript?.length || 0,
    summaryLen: summary?.length || 0,
  });

  // Persist raw webhook
  try {
    if (call_id) {
      await firestore.collection("webhookEvents").doc(String(call_id)).set(
        { receivedAt: FieldValue.serverTimestamp(), payload },
        { merge: true }
      );
    }
  } catch (e) {
    console.warn("Failed to persist webhookEvents:", e?.message || e);
  }

  let jobRef = null;
  try {
    jobRef = await resolveJobRef(firestore, call_id, request_data);
    if (!jobRef) {
      if (call_id) {
        await firestore.collection("webhookOrphans").doc(String(call_id)).set(
          { reason: "No matching job", seenAt: FieldValue.serverTimestamp(), payload },
          { merge: true }
        );
      }
      return res.status(202).json({ ...baseResponse, status: "accepted_no_job" });
    }

    const jobSnap = await jobRef.get();
    const jobData = jobSnap.exists ? jobSnap.data() : {};
    await normalizeJobDoc(jobRef, jobData);

    // Idempotent OK
    if (jobData?.status === "Scheduled" && jobData?.timeSlot && jobData?.scheduledDate) {
      await jobRef.set(
        {
          ...dbUpdate,
          lastWebhookAt: FieldValue.serverTimestamp(),
          lastWebhookDisposition: payload.disposition_tag || null,
          time_slot: FieldValue.delete(),
          scheduled_date: FieldValue.delete(),
        },
        { merge: true }
      );
      return res.status(200).json({ ...baseResponse, status: "ok_idempotent" });
    }
    const disposition = (payload.disposition_tag || "").toLowerCase();
    const transcript = concatenated_transcript || "";

    // 🔒 HARD GUARDS: skip model if we know it's not a real conversation
    if (NO_ANSWER_TAGS.has(disposition)) {
      await safeUpdateStatus(jobRef, "Manual Follow-up", "No answer/voicemail", dbUpdate);
      return res.status(200).json({ ...baseResponse, status: "manual_follow_up_no_answer" });
    }
    // If transcript has no customer turns at all, do not schedule
    const hasCustomerTurn = /\b(user|customer)\s*:/.test(transcript.toLowerCase());
    if (!hasCustomerTurn) {
      await safeUpdateStatus(jobRef, "Manual Follow-up", "No customer utterances detected", dbUpdate);
      return res.status(200).json({ ...baseResponse, status: "manual_follow_up_no_customer" });
    }

    // Build explicit date context for the model
    const baseDate = request_data?.today || null;
    const nextDay = request_data?.date_next_day || null;
    const dayAfter = request_data?.date_after_day || null;
    const tz = request_data?.tz || request_data?.timezone || null;

    const contextLines = [
      baseDate ? `base_date=${baseDate}` : null,
      nextDay ? `next_day=${nextDay}` : null,
      dayAfter ? `day_after=${dayAfter}` : null,
      tz ? `tz=${tz}` : null,
    ].filter(Boolean).join("\n");

    // Vertex request (JSON-only with schema)
    const vertexRequest = {
      contents: [{
        role: "user",
        parts: [{ text: `${contextLines}\n---\n${transcript}` }]
      }],
      systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0,
        topP: 0,
        topK: 1,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            outcome: { type: "string", enum: ["scheduled", "not_scheduled"] },
            timeSlot: {
              anyOf: [
                { type: "string", enum: ["8am to 2pm", "9am to 4pm", "12pm to 6pm"] },
                { type: "null" },
              ],
            },
            scheduledDate: { anyOf: [{ type: "string", format: "date" }, { type: "null" }] },
            relativeDay: { anyOf: [{ type: "string", enum: ["next_day", "day_after"] }, { type: "null" }] },
          },
          required: ["outcome", "timeSlot", "scheduledDate", "relativeDay"],
          additionalProperties: false,
        },
      },
    };

    // Run model
    let parsed = null;
    try {
      const result = await generativeModel.generateContent(vertexRequest);
      const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      parsed = extractFirstJsonObject(text);
      if (!parsed) throw new Error("Model did not return valid JSON.");
    } catch (vertexErr) {
      console.error("Vertex analysis failed:", vertexErr?.message || vertexErr);
      // 🚫 Conservative fallback: never auto-schedule on parsing/model errors
      await safeUpdateStatus(jobRef, "Manual Follow-up", "Model/parse failure", dbUpdate);
      return res.status(200).json({ ...baseResponse, status: "manual_follow_up_model_error" });
    }

    // Post-parse validation & normalization
    const isScheduled = parsed?.outcome === "scheduled";
    const normalizedSlot = normalizeSlot(parsed?.timeSlot);

    if (isScheduled && !normalizedSlot) {
      await safeUpdateStatus(jobRef, "Manual Follow-up", "Invalid or unrecognized timeSlot", dbUpdate);
      return res.status(200).json({ ...baseResponse, status: "manual_follow_up_invalid_slot" });
    }

    let scheduledDate = parsed?.scheduledDate || null;

    // Fix common "tomorrow" mismatch cases
    if (isScheduled && !scheduledDate) {
      if (parsed?.relativeDay === "day_after" && dayAfter) scheduledDate = dayAfter;
      else if (parsed?.relativeDay === "next_day" && nextDay) scheduledDate = nextDay;
      else if (mentionsTomorrow(transcript) && nextDay) scheduledDate = nextDay;
    }

    // Last-chance fallbacks provided by your caller
    if (isScheduled && !scheduledDate && request_data?.scheduledDate) {
      scheduledDate = request_data.scheduledDate;
    }

    if (isScheduled && !scheduledDate) {
      await safeUpdateStatus(jobRef, "Manual Follow-up", "Missing scheduledDate after normalization", {
        ...dbUpdate,
        lastWebhookAt: FieldValue.serverTimestamp(),
        lastWebhookDisposition: payload.disposition_tag || null,
      });
      return res.status(200).json({ ...baseResponse, status: "manual_follow_up_missing_date" });
    }

    if (isScheduled) {
      const update = {
        ...dbUpdate,
        status: "Scheduled",
        timeSlot: normalizedSlot,
        scheduledDate,
        blandCallId: call_id || null,
        lastWebhookAt: FieldValue.serverTimestamp(),
        lastWebhookDisposition: payload.disposition_tag || null,
        time_slot: FieldValue.delete(),
        scheduled_date: FieldValue.delete(),
      };
      await jobRef.set(update, { merge: true });
      return res.status(200).json({ ...baseResponse, status: "scheduled", timeSlot: normalizedSlot, scheduledDate });
    } else {
      await safeUpdateStatus(jobRef, "Manual Follow-up", null, {
        ...dbUpdate,
        lastWebhookAt: FieldValue.serverTimestamp(),
        lastWebhookDisposition: payload.disposition_tag || null,
      });
      return res.status(200).json({ ...baseResponse, status: "manual_follow_up" });
    }
  } catch (err) {
    console.error("Webhook processing error:", err?.message || err);
    try {
      await safeUpdateStatus(jobRef, "Manual Follow-up", err?.message || String(err), {
        ...dbUpdate,
        lastWebhookAt: FieldValue.serverTimestamp(),
        lastWebhookDisposition: payload.disposition_tag || null,
      });
      await firestore.collection("webhookFailures").add({
        call_id: call_id || null,
        at: FieldValue.serverTimestamp(),
        error: err?.message || String(err),
        payload,
      });
    } catch (e2) {
      console.error("Failed to write failure:", e2?.message || e2);
    }
    return res.status(200).json({ ...baseResponse, status: "manual_follow_up_error" });
  } finally {
    console.info("Webhook finished", { requestId, ms: Date.now() - started });
  }
});
