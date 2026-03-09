// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { google } from "npm:googleapis@126.0.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        console.log("--- Edge Function: schedule_interview started ---");

        // 1. Setup Supabase Admin Client
        const url = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!url || !serviceKey) {
            console.error("❌ Critical: Missing environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
            throw new Error("Internal Server Error: Missing config");
        }

        const supabaseAdmin = createClient(url, serviceKey);

        // 2. Auth user calling this endpoint
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            console.error("❌ Unauthorized: Missing Authorization header");
            return new Response(JSON.stringify({ error: "No se proporcionó token de autorización" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401,
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            console.error("❌ Unauthorized: Invalid token or user not found", authError?.message);
            return new Response(JSON.stringify({ error: `Sesión inválida: ${authError?.message || 'Usuario no encontrado'}` }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 401,
            });
        }

        console.log(`✅ Authorized user: ${user.email} (${user.id})`);

        // 3. Get Request Body
        const body = await req.json();
        const { application_id, scheduled_at, interviewer_id } = body;

        if (!application_id || !scheduled_at) {
            throw new Error("Faltan campos obligatorios: application_id o scheduled_at");
        }

        // 4. Get Application info
        const { data: appData, error: dbError } = await supabaseAdmin
            .from("recruit_applications")
            .select(`
                id, 
                recruit_candidates(
                    recruit_persons(
                        first_name, 
                        last_name, 
                        email
                    )
                ),
                recruit_job_postings(title)
            `)
            .eq("id", application_id)
            .single();

        if (dbError || !appData) {
            console.error("❌ Application DB Error:", dbError);
            throw new Error("No se encontró la solicitud especificada.");
        }

        const person = (appData.recruit_candidates as any)?.recruit_persons;
        const candidateEmail = person?.email;
        const candidateName = `${person?.first_name} ${person?.last_name}`;
        const jobTitle = (appData.recruit_job_postings as any)?.title || "Vacante";

        const startTime = new Date(scheduled_at);
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour interview

        // 5. Generar link de videollamada usando Jitsi Meet (funciona sin API keys ni Google Workspace)
        // El nombre de sala es único por aplicación, así siempre apunta a la misma sala
        const shortId = application_id.replace(/-/g, '').substring(0, 10);
        const meetLink = `https://meet.jit.si/entrevista-${shortId}`;
        console.log("✅ Jitsi Meet link generado:", meetLink);

        // 5b. Intentar registrar evento en Google Calendar con el link de Jitsi
        const googleServiceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
        if (googleServiceAccountKey) {
            try {
                const credentials = JSON.parse(googleServiceAccountKey);
                const { google } = await import("npm:googleapis@126.0.1");
                const calAuth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: ['https://www.googleapis.com/auth/calendar.events'],
                });
                const calendar = google.calendar({ version: 'v3', auth: calAuth });
                const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || 'primary';

                await calendar.events.insert({
                    calendarId,
                    resource: {
                        summary: `Entrevista Virtual: ${candidateName} - ${jobTitle}`,
                        description: `Enlace de videollamada: ${meetLink}\nCandidato: ${candidateName} (${candidateEmail || 'Sin correo'})`,
                        location: meetLink,
                        start: { dateTime: startTime.toISOString(), timeZone: 'America/Mexico_City' },
                        end: { dateTime: endTime.toISOString(), timeZone: 'America/Mexico_City' },
                    },
                    sendUpdates: 'none',
                });
                console.log("✅ Evento registrado en Google Calendar");
            } catch (calErr) {
                // No bloqueamos si Calendar falla — el link de Jitsi sigue siendo válido
                console.warn("⚠️ No se pudo crear evento en Calendar:", calErr.message);
            }
        }

        // 6. Save Interview Record
        const { error: intError } = await supabaseAdmin.from("recruit_interviews").insert({
            application_id: application_id,
            interviewer_id: interviewer_id || user.id,
            scheduled_at: scheduled_at,
            interview_type: "virtual",
            notes: "Entrevista virtual (Google Meet)",
            result: "pending"
        });

        if (intError) {
            console.error("❌ Error inserting interview:", intError);
            throw intError;
        }

        // 7. Update Application status
        const { error: appUpdateError } = await supabaseAdmin.from("recruit_applications")
            .update({
                meet_link: meetLink,
                status_key: 'interview_scheduled',
                status_reason: `Entrevista vía Jitsi Meet agendada para: ${startTime.toLocaleString()}`
            })
            .eq("id", application_id);

        if (appUpdateError) {
            console.error("❌ Error updating application:", appUpdateError);
            throw appUpdateError;
        }

        return new Response(JSON.stringify({ success: true, meet_link: meetLink }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.error("❌ Global catch error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
