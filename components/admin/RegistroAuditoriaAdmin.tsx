import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { AuditLog, UserRole } from '../../types';
import { nombreDeRol } from '../../pages/admin/catalogoRoles';

/**
 * Registro de cambios (design-claude/Admin General).
 *
 * Antes era una tabla de cinco columnas con la tabla y el id crudos; para
 * saber qué había pasado había que abrir el detalle de cada fila. Ahora cada
 * cambio se cuenta en una frase, y los que tocan permisos llevan un punto
 * lleno: son los únicos que cambian a qué puede entrar alguien, y son los
 * que uno viene a buscar acá.
 *
 * El diff completo sigue estando, a un toque de distancia.
 */

const NOMBRES_DE_CAMPO: Record<string, string> = {
    id: 'ID',
    created_at: 'Creado',
    updated_at: 'Actualizado',
    name: 'Nombre',
    email: 'Email',
    first_name: 'Nombre',
    last_name: 'Apellido',
    phone: 'Teléfono',
    role: 'Rol (legacy)',
    roles: 'Roles',
    is_active: 'Activo',
    leader_name: 'Nombre del anfitrión',
    leader_surname: 'Apellido del anfitrión',
    meeting_day: 'Día de reunión',
    meeting_time: 'Hora de reunión',
    location: 'Ubicación',
    status: 'Estado',
    group_id: 'Grupo',
    user_id: 'Usuario',
    linked_group_id: 'Grupo vinculado',
    volunteer_roles: 'Roles de voluntario',
    coordinator_variants: 'Categorías que coordina',
    config: 'Configuración',
};

const TABLAS: Record<string, string> = {
    users: 'un usuario',
    app_config: 'la configuración de la app',
    groups: 'un grupo',
    group_registrations: 'una inscripción',
    group_attendance: 'una asistencia',
    home_musica_banner_slides: 'el banner de música',
};

const nombreCampo = (clave: string) => NOMBRES_DE_CAMPO[clave] || clave;

const comoTexto = (valor: any): string => {
    if (valor === null || valor === undefined) return '—';
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
    if (Array.isArray(valor)) return valor.length ? valor.join(', ') : '—';
    if (typeof valor === 'object') return JSON.stringify(valor);
    if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valor)) {
        return new Date(valor).toLocaleString('es-AR');
    }
    return String(valor);
};

const listaRoles = (data: any): string[] => {
    if (!data) return [];
    if (Array.isArray(data.roles) && data.roles.length) return data.roles.map(String);
    return data.role ? [String(data.role)] : [];
};

/** Los roles llegan crudos de la base: se muestran con el nombre de la app. */
const enCastellano = (roles: string[]) => roles.map(r => nombreDeRol(r as UserRole));

interface Leida {
    frase: string;
    esRol: boolean;
}

/** Traduce una fila del registro a algo que se pueda leer de corrido. */
const leer = (log: AuditLog): Leida => {
    const quien = log.new_data?.name || log.old_data?.name || 'alguien';

    if (log.table_name === 'users') {
        if (log.action === 'INSERT') return { frase: `Creó la cuenta de ${quien}`, esRol: false };
        if (log.action === 'DELETE') return { frase: `Eliminó la cuenta de ${quien}`, esRol: false };

        const antes = listaRoles(log.old_data);
        const ahora = listaRoles(log.new_data);
        const dados = ahora.filter(r => !antes.includes(r));
        const quitados = antes.filter(r => !ahora.includes(r));

        if (dados.length || quitados.length) {
            const partes: string[] = [];
            if (dados.length) partes.push(`le dio ${dados.length === 1 ? 'el rol' : 'los roles'} ${enCastellano(dados).join(', ')}`);
            if (quitados.length) partes.push(`le quitó ${quitados.length === 1 ? 'el rol' : 'los roles'} ${enCastellano(quitados).join(', ')}`);
            const frase = partes.join(' y ');
            return { frase: `${frase.charAt(0).toUpperCase()}${frase.slice(1)} a ${quien}`, esRol: true };
        }

        if (log.old_data?.is_active !== log.new_data?.is_active) {
            return {
                frase: log.new_data?.is_active ? `Reactivó la cuenta de ${quien}` : `Desactivó la cuenta de ${quien}`,
                esRol: true,
            };
        }

        return { frase: `Actualizó los datos de ${quien}`, esRol: false };
    }

    if (log.table_name === 'app_config') {
        return { frase: 'Cambió la configuración pública de la app', esRol: false };
    }

    const cosa = TABLAS[log.table_name] || `un registro de ${log.table_name}`;
    const verbo = log.action === 'INSERT' ? 'Creó' : log.action === 'DELETE' ? 'Borró' : 'Actualizó';
    return { frase: `${verbo} ${cosa}`, esRol: false };
};

