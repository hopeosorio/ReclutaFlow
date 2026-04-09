import { supabase } from "@/lib/supabaseClient";
import type { ApplyFormValues } from "../types";

export const applyService = {
  /**
   * Submits a full application using the 'submit_application' Edge Function.
   * This is the "Microservice" approach that ensures atomic transactional integrity.
   */
  async submit(values: ApplyFormValues, documentFiles: Record<string, File | null>) {
    // 1. Map screening answers to the format expected by the DB/Edge Function
    const screeningAnswers = Object.entries(values.screening_answers).map(([qId, val]) => ({
      question_id: qId,
      answer_text: typeof val === 'string' ? val : null,
      answer_json: typeof val !== 'string' ? val : null
    }));

    // 2. Prepare document metadata
    const documents = Object.entries(documentFiles)
      .filter(([_, file]) => !!file)
      .map(([dtId, file]) => ({
        document_type_id: dtId,
        file_name: file!.name
      }));


    // 2.2 Re-fill person names from signature if empty
    const splitName = values.signer_name.trim().split(" ");
    const personToSubmit = { ...values.person };
    if (!personToSubmit.first_name || personToSubmit.first_name.trim() === "") {
        personToSubmit.first_name = splitName[0] || "CANDIDATO";
        personToSubmit.last_name = splitName.slice(1).join(" ") || "MEWI";
    }

    const payload = {
      job_posting_id: values.job_posting_id,
      person: personToSubmit,
      consent: {
        accepted: String(values.consent.accepted) === 'true' || values.consent.accepted === true
      },
      application_details: {
        ...values.application_details,
        has_experience: String(values.application_details.has_experience) === 'true' || values.application_details.has_experience === true,
        fixed_commitment_bool: String(values.application_details.fixed_commitment_bool) === 'true' || values.application_details.fixed_commitment_bool === true,
        weekend_availability: String(values.application_details.weekend_availability) === 'true' || values.application_details.weekend_availability === true,
        previous_employee: String(values.application_details.previous_employee) === 'true' || values.application_details.previous_employee === true,
        has_infonavit: String(values.application_details.has_infonavit) === 'true' || values.application_details.has_infonavit === true,
        salary_agreement: String(values.application_details.salary_agreement) === 'true' || values.application_details.salary_agreement === true,
        adjustments_required: String(values.application_details.adjustments_required) === 'true' || values.application_details.adjustments_required === true,
      },
      work_history: values.work_history.filter(w => w.company.trim() !== ""),
      personal_references: values.personal_references.filter(r => r.name.trim() !== ""),
      skills: values.skills,
      candidate: {
        ...values.candidate,
        has_education_certificate: values.candidate.has_education_certificate === 'yes'
      },
      signature: {
        signer_name: values.signer_name,
        signature_base64: values.signature_base64
      },
      screening_answers: screeningAnswers,
      documents: documents,
      suggested_slots: {
        slot_1: values.availability.slot_1 || null,
        slot_2: null,
        slot_3: null
      },
      create_signed_upload_urls: true
    };

    // 3. Call Edge Function
    const { data, error } = await supabase.functions.invoke("submit_application", {
      body: payload
    });

    if (error) throw error;

    // 4. Handle secondary file uploads if Edge Function provided signed URLs
    if (data.document_uploads && data.document_uploads.length > 0) {
      const failedUploads: string[] = [];
      for (const upload of data.document_uploads) {
        const file = documentFiles[upload.document_type_id];
        if (file && upload.signed_url) {
          const uploadRes = await fetch(upload.signed_url, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
          });
          if (!uploadRes.ok) failedUploads.push(file.name);
        }
      }
      if (failedUploads.length > 0) {
        throw new Error(`Tu solicitud fue enviada, pero no se pudieron subir los siguientes archivos: ${failedUploads.join(", ")}. Por favor contáctanos para reenviarlos.`);
      }
    }

    return data;
  }
};
