const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const templates = [
    {
        template_key: 'welcome_candidate',
        subject: '¡Bienvenido/a al equipo! 🚀',
        body_md: '# Hola {name},\n\nEs un gusto saludarte. Te damos la bienvenida oficial a nuestro proceso de selección para la vacante de **{job_title}** en la sucursal **{job_branch}**.\n\nEstamos muy emocados de conocerte mejor.\n\nAtentamente,\nEl equipo de Reclutamiento',
        is_active: true
    },
    {
        template_key: 'reject_after_call',
        subject: 'Gracias por tu interés',
        body_md: 'Hola {name},\n\nGracias por tu tiempo. En esta ocasión no continuaremos con tu proceso.\n\nTe agradecemos tu interés.\n\nAtentamente,\nRH',
        is_active: true
    },
    {
        template_key: 'schedule_interview',
        subject: 'Agenda tu entrevista',
        body_md: 'Hola {name},\n\nGracias por tu interés. Para continuar, te esperamos en:\n\n- **Fecha:** {schedule_date}\n- **Hora:** {schedule_time}\n- **Lugar:** {location}\n- **Reclutador:** {recruiter_name}\n\nAtentamente,\nRH',
        is_active: true
    }
];

async function seed() {
    console.log('--- Insertando/Actualizando plantillas con Supabase JS ---');
    for (const temp of templates) {
        const { error } = await supabase
            .from('recruit_message_templates')
            .upsert(temp, { onConflict: 'template_key' });

        if (error) {
            console.error(`❌ Error en ${temp.template_key}:`, error.message);
        } else {
            console.log(`✅ ${temp.template_key} ok`);
        }
    }
}

seed();
