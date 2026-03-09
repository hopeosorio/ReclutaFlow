import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { requireFields } from "../_shared/validation.ts";

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

  const missing = requireFields(payload, ["application_id", "status_key"]);
  if (missing.length > 0) {
    return errorResponse("Missing required fields", 400, { missing });
  }

  const supabase = getUserClient(req);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return errorResponse("Unauthorized", 401, authError?.message);
  }

  const applicationId = payload.application_id as string;
  let previousStatus: string | null = null;
  const emailVariables = (payload.email_variables ?? payload.variables ?? null) as
    | Record<string, string>
    | null;

  const { data: currentStatus } = await supabase
    .from("recruit_applications")
    .select("status_key")
    .eq("id", applicationId)
    .maybeSingle();

  if (currentStatus?.status_key) {
    previousStatus = currentStatus.status_key as string;
  }

  const { error: rpcError } = await supabase.rpc("recruit_change_status", {
    p_application_id: applicationId,
    p_status_key: payload.status_key,
    p_reason: payload.reason ?? null,
    p_note: payload.note ?? null,
  });

  if (rpcError) {
    return errorResponse("Failed to change status", 400, rpcError.message);
  }

  const { error: eventError } = await supabase.from("recruit_event_logs").insert({
    event_key: "status_changed",
    entity_type: "application",
    entity_id: applicationId,
    application_id: applicationId,
    metadata: {
      from_status_key: previousStatus,
      to_status_key: payload.status_key,
      reason: payload.reason ?? null,
      note: payload.note ?? null,
    },
    created_by: authData.user.id,
  });

  if (eventError) {
    console.error("Failed to log status event", eventError.message);
  }

  let emailResult: { ok: boolean; error?: string; template_key?: string } | null = null;

  if (previousStatus) {
    const { data: transition, error: transitionError } = await supabase
      .from("recruit_status_transitions")
      .select("template_key")
      .eq("from_status_key", previousStatus)
      .eq("to_status_key", payload.status_key)
      .eq("is_active", true)
      .maybeSingle();

    if (transitionError) {
      console.error("Failed to load transition template", transitionError.message);
    } else if (transition?.template_key) {
      const { data: emailData, error: emailError } = await supabase.functions.invoke("send_email", {
        body: {
          application_id: applicationId,
          template_key: transition.template_key,
          variables: emailVariables ?? undefined,
        },
      });

      if (emailError) {
        emailResult = { ok: false, error: emailError.message, template_key: transition.template_key };
      } else {
        emailResult = { ok: true, template_key: transition.template_key };
      }

      if (emailError) {
        console.error("Failed to send email after status change", emailError.message, emailData);
      }
    }
  }

  return jsonResponse({ ok: true, email: emailResult });
});
