import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Request } from "https://deno.land/std@0.177.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp/mod.ts";
import { marked } from "https://esm.sh/marked@11.1.1";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { asString, requireFields } from "../_shared/validation.ts";
import { renderTemplate } from "../_shared/templating.ts";

const EMAIL_SEND_MODE = (Deno.env.get("EMAIL_SEND_MODE") ?? "log_only").toLowerCase();
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") ?? "";
const SENDGRID_FROM = Deno.env.get("SENDGRID_FROM") ?? "";
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const SMTP_FROM = Deno.env.get("SMTP_FROM") ?? "";
const SMTP_SECURE = (Deno.env.get("SMTP_SECURE") ?? "true").toLowerCase() !== "false";
const DEFAULT_TIMEZONE = Deno.env.get("DEFAULT_TIMEZONE") ?? "America/Mexico_City";

function parseFromAddress(value: string): { email: string; name?: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    const email = match[2].trim();
    if (!email) return null;
    return name ? { email, name } : { email };
  }
  return { email: trimmed };
}


async function sendViaSmtp(params: {
  toAddress: string;
  subject: string;
  body: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!SMTP_HOST) return { ok: false, error: "SMTP_HOST is not configured" };
  if (!SMTP_PORT) return { ok: false, error: "SMTP_PORT is not configured" };
  if (!SMTP_USER) return { ok: false, error: "SMTP_USER is not configured" };
  if (!SMTP_PASS) return { ok: false, error: "SMTP_PASS is not configured" };
  if (!SMTP_FROM) return { ok: false, error: "SMTP_FROM is not configured" };

  const from = parseFromAddress(SMTP_FROM);
  if (!from) return { ok: false, error: "SMTP_FROM is invalid" };

  const fromHeader = from.name ? `${from.name} <${from.email}>` : from.email;
  const client = new SmtpClient();
  try {
    if (SMTP_SECURE) {
      await client.connectTLS({
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        username: SMTP_USER,
        password: SMTP_PASS,
      });
    } else {
      await client.connect({
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        username: SMTP_USER,
        password: SMTP_PASS,
      });
    }

    await client.send({
      from: fromHeader,
      to: params.toAddress,
      subject: params.subject,
      content: params.body,
      html: params.html,
    });

    await client.close();
    return { ok: true };
  } catch (err) {
    try {
      await client.close();
    } catch {
      // ignore close errors
    }
    const message = err instanceof Error ? err.message : "SMTP send failed";
    return { ok: false, error: message };
  }
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: DEFAULT_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405);
    }

    const bodyText = await req.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(bodyText);
    } catch (err) {
      return errorResponse("Invalid JSON payload", 400, {
        error: err instanceof Error ? err.message : String(err),
        receivedBody: bodyText.slice(0, 200)
      });
    }

    const missing = requireFields(payload, ["application_id", "template_key"]);
    if (missing.length > 0) {
      return errorResponse("Missing required fields", 400, { missing, receivedPayload: payload });
    }

    const supabase = getAdminClient();
    let senderId = "system";

    // Try to identify the user if a valid session is provided
    const userSupabase = getUserClient(req);
    const { data: authData } = await userSupabase.auth.getUser();

    if (authData?.user) {
      senderId = authData.user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", senderId)
        .single();

      if (profile && !(["rh_admin", "rh_recruiter", "interviewer"] as string[]).includes(profile.role)) {
        return errorResponse("Forbidden: Invalid role", 403);
      }
    }

    const applicationId = payload.application_id as string;
    // Skip RPC access check for system/internal calls as they bypass RLS anyway
    if (senderId !== "system") {
      const { data: access, error: accessError } = await supabase.rpc("can_access_application", {
        app_id: applicationId,
      });

      if (accessError || access !== true) {
        return errorResponse("Forbidden: You do not have access to this application", 403, accessError?.message);
      }
    }

    const { data: template, error: templateError } = await supabase
      .from("recruit_message_templates")
      .select("id, subject, body_md")
      .eq("template_key", payload.template_key)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      return errorResponse("Template not found", 404, templateError?.message);
    }

    let toAddress = asString(payload.to_address);
    let personName = null as string | null;

    const { data: application, error: applicationError } = await supabase
      .from("recruit_applications")
      .select("candidate_id, job_posting_id, assigned_to")
      .eq("id", applicationId)
      .single();

    if (applicationError || !application) {
      return errorResponse("Application not found", 404, applicationError?.message);
    }

    if (!toAddress || !personName) {
      const { data: candidate, error: candidateError } = await supabase
        .from("recruit_candidates")
        .select("person_id")
        .eq("id", application.candidate_id)
        .single();

      if (candidateError || !candidate) {
        return errorResponse("Candidate not found", 404, candidateError?.message);
      }

      const { data: person, error: personError } = await supabase
        .from("recruit_persons")
        .select("first_name, last_name, email")
        .eq("id", candidate.person_id)
        .single();

      if (personError || !person) {
        return errorResponse("Person not found", 404, personError?.message);
      }

      toAddress = toAddress ?? person.email;
      personName = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
    }

    if (!toAddress) {
      return errorResponse("Recipient email is required. Could not find email for this application.", 400, { applicationId, personName });
    }

    let jobTitle = "";
    let jobBranch = "";
    let recruiterName = "";
    let interviewerName = "";
    let scheduleDate = "";
    let scheduleTime = "";
    let interviewLocation = "";
    let onboardingDate = "";
    let onboardingTime = "";
    let onboardingLocation = "";
    let dressCode = "";
    let hostName = "";
    const usesOnboarding =
      template.subject.includes("{onboarding_date}") ||
      template.subject.includes("{onboarding_time}") ||
      template.subject.includes("{dress_code}") ||
      template.body_md.includes("{onboarding_date}") ||
      template.body_md.includes("{onboarding_time}") ||
      template.body_md.includes("{dress_code}");

    if (application.job_posting_id) {
      const { data: job } = await supabase
        .from("recruit_job_postings")
        .select("title, branch")
        .eq("id", application.job_posting_id)
        .maybeSingle();
      jobTitle = job?.title ?? "";
      jobBranch = job?.branch ?? "";
    }

    if (application.assigned_to) {
      const { data: recruiter } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", application.assigned_to)
        .maybeSingle();
      recruiterName = recruiter?.full_name ?? "";
    }

    const { data: interview } = await supabase
      .from("recruit_interviews")
      .select("scheduled_at, location, profiles:interviewer_id(full_name)")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    scheduleDate = formatDate(interview?.scheduled_at ?? null);
    scheduleTime = formatTime(interview?.scheduled_at ?? null);
    interviewLocation = interview?.location ?? "";
    interviewerName = interview?.profiles?.full_name ?? "";

    const { data: onboarding } = await supabase
      .from("recruit_onboarding_plans")
      .select("scheduled_at, location, dress_code, host_name")
      .eq("application_id", applicationId)
      .maybeSingle();

    onboardingDate = formatDate(onboarding?.scheduled_at ?? null);
    onboardingTime = formatTime(onboarding?.scheduled_at ?? null);
    onboardingLocation = onboarding?.location ?? "";
    dressCode = onboarding?.dress_code ?? "";
    hostName = onboarding?.host_name ?? "";

    const rawVariables = (payload.variables ?? {}) as Record<string, unknown>;
    const variables = Object.fromEntries(
      Object.entries(rawVariables).map(([key, value]) => [key, value == null ? "" : String(value)]),
    );
    const defaultVariables = {
      name: personName ?? "",
      job_title: jobTitle,
      job_branch: jobBranch,
      schedule_date: scheduleDate,
      schedule_time: scheduleTime,
      location: usesOnboarding && onboardingLocation ? onboardingLocation : interviewLocation,
      recruiter_name: recruiterName,
      interviewer_name: interviewerName,
      datetime: scheduleDate && scheduleTime ? `${scheduleDate} ${scheduleTime}` : scheduleDate || scheduleTime,
      host_name: hostName || recruiterName,
      onboarding_date: onboardingDate,
      onboarding_time: onboardingTime,
      dress_code: dressCode,
      contact_phone: "",
      contact_email: "",
      coupon_code: "",
    };

    const mergedVariables = { ...defaultVariables, ...variables };
    const renderedSubject = renderTemplate(template.subject, mergedVariables);
    const renderedBody = renderTemplate(template.body_md, mergedVariables);

    const parsedHtml = await marked.parse(renderedBody);

    const beautifulHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f5f7; color: #111827; margin: 0; padding: 0; }
    .wrapper { width: 100%; background-color: #f4f5f7; padding: 40px 0; text-align: center; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e5e7eb; overflow: hidden; text-align: left; }
    .header { background-color: #101010; padding: 40px; color: #ffffff; text-align: center; border-bottom: 4px solid #3d5afe; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.1em; color: #ffffff; }
    .header span { display: block; font-family: monospace; font-size: 10px; color: #3d5afe; margin-bottom: 5px; }
    .content { padding: 40px; font-size: 15px; line-height: 1.7; color: #374151; }
    .content h1, .content h2, .content h3 { color: #111827; margin-top: 0; font-weight: 800; letter-spacing: -0.02em; }
    .content strong { color: #111827; }
    .content blockquote { border-left: 4px solid #3d5afe; background-color: rgba(61, 90, 254, 0.05); margin: 20px 0; padding: 15px 20px; border-radius: 0 8px 8px 0; font-style: italic; }
    .content a { display: inline-block; background-color: #3d5afe; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 13px; letter-spacing: 0.05em; margin: 20px 0; text-align: center; }
    .content ul { padding-left: 20px; }
    .content li { margin-bottom: 8px; }
    .footer { background-color: #f9fafb; padding: 30px 40px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <span>// COMUNICADO OFICIAL</span>
        <h1>SISTEMA ELITE DE TALENTO</h1>
      </div>
      <div class="content">
        ${parsedHtml}
      </div>
      <div class="footer">
        Este es un mensaje transaccional automatizado.<br>Por favor, no respondas directamente a este correo.<br><br>
        <strong>SISTEMA ELITE DE ADQUISICIÓN DE TALENTO &copy; ${new Date().getFullYear()}</strong>
      </div>
    </div>
  </div>
</body>
</html>
  `;


    let status = "failed";
    let providerMessageId: string | null = null;
    let errorText: string | null = null;

    if (EMAIL_SEND_MODE === "log_only") {
      status = "sent";
      providerMessageId = "log_only";
    } else if (EMAIL_SEND_MODE === "smtp") {
      const smtpResult = await sendViaSmtp({
        toAddress,
        subject: renderedSubject,
        body: renderedBody,
        html: beautifulHtml,
      });
      if (!smtpResult.ok) {
        errorText = smtpResult.error ?? "SMTP send failed";
      } else {
        status = "sent";
        providerMessageId = "smtp";
      }
    } else if (EMAIL_SEND_MODE === "sendgrid") {
      if (!SENDGRID_API_KEY) {
        errorText = "SENDGRID_API_KEY is not configured";
      } else if (!SENDGRID_FROM) {
        errorText = "SENDGRID_FROM is not configured";
      } else {
        const from = parseFromAddress(SENDGRID_FROM);
        if (!from) {
          errorText = "SENDGRID_FROM is invalid";
        } else {
          const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SENDGRID_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: toAddress }], subject: renderedSubject }],
              from,
              content: [
                { type: "text/plain", value: renderedBody },
                { type: "text/html", value: beautifulHtml },
              ],
            }),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            errorText = `Provider error: ${response.status} ${errorBody}`;
          } else {
            providerMessageId = response.headers.get("x-message-id");
            status = "sent";
          }
        }
      }
    } else {
      errorText = `EMAIL_SEND_MODE not supported: ${EMAIL_SEND_MODE}`;
    }

    const { error: logError } = await supabase
      .from("recruit_message_logs")
      .insert({
        application_id: applicationId,
        template_id: template.id,
        channel: "email",
        to_address: toAddress,
        status,
        provider_message_id: providerMessageId,
        error: errorText,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      });

    if (logError) {
      return errorResponse("Failed to log message", 500, logError.message);
    }

    const eventKey = status === "sent" ? "email_sent" : "email_failed";
    const { error: eventError } = await supabase.from("recruit_event_logs").insert({
      event_key: eventKey,
      entity_type: "application",
      entity_id: applicationId,
      application_id: applicationId,
      template_id: template.id,
      metadata: {
        status,
        to_address: toAddress,
        template_key: payload.template_key,
        provider_message_id: providerMessageId,
        error: errorText,
      },
      created_by: senderId === "system" ? null : senderId,
    });

    if (eventError) {
      console.error("Failed to log email event", eventError.message);
    }

    if (status !== "sent") {
      return errorResponse("Email delivery failed", 502, errorText);
    }

    return jsonResponse({ ok: true, provider_message_id: providerMessageId });
  } catch (err) {
    console.error("Critical Function Error:", err);
    return errorResponse("Internal server error during email processing", 500, {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
  }
});
