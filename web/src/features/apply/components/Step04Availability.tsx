import type { FieldErrors } from "react-hook-form";
import SlotCalendarV2 from "./SlotCalendarV2";
import type { ApplyFormValues } from "../types";

const SectionTitle = ({ mono, title }: { mono: string, title: string }) => (
  <div className="section-title-wrapper mb-8">
    <span className="mono color-accent">// {mono}</span>
    <h2 className="outfit-bold">{title}</h2>
  </div>
);

interface Step04AvailabilityProps {
  slots: { slot_1: string };
  onChange: (slots: { slot_1: string }) => void;
  errors: FieldErrors<ApplyFormValues>;
  occupiedSlots: string[];
}

export default function Step04Availability({ slots, onChange, errors, occupiedSlots }: Step04AvailabilityProps) {
  return (
    <div className="pro-card compact-card step-enter">
      <SectionTitle mono="AGENDAMIENTO" title="HORARIO DE ENTREVISTA" />
      <p className="mono color-dim mb-8" style={{ fontSize: '0.75rem' }}>
        SELECCIONA EL HORARIO PREFERIDO PARA TU ENTREVISTA VIRTUAL. EL SISTEMA ASIGNARÁ AUTOMÁTICAMENTE AL RECLUTADOR DISPONIBLE.
      </p>

      <div className="availability-wrapper" style={{ minHeight: '400px' }}>
        <SlotCalendarV2
          slots={slots}
          onChange={(newSlots) => onChange(newSlots as { slot_1: string })}
          error={(errors.availability?.slot_1 as any)?.message}
          occupiedSlots={occupiedSlots}
        />
      </div>
    </div>
  );
}
