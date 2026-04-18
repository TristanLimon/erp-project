import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SupabaseService } from './supabase.service';
import {
  AppUser, Group, Ticket, TicketComment, Permission,
  ALL_PERMISSIONS, PRIORITY_MAP,
  mapProfile, mapGroup, mapTicket,
  TicketStatus, TicketPriority, TicketHistory,
} from '../models/erp.models';

export { ALL_PERMISSIONS, PRIORITY_MAP };
export type {
  AppUser, Group, Ticket, TicketComment, TicketHistory, TicketStatus, TicketPriority,
  Permission,
};

/**
 * Servicio Central del Frontend.
 *
 * Se comunica exclusivamente con el backend Express (API Gateway) mediante HttpClient.
 * Gestiona el estado reactivo centralizado (signals) para toda la aplicación.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private http = inject(HttpClient);
  private supabase = inject(SupabaseService);
  private sb = this.supabase.client;
  private readonly baseUrl = environment.apiBaseUrl; // http://localhost:3000/api

  // ── ESTADO REACTIVO (Signals) ──────────────────────────────────────────────
  private _currentUser = signal<AppUser | null>(null);
  private _currentGroupId = signal<string | null>(null);
  private _globalPermissions = signal<Permission[]>([]);
  private _activePermissions = signal<Permission[]>([]);

  private _users = signal<AppUser[]>([]);
  private _groups = signal<Group[]>([]);
  private _tickets = signal<Ticket[]>([]);

  // ── SEÑALES PÚBLICAS ───────────────────────────────────────────────────────
  readonly currentUser = computed(() => this._currentUser());
  readonly currentGroup = computed(() => this._groups().find(g => g.id === this._currentGroupId()) ?? null);
  readonly users = computed(() => this._users());
  readonly groups = computed(() => this._groups());
  readonly tickets = computed(() => this._tickets());
  readonly globalPermissions = computed(() => this._globalPermissions());
  readonly activePermissions = computed(() => this._activePermissions());

  constructor() {
    this.sb.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        this.loadUserData(data.session.user.id, data.session.user.email ?? '');
      }
    });
  }

  // ── HELPERS HTTP ───────────────────────────────────────────────────────────

  private async fetchBackend<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', resource: string, data?: any, query?: Record<string, string>): Promise<T> {
    const session = await this.sb.auth.getSession();
    const token = session.data.session?.access_token;
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    if (method === 'POST' || method === 'PATCH') headers = headers.set('Prefer', 'return=representation');

    let params = new HttpParams();
    if (query) Object.entries(query).forEach(([k, v]) => params = params.set(k, v));

    const url = `${this.baseUrl}/${resource}`;

    try {
      if (method === 'GET') return await firstValueFrom(this.http.get<T>(url, { headers, params }));
      if (method === 'POST') return await firstValueFrom(this.http.post<T>(url, data, { headers, params }));
      if (method === 'PATCH') return await firstValueFrom(this.http.patch<T>(url, data, { headers, params }));
      if (method === 'DELETE') return await firstValueFrom(this.http.delete<T>(url, { headers, params }));
      throw new Error(`Método HTTP ${method} no soportado`);
    } catch (err: any) {
      console.error(`[PermissionService] Error en ${method} ${url}`, err);
      throw new Error(err.error?.error || err.message || 'Error de red');
    }
  }

  // ── AUTH & INICIALIZACIÓN ──────────────────────────────────────────────────

  async login(email: string, password: string): Promise<AppUser | null> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;
    return this.loadUserData(data.user.id, data.user.email ?? '');
  }

  async registrar(params: any): Promise<{ ok: boolean; msg: string }> {
    const { data, error } = await this.sb.auth.signUp({
      email: params.email, password: params.password,
      options: { data: { usuario: params.usuario, nombre_completo: params.nombreCompleto } },
    });
    if (error) return { ok: false, msg: error.message };
    if (!data.user) return { ok: false, msg: 'Error al crear usuario.' };

    await this.fetchBackend('PATCH', 'profiles', {
      usuario: params.usuario, nombre_completo: params.nombreCompleto,
      telefono: params.telefono ?? '', direccion: params.direccion ?? '',
      fecha_nacimiento: params.fechaNacimiento ?? '',
    }, { id: `eq.${data.user.id}` });

    return { ok: true, msg: 'Cuenta creada exitosamente.' };
  }

  async logout(): Promise<void> {
    await this.sb.auth.signOut();
    this._currentUser.set(null);
    this._currentGroupId.set(null);
    this._globalPermissions.set([]);
    this._activePermissions.set([]);
    this._tickets.set([]);
    this._groups.set([]);
    this._users.set([]);
  }

  async loadUserData(userId: string, email: string): Promise<AppUser | null> {
    try {
      const profiles = await this.fetchBackend<any[]>('GET', 'profiles', null, { id: `eq.${userId}` });
      if (!profiles || profiles.length === 0) return null;

      const user: AppUser = mapProfile({ ...profiles[0], email });
      this._currentUser.set(user);
      this._globalPermissions.set(user.permissions);

      await this.loadAllUsers(user);
      await this.loadGroupsAndMembers();
      return user;
    } catch (err) {
      console.error('[PermissionService] Error cargando datos:', err);
      return null;
    }
  }

  // ── PERMISOS ───────────────────────────────────────────────────────────────

  has(permission: Permission): boolean {
    return this._globalPermissions().includes(permission) || this._activePermissions().includes(permission);
  }
  hasAny(...perms: Permission[]): boolean { return perms.some(p => this.has(p)); }
  hasAll(...perms: Permission[]): boolean { return perms.every(p => this.has(p)); }

  async refreshCurrentUserPermissions(): Promise<void> {
    const uid = this._currentUser()?.id;
    if (!uid) return;
    try {
      const profiles = await this.fetchBackend<any[]>('GET', 'profiles', null, { select: 'permissions', id: `eq.${uid}` });
      if (profiles && profiles.length > 0) {
        const perms = (profiles[0].permissions ?? []) as Permission[];
        this._globalPermissions.set(perms);
        this._currentUser.update(u => u ? { ...u, permissions: perms } : u);
      }
    } catch (err) {}
  }

  async updateUserPermissionsInGroup(groupId: string, userId: string, permissions: Permission[]) {
    await this.fetchBackend('PATCH', 'group_members', { permissions }, { group_id: `eq.${groupId}`, user_id: `eq.${userId}` });
    if (userId === this._currentUser()?.id && groupId === this._currentGroupId()) {
      this._activePermissions.set(permissions);
    }
  }

  async getUserGroupMemberships(userId: string): Promise<{ groupId: string; permissions: Permission[] }[]> {
    const data = await this.fetchBackend<any[]>('GET', 'group_members', null, { select: 'group_id,permissions', user_id: `eq.${userId}` });
    return (data ?? []).map(m => ({ groupId: m.group_id, permissions: (m.permissions ?? []) as Permission[] }));
  }

  // ── TICKETS ────────────────────────────────────────────────────────────────

  ticketsByGroup(groupId: string): Ticket[] {
    return this._tickets().filter(t => t.groupId === groupId);
  }

  async loadTickets(groupId: string) {
    const data = await this.fetchBackend<any[]>('GET', 'tickets', null, {
      select: '*,ticket_comments(*),ticket_history(*)',
      group_id: `eq.${groupId}`,
      order: 'created_at.desc'
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
    const rowArray = await this.fetchBackend<any[]>('POST', 'tickets', insertData);
    const ticket = mapTicket({ ...rowArray[0], ticket_comments: [], ticket_history: [] });
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

    await this.fetchBackend('PATCH', 'tickets', updateData, { id: `eq.${id}` });

    const original = this._tickets().find(t => t.id === id);
    if (original) {
      const historyRows = (Object.keys(changes) as (keyof Ticket)[])
        .filter(f => !['comments', 'history', 'id', 'groupId', 'fechaCreacion'].includes(f))
        .filter(f => String((original as any)[f]) !== String((changes as any)[f]))
        .map(f => ({
          ticket_id: id, user_id: changedBy.id, user_name: changedBy.nombreCompleto,
          field: f, old_value: String((original as any)[f] ?? ''), new_value: String((changes as any)[f] ?? '')
        }));
      if (historyRows.length > 0) {
        await this.fetchBackend('POST', 'ticket_history', historyRows);
      }
    }
    this._tickets.update(ts => ts.map(t => t.id === id ? { ...t, ...changes } : t));
  }

  async addComment(ticketId: string, text: string, user: AppUser) {
    const data = await this.fetchBackend<any[]>('POST', 'ticket_comments', {
      ticket_id: ticketId, user_id: user.id, user_name: user.nombreCompleto, text
    });
    const comment: TicketComment = {
      id: data[0].id, userId: data[0].user_id, userName: data[0].user_name,
      text: data[0].text, createdAt: data[0].created_at
    };
    this._tickets.update(ts => ts.map(t => t.id === ticketId ? { ...t, comments: [...t.comments, comment] } : t));
  }

  async deleteTicket(id: string) {
    await this.fetchBackend('DELETE', 'tickets', null, { id: `eq.${id}` });
    this._tickets.update(ts => ts.filter(t => t.id !== id));
  }

  // ── GRUPOS ─────────────────────────────────────────────────────────────────

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

  async loadGroupsAndMembers() {
    const allMembers = await this.fetchBackend<any[]>('GET', 'group_members', null, { select: 'group_id,user_id,permissions' });
    const allGroups = await this.fetchBackend<any[]>('GET', 'groups', null, { select: '*' });

    if (!allGroups || !allMembers) return;

    const groups: Group[] = allGroups.map(g => {
      const memberIds = allMembers.filter(m => m.group_id === g.id).map(m => m.user_id);
      return mapGroup(g, memberIds);
    });
    this._groups.set(groups);
  }

  async setCurrentGroup(groupId: string) {
    this._currentGroupId.set(groupId);
    const uid = this._currentUser()?.id;
    if (!uid) return;
    try {
      const data = await this.fetchBackend<any[]>('GET', 'group_members', null, {
        select: 'permissions', group_id: `eq.${groupId}`, user_id: `eq.${uid}`
      });
      this._activePermissions.set((data && data.length > 0 ? data[0].permissions : []) as Permission[]);
    } catch {
      this._activePermissions.set([]);
    }
    await this.loadTickets(groupId);
  }

  async createGroup(data: Omit<Group, 'id' | 'createdAt'>): Promise<Group> {
    const currentUserId = this._currentUser()!.id;
    const rowArray = await this.fetchBackend<any[]>('POST', 'groups', {
      nombre: data.nombre, descripcion: data.descripcion,
      llm_model: data.llmModel, color: data.color, created_by: currentUserId,
    });
    await this.fetchBackend('POST', 'group_members', {
      group_id: rowArray[0].id, user_id: currentUserId, permissions: [...ALL_PERMISSIONS]
    });
    const group = mapGroup(rowArray[0], [...data.memberIds, currentUserId]);
    this._groups.update(gs => [...gs, group]);
    return group;
  }

  async updateGroup(id: string, changes: Partial<Group>) {
    const updateData: any = {};
    if (changes.nombre) updateData.nombre = changes.nombre;
    if (changes.descripcion !== undefined) updateData.descripcion = changes.descripcion;
    if (changes.llmModel) updateData.llm_model = changes.llmModel;
    if (changes.color) updateData.color = changes.color;
    await this.fetchBackend('PATCH', 'groups', updateData, { id: `eq.${id}` });
    this._groups.update(gs => gs.map(g => g.id === id ? { ...g, ...changes } : g));
  }

  async deleteGroup(id: string) {
    await this.fetchBackend('DELETE', 'groups', null, { id: `eq.${id}` });
    this._groups.update(gs => gs.filter(g => g.id !== id));
  }

  async addMemberToGroup(groupId: string, userId: string, permissions: Permission[] = []) {
    await this.fetchBackend('POST', 'group_members', { group_id: groupId, user_id: userId, permissions }, { 'Prefer': 'resolution=merge-duplicates' } as any);
    this._groups.update(gs => gs.map(g => g.id === groupId && !g.memberIds.includes(userId) ? { ...g, memberIds: [...g.memberIds, userId] } : g));
  }

  async removeMemberFromGroup(groupId: string, userId: string) {
    await this.fetchBackend('DELETE', 'group_members', null, { group_id: `eq.${groupId}`, user_id: `eq.${userId}` });
    this._groups.update(gs => gs.map(g => g.id === groupId ? { ...g, memberIds: g.memberIds.filter(id => id !== userId) } : g));
  }

  // ── USUARIOS ───────────────────────────────────────────────────────────────

  getUserById(id: string): AppUser | undefined {
    return this._users().find(u => u.id === id);
  }

  async loadAllUsers(currentUser: AppUser) {
    const profiles = await this.fetchBackend<any[]>('GET', 'profiles', null, { select: '*' });
    if (!profiles) return;
    const users: AppUser[] = profiles.map(p => mapProfile({ ...p, email: p.id === currentUser.id ? currentUser.email : '' }));
    this._users.set(users);
  }

  async updateUser(id: string, changes: Partial<AppUser>) {
    const updateData: any = {};
    if (changes.nombreCompleto) updateData.nombre_completo = changes.nombreCompleto;
    if (changes.usuario) updateData.usuario = changes.usuario;
    if (changes.telefono !== undefined) updateData.telefono = changes.telefono;
    if (changes.direccion !== undefined) updateData.direccion = changes.direccion;
    if (changes.fechaNacimiento !== undefined) updateData.fecha_nacimiento = changes.fechaNacimiento;
    if (changes.permissions !== undefined) updateData.permissions = changes.permissions;

    await this.fetchBackend('PATCH', 'profiles', updateData, { id: `eq.${id}` });
    this._users.update(us => us.map(u => u.id === id ? { ...u, ...changes } : u));
    if (this._currentUser()?.id === id) {
      this._currentUser.update(u => u ? { ...u, ...changes } : u);
      if (changes.permissions !== undefined) this._globalPermissions.set(changes.permissions as Permission[]);
    }
  }

  async deleteUser(id: string) {
    await this.fetchBackend('DELETE', 'profiles', null, { id: `eq.${id}` });
    this._users.update(us => us.filter(u => u.id !== id));
    this._groups.update(gs => gs.map(g => ({ ...g, memberIds: g.memberIds.filter(mid => mid !== id) })));
  }

  async createUser(data: Omit<AppUser, 'id'>): Promise<{ ok: boolean; msg: string }> {
    return { ok: false, msg: 'Crear usuarios requiere un Edge Function de Supabase (Service Role).' };
  }
}
