import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DividerModule } from 'primeng/divider';
import { PanelModule } from 'primeng/panel';
import { BadgeModule } from 'primeng/badge';
import { MessageService, ConfirmationService } from 'primeng/api';
import { PermissionService, AppUser, Permission, ALL_PERMISSIONS } from '../../../services/permission.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

const PERM_GROUPS = [
  {
    label: 'Tickets', icon: 'pi-ticket', color: '#6c47ff', bg: '#f3f0ff',
    perms: ALL_PERMISSIONS.filter(p => p.startsWith('ticket:'))
  },
  {
    label: 'Grupos', icon: 'pi-users', color: '#0ea5e9', bg: '#f0f9ff',
    perms: ALL_PERMISSIONS.filter(p => p.startsWith('group:'))
  },
  {
    label: 'Usuarios', icon: 'pi-user', color: '#f59e0b', bg: '#fffbeb',
    perms: ALL_PERMISSIONS.filter(p => p.startsWith('user:'))
  },
];

const PERM_LABELS: Record<string, string> = {
  'ticket:create': 'Crear tickets',
  'ticket:edit': 'Editar tickets',
  'ticket:delete': 'Eliminar tickets',
  'ticket:view': 'Ver tickets',
  'ticket:assign': 'Asignar tickets',
  'ticket:change_status': 'Cambiar estado',
  'ticket:comment': 'Comentar',
  'group:create': 'Crear grupos',
  'group:edit': 'Editar grupos',
  'group:delete': 'Eliminar grupos',
  'group:view': 'Ver grupos',
  'group:add_member': 'Agregar miembros',
  'group:remove_member': 'Quitar miembros',
  'user:create': 'Crear usuarios',
  'user:edit': 'Editar usuarios',
  'user:delete': 'Eliminar usuarios',
  'user:view': 'Ver usuarios',
  'user:manage_permissions': 'Gestionar permisos',
};

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, TableModule, InputTextModule, AvatarModule, TagModule,
    DialogModule, PasswordModule, CheckboxModule, ToastModule,
    ConfirmDialogModule, DividerModule, PanelModule, BadgeModule,
    HasPermissionDirective
  ],
  providers: [MessageService, ConfirmationService],
  template: `
<p-toast />
<p-confirmdialog />
<div class="um-container" *hasPermission="'user:manage_permissions'; else noPerm">

  <div class="um-header">
    <div>
      <h1 class="page-title"><i class="pi pi-shield"></i> Gestión de Usuarios</h1>
      <p class="page-sub">Administra usuarios y asigna permisos individuales</p>
    </div>
    <p-button *hasPermission="'user:create'" label="Nuevo usuario" icon="pi pi-user-plus"
              (onClick)="openCreate()" />
  </div>

  <!-- Search -->
  <div class="search-bar">
    <input pInputText [(ngModel)]="search" placeholder="🔍  Buscar usuario..." style="width:300px" />
  </div>

  <!-- Users list with inline permissions -->
  <div class="users-list">
    @for (u of filtered(); track u.id) {
      <div class="user-card" [class.expanded]="expandedUserId === u.id">

        <!-- User row header -->
        <div class="user-row" (click)="toggleExpand(u)">
          <div class="user-main">
            <p-avatar [label]="u.nombreCompleto.charAt(0)" shape="circle" size="large"
                      [style]="{'background': getAvatarColor(u.id), 'color':'#fff', 'font-weight':'700'}" />
            <div class="user-info">
              <span class="user-name">{{ u.nombreCompleto }}</span>
              <span class="user-meta">&#64;{{ u.usuario }} · {{ u.email }}</span>
              <span class="user-groups">
                <i class="pi pi-users" style="font-size:.72rem"></i>
                {{ getUserGroups(u.id) }}
              </span>
            </div>
          </div>

          <div class="user-stats">
            <div class="perm-summary">
              @for (pg of permGroups; track pg.label) {
                <div class="perm-pill" [style.background]="pg.bg" [style.color]="pg.color"
                     [title]="pg.label">
                  <i [class]="'pi ' + pg.icon" style="font-size:.72rem"></i>
                  {{ countPermsInGroup(u, pg.perms) }}/{{ pg.perms.length }}
                </div>
              }
            </div>
            <div class="total-badge">
              <i class="pi pi-key" style="font-size:.8rem"></i>
              {{ u.permissions.length }} / {{ totalPerms }}
            </div>
          </div>

          <div class="user-actions" (click)="$event.stopPropagation()">
            <p-button icon="pi pi-pencil" variant="text" size="small"
                      pTooltip="Editar usuario" (onClick)="openEdit(u)" />
            <p-button *hasPermission="'user:delete'" icon="pi pi-trash" variant="text"
                      severity="danger" size="small"
                      pTooltip="Eliminar usuario"
                      [disabled]="u.id === currentUser()?.id"
                      (onClick)="deleteUser(u)" />
          </div>

          <div class="expand-icon">
            <i [class]="expandedUserId === u.id ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
               style="color:#9ca3af;font-size:.8rem"></i>
          </div>
        </div>

        <!-- Inline permissions panel -->
        @if (expandedUserId === u.id) {
          <div class="perms-panel">
            <div class="perms-panel-header">
              <span class="perms-panel-title">
                <i class="pi pi-shield" style="color:#6c47ff"></i>
                Asignación de Permisos — <em style="font-weight:400;color:#6b7280">{{ u.nombreCompleto }}</em>
              </span>
              <div class="perms-panel-actions">
                <p-button label="Todos" size="small" variant="outlined"
                          icon="pi pi-check-square"
                          (onClick)="toggleAll(u, true)" />
                <p-button label="Ninguno" size="small" variant="outlined"
                          severity="secondary" icon="pi pi-stop"
                          (onClick)="toggleAll(u, false)" />
                <p-button label="Guardar permisos" size="small"
                          icon="pi pi-save" severity="success"
                          [disabled]="!isDirty(u.id)"
                          (onClick)="savePermsInline(u)" />
              </div>
            </div>

            <div class="perms-grid">
              @for (pg of permGroups; track pg.label) {
                <div class="perm-group-card" [style.border-top-color]="pg.color">
                  <div class="perm-group-title" [style.color]="pg.color" [style.background]="pg.bg">
                    <i [class]="'pi ' + pg.icon"></i>
                    <span>{{ pg.label }}</span>
                    <span class="group-count" [style.background]="pg.color">
                      {{ countPermsInGroupFromTemp(u.id, pg.perms) }}/{{ pg.perms.length }}
                    </span>
                  </div>
                  <div class="perm-items">
                    @for (p of pg.perms; track p) {
                      <label class="perm-item" [class.checked]="getTempPerm(u.id, p)">
                        <p-checkbox [binary]="true"
                                    [ngModel]="getTempPerm(u.id, p)"
                                    (ngModelChange)="setTempPerm(u.id, p, $event)"
                                    [inputId]="u.id + '-' + p" />
                        <span class="perm-label">{{ permLabels[p] || p }}</span>
                        <span class="perm-code">{{ p }}</span>
                      </label>
                    }
                  </div>
                </div>
              }
            </div>

            @if (savedUserId === u.id) {
              <div class="save-feedback">
                <i class="pi pi-check-circle"></i> Permisos guardados correctamente
              </div>
            }
          </div>
        }
      </div>
    }

    @if (filtered().length === 0) {
      <div class="empty-state">
        <i class="pi pi-users" style="font-size:2.5rem;color:#d1d5db"></i>
        <p>No se encontraron usuarios</p>
      </div>
    }
  </div>
</div>

<ng-template #noPerm>
  <div style="text-align:center;padding:4rem;color:#9ca3af">
    <i class="pi pi-lock" style="font-size:3rem"></i>
    <p>No tienes permisos para acceder a esta sección.</p>
  </div>
</ng-template>

<!-- Dialog crear/editar usuario -->
<p-dialog [header]="editMode ? 'Editar Usuario' : 'Crear Usuario'" [(visible)]="showForm"
          [modal]="true" [style]="{'width':'520px'}">
  <div class="flex flex-column gap-3 pt-2">
    <div class="grid">
      <div class="col-6 flex flex-column gap-1">
        <label class="field-label">Nombre completo *</label>
        <input pInputText [(ngModel)]="form.nombreCompleto" />
      </div>
      <div class="col-6 flex flex-column gap-1">
        <label class="field-label">Usuario *</label>
        <input pInputText [(ngModel)]="form.usuario" />
      </div>
      <div class="col-6 flex flex-column gap-1">
        <label class="field-label">Email *</label>
        <input pInputText [(ngModel)]="form.email" type="email" />
      </div>
      <div class="col-6 flex flex-column gap-1">
        <label class="field-label">{{ editMode ? 'Nueva contraseña' : 'Contraseña *' }}</label>
        <p-password [(ngModel)]="form.password" [feedback]="true" [toggleMask]="true"
                    styleClass="w-full" [inputStyle]="{'width':'100%'}"
                    [placeholder]="editMode ? 'Dejar en blanco para mantener' : ''" />
      </div>
      <div class="col-6 flex flex-column gap-1">
        <label class="field-label">Teléfono</label>
        <input pInputText [(ngModel)]="form.telefono" />
      </div>
      <div class="col-6 flex flex-column gap-1">
        <label class="field-label">Dirección</label>
        <input pInputText [(ngModel)]="form.direccion" />
      </div>
      <div class="col-6 flex flex-column gap-1">
        <label class="field-label">Fecha de nacimiento</label>
        <input pInputText [(ngModel)]="form.fechaNacimiento" type="date" />
      </div>
    </div>
    @if (formMsg) {
      <p [style]="{'color': formOk ? '#22c55e' : '#ef4444', 'font-size':'.875rem'}">{{ formMsg }}</p>
    }
  </div>
  <ng-template #footer>
    <p-button label="Cancelar" variant="text" (onClick)="showForm = false" />
    <p-button [label]="editMode ? 'Actualizar' : 'Crear'" icon="pi pi-check" (onClick)="saveUser()" />
  </ng-template>
</p-dialog>
  `,
  styles: [`
    .um-container { padding:1.5rem; max-width:1100px; margin:0 auto; }

    .um-header {
      display:flex; justify-content:space-between; align-items:flex-start;
      flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem;
      background:#fff; padding:1.25rem 1.5rem;
      border-radius:14px; box-shadow:0 1px 6px rgba(0,0,0,.06);
    }
    .page-title { font-size:1.4rem; font-weight:800; color:#0f0a2e; margin:0; display:flex; align-items:center; gap:.5rem; }
    .page-sub { color:#9ca3af; font-size:.875rem; margin:.25rem 0 0; }

    .search-bar { margin-bottom:1rem; }

    .users-list { display:flex; flex-direction:column; gap:.75rem; }

    .user-card {
      background:#fff; border-radius:14px;
      box-shadow:0 1px 6px rgba(0,0,0,.06);
      overflow:hidden; transition:box-shadow .2s;
      border: 2px solid transparent;
    }
    .user-card.expanded {
      border-color:#6c47ff33;
      box-shadow:0 4px 20px rgba(108,71,255,.12);
    }

    .user-row {
      display:flex; align-items:center; gap:1rem;
      padding:1rem 1.25rem; cursor:pointer;
      transition:background .15s;
    }
    .user-row:hover { background:#fafafa; }

    .user-main { display:flex; align-items:center; gap:.85rem; flex:1; min-width:0; }
    .user-info { display:flex; flex-direction:column; gap:.15rem; min-width:0; }
    .user-name { font-weight:700; font-size:.95rem; color:#0f0a2e; }
    .user-meta { font-size:.78rem; color:#9ca3af; }
    .user-groups { font-size:.75rem; color:#6b7280; display:flex; align-items:center; gap:.3rem; }

    .user-stats { display:flex; align-items:center; gap:.75rem; flex-shrink:0; }
    .perm-summary { display:flex; gap:.4rem; }
    .perm-pill {
      display:flex; align-items:center; gap:.3rem;
      font-size:.72rem; font-weight:600;
      padding:.2rem .55rem; border-radius:20px;
    }
    .total-badge {
      display:flex; align-items:center; gap:.3rem;
      background:#f3f0ff; color:#6c47ff;
      font-size:.78rem; font-weight:700;
      padding:.25rem .65rem; border-radius:20px;
    }

    .user-actions { display:flex; gap:.25rem; flex-shrink:0; }
    .expand-icon { padding:.25rem; flex-shrink:0; }

    /* Permissions Panel */
    .perms-panel {
      border-top:1px solid #ede9fe;
      background:#f8f7ff;
      padding:1.25rem 1.5rem 1.5rem;
      animation: slideDown .2s ease;
    }
    @keyframes slideDown {
      from { opacity:0; transform:translateY(-6px); }
      to { opacity:1; transform:translateY(0); }
    }

    .perms-panel-header {
      display:flex; align-items:center; justify-content:space-between;
      flex-wrap:wrap; gap:.75rem; margin-bottom:1.25rem;
    }
    .perms-panel-title {
      font-weight:700; font-size:.95rem; color:#0f0a2e;
      display:flex; align-items:center; gap:.5rem;
    }
    .perms-panel-actions { display:flex; gap:.5rem; flex-wrap:wrap; }

    .perms-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));
      gap:1rem;
    }

    .perm-group-card {
      background:#fff;
      border-radius:12px;
      border-top:3px solid #6c47ff;
      box-shadow:0 1px 4px rgba(0,0,0,.05);
      overflow:hidden;
    }

    .perm-group-title {
      display:flex; align-items:center; gap:.5rem;
      padding:.65rem 1rem; font-weight:700; font-size:.875rem;
    }
    .group-count {
      margin-left:auto; color:#fff;
      font-size:.72rem; font-weight:700;
      padding:.15rem .5rem; border-radius:20px;
    }

    .perm-items { padding:.75rem 1rem; display:flex; flex-direction:column; gap:.4rem; }

    .perm-item {
      display:flex; align-items:center; gap:.65rem;
      padding:.45rem .65rem; border-radius:8px;
      cursor:pointer; transition:background .15s;
      border:1px solid transparent;
    }
    .perm-item:hover { background:#f9fafb; }
    .perm-item.checked { background:#f3f0ff; border-color:#ddd6fe; }

    .perm-label { font-size:.83rem; font-weight:500; color:#374151; flex:1; }
    .perm-code { font-size:.68rem; font-family:monospace; color:#c4b5fd; }

    .save-feedback {
      margin-top:1rem; padding:.65rem 1rem;
      background:#f0fdf4; color:#16a34a;
      border-radius:8px; font-size:.875rem; font-weight:600;
      display:flex; align-items:center; gap:.5rem;
    }

    .empty-state {
      text-align:center; padding:3rem; color:#9ca3af;
      background:#fff; border-radius:14px;
    }

    .field-label { font-weight:600; font-size:.875rem; color:#374151; }
  `]
})
export class UserManagementComponent {
  search = '';
  showForm = false;
  editMode = false;
  editId = '';
  formMsg = '';
  formOk = false;
  expandedUserId: string | null = null;
  savedUserId: string | null = null;
  permGroups = PERM_GROUPS;
  permLabels = PERM_LABELS;
  totalPerms = ALL_PERMISSIONS.length;

