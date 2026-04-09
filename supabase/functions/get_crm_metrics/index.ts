import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Global Counts
    // Consultas optimizadas en paralelo
    const [
      { count: totalApps },
      { count: emailsSent },
      { count: emailsFailed },
      { data: statusBreakdown },
      { data: recentLogs }
    ] = await Promise.all([
      supabaseClient.from("recruit_applications").select("*", { count: "exact", head: true }),
      supabaseClient.from("recruit_message_logs").select("*", { count: "exact", head: true }).eq("status", "sent"),
      supabaseClient.from("recruit_message_logs").select("*", { count: "exact", head: true }).eq("status", "failed"),
      supabaseClient.rpc("get_status_counts"), // Si no existe el RPC, usaremos fallback vía .select()
      supabaseClient.from("recruit_event_logs")
        .select(`
          id, event_key, entity_type, entity_id, application_id, template_id, metadata, created_at, 
          profiles:created_by(full_name), 
          recruit_message_templates(template_key, subject)
        `)
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

    // Fallback si no hay RPC de conteo por estatus
    let finalStatusBreakdown = statusBreakdown;
    if (!statusBreakdown) {
       const { data: appsByStatus } = await supabaseClient
         .from("recruit_applications")
         .select("status_key");
       
       const counts: Record<string, number> = {};
       appsByStatus?.forEach(app => {
         counts[app.status_key] = (counts[app.status_key] || 0) + 1;
       });
       finalStatusBreakdown = Object.entries(counts).map(([key, count]) => ({ status_key: key, count }));
    }

    return new Response(JSON.stringify({
      summary: {
        total_applications: totalApps || 0,
        emails_sent: emailsSent || 0,
        emails_failed: emailsFailed || 0,
        status_breakdown: finalStatusBreakdown
      },
      recent_events: recentLogs || []
    }), {
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
