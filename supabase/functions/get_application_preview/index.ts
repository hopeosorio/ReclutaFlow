import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { corsHeaders } from "../_shared/cors.ts"

interface RequestBody {
  application_id: string;
}

serve(async (req) => {
  // Manejo de CORS (Preflight requests)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { application_id } = await req.json() as RequestBody;

    if (!application_id) {
       return new Response(JSON.stringify({ error: "application_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Fetch Application + Job + Candidate + Person
    const { data: app, error: appError } = await supabaseClient
      .from("recruit_applications")
      .select(`
        id, 
        assigned_to,
        job_posting_id,
        recruit_job_postings(title, branch),
        recruit_candidates(
          recruit_persons(first_name, last_name, email)
        )
      `)
      .eq("id", application_id)
      .single();

    if (appError || !app) {
      return new Response(JSON.stringify({ error: appError?.message || "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Fetch Recruiter name (if assigned)
    let recruiterName = "";
    if (app.assigned_to) {
      const { data: rec } = await supabaseClient
        .from("profiles")
        .select("full_name")
        .eq("id", app.assigned_to)
        .maybeSingle();
      recruiterName = rec?.full_name || "";
    }

    // 3. Fetch Interview details (last one)
    const { data: interview } = await supabaseClient
      .from("recruit_interviews")
      .select("scheduled_at, location, profiles:interviewer_id(full_name)")
      .eq("application_id", application_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Formatting Utilities
    const formatMXDate = (dateStr: string | null) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("es-MX", { 
        year: "numeric", month: "2-digit", day: "2-digit", 
        timeZone: "America/Mexico_City" 
      }).format(d);
    };

    const formatMXTime = (dateStr: string | null) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("es-MX", { 
        hour: "2-digit", minute: "2-digit", 
        timeZone: "America/Mexico_City", 
        hour12: false 
      }).format(d);
    };

    const person = (app.recruit_candidates as any)?.recruit_persons;
    const scheduleDate = formatMXDate(interview?.scheduled_at || null);
    const scheduleTime = formatMXTime(interview?.scheduled_at || null);

    // 5. Build Final Map
    const variables = {
      name: `${person?.first_name || ""} ${person?.last_name || ""}`.trim(),
      job_title: (app.recruit_job_postings as any)?.title || "",
      job_branch: (app.recruit_job_postings as any)?.branch || "",
      schedule_date: scheduleDate,
      schedule_time: scheduleTime,
      location: interview?.location || "",
      recruiter_name: recruiterName,
      interviewer_name: (interview?.profiles as any)?.full_name || "",
      contact_email: person?.email || "",
      datetime: scheduleDate && scheduleTime ? `${scheduleDate} ${scheduleTime}` : (scheduleDate || scheduleTime || ""),
      application_id: app.id
    };

    return new Response(JSON.stringify({ variables }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
