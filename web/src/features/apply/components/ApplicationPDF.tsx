import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { ApplyFormValues, JobPosting, JobProfile } from '../types';

interface Props {
  values: ApplyFormValues;
  jobPosting?: JobPosting;
  jobProfile?: JobProfile | null;
}

const isTrue = (v: unknown) => v === true || v === 'true';
const yesNo = (v: unknown) => isTrue(v) ? 'SÍ' : 'NO';

const scheduleLabel = (v: string) =>
  ({ morning: 'MATUTINO (AM)', afternoon: 'VESPERTINO (PM)', rotative: 'ROLA TURNOS' } as Record<string, string>)[v] ??
  'AMBOS / SIN PREFERENCIA';

const maritalLabel = (v: string) =>
  ({
    soltero: 'Soltero/a', casado: 'Casado/a', union_libre: 'Unión Libre',
    divorciado: 'Divorciado/a', viudo: 'Viudo/a', prefiero_no_decir: 'Prefiero no decir',
  } as Record<string, string>)[v] ?? v;

const BLACK = '#000000';
const GRAY_BG = '#E8E8E8';
const GRAY_TEXT = '#444444';

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 8, color: BLACK, padding: 30, lineHeight: 1.3 },
  sectionTitle: {
    backgroundColor: GRAY_BG, textAlign: 'center', fontFamily: 'Helvetica-Bold',
    fontSize: 8, padding: 4, borderWidth: 1, borderColor: BLACK, marginTop: 4,
  },
  tableWrap: { borderWidth: 1, borderColor: BLACK, marginBottom: 6 },
  row: { flexDirection: 'row' },
  rowBB: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BLACK },
  label: { fontFamily: 'Helvetica-Bold', fontSize: 6, color: GRAY_TEXT, marginBottom: 1 },
  val: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  bold: { fontFamily: 'Helvetica-Bold' },
  small: { fontSize: 6 },
  dimSmall: { fontSize: 6, color: GRAY_TEXT },
});

const cell = (flex = 1) => ({ flex, padding: 4, borderRightWidth: 1, borderRightColor: BLACK });
const lastCell = (flex = 1) => ({ flex, padding: 4 });

