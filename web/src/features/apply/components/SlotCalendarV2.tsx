import { useState, useMemo, useCallback } from 'react';
import Calendar from 'react-calendar';
import { format, isBefore, isWeekend, startOfDay, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, CheckCircle2 } from 'lucide-react';
import 'react-calendar/dist/Calendar.css';

interface SlotCalendarV2Props {
    slots: { slot_1: string };
    onChange: (slots: { slot_1: string }) => void;
    error?: string;
    occupiedSlots: string[];
}

export default function SlotCalendarV2({ slots, onChange, error, occupiedSlots }: SlotCalendarV2Props) {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const availableHours = [9, 10, 11, 12, 13, 14, 15, 16];
    
    // MEMOIZE DATES SO CALENDAR DOESN'T RE-RENDER AND COLLAPSE
    const { tomorrow, maxAllowedDate } = useMemo(() => {
        const today = startOfDay(new Date());
        return {
            tomorrow: addDays(today, 1),
            maxAllowedDate: addDays(today, 11)
        };
    }, []);

    const tileDisabled = useCallback(({ date }: { date: Date }) => isWeekend(date), []);

    const confirmedSlot = slots['slot_1'] || '';

    const handleDateChange = (value: any) => {
        setSelectedDate(value as Date);
    };

    const handleTimeSelect = (hour: number) => {
        if (!selectedDate) return;
        const d = new Date(selectedDate);
        d.setHours(hour, 0, 0, 0);
        const isoSlot = format(d, "yyyy-MM-dd'T'HH:mm:ssxxx");
        onChange({ slot_1: isoSlot });
    };

    return (
        <div className="availability-card pro-card" style={{ padding: '2rem', border: '1px solid var(--border-dim)', background: 'rgba(255,255,255,0.02)' }}>

            <div className="slot-calendar-grid">
                {/* LEFT: Calendar */}
                <div>
                    <h4 className="mono color-dim mb-4" style={{ fontSize: '0.8rem', letterSpacing: '0.1em' }}>
                        <CalendarIcon size={14} style={{ display: 'inline', marginRight: '6px' }} />
                        SELECCIONA UN DÍA
                    </h4>
                    <div className="custom-calendar-wrapper" style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                        <Calendar
                            onChange={handleDateChange}
                            value={selectedDate}
                            minDate={tomorrow}
                            maxDate={maxAllowedDate}
                            tileDisabled={tileDisabled}
                            className="elite-calendar"
                        />
                    </div>
                </div>

                {/* RIGHT: Times */}
                <div>
                    {selectedDate ? (
                        <>
                            <div className="hours-grid-wrapper mb-8">
                                <h4 className="mono color-dim mb-4" style={{ fontSize: '0.8rem' }}>
                                    <Clock size={14} style={{ display: 'inline', marginRight: '6px' }} />
                                    HORARIOS — {format(selectedDate, 'dd/MM/yyyy')}
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                    {availableHours.map((hour) => {
                                        const d = new Date(selectedDate);
                                        d.setHours(hour, 0, 0, 0);
                                        const isoSlot = format(d, "yyyy-MM-dd'T'HH:mm:ssxxx");
                                        const slotDate = new Date(isoSlot);
                                        const now = new Date();
                                        const isPast = isBefore(slotDate, now);
                                        const diffHours = (slotDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                                        const isTooClose = diffHours < 24;
                                        const isOccupied = occupiedSlots.some(os => new Date(os).getTime() === slotDate.getTime());
                                        const isSelected = confirmedSlot === isoSlot;
                                        const isDisabled = isPast || isTooClose || isOccupied;

                                        return (
                                            <button
                                                key={hour}
                                                type="button"
                                                disabled={isDisabled}
                                                onClick={() => handleTimeSelect(hour)}
                                                className={`hour-slot mono ${isSelected ? 'selected' : ''}`}
                                                style={{
                                                    padding: '0.9rem 0',
                                                    fontSize: '0.85rem',
                                                    borderRadius: '8px',
                                                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-dim)',
                                                    background: isSelected ? 'var(--accent)' : 'var(--bg-soft)',
                                                    color: isSelected ? '#fff' : (isOccupied ? '#ff4d4d' : (isDisabled ? 'rgba(255,255,255,0.2)' : 'var(--text-main)')),
                                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    fontWeight: isOccupied ? 'bold' : 'normal',
                                                }}
                                            >
                                                {isOccupied ? (
                                                    <>
                                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', pointerEvents: 'none', borderRadius: '8px' }} />
                                                        <span style={{ position: 'relative', zIndex: 1, fontSize: '0.65rem', letterSpacing: '0.05em' }}>LLENO</span>
                                                    </>
                                                ) : (isTooClose || isPast) ? (
                                                    <span style={{ fontSize: '0.6rem', opacity: 0.8, color: 'var(--text-dim)', fontWeight: 'bold' }}>NO DISPONIBLE</span>
                                                ) : (
                                                    `${hour}:00`
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Slot confirmado - Debajo del grid, alineado a la derecha */}
                            {confirmedSlot && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center',
                                        background: 'rgba(61,90,254,0.1)', border: '1px solid var(--accent)',
                                        borderRadius: '12px', padding: '1rem 1.5rem', width: '300px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <CheckCircle2 size={22} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                            <div>
                                                <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: '2px' }}>HORARIO SELECCIONADO</div>
                                                <div className="outfit-bold" style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                                    {format(new Date(confirmedSlot), "EEEE dd 'de' MMMM yyyy", { locale: es }).toUpperCase()}
                                                </div>
                                                <div className="mono" style={{ fontSize: '1rem', color: 'var(--accent)' }}>
                                                    {format(new Date(confirmedSlot), 'HH:mm')} HRS
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="mb-8 p-6 mono color-dim flex-center"
                            style={{ border: '1px dashed var(--border-dim)', borderRadius: '12px', fontSize: '0.7rem', minHeight: '200px', flexDirection: 'column', textAlign: 'center', gap: '0.5rem' }}>
                            <span className="desktop-arrow">← SELECCIONA UN DÍA EN EL CALENDARIO</span>
                            <span className="mobile-arrow">↑<br/>SELECCIONA UN DÍA EN EL CALENDARIO</span>
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="field-err mt-6 mb-2"
                    style={{ background: 'rgba(255,0,0,0.1)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #ff4444', textAlign: 'center' }}>
                    {error}
                </div>
            )}
        </div>
    );
}
