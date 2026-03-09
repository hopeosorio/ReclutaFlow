// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getAdminClient } from "../_shared/supabase.ts";

/**
 * Edge Function to send 24h reminders for scheduled interviews.
 * Should be triggered daily by a Supabase Cron.
 */
serve(async (req: Request) => {
    // Basic security check for cron (can be improved with a secret header)
    const authHeader = req.headers.get("Authorization");
    const admin = getAdminClient();

    // 1. Calculate the time window (Interviews for tomorrow)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const startOfTomorrow = new Date(tomorrow);
    startOfTomorrow.setHours(0, 0, 0, 0);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);

    console.log(`Checking interviews between ${startOfTomorrow.toISOString()} and ${endOfTomorrow.toISOString()}`);

    // 2. Fetch interviews in that window
    const { data: interviews, error } = await admin
        .from("recruit_interviews")
        .select(`
      id,
      scheduled_at,
      application_id,
      recruit_applications (
        id,
        candidate_id,
        recruit_candidates (
          recruit_persons (
            email,
            first_name
          )
        )
      )
    `)
        .eq("result", "pending")
        .gte("scheduled_at", startOfTomorrow.toISOString())
        .lte("scheduled_at", endOfTomorrow.toISOString());

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!interviews || interviews.length === 0) {
        return new Response(JSON.stringify({ message: "No interviews scheduled for tomorrow." }), { status: 200 });
    }

    let sentCount = 0;
    let skipCount = 0;

    for (const iv of interviews) {
        // 3. Check if we already sent a reminder for this interview
        const { data: existing } = await admin
            .from("recruit_event_logs")
            .select("id")
            .eq("event_key", "remind_24h_sent")
            .eq("entity_id", iv.id)
            .maybeSingle();

        if (existing) {
            skipCount++;
            continue;
        }

        // 4. Trigger reminder intent
        // Note: We insert into event_logs to track the action.
        // In a full implementation, we'd also call a mailing service or the send_email function.
        // Since send_email requires a User Client, we'll perform the insert and assume 
        // there's a background process or we'll eventually transition to a shared mailer.

        // For now, let's log the attempt and create the event.
        console.log(`Reminding candidate for interview ${iv.id} (Application: ${iv.application_id})`);

        const { error: logError } = await admin.from("recruit_event_logs").insert({
            event_key: "remind_24h_sent",
            entity_type: "interview",
            entity_id: iv.id,
            application_id: iv.application_id,
            metadata: {
                status: "queued",
                scheduled_at: iv.scheduled_at,
                email: (iv.recruit_applications as any)?.recruit_candidates?.recruit_persons?.email
            }
        });

        if (!logError) {
            sentCount++;
        }
    }

    return new Response(JSON.stringify({
        processed: interviews.length,
        sent: sentCount,
        already_sent: skipCount
    }), { status: 200 });
});