const cuando = (iso: string) => {
    const fecha = new Date(iso);
    if (isNaN(fecha.getTime())) return '';
    const ahora = new Date();
    const mismoDia = fecha.toDateString() === ahora.toDateString();
    const ayer = new Date(ahora);
    ayer.setDate(ahora.getDate() - 1);
    const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    if (mismoDia) return `hoy ${hora}`;
    if (fecha.toDateString() === ayer.toDateString()) return `ayer ${hora}`;
    return `${fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} ${hora}`;
};

const AdminAuditLogs: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [cargando, setCargando] = useState(true);
    const [soloRoles, setSoloRoles] = useState(false);
    const [detalle, setDetalle] = useState<AuditLog | null>(null);

    const traer = useCallback(async () => {
        setCargando(true);
        setLogs(await supabaseService.getAuditLogs());
        setCargando(false);
    }, []);

    useEffect(() => {
        traer();
        const cada30s = setInterval(traer, 30000);
        return () => clearInterval(cada30s);
    }, [traer]);

    useEffect(() => {
        if (!detalle) return;
        const alSalir = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetalle(null); };
        window.addEventListener('keydown', alSalir);
        return () => window.removeEventListener('keydown', alSalir);
    }, [detalle]);

    const filas = useMemo(
        () => logs.map(log => ({ log, ...leer(log) })).filter(f => !soloRoles || f.esRol),
        [logs, soloRoles]
    );

    return (
        <>
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <p className="mx-0.5 min-w-[240px] max-w-[640px] flex-1 text-[13px] font-medium leading-[1.6] text-black/[.62]">
                    Todo cambio de permisos o de configuración pública queda registrado. Los cambios de rol se marcan
                    aparte porque son los que afectan el acceso de alguien.
                </p>
                <button
                    onClick={() => setSoloRoles(v => !v)}
                    aria-pressed={soloRoles}
                    className={`h-[38px] flex-none rounded-full px-4 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${soloRoles ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.62]'}`}
                >
                    Solo permisos
                </button>
                <button
                    onClick={traer}
                    className="h-[38px] flex-none rounded-full bg-[#f2f2f0] px-4 text-[12.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    Actualizar
                </button>
            </div>

            <div className="overflow-hidden rounded-[20px] bg-white">
                {cargando && logs.length === 0 ? (
                    <p className="px-[18px] py-12 text-center text-[13px] font-medium text-black/[.6]">
                        Cargando el registro…
                    </p>
                ) : filas.length === 0 ? (
                    <p className="px-[18px] py-12 text-center text-[13px] font-medium text-black/[.6]">
                        {soloRoles ? 'No hay cambios de permisos registrados.' : 'Todavía no hay cambios registrados.'}
                    </p>
                ) : (
                    filas.map(({ log, frase, esRol }) => (
                        <button
                            key={log.id}
                            onClick={() => setDetalle(log)}
                            className="flex w-full items-start gap-3 border-b border-[#f4f3f1] px-[18px] py-3.5 text-left transition-colors last:border-b-0 hover:bg-[#fcfcfb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                        >
                            <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${esRol ? 'bg-[#0a0a0a]' : 'bg-black/[.18]'}`} />
                            <span className="min-w-0 flex-1">
                                <span className="block text-[13.5px] font-semibold leading-[1.5] text-[#0a0a0a]">{frase}</span>
                                <span className="mt-1 block text-[12px] font-medium text-black/[.6]">{log.actor_name}</span>
                            </span>
                            <span className="flex-none whitespace-nowrap text-[12px] font-medium text-black/[.55]">
                                {cuando(log.created_at)}
                            </span>
                        </button>
                    ))
                )}
            </div>

            {detalle && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Detalle del cambio"
                    className="fixed inset-0 z-[120] flex items-end justify-center bg-[rgba(10,10,10,.42)] md:items-center md:p-10"
                    onClick={() => setDetalle(null)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="flex max-h-[86vh] w-full flex-col rounded-t-[24px] bg-white md:max-w-[620px] md:rounded-[24px]"
                    >
                        <div className="border-b border-[#f0efec] px-6 pb-4 pt-6">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.55]">
                                Detalle del cambio
                            </p>
                            <p className="mt-2 text-[17px] font-semibold leading-[1.35] tracking-[-0.015em] text-[#0a0a0a]">
                                {leer(detalle).frase}
                            </p>
                            <p className="mt-1.5 text-[12.5px] font-medium text-black/[.62]">
                                {detalle.actor_name} · {cuando(detalle.created_at)} · {detalle.table_name}
                            </p>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                            <CambiosDelRegistro log={detalle} />
                        </div>

                        <div className="border-t border-[#f0efec] px-6 pb-6 pt-4">
                            <button
                                onClick={() => setDetalle(null)}
                                className="h-12 w-full rounded-full bg-[#0a0a0a] text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

/** Qué cambió, campo por campo. */
const CambiosDelRegistro: React.FC<{ log: AuditLog }> = ({ log }) => {
    if (log.action === 'INSERT' || log.action === 'DELETE') {
        const datos = (log.action === 'INSERT' ? log.new_data : log.old_data) || {};
        const entradas = Object.entries(datos).filter(([, v]) => v !== null && v !== undefined && v !== '');
        return (
            <>
                <p className="mb-3 text-[12.5px] font-semibold text-[#0a0a0a]">
                    {log.action === 'INSERT' ? 'Se creó con estos datos' : 'Tenía estos datos'}
                </p>
                <div className="flex flex-col gap-1.5">
                    {entradas.map(([clave, valor]) => (
                        <div key={clave} className="flex items-start justify-between gap-3 border-b border-[#f4f3f1] py-2 last:border-b-0">
                            <span className="flex-none text-[12px] font-medium text-black/[.6]">{nombreCampo(clave)}</span>
                            <span className="min-w-0 break-words text-right text-[12.5px] font-semibold text-[#0a0a0a]">
                                {comoTexto(valor)}
                            </span>
                        </div>
                    ))}
                </div>
            </>
        );
    }

    const antes = log.old_data || {};
    const ahora = log.new_data || {};
    const claves = Array.from(new Set([...Object.keys(antes), ...Object.keys(ahora)]))
        .filter(k => JSON.stringify(antes[k]) !== JSON.stringify(ahora[k]));

    if (claves.length === 0) {
        return <p className="text-[13px] font-medium text-black/[.6]">No quedó registrado ningún campo distinto.</p>;
    }

    return (
        <div className="flex flex-col gap-2.5">
            {claves.map(clave => (
                <div key={clave} className="rounded-[16px] bg-[#f7f7f5] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.55]">
                        {nombreCampo(clave)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-[10px] bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-black/[.55] line-through">
                            {comoTexto(antes[clave])}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.4)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                        <span className="rounded-[10px] bg-[#0a0a0a] px-2.5 py-1.5 text-[12.5px] font-semibold text-white">
                            {comoTexto(ahora[clave])}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AdminAuditLogs;
