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

/** 🔒 Overkill, high-precision scheduling prompt */
const SYSTEM_PROMPT = `
You are an expert QA scheduler analyzing a phone-call transcript between an AGENT and a CUSTOMER.
Your job: determine if an appointment was scheduled for a valid window and extract the scheduled date if present.

Valid windows (MUST MATCH EXACTLY):
- "8am to 2pm"
- "9am to 4pm"
- "12pm to 6pm"

Decision rules:
1) "scheduled" ONLY if:
   - The CUSTOMER accepts one of the valid windows (exact match), AND
   
2) If acceptance is ambiguous, tentative ("maybe", "I'll think", "call me later"), or there is no explicit recap, return "not_scheduled".
3) Voicemail/no answer/wrong number/any non-listed window -> "not_scheduled".
4) If multiple valid windows appear, choose the last one that is accepted by the CUSTOMER.
5) NEVER normalize or invent windows. If a non-listed window is mentioned (e.g., "11am to 3pm"), return "not_scheduled".
6) Try to EXTRACT the scheduled DATE from the transcript if it is clearly stated or inferable as a specific calendar day (e.g., "August 28, 2025" or "8/28/2025" or "28/08/2025" or "Wednesday the 28th").
   - Output date in strict ISO format: YYYY-MM-DD.
   - If the transcript uses RELATIVE terms (e.g., "tomorrow", "day after tomorrow") and you CANNOT convert them safely to an absolute date, set "scheduledDate" to null and set "relativeDay" accordingly:
       * "next_day" for tomorrow
       * "day_after" for the day after tomorrow
       * null if not applicable
7) Output MUST be JSON only (no markdown, no commentary), with EXACT keys & casing:

{
  "outcome": "scheduled" | "not_scheduled",
  "timeSlot": "8am to 2pm" | "9am to 4pm" | "12pm to 6pm" | null,
  "scheduledDate": string | null,   // ISO: YYYY-MM-DD if explicitly known
  "relativeDay": "next_day" | "day_after" | null
}

Constraints:
- "timeSlot" is MANDATORY as a field. If "outcome" is "scheduled", "timeSlot" MUST be one of the valid windows (not null).
- If "outcome" is "not_scheduled", "timeSlot" MUST be null, "scheduledDate" MUST be null, and "relativeDay" MUST be null.

Examples of valid extractions (behavioral, do not copy text):
- Customer: "Yes, the 9 to 4 works for me for Thursday August 28." Agent: "Perfect, I'll lock you for 9am to 4pm on August 28." 
  -> outcome="scheduled", timeSlot="9am to 4pm", scheduledDate="2025-08-28", relativeDay=null
- Customer: "Tomorrow works, let's do 12 to 6." Agent: "Booked for 12pm to 6pm tomorrow."
  -> outcome="scheduled", timeSlot="12pm to 6pm", scheduledDate=null, relativeDay="next_day"
- Voicemail or "call me later"
  -> outcome="not_scheduled", timeSlot=null, scheduledDate=null, relativeDay=null
`;

/** Extract first JSON object from text */
function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
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

    // Build Vertex request
    const vertexRequest = {
      contents: [{ role: "user", parts: [{ text: concatenated_transcript }]}],
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
            scheduledDate: {
              anyOf: [
                { type: "string", format: "date" }, // ISO YYYY-MM-DD
                { type: "null" },
              ],
            },
            relativeDay: {
              anyOf: [
                { type: "string", enum: ["next_day", "day_after"] },
                { type: "null" },
              ],
            },
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
      const cands = result?.response?.candidates || [];
      const parts = cands[0]?.content?.parts || [];
      const text = parts[0]?.text || "";
      parsed = extractJson(text);
      if (!parsed) throw new Error("Model did not return valid JSON.");
    } catch (vertexErr) {
      console.error("Vertex analysis failed:", vertexErr?.message || vertexErr);

      // Minimal rule-based fallback
      const t = (concatenated_transcript || "").toLowerCase();
      const yes = /\b(yes|yeah|yep|okay|ok|perfect|works|that\s*works|sounds good|let's do it)\b/.test(t);
      let guessedSlot = null;
      if (t.includes("9am") && t.includes("4pm")) guessedSlot = "9am to 4pm";
      else if (t.includes("8am") && t.includes("2pm")) guessedSlot = "8am to 2pm";
      else if (t.includes("12pm") && t.includes("6pm")) guessedSlot = "12pm to 6pm";

      parsed = yes && guessedSlot && ALLOWED_SLOTS.has(guessedSlot)
        ? { outcome: "scheduled", timeSlot: guessedSlot, scheduledDate: null, relativeDay: /tomorrow/.test(t) ? "next_day" : null }
        : { outcome: "not_scheduled", timeSlot: null, scheduledDate: null, relativeDay: null };
    }

    // Post-parse validation
    const isScheduled = parsed?.outcome === "scheduled";
    const slot = parsed?.timeSlot ?? null;

    // timeSlot field is mandatory (always present); if scheduled then must be valid
    if (isScheduled && !ALLOWED_SLOTS.has(slot)) {
      console.warn("Invalid or missing timeSlot for a scheduled outcome; forcing manual follow-up", { slot });
      await safeUpdateStatus(jobRef, "Manual Follow-up", "Invalid timeSlot for scheduled", dbUpdate);
      return res.status(200).json({ ...baseResponse, status: "manual_follow_up_invalid_slot" });
    }

    // Determine scheduledDate with required fallback behavior
    let scheduledDate = parsed?.scheduledDate || null;

    // If model didn't give an absolute date, try relative mapping first
    if (!scheduledDate && isScheduled) {
      if (parsed?.relativeDay === "day_after" && request_data?.date_after_day) {
        scheduledDate = request_data.date_after_day;
      }
    }
    // Your requested forced fallback: if scheduled and still no date, use date_next_day
    if (!scheduledDate && isScheduled && request_data?.date_next_day) {
      scheduledDate = request_data.date_next_day;
    }
    // As a very last resort (rare), if request_data.scheduledDate exists, use it
    if (!scheduledDate && isScheduled && request_data?.scheduledDate) {
      scheduledDate = request_data.scheduledDate;
    }

    if (isScheduled) {
      if (!scheduledDate) {
        // Could not determine a date even after fallbacks -> manual follow-up (data safety)
        await safeUpdateStatus(jobRef, "Manual Follow-up", "Missing scheduledDate after fallbacks", {
          ...dbUpdate,
          lastWebhookAt: FieldValue.serverTimestamp(),
          lastWebhookDisposition: payload.disposition_tag || null,
        });
        return res.status(200).json({ ...baseResponse, status: "manual_follow_up_missing_date" });
      }

      const update = {
        ...dbUpdate,
        status: "Scheduled",
        timeSlot: slot,
        scheduledDate,
        blandCallId: call_id || jobData?.blandCallId || null,
        lastWebhookAt: FieldValue.serverTimestamp(),
        lastWebhookDisposition: payload.disposition_tag || null,
        // ensure no snake_case remains
        time_slot: FieldValue.delete(),
        scheduled_date: FieldValue.delete(),
      };
      await jobRef.set(update, { merge: true });
      console.info(`Job ${jobRef.id} scheduled`, { timeSlot: slot, scheduledDate });
      return res.status(200).json({ ...baseResponse, status: "scheduled", timeSlot: slot, scheduledDate });
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
