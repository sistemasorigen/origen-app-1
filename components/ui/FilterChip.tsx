import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface FilterChipOption { label: string; value: string; }

const FilterChip: React.FC<{
    label: string;
    value: string;
    options: FilterChipOption[];
    onChange: (v: string) => void;
    activeColor?: string; // tailwind bg+border classes when active
    // Tipografía del texto (disparador y opciones). Se expone porque cada
    // pantalla tiene su propia escala de etiquetas: Audiencia usa caja baja,
    // Bienvenida rotula todo en mayúsculas con tracking.
    textClassName?: string;
}> = ({
    label,
    value,
    options,
    onChange,
    activeColor = 'bg-black border-black text-white',
    textClassName = 'text-xs font-bold',
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const active = value !== '';
    const selectedLabel = active ? options.find(o => o.value === value)?.label ?? label : label;

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-lg border ${textClassName} transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950
                    ${active
                        ? `${activeColor} border-transparent`
                        : 'border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-black dark:text-white hover:bg-slate-50 dark:hover:bg-neutral-800'
                    }`}
            >
                <span className="truncate">{selectedLabel}</span>
                {active
                    ? <X className="w-3.5 h-3.5 shrink-0 opacity-70" onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }} />
                    : <ChevronDown className={`w-3.5 h-3.5 shrink-0 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
                }
            </button>

            {open && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 ${textClassName} transition-colors
                                ${value === opt.value
                                    ? 'bg-black dark:bg-white text-white dark:text-black'
                                    : 'text-black dark:text-white hover:bg-slate-100 dark:hover:bg-neutral-800'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FilterChip;
