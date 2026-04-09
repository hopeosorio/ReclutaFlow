// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { isNonEmptyString, requireFields } from "../_shared/validation.ts";

const BUCKET = "recruit-docs";

function parseClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  if (!forwarded) return null;
  return forwarded.split(",")[0].trim() || null;
}

function decodeBase64Payload(input: string): { bytes: Uint8Array; contentType: string } {
  const dataUrlMatch = input.match(/^data:([^;]+);base64,(.*)$/);
  let contentType = "application/octet-stream";
  let base64 = input;
  if (dataUrlMatch) {
    contentType = dataUrlMatch[1];
    base64 = dataUrlMatch[2];
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { bytes, contentType };
}

function extFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "application/pdf": "pdf",
  };
  return map[contentType] ?? "bin";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const missing = requireFields(payload, ["job_posting_id", "person", "consent"]);
  if (missing.length > 0) {
    return errorResponse("Missing required fields", 400, { missing });
  }

  const person = payload.person as Record<string, unknown>;
  const consent = payload.consent as Record<string, unknown>;
  const candidate = (payload.candidate ?? {}) as Record<string, unknown>;
  const signature = (payload.signature ?? null) as Record<string, unknown> | null;
  const screeningAnswers = (payload.screening_answers ?? []) as Array<Record<string, unknown>>;
  const documents = (payload.documents ?? []) as Array<Record<string, unknown>>;
  const createSignedUploadUrls = payload.create_signed_upload_urls === true;

  const personMissing = requireFields(person, ["first_name", "last_name"]);
  if (personMissing.length > 0) {
    return errorResponse("Missing required person fields", 400, { missing: personMissing });
  }

  if (consent.accepted !== true) {
    return errorResponse("Privacy notice consent is required", 400);
  }

  const admin = getAdminClient();

  const jobPostingId = payload.job_posting_id as string;

  const { data: jobPosting, error: jobPostingError } = await admin
    .from("recruit_job_postings")
    .select("id, status")
    .eq("id", jobPostingId)
    .eq("status", "active")
    .single();

  if (jobPostingError || !jobPosting) {
    return errorResponse("Job posting not found or inactive", 404, jobPostingError?.message);
  }

  let privacyNoticeId = consent.privacy_notice_id as string | undefined;
  if (privacyNoticeId) {
    const { data: notice, error: noticeError } = await admin
      .from("recruit_privacy_notices")
      .select("id, is_active")
      .eq("id", privacyNoticeId)
      .single();
    if (noticeError || !notice || notice.is_active !== true) {
      return errorResponse("Privacy notice is not active", 400, noticeError?.message);
    }
  } else {
    const { data: activeNotice, error: activeNoticeError } = await admin
      .from("recruit_privacy_notices")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (activeNoticeError || !activeNotice) {
      return errorResponse("No active privacy notice found", 400, activeNoticeError?.message);
    }
    privacyNoticeId = activeNotice.id;
  }

  const { data: personRow, error: personError } = await admin
    .from("recruit_persons")
    .insert({
      first_name: person.first_name,
      last_name: person.last_name,
      phone: person.phone ?? null,
      email: person.email ?? null,
      address_line1: person.address_line1 ?? null,
      address_line2: person.address_line2 ?? null,
      neighborhood: person.neighborhood ?? null,
      city: person.city ?? null,
      state: person.state ?? null,
      postal_code: person.postal_code ?? null,
    })
    .select("id")
    .single();

  if (personError || !personRow) {
    return errorResponse("Failed to create person", 500, personError?.message);
  }

  const { data: candidateRow, error: candidateError } = await admin
    .from("recruit_candidates")
    .insert({
      person_id: personRow.id,
      education_level: candidate.education_level ?? null,
      has_education_certificate: candidate.has_education_certificate ?? null,
    })
    .select("id")
    .single();

  if (candidateError || !candidateRow) {
    return errorResponse("Failed to create candidate", 500, candidateError?.message);
  }

  // ─── AUTO-ASSIGNMENT LOGIC (Balanced Round-Robin) ───
  let assignedTo: string | null = null;
  try {
    // 1. Get eligible recruiters
    const { data: recruiters } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "rh_recruiter");

    if (recruiters && recruiters.length > 0) {
      const recruiterIds = recruiters.map(r => r.id);

      // 2. Count active/pending applications per recruiter
      // We consider "pending" those not in terminal states (hired, rejected, withdrawn)
      const terminalStates = ["hired", "rejected_after_call", "interview_done_fail", "rejected"];
      const { data: appCounts } = await admin
        .from("recruit_applications")
        .select("assigned_to")
        .not("assigned_to", "is", null)
        .in("assigned_to", recruiterIds)
        .filter("status_key", "not.in", `(${terminalStates.join(",")})`);

      // 3. Initialize mapping and count
      const workload: Record<string, number> = {};
      recruiterIds.forEach(id => workload[id] = 0);

      appCounts?.forEach((a: any) => {
        if (a.assigned_to && workload[a.assigned_to] !== undefined) {
          workload[a.assigned_to]++;
        }
      });

      // 4. Find recruiter(s) with minimum workload
      let minWorkload = Infinity;
      let candidatesList: string[] = [];

      for (const id of recruiterIds) {
        if (workload[id] < minWorkload) {
          minWorkload = workload[id];
          candidatesList = [id];
        } else if (workload[id] === minWorkload) {
          candidatesList.push(id);
        }
      }

      // 5. Select one randomly from the best candidates
      assignedTo = candidatesList[Math.floor(Math.random() * candidatesList.length)];
    }
  } catch (assignError) {
    console.warn("Auto-assignment failed, falling back to random recruiter:", assignError);
    // Fallback: Pick a recruiter at random if the complex logic fails
    try {
        const { data: fallbackRecruiters } = await admin
          .from("profiles")
          .select("id")
          .eq("role", "rh_recruiter");
        if (fallbackRecruiters && fallbackRecruiters.length > 0) {
            assignedTo = fallbackRecruiters[Math.floor(Math.random() * fallbackRecruiters.length)].id;
        }
    } catch { /* Silent fail */ }
  }

  const suggestedSlots = (payload.suggested_slots ?? {}) as Record<string, string>;

  const { data: applicationRow, error: applicationError } = await admin
    .from("recruit_applications")
    .insert({
      job_posting_id: jobPostingId,
      candidate_id: candidateRow.id,
      status_key: "new",
      status_reason: null,
      traffic_light: null,
      assigned_to: assignedTo,
      suggested_slot_1: suggestedSlots.slot_1 || null,
      suggested_slot_2: suggestedSlots.slot_2 || null,
      suggested_slot_3: suggestedSlots.slot_3 || null,
    })
    .select("id, status_key, submitted_at")
    .single();

  if (applicationError || !applicationRow) {
    return errorResponse("Failed to create application", 500, applicationError?.message);
  }

  const userAgent = req.headers.get("user-agent") ?? null;
  const ipAddress = parseClientIp(req);

  const { error: consentError } = await admin
    .from("recruit_privacy_consents")
    .insert({
      application_id: applicationRow.id,
      privacy_notice_id: privacyNoticeId,
      accepted: true,
      user_agent: userAgent,
      ip_address: ipAddress,
    });

  if (consentError) {
    return errorResponse("Failed to store privacy consent", 500, consentError.message);
  }

  let signatureUpload: Record<string, unknown> | null = null;
  if (signature) {
    const signerName =
      (signature.signer_name as string | undefined) ??
      `${person.first_name} ${person.last_name}`.trim();

    let signaturePath = (signature.signature_storage_path as string | undefined) ?? null;

    if (isNonEmptyString(signature.signature_base64)) {
      const decoded = decodeBase64Payload(signature.signature_base64);
      const ext = extFromContentType(decoded.contentType);
      const path = `applications/${applicationRow.id}/signatures/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: false });
      if (uploadError) {
        return errorResponse("Failed to upload signature", 500, uploadError.message);
      }
      signaturePath = path;
    } else if (signature.request_signed_upload === true) {
      const path = `applications/${applicationRow.id}/signatures/${crypto.randomUUID()}.png`;
      const { data: signedData, error: signedError } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);
      if (signedError || !signedData) {
        return errorResponse("Failed to create signed upload URL for signature", 500, signedError?.message);
      }
      signaturePath = path;
      signatureUpload = {
        path: signedData.path ?? path,
        signed_url: signedData.signedUrl,
        token: signedData.token,
      };
    }

    if (signaturePath || signature.signature_json) {
      const { error: signatureError } = await admin
        .from("recruit_digital_signatures")
        .insert({
          application_id: applicationRow.id,
          signer_name: signerName,
          signature_storage_path: signaturePath,
          signature_json: signature.signature_json ?? null,
        });

      if (signatureError) {
        return errorResponse("Failed to store signature", 500, signatureError.message);
      }
    }
  }

  if (screeningAnswers.length > 0) {
    const answerRows = screeningAnswers.map((answer) => ({
      application_id: applicationRow.id,
      question_id: answer.question_id,
      answer_text: answer.answer_text ?? null,
      answer_json: answer.answer_json ?? null,
    }));

    const { error: answersError } = await admin
      .from("recruit_screening_answers")
      .insert(answerRows);

    if (answersError) {
      return errorResponse("Failed to store screening answers", 500, answersError.message);
    }
  }

  const documentUploads: Array<Record<string, unknown>> = [];
  if (documents.length > 0) {
    const documentRows = documents.map((doc) => {
      const documentTypeId = doc.document_type_id as string;
      const fileName = (doc.file_name as string | undefined) ?? "document";
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `applications/${applicationRow.id}/documents/${documentTypeId}/${crypto.randomUUID()}-${safeName}`;
      if (createSignedUploadUrls) {
        documentUploads.push({
          document_type_id: documentTypeId,
          path,
        });
      }
      return {
        application_id: applicationRow.id,
        document_type_id: documentTypeId,
        storage_path: path,
      };
    });

    const { error: documentsError } = await admin
      .from("recruit_application_documents")
      .insert(documentRows);

    if (documentsError) {
      return errorResponse("Failed to create document rows", 500, documentsError.message);
    }

    if (createSignedUploadUrls) {
      for (const upload of documentUploads) {
        const { data: signedData, error: signedError } = await admin.storage
          .from(BUCKET)
          .createSignedUploadUrl(upload.path as string);
        if (signedError || !signedData) {
          upload.error = signedError?.message ?? "Failed to create signed URL";
          continue;
        }
        upload.signed_url = signedData.signedUrl;
        upload.token = signedData.token;
      }
    }
  }

  return jsonResponse({
    application_id: applicationRow.id,
    candidate_id: candidateRow.id,
    person_id: personRow.id,
    status_key: applicationRow.status_key,
    submitted_at: applicationRow.submitted_at,
    signature_upload: signatureUpload,
    document_uploads: documentUploads,
  });
});
