const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Configuración de Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Configuración de Nodemailer (Motor Elite)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

console.log('--- Motor de Envío de Correo Iniciado ---');
console.log('Escuchando solicitudes de envío...');

async function processQueue() {
  try {
    // Buscar correos en cola
    const { data: logs, error } = await supabase
      .from('recruit_message_logs')
      .select(`
        id,
        application_id,
        to_address,
        template_id,
        recruit_message_templates (
          subject,
          body_md
        )
      `)
      .eq('status', 'queued')
      .limit(10);

    if (error) throw error;

    if (!logs || logs.length === 0) return;

    for (const log of logs) {
      console.log(`\nProcessing email for application: ${log.application_id}`);

      try {
        // Obtener datos del candidato para las variables
        const { data: appData, error: appError } = await supabase
          .from('recruit_applications')
          .select(`
                        id,
                        job_posting_id,
                        assigned_to,
                        meet_link,
                        recruit_candidates (
                            person_id,
                            recruit_persons (
                                first_name,
                                last_name,
                                email
                            )
                        ),
                        profiles:assigned_to (
                            full_name
                        )
                    `)
          .eq('id', log.application_id)
          .single();

        if (appError) throw appError;

        const candidatePerson = appData.recruit_candidates.recruit_persons;
        const candidateName = `${candidatePerson.first_name} ${candidatePerson.last_name}`;
        const recruiterName = appData.profiles?.full_name || 'Reclutador';
        const meetLink = appData.meet_link || '';

        // Determinar qué poner en {name} (el destinatario por defecto)
        let recipientName = candidateName;
        // Si el correo va dirigido a alguien que NO es el candidato, usamos el nombre del reclutador
        if (log.to_address && log.to_address.toLowerCase() !== candidatePerson.email.toLowerCase()) {
          recipientName = recruiterName;
        }

        // Obtener datos de la vacante
        let jobTitle = '';
        let jobBranch = '';
        if (appData.job_posting_id) {
          const { data: job } = await supabase
            .from('recruit_job_postings')
            .select('title, branch')
            .eq('id', appData.job_posting_id)
            .single();
          if (job) {
            jobTitle = job.title;
            jobBranch = job.branch;
          }
        }

        // Obtener datos de la entrevista
        let interviewDate = '';
        let interviewTime = '';
        const { data: interview } = await supabase
          .from('recruit_interviews')
          .select('scheduled_at')
          .eq('application_id', log.application_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (interview && interview.scheduled_at) {
          const d = new Date(interview.scheduled_at);
          interviewDate = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
          interviewTime = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        }

        // Renderizar variables
        const vars = {
          '{name}': recipientName,
          '{candidate_name}': candidateName,
          '{recruiter_name}': recruiterName,
          '{job_title}': jobTitle,
          '{job_branch}': jobBranch,
          '{meet_link}': meetLink,
          '{interview_date}': interviewDate,
          '{interview_time}': interviewTime,
          '{schedule_date}': interviewDate,
          '{schedule_time}': interviewTime,
          '{application_id}': log.application_id,
          '{track_url}': `http://localhost:5173/track?id=${log.application_id}`,
        };

        let subject = log.recruit_message_templates.subject;
        let body = log.recruit_message_templates.body_md;

        for (const [key, val] of Object.entries(vars)) {
          const regex = new RegExp(key, 'g');
          subject = subject.replace(regex, val || '---');
          body = body.replace(regex, val || '---');
        }

        const htmlTemplate = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f5f7; color: #111827; margin: 0; padding: 0; }
    .wrapper { width: 100%; background-color: #f4f5f7; padding: 40px 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e5e7eb; overflow: hidden; }
    .header { background-color: #101010; padding: 40px; color: #ffffff; text-align: center; border-bottom: 4px solid #3d5afe; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.1em; color: #ffffff; }
    .header span { display: block; font-family: monospace; font-size: 10px; color: #3d5afe; margin-bottom: 5px; }
    .content { padding: 40px; font-size: 15px; line-height: 1.7; color: #374151; }
    .footer { background-color: #f9fafb; padding: 30px 40px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
    .cta-button { display: inline-block; padding: 12px 24px; background-color: #3d5afe; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
    strong { color: #111827; font-weight: 700; }
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
        ${body
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: #3d5afe; font-weight: bold; text-decoration: none;">$1</a>')
            .replace(/\n/g, '<br>')
          }
        ${meetLink ? `<br><center><a href="${meetLink}" class="cta-button">UNIRSE A LA REUNIÓN</a></center>` : ''}
      </div>
      <div class="footer">
        <strong>SISTEMA ELITE &copy; ${new Date().getFullYear()}</strong>
      </div>
    </div>
  </div>
</body>
</html>
        `;

        // Enviar correo
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: log.to_address || candidatePerson.email,
          subject: subject,
          html: htmlTemplate,
        });

        // Actualizar log a 'sent'
        await supabase
          .from('recruit_message_logs')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', log.id);

        console.log(`✅ Email sent to ${log.to_address || candidatePerson.email}`);

      } catch (innerError) {
        console.error(`❌ Error processing log ${log.id}:`, innerError.message);
        await supabase
          .from('recruit_message_logs')
          .update({ status: 'failed', error: innerError.message })
          .eq('id', log.id);
      }
    }
  } catch (error) {
    console.error('Queue processing error:', error.message);
  }
}

// Ejecutar cada 10 segundos
setInterval(processQueue, 10000);
processQueue();
