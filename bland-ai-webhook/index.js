"use strict";

const functions = require("@google-cloud/functions-framework");
const { Firestore, FieldValue } = require("@google-cloud/firestore");
const { VertexAI } = require("@google-cloud/vertexai");

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "safewayos2";
const LOCATION = "us-central1";
const ALLOWED_SLOTS = new Set(["8am to 2pm", "9am to 4pm", "12pm to 6pm"]);

const firestore = new Firestore({ projectId: PROJECT_ID });
const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });

const generativeModel = vertexAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

const SYSTEM_PROMPT = `
You are an expert scheduling assistant responsible for analyzing phone call transcripts. Your task is to determine if a service appointment was successfully scheduled.

Valid time slots: "8am to 2pm", "9am to 4pm", "12pm to 6pm".

Return ONLY JSON with:
{
  "outcome": "scheduled" | "not_scheduled",
  "time_slot": string | null
}

Rules:
- "scheduled" only if customer clearly agrees to a specific valid slot and the agent confirms.
- If "scheduled", "time_slot" MUST be exactly one of the valid slots.
- If "not_scheduled", "time_slot" MUST be null.
`;

/** Extract first JSON object from text (as a robust fallback). */
function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const maybe = text.slice(start, end + 1);
  try {
    return JSON.parse(maybe);
  } catch {
    return null;
  }
}

/** Normalize date from Bland's payload */
function pickScheduledDate(request_data) {
  // Prefer explicit fields if they exist
  return (
    request_data?.scheduled_date ||
    request_data?.date_next_day ||
    request_data?.date_after_day ||
    null
  );
}

/** Try to resolve the job document by several keys */
async function resolveJobRef(firestore, callId, request_data) {
  const tryCollectionNames = ["jobs", "Jobs"]; // handle possible case mismatch

  // 1) blandCallId == call_id (primary path)
  for (const coll of tryCollectionNames) {
    const q = await firestore
      .collection(coll)
      .where("blandCallId", "==", callId)
      .limit(1)
      .get();
    if (!q.empty) return q.docs[0].ref;
  }

  // 2) callId == call_id (alternate naming)
  for (const coll of tryCollectionNames) {
    const q = await firestore
      .collection(coll)
      .where("callId", "==", callId)
      .limit(1)
      .get();
    if (!q.empty) return q.docs[0].ref;
  }

  // 3) request_data includes an internal job id you control
  const possibleJobId =
    request_data?.job_id || request_data?.jobId || request_data?.id || null;
  if (possibleJobId) {
    for (const coll of tryCollectionNames) {
      const doc = await firestore.collection(coll).doc(String(possibleJobId)).get();
      if (doc.exists) return doc.ref;
    }
  }

  return null;
}

/** Update job status with optional reason */
async function safeUpdateStatus(jobRef, status, errorReason = null, extra = {}) {
  if (!jobRef) return;
  const update = {
    status,
    errorReason: errorReason || FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  };
  try {
    await jobRef.set(update, { merge: true });
    console.info(`Job ${jobRef.id} -> status "${status}"`, { extra });
  } catch (e) {
    console.error(`Failed to update job ${jobRef.id}:`, e?.message || e);
  }
}

