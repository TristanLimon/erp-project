import { Injectable, signal, computed } from '@angular/core';

// ── Catálogo de permisos ──────────────────────────────────────────────────────
export const ALL_PERMISSIONS = [
  // Tickets
  'ticket:create', 'ticket:edit', 'ticket:delete', 'ticket:view',
  'ticket:assign', 'ticket:change_status', 'ticket:comment',
  // Grupos
  'group:create', 'group:edit', 'group:delete', 'group:view', 'group:add_member', 'group:remove_member',
  // Usuarios
  'user:create', 'user:edit', 'user:delete', 'user:view', 'user:manage_permissions',
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

export interface TicketComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface TicketHistory {
  id: string;
  userId: string;
  userName: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
}

export interface Ticket {
  id: string;
  groupId: string;
  titulo: string;
  descripcion: string;
  status: TicketStatus;
  prioridad: TicketPriority;
  asignadoA: string | null;
  creadoPor: string;
  fechaCreacion: string;
  fechaLimite: string | null;
  comments: TicketComment[];
  history: TicketHistory[];
}

// ── Permisos predefinidos ─────────────────────────────────────────────────────
const SUPER_ADMIN_PERMS: Permission[] = [...ALL_PERMISSIONS];

const REGULAR_PERMS: Permission[] = [
  'ticket:create', 'ticket:view', 'ticket:change_status', 'ticket:comment',
  'group:view',
  'user:view',
];

@Injectable({ providedIn: 'root' })
export class PermissionService {
  // ── Usuarios ──────────────────────────────────────────────────────────────
  private _users = signal<AppUser[]>([
    {
      id: 'u1',
      email: 'superadmin@demo.com',
      password: 'Admin@2024!!',
      usuario: 'superadmin',
      nombreCompleto: 'Super Administrador',
      direccion: 'Av. Reforma 123, CDMX',
      telefono: '5512345678',
      fechaNacimiento: '1990-01-15',
      permissions: SUPER_ADMIN_PERMS,
    },
    {
      id: 'u2',
      email: 'admin@demo.com',
      password: 'Admin@2024!!',
      usuario: 'admin_demo',
      nombreCompleto: 'Administrador Demo',
      direccion: 'Av. Insurgentes 456',
      telefono: '5598765432',
      fechaNacimiento: '1988-03-22',
      permissions: [
        'ticket:create','ticket:edit','ticket:delete','ticket:view',
        'ticket:assign','ticket:change_status','ticket:comment',
        'group:create','group:edit','group:delete','group:view','group:add_member','group:remove_member',
        'user:view',
      ],
    },
    {
      id: 'u3',
      email: 'usuario@demo.com',
      password: 'User#12345$',
      usuario: 'usuario_demo',
      nombreCompleto: 'Usuario Demo',
      direccion: 'Calle Juárez 456, Guadalajara',
      telefono: '3312345678',
      fechaNacimiento: '1995-06-20',
      permissions: REGULAR_PERMS,
    },
    {
      id: 'u4',
      email: 'dev@demo.com',
      password: 'Dev#12345$',
      usuario: 'dev_demo',
      nombreCompleto: 'Desarrollador Demo',
      direccion: 'Col. Roma, CDMX',
      telefono: '5511223344',
      fechaNacimiento: '1992-11-10',
      permissions: [
        'ticket:create','ticket:edit','ticket:view',
        'ticket:change_status','ticket:comment','ticket:assign',
        'group:view',
        'user:view',
      ],
    },
  ]);

  // ── Grupos ────────────────────────────────────────────────────────────────
  private _groups = signal<Group[]>([
    {
      id: 'g1',
      nombre: 'Equipo Dev',
      descripcion: 'Equipo de desarrollo de software',
      llmModel: 'GPT-4o',
      color: '#6c47ff',
      memberIds: ['u1', 'u2', 'u3', 'u4'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'g2',
      nombre: 'Soporte',
      descripcion: 'Equipo de soporte técnico',
      llmModel: 'Claude 3.5',
      color: '#0ea5e9',
      memberIds: ['u1', 'u3'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'g3',
      nombre: 'UX / Diseño',
      descripcion: 'Equipo de experiencia de usuario',
      llmModel: 'Gemini 1.5',
      color: '#f59e0b',
      memberIds: ['u1', 'u2', 'u4'],
      createdAt: new Date().toISOString(),
    },
  ]);

  // ── Tickets ───────────────────────────────────────────────────────────────
  private _tickets = signal<Ticket[]>([
    {
      id: 't1', groupId: 'g1', titulo: 'Configurar CI/CD pipeline',
      descripcion: 'Configurar GitHub Actions para despliegue automático.',
      status: 'en_progreso', prioridad: 'alta',
      asignadoA: 'u4', creadoPor: 'u2',
      fechaCreacion: new Date(Date.now() - 86400000 * 3).toISOString(),
      fechaLimite: new Date(Date.now() + 86400000 * 7).toISOString(),
      comments: [], history: [],
    },
    {
      id: 't2', groupId: 'g1', titulo: 'Diseñar pantalla de login',
      descripcion: 'Crear mockup y componente Angular para el login.',
      status: 'hecho', prioridad: 'media',
      asignadoA: 'u3', creadoPor: 'u2',
      fechaCreacion: new Date(Date.now() - 86400000 * 10).toISOString(),
      fechaLimite: null,
      comments: [], history: [],
    },
    {
      id: 't3', groupId: 'g1', titulo: 'Resolver bug en formulario',
      descripcion: 'El formulario de registro no valida el email correctamente.',
      status: 'pendiente', prioridad: 'critica',
      asignadoA: null, creadoPor: 'u3',
      fechaCreacion: new Date(Date.now() - 86400000).toISOString(),
      fechaLimite: new Date(Date.now() + 86400000 * 2).toISOString(),
      comments: [], history: [],
    },
    {
      id: 't4', groupId: 'g2', titulo: 'Atender ticket cliente #4521',
      descripcion: 'El cliente reporta falla al iniciar sesión.',
      status: 'revision', prioridad: 'alta',
      asignadoA: 'u3', creadoPor: 'u1',
      fechaCreacion: new Date(Date.now() - 86400000 * 2).toISOString(),
      fechaLimite: new Date(Date.now() + 86400000).toISOString(),
      comments: [], history: [],
    },
    {
      id: 't5', groupId: 'g3', titulo: 'Rediseñar dashboard principal',
      descripcion: 'Mejorar la disposición de componentes del dashboard.',
      status: 'pendiente', prioridad: 'media_alta',
      asignadoA: 'u4', creadoPor: 'u2',
      fechaCreacion: new Date().toISOString(),
      fechaLimite: new Date(Date.now() + 86400000 * 14).toISOString(),
      comments: [], history: [],
    },
  ]);

  // ── Usuario activo ────────────────────────────────────────────────────────
  private _currentUser = signal<AppUser | null>(null);
  private _currentGroupId = signal<string | null>(null);

  readonly currentUser = computed(() => this._currentUser());
  readonly currentGroup = computed(() =>
    this._groups().find(g => g.id === this._currentGroupId()) ?? null
  );
  readonly users = computed(() => this._users());
  readonly groups = computed(() => this._groups());
  readonly tickets = computed(() => this._tickets());

  // ── Auth ──────────────────────────────────────────────────────────────────
  login(email: string, password: string): AppUser | null {
    const user = this._users().find(u => u.email === email && u.password === password);
    if (user) { this._currentUser.set(user); return user; }
    return null;
  }

  logout() {
    this._currentUser.set(null);
    this._currentGroupId.set(null);
  }

  setCurrentGroup(groupId: string) { this._currentGroupId.set(groupId); }

  // ── Comprobación de permisos ──────────────────────────────────────────────
  has(permission: Permission): boolean {
    return this._currentUser()?.permissions.includes(permission) ?? false;
  }

  hasAny(...perms: Permission[]): boolean {
    return perms.some(p => this.has(p));
  }

  hasAll(...perms: Permission[]): boolean {
    return perms.every(p => this.has(p));
  }

  // ── Grupos del usuario actual ─────────────────────────────────────────────
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

  ticketsByGroup(groupId: string): Ticket[] {
    return this._tickets().filter(t => t.groupId === groupId);
  }

  // ── CRUD Tickets ──────────────────────────────────────────────────────────
  createTicket(data: Omit<Ticket, 'id' | 'fechaCreacion' | 'comments' | 'history'>): Ticket {
    const ticket: Ticket = {
      ...data,
      id: 't' + Date.now(),
      fechaCreacion: new Date().toISOString(),
      comments: [],
      history: [],
    };
    this._tickets.update(ts => [...ts, ticket]);
    return ticket;
  }

  updateTicket(id: string, changes: Partial<Ticket>, changedBy: AppUser) {
    this._tickets.update(ts => ts.map(t => {
      if (t.id !== id) return t;
      const historyEntries: TicketHistory[] = [];
      (Object.keys(changes) as (keyof Ticket)[]).forEach(field => {
        if (['comments','history'].includes(field)) return;
        const oldVal = String((t as any)[field] ?? '');
        const newVal = String((changes as any)[field] ?? '');
        if (oldVal !== newVal) {
          historyEntries.push({
            id: 'h' + Date.now() + Math.random(),
            userId: changedBy.id,
            userName: changedBy.nombreCompleto,
            field,
            oldValue: oldVal,
            newValue: newVal,
            changedAt: new Date().toISOString(),
          });
        }
      });
      return { ...t, ...changes, history: [...t.history, ...historyEntries] };
    }));
  }

  addComment(ticketId: string, text: string, user: AppUser) {
    const comment: TicketComment = {
      id: 'c' + Date.now(),
      userId: user.id,
      userName: user.nombreCompleto,
      text,
      createdAt: new Date().toISOString(),
    };
    this._tickets.update(ts => ts.map(t =>
      t.id === ticketId ? { ...t, comments: [...t.comments, comment] } : t
    ));
  }

  deleteTicket(id: string) {
    this._tickets.update(ts => ts.filter(t => t.id !== id));
  }

  // ── CRUD Grupos ───────────────────────────────────────────────────────────
  createGroup(data: Omit<Group, 'id' | 'createdAt'>): Group {
    const group: Group = { ...data, id: 'g' + Date.now(), createdAt: new Date().toISOString() };
    this._groups.update(gs => [...gs, group]);
    return group;
  }

  updateGroup(id: string, changes: Partial<Group>) {
    this._groups.update(gs => gs.map(g => g.id === id ? { ...g, ...changes } : g));
  }

  deleteGroup(id: string) {
    this._groups.update(gs => gs.filter(g => g.id !== id));
  }

  addMemberToGroup(groupId: string, userId: string) {
    this._groups.update(gs => gs.map(g =>
      g.id === groupId && !g.memberIds.includes(userId)
        ? { ...g, memberIds: [...g.memberIds, userId] }
        : g
    ));
  }

  removeMemberFromGroup(groupId: string, userId: string) {
    this._groups.update(gs => gs.map(g =>
      g.id === groupId ? { ...g, memberIds: g.memberIds.filter(id => id !== userId) } : g
    ));
  }

  // ── CRUD Usuarios (superAdmin) ────────────────────────────────────────────
  createUser(data: Omit<AppUser, 'id'>): { ok: boolean; msg: string } {
    if (this._users().some(u => u.email === data.email))
      return { ok: false, msg: 'Email ya existe.' };
    const newUser: AppUser = { ...data, id: 'u' + Date.now() };
    this._users.update(us => [...us, newUser]);
    return { ok: true, msg: 'Usuario creado.' };
  }

  updateUser(id: string, changes: Partial<AppUser>) {
    this._users.update(us => us.map(u => u.id === id ? { ...u, ...changes } : u));
    // Sync current user if editing self
    if (this._currentUser()?.id === id) {
      this._currentUser.update(u => u ? { ...u, ...changes } : u);
    }
  }

  deleteUser(id: string) {
    this._users.update(us => us.filter(u => u.id !== id));
    this._groups.update(gs => gs.map(g => ({
      ...g, memberIds: g.memberIds.filter(mid => mid !== id)
    })));
  }

  getUserById(id: string): AppUser | undefined {
    return this._users().find(u => u.id === id);
  }
}
