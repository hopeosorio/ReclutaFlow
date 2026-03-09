const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const statuses = [
    { status_key: 'new', label: 'Nuevo Registro', sort_order: 1, category: 'lead', requires_reason: false },
    { status_key: 'docs_validation', label: 'Validación de Documentos', sort_order: 2, category: 'screening', requires_reason: false },
    { status_key: 'virtual_pending', label: 'Entrevista Pendiente', sort_order: 3, category: 'interview', requires_reason: false },
    { status_key: 'virtual_done', label: 'Entrevista Completada', sort_order: 4, category: 'interview', requires_reason: false },
    { status_key: 'final_docs', label: 'Documentación Final', sort_order: 5, category: 'onboarding', requires_reason: false },
    { status_key: 'onboarding_scheduled', label: 'Onboarding Programado', sort_order: 6, category: 'onboarding', requires_reason: false },
    { status_key: 'hired', label: 'Contratado', sort_order: 7, category: 'terminal', requires_reason: false },
    { status_key: 'rejected', label: 'Rechazado', sort_order: 8, category: 'terminal', requires_reason: true },
    { status_key: 'withdrawn', label: 'Retirado Voluntariamente', sort_order: 9, category: 'terminal', requires_reason: true }
];

const transitions = [
    { from_status_key: 'new', to_status_key: 'docs_validation', is_active: true },
    { from_status_key: 'new', to_status_key: 'virtual_pending', is_active: true },
    { from_status_key: 'new', to_status_key: 'rejected', is_active: true },
    { from_status_key: 'new', to_status_key: 'withdrawn', is_active: true },
    { from_status_key: 'docs_validation', to_status_key: 'virtual_pending', is_active: true },
    { from_status_key: 'docs_validation', to_status_key: 'rejected', is_active: true },
    { from_status_key: 'virtual_pending', to_status_key: 'virtual_done', is_active: true },
    { from_status_key: 'virtual_pending', to_status_key: 'rejected', is_active: true },
    { from_status_key: 'virtual_done', to_status_key: 'final_docs', is_active: true },
    { from_status_key: 'virtual_done', to_status_key: 'rejected', is_active: true },
    { from_status_key: 'final_docs', to_status_key: 'onboarding_scheduled', is_active: true },
    { from_status_key: 'onboarding_scheduled', to_status_key: 'hired', is_active: true }
];

async function seed() {
    console.log('--- Configurando Estatus de Reclutamiento ---');
    for (const s of statuses) {
        const { error } = await supabase.from('recruit_statuses').upsert(s);
        if (error) console.error(`❌ Error estatus ${s.status_key}:`, error.message);
        else console.log(`✅ Estatus ${s.status_key} ok`);
    }

    console.log('\n--- Configurando Transiciones ---');
    for (const t of transitions) {
        const { error } = await supabase.from('recruit_status_transitions').upsert(t);
        if (error) console.error(`❌ Error transición ${t.from_status_key} -> ${t.to_status_key}:`, error.message);
        else console.log(`✅ Transición ${t.from_status_key} -> ${t.to_status_key} ok`);
    }
}

seed();