functions.http("blandAiWebhook", async (req, res) => {
  const started = Date.now();
  const requestId = req.get("X-Request-Id") || `local-${started}`;

  // Basic method guard
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // Tolerant parsing
  const payload = req.body || {};
  const call_id = payload.call_id || payload.callId || null;
  const concatenated_transcript = payload.concatenated_transcript || "";
  const request_data = payload.request_data || {};

  console.info("Webhook received", {
    requestId,
    hasBody: !!req.body,
    call_id,
    disposition_tag: payload.disposition_tag || null,
    transcriptLen: concatenated_transcript?.length || 0,
  });

  // Save raw webhook for debugging/audit (non-blocking best-effort)
  try {
    if (call_id) {
      await firestore
        .collection("webhookEvents")
        .doc(String(call_id))
        .set(
          {
            receivedAt: FieldValue.serverTimestamp(),
            payload,
          },
          { merge: true }
        );
    }
  } catch (e) {
    console.warn("Failed to persist webhookEvents record:", e?.message || e);
  }

  // Validate minimum fields
  if (!call_id || !concatenated_transcript) {
    console.error("Missing required fields", { call_id, hasTranscript: !!concatenated_transcript });
    // Don’t 400—still try to mark something if we can resolve a job
  }

  let jobRef = null;
  try {
    // Resolve the job reference via multiple strategies
    jobRef = await resolveJobRef(firestore, call_id, request_data);

    if (!jobRef) {
      console.error("Job not found for call_id", { call_id });
      // Persist orphaned webhook for later reconciliation
      if (call_id) {
        await firestore
          .collection("webhookOrphans")
          .doc(String(call_id))
          .set(
            {
              reason: "No matching job",
              seenAt: FieldValue.serverTimestamp(),
              payload,
            },
            { merge: true }
          );
      }
      return res.status(202).send("Accepted: No matching job yet");
    }

    // If job already scheduled, make this idempotent
    const jobSnap = await jobRef.get();
    const jobData = jobSnap.exists ? jobSnap.data() : {};
    if (jobData?.status === "Scheduled" && jobData?.timeSlot && jobData?.scheduledDate) {
      console.info("Job already scheduled; acknowledging idempotently", {
        jobId: jobRef.id,
        status: jobData.status,
      });
      await jobRef.set(
        {
          lastWebhookAt: FieldValue.serverTimestamp(),
          lastWebhookDisposition: payload.disposition_tag || null,
        },
        { merge: true }
      );
      return res.status(200).send("OK (idempotent)");
    }

    // Build Vertex request
    const scheduledDate = pickScheduledDate(request_data);

    const vertexRequest = {
      contents: [
        {
          role: "user",
          parts: [{ text: concatenated_transcript }],
        },
      ],
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }],
      },
      generationConfig: {
        temperature: 0,
        topP: 0,
        topK: 1,
        responseMimeType: "application/json",
        // Enforce shape to reduce parse failures
        responseSchema: {
          type: "object",
          properties: {
            outcome: { type: "string", enum: ["scheduled", "not_scheduled"] },
            time_slot: {
              anyOf: [
                { type: "string", enum: ["8am to 2pm", "9am to 4pm", "12pm to 6pm"] },
                { type: "null" },
              ],
            },
          },
          required: ["outcome", "time_slot"],
          additionalProperties: false,
        },
      },
    };

    let parsed = null;
    try {
      const result = await generativeModel.generateContent(vertexRequest);

      // Defensive unwrap
      const cands = result?.response?.candidates || [];
      const parts = cands[0]?.content?.parts || [];
      const text = parts[0]?.text || "";

      parsed = extractJson(text);
      if (!parsed) throw new Error("Model did not return valid JSON.");
    } catch (vertexErr) {
      console.error("Vertex analysis failed:", vertexErr?.message || vertexErr);

      // Fallback: simple rule-based parse (best effort)
      const t = concatenated_transcript.toLowerCase();
      const yes = /\b(yes|yeah|yep|okay|ok|perfect|works)\b/.test(t);
      let guessedSlot = null;
      if (t.includes("9am") && t.includes("4pm")) guessedSlot = "9am to 4pm";
      else if (t.includes("8am") && t.includes("2pm")) guessedSlot = "8am to 2pm";
      else if (t.includes("12pm") && t.includes("6pm")) guessedSlot = "12pm to 6pm";

      if (yes && guessedSlot && ALLOWED_SLOTS.has(guessedSlot)) {
        parsed = { outcome: "scheduled", time_slot: guessedSlot };
      } else {
        parsed = { outcome: "not_scheduled", time_slot: null };
      }
    }

    console.info("Analysis result", parsed);

    // Validate final analysis
    const isScheduled = parsed?.outcome === "scheduled";
    const slot = parsed?.time_slot;
    if (isScheduled && !ALLOWED_SLOTS.has(slot)) {
      console.warn("Model returned invalid slot; downgrading to not_scheduled", { slot });
    }

    if (isScheduled && ALLOWED_SLOTS.has(slot)) {
      // Write both camelCase and snake_case for compatibility
      const update = {
        status: "Scheduled",
        timeSlot: slot,
        scheduledDate: scheduledDate,
        time_slot: slot,
        scheduled_date: scheduledDate,
        blandCallId: call_id || jobData?.blandCallId || null,
        lastWebhookAt: FieldValue.serverTimestamp(),
        lastWebhookDisposition: payload.disposition_tag || null,
      };
      await jobRef.set(update, { merge: true });
      console.info(`Job ${jobRef.id} scheduled`, update);
      return res.status(200).send("OK: scheduled");
    } else {
      await safeUpdateStatus(jobRef, "Manual Follow-up", null, {
        lastWebhookAt: FieldValue.serverTimestamp(),
        lastWebhookDisposition: payload.disposition_tag || null,
      });
      return res.status(200).send("OK: manual_follow_up");
    }
  } catch (err) {
    console.error("Webhook processing error:", err?.message || err);

    // Try to mark the job if we have it
    await safeUpdateStatus(jobRef, "Manual Follow-up", err?.message || String(err), {
      lastWebhookAt: FieldValue.serverTimestamp(),
      lastWebhookDisposition: payload.disposition_tag || null,
    });

    // Persist failure for later inspection
    try {
      await firestore.collection("webhookFailures").add({
        call_id: call_id || null,
        at: FieldValue.serverTimestamp(),
        error: err?.message || String(err),
        payload,
      });
    } catch (e2) {
      console.error("Failed to write webhookFailures:", e2?.message || e2);
    }

    return res.status(200).send("OK: recorded failure (manual follow-up)");
  } finally {
    console.info("Webhook finished", { requestId, ms: Date.now() - started });
  }
});
