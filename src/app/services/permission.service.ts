
import { Injectable, signal, computed, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ApiGatewayService } from '../core/api-gateway.service';

export const ALL_PERMISSIONS = [
  'ticket:create', 'ticket:edit', 'ticket:delete', 'ticket:view',
  'ticket:assign', 'ticket:change_status', 'ticket:comment',
  'group:create', 'group:edit', 'group:delete', 'group:view',
  'group:add_member', 'group:remove_member',
  'user:create', 'user:edit', 'user:delete', 'user:view',
  'user:manage_permissions',
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

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

export interface Group {
  id: string;
  nombre: string;
  descripcion?: string;
  llmModel: string;
  color: string;
  memberIds: string[];
  createdAt: string;
}

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

export interface TicketComment { id: string; userId: string; userName: string; text: string; createdAt: string; }
export interface TicketHistory { id: string; userId: string; userName: string; field: string; oldValue: string; newValue: string; changedAt: string; }

export interface Ticket {
  id: string; groupId: string; titulo: string; descripcion: string;
  status: TicketStatus; prioridad: TicketPriority; asignadoA: string | null;
  creadoPor: string; fechaCreacion: string; fechaLimite: string | null;
  comments: TicketComment[]; history: TicketHistory[];
}

function mapProfile(row: any): AppUser {
  return {
    id: row.id, email: row.email ?? '', password: '',
    usuario: row.usuario ?? '', nombreCompleto: row.nombre_completo ?? '',
    direccion: row.direccion ?? '', telefono: row.telefono ?? '',
    fechaNacimiento: row.fecha_nacimiento ?? '',
    permissions: (row.permissions ?? []) as Permission[],
    avatar: row.avatar ?? '',
  };
}

function mapGroup(row: any, memberIds: string[] = []): Group {
  return {
    id: row.id, nombre: row.nombre, descripcion: row.descripcion ?? '',
    llmModel: row.llm_model ?? 'GPT-4o', color: row.color ?? '#6c47ff',
    memberIds, createdAt: row.created_at,
  };
}

function mapTicket(row: any): Ticket {
  return {
    id: row.id, groupId: row.group_id, titulo: row.titulo,
    descripcion: row.descripcion ?? '', status: row.status as TicketStatus,
    prioridad: row.prioridad as TicketPriority, asignadoA: row.asignado_a ?? null,
    creadoPor: row.creado_por ?? '', fechaCreacion: row.created_at,
    fechaLimite: row.fecha_limite ?? null,
    comments: (row.ticket_comments ?? []).map((c: any) => ({ id: c.id, userId: c.user_id, userName: c.user_name, text: c.text, createdAt: c.created_at })),
    history: (row.ticket_history ?? []).map((h: any) => ({ id: h.id, userId: h.user_id, userName: h.user_name, field: h.field, oldValue: h.old_value ?? '', newValue: h.new_value ?? '', changedAt: h.changed_at })),
  };
}

@Injectable({ providedIn: 'root' })
export class PermissionService {
  /** Supabase SDK — ahora SOLO para auth (login, signup, signOut, getSession) */
  private sb!: SupabaseService['client'];
  /** API Gateway — para TODAS las operaciones CRUD (REST API) */
  private api = inject(ApiGatewayService);

  private _users    = signal<AppUser[]>([]);
  private _groups   = signal<Group[]>([]);
  private _tickets  = signal<Ticket[]>([]);
  private _currentUser    = signal<AppUser | null>(null);
  private _currentGroupId = signal<string | null>(null);

  /** Permisos globales del usuario (profiles.permissions) */
  private _globalPermissions = signal<Permission[]>([]);
  /** Permisos del usuario en el grupo activo (group_members.permissions) */
  private _activePermissions = signal<Permission[]>([]);

  readonly currentUser  = computed(() => this._currentUser());
  readonly currentGroup = computed(() => this._groups().find(g => g.id === this._currentGroupId()) ?? null);
  readonly users   = computed(() => this._users());
  readonly groups  = computed(() => this._groups());
  readonly tickets = computed(() => this._tickets());

  constructor(private supabase: SupabaseService) {
    this.sb = supabase.client;
    // Verificar sesión existente al inicio (usa Supabase Auth SDK)
    this.sb.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        this.loadUserData(data.session.user.id, data.session.user.email ?? '');
      }
    });
  }

  // ── AUTH (sigue usando Supabase Auth SDK) ──────────────────────────────────

  async login(email: string, password: string): Promise<AppUser | null> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;
    return this.loadUserData(data.user.id, data.user.email ?? '');
  }

  async registrar(params: { email: string; password: string; usuario: string; nombreCompleto: string; telefono?: string; direccion?: string; fechaNacimiento?: string; }): Promise<{ ok: boolean; msg: string }> {
    const { data, error } = await this.sb.auth.signUp({
      email: params.email, password: params.password,
      options: { data: { usuario: params.usuario, nombre_completo: params.nombreCompleto } },
    });
    if (error) return { ok: false, msg: error.message };
    if (!data.user) return { ok: false, msg: 'Error al crear usuario.' };

    // Actualizar perfil via API Gateway
    await this.api.update('profiles', {
      usuario: params.usuario, nombre_completo: params.nombreCompleto,
      telefono: params.telefono ?? '', direccion: params.direccion ?? '',
      fecha_nacimiento: params.fechaNacimiento ?? '',
    }, { id: `eq.${data.user.id}` }, 'profile');

    return { ok: true, msg: 'Cuenta creada exitosamente.' };
  }

  async logout(): Promise<void> {
    await this.sb.auth.signOut();
    this._currentUser.set(null);
    this._currentGroupId.set(null);
    this._globalPermissions.set([]);
    this._activePermissions.set([]);
    this._users.set([]); this._groups.set([]); this._tickets.set([]);
  }

  // ── Carga de datos (ahora via API Gateway) ────────────────────────────────

  async loadUserData(userId: string, email: string): Promise<AppUser | null> {
    try {
      const profile = await this.api.select('profiles', {
        select: '*',
        filters: { id: `eq.${userId}` },
        single: true,
      });
      if (!profile) return null;

      const user: AppUser = mapProfile({ ...profile, email });
      this._currentUser.set(user);

      // Cargar permisos GLOBALES desde el perfil
      this._globalPermissions.set(user.permissions);

      await this.loadGroupsAndMembers();
      await this.loadAllUsers();
      return user;
    } catch (err) {
      console.error('[PermissionService] Error cargando datos del usuario:', err);
      return null;
    }
  }

  private async loadGroupsAndMembers() {
    const uid = this._currentUser()?.id;
    if (!uid) return;

    const [allMembers, allGroups] = await Promise.all([
      this.api.select<any[]>('group_members', { select: 'group_id,user_id,permissions' }),
      this.api.select<any[]>('groups', { select: '*' }),
    ]);

    if (!allGroups || !allMembers) return;

    const groups: Group[] = allGroups.map(g => {
      const memberIds = (allMembers ?? []).filter(m => m.group_id === g.id).map(m => m.user_id);
      return mapGroup(g, memberIds);
    });
    this._groups.set(groups);
  }

  private async loadAllUsers() {
    const profiles = await this.api.select<any[]>('profiles', { select: '*' });
    if (!profiles) return;

    const users: AppUser[] = profiles.map(p =>
      mapProfile({ ...p, email: p.id === this._currentUser()?.id ? this._currentUser()?.email : '' })
    );
    this._users.set(users);
  }

  // ── Permisos ──────────────────────────────────────────────────────────────

  async setCurrentGroup(groupId: string) {
    this._currentGroupId.set(groupId);
    const uid = this._currentUser()?.id;
    if (!uid) return;

    try {
      const data = await this.api.select('group_members', {
        select: 'permissions',
        filters: { group_id: `eq.${groupId}`, user_id: `eq.${uid}` },
        single: true,
      });
      this._activePermissions.set((data?.permissions ?? []) as Permission[]);
    } catch {
      this._activePermissions.set([]);
    }

    await this.loadTickets(groupId);
  }

  /**
   * Verifica permiso en capa global (profiles.permissions)
   * O en el grupo activo (group_members.permissions).
   */
  has(permission: Permission): boolean {
    return this._globalPermissions().includes(permission) || this._activePermissions().includes(permission);
  }

  hasAny(...perms: Permission[]): boolean { return perms.some(p => this.has(p)); }
  hasAll(...perms: Permission[]): boolean { return perms.every(p => this.has(p)); }

  // ── Grupos ────────────────────────────────────────────────────────────────

  myGroups(): Group[] {
    const uid = this._currentUser()?.id;
    if (!uid) return [];
    return this._groups().filter(g => g.memberIds.includes(uid));
  }

  groupMembers(groupId: string): AppUser[] {
    const group = this._groups().find(g => g.id === groupId);
    if (!group) return [];
    return this._users().filter(u => group.memberIds.includes(u.id));
  }

  ticketsByGroup(groupId: string): Ticket[] { return this._tickets().filter(t => t.groupId === groupId); }
  getUserById(id: string): AppUser | undefined { return this._users().find(u => u.id === id); }

  // ── Tickets (via API Gateway) ─────────────────────────────────────────────

  private async loadTickets(groupId: string) {
    const data = await this.api.select<any[]>('tickets', {
      select: '*,ticket_comments(*),ticket_history(*)',
      filters: { group_id: `eq.${groupId}` },
      order: 'created_at.desc',
    });

    if (!data) return;
    this._tickets.update(existing => {
      const otherGroups = existing.filter(t => t.groupId !== groupId);
      return [...otherGroups, ...data.map(mapTicket)];
    });
  }

  async createTicket(data: Omit<Ticket, 'id' | 'fechaCreacion' | 'comments' | 'history'>): Promise<Ticket> {
    const insertData = {
      group_id: data.groupId, titulo: data.titulo, descripcion: data.descripcion,
      status: data.status, prioridad: data.prioridad, asignado_a: data.asignadoA,
      creado_por: data.creadoPor, fecha_limite: data.fechaLimite,
    };

    // Validar con JSON Schema + enviar via API Gateway
    const row = await this.api.insert('tickets', insertData, 'ticket');

    const ticket = mapTicket({ ...row, ticket_comments: [], ticket_history: [] });
    this._tickets.update(ts => [...ts, ticket]);
    return ticket;
  }

  async updateTicket(id: string, changes: Partial<Ticket>, changedBy: AppUser) {
    const updateData: any = {};
    if (changes.titulo !== undefined) updateData.titulo = changes.titulo;
    if (changes.descripcion !== undefined) updateData.descripcion = changes.descripcion;
    if (changes.status !== undefined) updateData.status = changes.status;
    if (changes.prioridad !== undefined) updateData.prioridad = changes.prioridad;
    if (changes.asignadoA !== undefined) updateData.asignado_a = changes.asignadoA;
    if (changes.fechaLimite !== undefined) updateData.fecha_limite = changes.fechaLimite;
    updateData.updated_at = new Date().toISOString();

    // Actualizar via API Gateway con validación de schema
    await this.api.update('tickets', updateData, { id: `eq.${id}` }, 'ticket-update');

    const original = this._tickets().find(t => t.id === id);
    if (original) {
      const historyRows = (Object.keys(changes) as (keyof Ticket)[])
        .filter(f => !['comments', 'history', 'id', 'groupId', 'fechaCreacion'].includes(f))
        .filter(f => String((original as any)[f]) !== String((changes as any)[f]))
        .map(f => ({ ticket_id: id, user_id: changedBy.id, user_name: changedBy.nombreCompleto, field: f, old_value: String((original as any)[f] ?? ''), new_value: String((changes as any)[f] ?? '') }));
      if (historyRows.length > 0) {
        await this.api.insertMany('ticket_history', historyRows);
      }
    }

    this._tickets.update(ts => ts.map(t => t.id === id ? { ...t, ...changes } : t));
  }

  async addComment(ticketId: string, text: string, user: AppUser) {
    const commentData = { ticket_id: ticketId, user_id: user.id, user_name: user.nombreCompleto, text };

    // Validar con JSON Schema + enviar via API Gateway
    const data = await this.api.insert('ticket_comments', commentData, 'comment');

    const comment: TicketComment = { id: data.id, userId: data.user_id, userName: data.user_name, text: data.text, createdAt: data.created_at };
    this._tickets.update(ts => ts.map(t => t.id === ticketId ? { ...t, comments: [...t.comments, comment] } : t));
  }

  async deleteTicket(id: string) {
    await this.api.delete('tickets', { id: `eq.${id}` });
    this._tickets.update(ts => ts.filter(t => t.id !== id));
  }

  // ── Grupos CRUD (via API Gateway) ─────────────────────────────────────────

  async createGroup(data: Omit<Group, 'id' | 'createdAt'>): Promise<Group> {
    const uid = this._currentUser()!.id;
    const insertData = {
      nombre: data.nombre, descripcion: data.descripcion,
      llm_model: data.llmModel, color: data.color, created_by: uid,
    };

    const row = await this.api.insert('groups', insertData, 'group');

    await this.api.insert('group_members', {
      group_id: row.id, user_id: uid, permissions: [...ALL_PERMISSIONS]
    }, 'group-member');

    const group = mapGroup(row, [...data.memberIds, uid]);
    this._groups.update(gs => [...gs, group]);
    return group;
  }

  async updateGroup(id: string, changes: Partial<Group>) {
    const updateData: any = {};
    if (changes.nombre) updateData.nombre = changes.nombre;
    if (changes.descripcion !== undefined) updateData.descripcion = changes.descripcion;
    if (changes.llmModel) updateData.llm_model = changes.llmModel;
    if (changes.color) updateData.color = changes.color;

    await this.api.update('groups', updateData, { id: `eq.${id}` });
    this._groups.update(gs => gs.map(g => g.id === id ? { ...g, ...changes } : g));
  }

  async deleteGroup(id: string) {
    await this.api.delete('groups', { id: `eq.${id}` });
    this._groups.update(gs => gs.filter(g => g.id !== id));
  }

  async addMemberToGroup(groupId: string, userId: string, permissions: Permission[] = []) {
    await this.api.upsert('group_members', {
      group_id: groupId, user_id: userId, permissions
    }, 'group-member');

    this._groups.update(gs => gs.map(g =>
      g.id === groupId && !g.memberIds.includes(userId)
        ? { ...g, memberIds: [...g.memberIds, userId] } : g
    ));
  }

  async removeMemberFromGroup(groupId: string, userId: string) {
    await this.api.delete('group_members', { group_id: `eq.${groupId}`, user_id: `eq.${userId}` });
    this._groups.update(gs => gs.map(g =>
      g.id === groupId ? { ...g, memberIds: g.memberIds.filter(id => id !== userId) } : g
    ));
  }

  // ── Usuarios CRUD (via API Gateway) ───────────────────────────────────────

  async updateUser(id: string, changes: Partial<AppUser>) {
    const updateData: any = {};
    if (changes.nombreCompleto) updateData.nombre_completo = changes.nombreCompleto;
    if (changes.usuario) updateData.usuario = changes.usuario;
    if (changes.telefono !== undefined) updateData.telefono = changes.telefono;
    if (changes.direccion !== undefined) updateData.direccion = changes.direccion;
    if (changes.fechaNacimiento !== undefined) updateData.fecha_nacimiento = changes.fechaNacimiento;
    if (changes.permissions !== undefined) updateData.permissions = changes.permissions;

    await this.api.update('profiles', updateData, { id: `eq.${id}` }, 'profile');

    this._users.update(us => us.map(u => u.id === id ? { ...u, ...changes } : u));
    if (this._currentUser()?.id === id) {
      this._currentUser.update(u => u ? { ...u, ...changes } : u);
      if (changes.permissions !== undefined) {
        this._globalPermissions.set(changes.permissions as Permission[]);
      }
    }
  }

  async updateUserPermissionsInGroup(groupId: string, userId: string, permissions: Permission[]) {
    await this.api.update('group_members', { permissions }, { group_id: `eq.${groupId}`, user_id: `eq.${userId}` });
    if (userId === this._currentUser()?.id && groupId === this._currentGroupId()) {
      this._activePermissions.set(permissions);
    }
  }

  async deleteUser(id: string) {
    await this.api.delete('profiles', { id: `eq.${id}` });
    this._users.update(us => us.filter(u => u.id !== id));
    this._groups.update(gs => gs.map(g => ({ ...g, memberIds: g.memberIds.filter(mid => mid !== id) })));
  }

  async createUser(data: Omit<AppUser, 'id'>): Promise<{ ok: boolean; msg: string }> {
    return { ok: false, msg: 'Crear usuarios requiere un Edge Function de Supabase (Service Role).' };
  }

  /** Obtiene los permisos por grupo de un usuario específico */
  async getUserGroupMemberships(userId: string): Promise<{ groupId: string; permissions: Permission[] }[]> {
    const data = await this.api.select<any[]>('group_members', {
      select: 'group_id,permissions',
      filters: { user_id: `eq.${userId}` },
    });

    return (data ?? []).map(m => ({
      groupId: m.group_id,
      permissions: (m.permissions ?? []) as Permission[],
    }));
  }
}
