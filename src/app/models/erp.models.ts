/**
 * Modelos, tipos e interfaces compartidos del ERP.
 *
 * Este archivo centraliza todas las definiciones de datos que usan
 * los microservicios (AuthService, TicketService, GroupService,
 * UserService, PermissionService).
 */

// ── Permisos ────────────────────────────────────────────────────────────────

export const ALL_PERMISSIONS = [
  'ticket:create', 'ticket:edit', 'ticket:delete', 'ticket:view',
  'ticket:assign', 'ticket:change_status', 'ticket:comment',
  'group:create', 'group:edit', 'group:delete', 'group:view',
  'group:add_member', 'group:remove_member',
  'user:create', 'user:edit', 'user:delete', 'user:view',
  'user:manage_permissions',
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

// ── Usuarios ────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  password: string;
  usuario: string;
  nombreCompleto: string;
  direccion: string;
  telefono: string;
  fechaNacimiento: string;
  permissions: Permission[];
  avatar?: string;
}

// ── Grupos ───────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  nombre: string;
  descripcion?: string;
  llmModel: string;
  color: string;
  memberIds: string[];
  createdAt: string;
}

// ── Tickets ─────────────────────────────────────────────────────────────────

export type TicketStatus = 'pendiente' | 'en_progreso' | 'revision' | 'hecho' | 'bloqueado';
export type TicketPriority = 'critica' | 'alta' | 'media_alta' | 'media' | 'media_baja' | 'baja' | 'minima';

export const PRIORITY_MAP: Record<TicketPriority, { label: string; severity: string; color: string }> = {
  'critica':    { label: 'Crítica',    severity: 'danger',    color: '#ef4444' },
  'alta':       { label: 'Alta',       severity: 'danger',    color: '#f97316' },
  'media_alta': { label: 'Media-Alta', severity: 'warn',      color: '#eab308' },
  'media':      { label: 'Media',      severity: 'warn',      color: '#84cc16' },
  'media_baja': { label: 'Media-Baja', severity: 'info',      color: '#22c55e' },
  'baja':       { label: 'Baja',       severity: 'info',      color: '#3b82f6' },
  'minima':     { label: 'Mínima',     severity: 'secondary', color: '#8b5cf6' },
};

export interface TicketComment {
  id: string; userId: string; userName: string; text: string; createdAt: string;
}

export interface TicketHistory {
  id: string; userId: string; userName: string; field: string;
  oldValue: string; newValue: string; changedAt: string;
}

export interface Ticket {
  id: string; groupId: string; titulo: string; descripcion: string;
  status: TicketStatus; prioridad: TicketPriority; asignadoA: string | null;
  creadoPor: string; fechaCreacion: string; fechaLimite: string | null;
  comments: TicketComment[]; history: TicketHistory[];
}

// ── Mappers (DB row → modelo) ───────────────────────────────────────────────

export function mapProfile(row: any): AppUser {
  return {
    id: row.id, email: row.email ?? '', password: '',
    usuario: row.usuario ?? '', nombreCompleto: row.nombre_completo ?? '',
    direccion: row.direccion ?? '', telefono: row.telefono ?? '',
    fechaNacimiento: row.fecha_nacimiento ?? '',
    permissions: (row.permissions ?? []) as Permission[],
    avatar: row.avatar ?? '',
  };
}

export function mapGroup(row: any, memberIds: string[] = []): Group {
  return {
    id: row.id, nombre: row.nombre, descripcion: row.descripcion ?? '',
    llmModel: row.llm_model ?? 'GPT-4o', color: row.color ?? '#6c47ff',
    memberIds, createdAt: row.created_at,
  };
}

export function mapTicket(row: any): Ticket {
  return {
    id: row.id, groupId: row.group_id, titulo: row.titulo,
    descripcion: row.descripcion ?? '', status: row.status as TicketStatus,
    prioridad: row.prioridad as TicketPriority, asignadoA: row.asignado_a ?? null,
    creadoPor: row.creado_por ?? '', fechaCreacion: row.created_at,
    fechaLimite: row.fecha_limite ?? null,
    comments: (row.ticket_comments ?? []).map((c: any) => ({
      id: c.id, userId: c.user_id, userName: c.user_name, text: c.text, createdAt: c.created_at
    })),
    history: (row.ticket_history ?? []).map((h: any) => ({
      id: h.id, userId: h.user_id, userName: h.user_name, field: h.field,
      oldValue: h.old_value ?? '', newValue: h.new_value ?? '', changedAt: h.changed_at
    })),
  };
}