  tempPermsMap: Record<string, Record<string, boolean>> = {};
  dirtyUsers = new Set<string>();

  form = {
    nombreCompleto: '', usuario: '', email: '', password: '',
    telefono: '', direccion: '', fechaNacimiento: ''
  };

  currentUser = computed(() => this.ps.currentUser());

  filtered = computed(() => {
    const s = this.search.toLowerCase();
    return this.ps.users().filter(u =>
      !s || u.nombreCompleto.toLowerCase().includes(s)
        || u.email.toLowerCase().includes(s)
        || u.usuario.toLowerCase().includes(s)
    );
  });

  constructor(private ps: PermissionService, private msg: MessageService, private confirm: ConfirmationService) {}

  getAvatarColor(uid: string): string {
    const colors = ['#6c47ff', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
    const idx = parseInt(uid.replace(/\D/g, '')) % colors.length;
    return colors[idx] || '#6c47ff';
  }

  getUserGroups(uid: string) {
    return this.ps.groups().filter(g => g.memberIds.includes(uid)).map(g => g.nombre).join(', ') || '—';
  }

  countPermsInGroup(u: AppUser, perms: readonly string[]): number {
    return perms.filter(p => u.permissions.includes(p as Permission)).length;
  }

  countPermsInGroupFromTemp(uid: string, perms: readonly string[]): number {
    const map = this.tempPermsMap[uid];
    if (!map) {
      const user = this.ps.users().find(u => u.id === uid);
      return user ? perms.filter(p => user.permissions.includes(p as Permission)).length : 0;
    }
    return perms.filter(p => map[p]).length;
  }

  toggleExpand(u: AppUser) {
    if (this.expandedUserId === u.id) {
      this.expandedUserId = null;
    } else {
      this.expandedUserId = u.id;
      this.savedUserId = null;
      if (!this.tempPermsMap[u.id]) {
        this.initTempPerms(u);
      }
    }
  }

  initTempPerms(u: AppUser) {
    const map: Record<string, boolean> = {};
    ALL_PERMISSIONS.forEach(p => { map[p] = u.permissions.includes(p); });
    this.tempPermsMap[u.id] = map;
  }

  getTempPerm(uid: string, perm: string): boolean {
    return this.tempPermsMap[uid]?.[perm] ?? false;
  }

  setTempPerm(uid: string, perm: string, val: boolean) {
    if (!this.tempPermsMap[uid]) {
      const user = this.ps.users().find(u => u.id === uid);
      if (user) this.initTempPerms(user);
    }
    this.tempPermsMap[uid][perm] = val;
    this.dirtyUsers.add(uid);
  }

  isDirty(uid: string): boolean {
    return this.dirtyUsers.has(uid);
  }

  toggleAll(u: AppUser, val: boolean) {
    if (!this.tempPermsMap[u.id]) this.initTempPerms(u);
    ALL_PERMISSIONS.forEach(p => { this.tempPermsMap[u.id][p] = val; });
    this.dirtyUsers.add(u.id);
  }

  savePermsInline(u: AppUser) {
    const map = this.tempPermsMap[u.id];
    if (!map) return;
    const perms = ALL_PERMISSIONS.filter(p => map[p]) as Permission[];
    this.ps.updateUser(u.id, { permissions: perms });
    this.dirtyUsers.delete(u.id);
    this.savedUserId = u.id;
    this.msg.add({ severity: 'success', summary: 'Permisos actualizados', detail: u.nombreCompleto, life: 2500 });
    setTimeout(() => { this.savedUserId = null; }, 3000);
  }

  openCreate() {
    this.editMode = false;
    this.editId = '';
    this.form = { nombreCompleto: '', usuario: '', email: '', password: '', telefono: '', direccion: '', fechaNacimiento: '' };
    this.formMsg = '';
    this.showForm = true;
  }

  openEdit(u: AppUser) {
    this.editMode = true;
    this.editId = u.id;
    this.form = {
      nombreCompleto: u.nombreCompleto,
      usuario: u.usuario,
      email: u.email,
      password: '',
      telefono: u.telefono,
      direccion: u.direccion,
      fechaNacimiento: u.fechaNacimiento,
    };
    this.formMsg = '';
    this.showForm = true;
  }

  saveUser() {
    if (!this.form.nombreCompleto || !this.form.usuario || !this.form.email) {
      this.formMsg = 'Nombre, usuario y email son obligatorios.'; this.formOk = false; return;
    }
    if (this.editMode) {
      const changes: any = { ...this.form };
      if (!changes.password) delete changes.password;
      this.ps.updateUser(this.editId, changes);
      this.msg.add({ severity: 'success', summary: 'Usuario actualizado', life: 2500 });
      this.showForm = false;
    } else {
      if (!this.form.password) { this.formMsg = 'La contraseña es obligatoria.'; this.formOk = false; return; }
      const result = this.ps.createUser({
        email: this.form.email,
        password: this.form.password,
        usuario: this.form.usuario,
        nombreCompleto: this.form.nombreCompleto,
        direccion: this.form.direccion,
        telefono: this.form.telefono,
        fechaNacimiento: this.form.fechaNacimiento,
        permissions: [],
      });
      if (result.ok) {
        this.msg.add({ severity: 'success', summary: 'Usuario creado', life: 2500 });
        this.showForm = false;
      } else {
        this.formMsg = result.msg; this.formOk = false;
      }
    }
  }

  deleteUser(u: AppUser) {
    this.confirm.confirm({
      message: `¿Eliminar al usuario ${u.nombreCompleto}?`,
      header: 'Eliminar usuario',
      icon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.ps.deleteUser(u.id);
        if (this.expandedUserId === u.id) this.expandedUserId = null;
        this.msg.add({ severity: 'success', summary: 'Usuario eliminado', life: 2500 });
      }
    });
  }
}
