const https = require('https');

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

const data = JSON.stringify(templates);

const options = {
    hostname: 'lwjyxfflpxptdmgupgmj.supabase.co',
    path: '/rest/v1/recruit_message_templates',
    method: 'POST', // POST with resolution=merge-duplicates acts like UPSERT in PostgREST
    headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3anl4ZmZscHhwdGRtZ3VwZ21qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1OTY5MjQsImV4cCI6MjA4ODE3MjkyNH0.cm1X9hki0qJ9UpH1FK04lP_PY-7_t2M-PZ1sbKJA-Ho',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3anl4ZmZscHhwdGRtZ3VwZ21qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1OTY5MjQsImV4cCI6MjA4ODE3MjkyNH0.cm1X9hki0qJ9UpH1FK04lP_PY-7_t2M-PZ1sbKJA-Ho',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': data.length
    }
};

console.log('--- Insertando plantillas de correo ---');

const req = https.request(options, (res) => {
    console.log('Status:', res.statusCode);
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ Plantillas insertadas/actualizadas correctamente.');
        } else {
            console.log('❌ Error al insertar plantillas:', body);
        }
    });
});

req.on('error', (e) => {
    console.error('❌ Error de conexión:', e.message);
});

req.write(data);
req.end();