export function ApplicationPDF({ values: v, jobPosting, jobProfile }: Props) {
  const today = new Date().toLocaleDateString('es-MX');
  const ad = v.application_details;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── ENCABEZADO ── */}
        <View style={s.tableWrap}>
          <View style={s.row}>
            <View style={[cell(1.5), { alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold' }}>MEWI</Text>
            </View>
            <View style={[cell(3), { alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>SOLICITUD DE EMPLEO</Text>
            </View>
            <View style={lastCell(1.5)}>
              <Text style={s.dimSmall}>Fecha de solicitud:</Text>
              <Text style={s.bold}>{today}</Text>
              <Text style={[s.dimSmall, { marginTop: 4 }]}>Puesto que solicita:</Text>
              <Text style={s.bold}>{jobPosting?.title ?? '---'}</Text>
              {jobProfile?.salary_range ? <>
                <Text style={[s.dimSmall, { marginTop: 4 }]}>Sueldo mensual ofrecido:</Text>
                <Text style={s.bold}>{jobProfile.salary_range}</Text>
              </> : null}
            </View>
          </View>
        </View>

        {/* ── DATOS PERSONALES ── */}
        <Text style={s.sectionTitle}>DATOS PERSONALES</Text>
        <View style={s.tableWrap}>
          <View style={s.rowBB}>
            <View style={cell(3)}><Text style={s.label}>Nombre del candidato:</Text><Text style={s.val}>{v.signer_name}</Text></View>
            <View style={lastCell(1)}><Text style={s.label}>Fecha de nacimiento:</Text><Text style={s.val}>{v.person.birth_date}</Text></View>
          </View>
          <View style={s.rowBB}>
            <View style={cell(3)}><Text style={s.label}>Calle y número (Residencia):</Text><Text style={s.val}>{v.person.address_line1}</Text></View>
            <View style={lastCell(1)}><Text style={s.label}>C.P.</Text><Text style={s.val}>{v.person.postal_code}</Text></View>
          </View>
          <View style={s.rowBB}>
            <View style={cell(2)}><Text style={s.label}>Colonia / Municipio</Text><Text style={s.val}>{v.person.colonia}</Text></View>
            <View style={lastCell(2)}><Text style={s.label}>Estado</Text><Text style={s.val}>{v.person.state}</Text></View>
          </View>
          <View style={s.rowBB}>
            <View style={cell(1)}><Text style={s.label}>Teléfono</Text><Text style={s.val}>{v.person.phone}</Text></View>
            <View style={cell(1)}><Text style={s.label}>Tel. Opcional</Text><Text style={s.val}>{v.person.phone_optional || '---'}</Text></View>
            <View style={cell(2)}><Text style={s.label}>Email</Text><Text style={s.val}>{v.person.email}</Text></View>
            <View style={lastCell(1)}><Text style={s.label}>Escolaridad</Text><Text style={s.val}>{v.candidate.education_level.toUpperCase()}</Text></View>
          </View>
          <View style={s.row}>
            <View style={cell(2)}><Text style={s.label}>Estado Civil</Text><Text style={s.val}>{maritalLabel(v.person.marital_status)}</Text></View>
          </View>
        </View>

        {/* ── DATOS DEL EMPLEO ── */}
        <Text style={s.sectionTitle}>DATOS DEL EMPLEO & DISPONIBILIDAD</Text>
        <View style={s.tableWrap}>
          <View style={s.rowBB}>
            <View style={cell(1)}><Text style={s.label}>Experiencia en vacante</Text><Text style={s.val}>{yesNo(ad.has_experience)}</Text></View>
            <View style={cell(1)}><Text style={s.label}>Años de experiencia</Text><Text style={s.val}>{ad.years_experience || 0}</Text></View>
            <View style={cell(1)}><Text style={s.label}>Turno</Text><Text style={s.val}>{scheduleLabel(ad.schedule_preference)}</Text></View>
            <View style={lastCell(1)}><Text style={s.label}>Disponible fines de semana</Text><Text style={s.val}>{yesNo(ad.weekend_availability)}</Text></View>
          </View>
          <View style={s.row}>
            <View style={cell(1)}><Text style={s.label}>Compromiso fijo (Escuela/Otro)</Text><Text style={s.val}>{yesNo(ad.fixed_commitment_bool)}</Text></View>
            <View style={lastCell(3)}>
              {isTrue(ad.fixed_commitment_bool) ? <>
                <Text style={s.label}>¿Cuál?</Text>
                <Text style={s.val}>{ad.fixed_commitment || '---'}</Text>
              </> : null}
            </View>
          </View>
        </View>

        {/* ── REFERENCIA LABORAL ── */}
        <Text style={s.sectionTitle}>REFERENCIA LABORAL (ÚLTIMOS 2 EMPLEOS)</Text>
        <View style={s.tableWrap}>
          <View style={s.rowBB}>
            <View style={cell(1.5)}><Text style={s.bold}>Empresa / Puesto</Text></View>
            <View style={cell(1)}><Text style={s.bold}>Periodo (Del/Al)</Text></View>
            <View style={cell(1)}><Text style={s.bold}>Jefe (Nombre/Puesto)</Text></View>
            <View style={cell(0.8)}><Text style={s.bold}>Teléfono</Text></View>
            <View style={lastCell(1)}><Text style={s.bold}>Motivo Separación</Text></View>
          </View>
          {v.work_history.filter(w => w.company).length === 0 ? (
            <View style={s.row}>
              <View style={[lastCell(1), { alignItems: 'center' }]}><Text>SIN EXPERIENCIA REPORTADA</Text></View>
            </View>
          ) : v.work_history.filter(w => w.company).map((w, i, arr) => (
            <View key={i} style={i < arr.length - 1 ? s.rowBB : s.row}>
              <View style={cell(1.5)}><Text style={s.bold}>{w.company}</Text><Text>{w.position}</Text></View>
              <View style={cell(1)}><Text>Inicio: {w.period_from}</Text><Text>Fin: {w.period_to}</Text></View>
              <View style={cell(1)}><Text style={s.bold}>{w.manager}</Text><Text>{w.manager_position}</Text></View>
              <View style={cell(0.8)}><Text>{w.phone}</Text></View>
              <View style={lastCell(1)}><Text>{w.reason_for_leaving}</Text></View>
            </View>
          ))}
        </View>

        {/* ── REFERENCIAS PERSONALES ── */}
        <Text style={s.sectionTitle}>REFERENCIAS PERSONALES</Text>
        <View style={s.tableWrap}>
          <View style={s.rowBB}>
            <View style={cell(2)}><Text style={s.bold}>Nombre</Text></View>
            <View style={cell(1)}><Text style={s.bold}>Ocupación</Text></View>
            <View style={lastCell(1)}><Text style={s.bold}>Teléfono</Text></View>
          </View>
          {v.personal_references.filter(r => r.name).length === 0 ? (
            <View style={s.row}>
              <View style={[lastCell(1), { alignItems: 'center' }]}><Text>SIN REFERENCIAS REPORTADAS</Text></View>
            </View>
          ) : v.personal_references.filter(r => r.name).map((r, i, arr) => (
            <View key={i} style={i < arr.length - 1 ? s.rowBB : s.row}>
              <View style={cell(2)}><Text>{r.name}</Text></View>
              <View style={cell(1)}><Text>{r.occupation}</Text></View>
              <View style={lastCell(1)}><Text>{r.phone}</Text></View>
            </View>
          ))}
        </View>

        {/* ── DATOS GENERALES & CONOCIMIENTOS ── */}
        <Text style={s.sectionTitle}>DATOS GENERALES & CONOCIMIENTOS</Text>
        <View style={s.tableWrap}>
          <View style={s.rowBB}>
            <View style={cell(1)}><Text style={s.label}>De acuerdo con sueldo</Text><Text style={s.val}>{ad.agrees_with_salary === 'yes' ? 'SÍ' : ad.agrees_with_salary === 'no' ? 'NO' : 'NEGOCIABLE'}</Text></View>
            <View style={cell(1)}><Text style={s.label}>Crédito Infonavit</Text><Text style={s.val}>{yesNo(ad.has_infonavit)}</Text></View>
            <View style={cell(1)}><Text style={s.label}>Trabajó antes con nosotros</Text><Text style={s.val}>{yesNo(ad.previous_employee)}</Text></View>
            <View style={lastCell(1)}>
              {isTrue(ad.previous_employee) ? <>
                <Text style={s.label}>Motivo del retiro</Text>
                <Text style={s.val}>{ad.previous_employee_reason || '---'}</Text>
              </> : null}
            </View>
          </View>
          <View style={s.row}>
            <View style={cell(1)}><Text style={s.label}>Manejo de Caja</Text><Text style={s.val}>{v.skills.cashier ? 'SÍ' : 'NO'}</Text></View>
            <View style={cell(1)}><Text style={s.label}>Bebidas</Text><Text style={s.val}>{v.skills.drinks ? 'SÍ' : 'NO'}</Text></View>
            <View style={cell(1)}><Text style={s.label}>Inventario</Text><Text style={s.val}>{v.skills.inventory ? 'SÍ' : 'NO'}</Text></View>
            <View style={cell(1)}><Text style={s.label}>Limpieza</Text><Text style={s.val}>{v.skills.cleaning ? 'SÍ' : 'NO'}</Text></View>
            <View style={lastCell(1)}><Text style={s.label}>Otras habilidades</Text><Text style={s.val}>{v.skills.others || '---'}</Text></View>
          </View>
        </View>

        {/* ── SALUD & SEGURIDAD ── */}
        <Text style={s.sectionTitle}>SALUD & SEGURIDAD</Text>
        <View style={s.tableWrap}>
          <View style={s.row}>
            <View style={cell(2)}><Text style={s.label}>Ajustes razonables sugeridos</Text><Text style={s.val}>{ad.health_adjustments || 'NINGUNO'}</Text></View>
            <View style={lastCell(1)}><Text style={s.label}>Fecha de inicio disponible</Text><Text style={s.val}>{ad.start_date}</Text></View>
          </View>
        </View>

        {/* ── COMENTARIOS ── */}
        <View style={{ borderWidth: 1, borderColor: BLACK, padding: 5, marginTop: 4 }}>
          <Text style={s.bold}>COMENTARIOS ADICIONALES:</Text>
          <Text style={{ marginTop: 3, minHeight: 20 }}>{ad.comments || 'SIN COMENTARIOS'}</Text>
        </View>

        {/* ── FIRMA ── */}
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <View style={{ width: 280, alignItems: 'center' }}>
            {v.signature_base64
              ? <Image src={v.signature_base64} style={{ height: 55, width: 180, marginBottom: 6 }} />
              : <View style={{ height: 61 }} />
            }
            <View style={{ borderTopWidth: 1, borderTopColor: BLACK, width: '100%', paddingTop: 5, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10 }}>{v.signer_name.toUpperCase()}</Text>
              <Text style={{ fontSize: 6, color: GRAY_TEXT, marginTop: 2 }}>NOMBRE Y FIRMA DEL SOLICITANTE</Text>
            </View>
          </View>
        </View>

        {/* ── LEYENDA ── */}
        <Text style={{ fontSize: 6, color: GRAY_TEXT, textAlign: 'center', marginTop: 12, fontFamily: 'Helvetica-Oblique' }}>
          Hago constar que mis respuestas son verdaderas y autorizo la verificación de mis datos.
        </Text>

      </Page>
    </Document>
  );
}
