import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DividerModule } from 'primeng/divider';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService, ConfirmationService } from 'primeng/api';
import { PermissionService, AppUser, Permission, ALL_PERMISSIONS } from '../../../services/permission.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

const PERM_GROUPS = [
  { label: 'Tickets',  icon: 'pi-ticket',    color: '#6c47ff', bg: '#f3f0ff', border: '#ddd6fe', perms: ALL_PERMISSIONS.filter(p => p.startsWith('ticket:')) },
  { label: 'Grupos',   icon: 'pi-users',     color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd', perms: ALL_PERMISSIONS.filter(p => p.startsWith('group:'))  },
  { label: 'Usuarios', icon: 'pi-user-edit', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', perms: ALL_PERMISSIONS.filter(p => p.startsWith('user:'))   },
];

const PERM_LABELS: Record<string, string> = {
  'ticket:create':'Crear tickets','ticket:edit':'Editar tickets','ticket:delete':'Eliminar tickets',
  'ticket:view':'Ver tickets','ticket:assign':'Asignar tickets','ticket:change_status':'Cambiar estado','ticket:comment':'Comentar',
  'group:create':'Crear grupos','group:edit':'Editar grupos','group:delete':'Eliminar grupos','group:view':'Ver grupos',
  'group:add_member':'Agregar miembros','group:remove_member':'Quitar miembros',
  'user:create':'Crear usuarios','user:edit':'Editar usuarios','user:delete':'Eliminar usuarios',
  'user:view':'Ver usuarios','user:manage_permissions':'Gestionar permisos',
};

const AVATAR_COLORS = ['#6c47ff','#0ea5e9','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6'];

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, AvatarModule, TagModule,
    DialogModule, PasswordModule, ToastModule, TooltipModule,
    ConfirmDialogModule, DividerModule, BadgeModule, IconFieldModule, InputIconModule,
    HasPermissionDirective
  ],
  providers: [MessageService, ConfirmationService],
  template: `
<p-toast position="top-right" />
<p-confirmdialog />

<div *hasPermission="'user:manage_permissions'; else noPerm">
  <div class="um-page">

    <!-- Header -->
    <div class="um-header">
      <div class="header-left">
        <div class="header-icon"><i class="pi pi-shield"></i></div>
        <div>
          <h1 class="page-title">Gestión de Usuarios</h1>
          <p class="page-sub">{{ ps.users().length }} usuarios registrados · {{ ps.groups().length }} grupos</p>
        </div>
      </div>
      <div class="header-right">
        <p-iconfield>
          <p-inputicon class="pi pi-search" />
          <input pInputText [(ngModel)]="search" placeholder="Buscar usuario..." style="width:230px" />
        </p-iconfield>
        <p-button *hasPermission="'user:create'" label="Nuevo usuario" icon="pi pi-user-plus"
                  (onClick)="openCreate()" styleClass="btn-primary" />
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-pill stat-purple">
        <i class="pi pi-users"></i>
        <span class="stat-n">{{ ps.users().length }}</span>
        <span class="stat-l">Usuarios</span>
      </div>
      <div class="stat-pill stat-blue">
        <i class="pi pi-th-large"></i>
        <span class="stat-n">{{ ps.groups().length }}</span>
        <span class="stat-l">Grupos</span>
      </div>
      <div class="stat-pill stat-amber">
        <i class="pi pi-key"></i>
        <span class="stat-n">{{ totalPerms }}</span>
        <span class="stat-l">Tipos de permiso</span>
      </div>
    </div>

    <!-- User list -->
    <div class="users-list">
      @for (u of filtered(); track u.id) {
        <div class="user-card" [class.expanded]="expandedUserId === u.id">

          <div class="user-row" (click)="toggleExpand(u)">
            <div class="u-avatar" [style]="{'background': getAvatarColor(u.id)}">
              {{ u.nombreCompleto.charAt(0).toUpperCase() }}
            </div>
            <div class="u-info">
              <span class="u-name">{{ u.nombreCompleto }}</span>
              <span class="u-meta">
                <i class="pi pi-at" style="font-size:.62rem"></i>{{ u.usuario }}
                &nbsp;·&nbsp;
                <i class="pi pi-envelope" style="font-size:.62rem"></i>{{ u.email }}
              </span>
              <span class="u-groups">
                <i class="pi pi-users" style="font-size:.62rem"></i>{{ getUserGroups(u.id) }}
              </span>
            </div>

            <div class="u-perms">
              @for (pg of permGroups; track pg.label) {
                <span class="pp" [style]="{'background':pg.bg,'color':pg.color,'border':'1px solid '+pg.border}"
                      [pTooltip]="pg.label">
                  <i [class]="'pi '+pg.icon"></i>
                  {{ countPermsInGroup(u, pg.perms) }}/{{ pg.perms.length }}
                </span>
              }
              <span class="pp-total">
                <i class="pi pi-key"></i>{{ u.permissions.length }}/{{ totalPerms }}
              </span>
            </div>

            <div class="u-actions" (click)="$event.stopPropagation()">
              <p-button icon="pi pi-pencil" variant="text" size="small"
                        pTooltip="Editar" (onClick)="openEdit(u)" />
              <p-button *hasPermission="'user:delete'" icon="pi pi-trash"
                        variant="text" severity="danger" size="small"
                        pTooltip="Eliminar" [disabled]="u.id === currentUser()?.id"
                        (onClick)="confirmDelete(u)" />
            </div>

            <div class="chevron" [class.open]="expandedUserId === u.id">
              <i class="pi pi-chevron-down"></i>
            </div>
          </div>

          @if (expandedUserId === u.id) {
            <div class="perms-panel">
              <div class="pp-header">
                <span class="pp-title">
                  <i class="pi pi-shield" style="color:#6c47ff"></i>
                  Permisos de <strong>{{ u.nombreCompleto }}</strong>
                </span>
                <div class="pp-actions">
                  <p-button label="Todos" size="small" variant="outlined"
                            icon="pi pi-check-square" (onClick)="toggleAll(u, true)" />
                  <p-button label="Ninguno" size="small" variant="outlined"
                            severity="secondary" icon="pi pi-stop" (onClick)="toggleAll(u, false)" />
                  <p-button label="Guardar" size="small" icon="pi pi-save"
                            severity="success" [disabled]="!isDirty(u.id)"
                            (onClick)="savePermsInline(u)" />
                </div>
              </div>

              <div class="pg-grid">
                @for (pg of permGroups; track pg.label) {
                  <div class="pg-card" [style]="{'border-top':'3px solid '+pg.color}">
                    <div class="pg-head" [style]="{'background':pg.bg}">
                      <i [class]="'pi '+pg.icon" [style]="{'color':pg.color}"></i>
                      <span [style]="{'color':pg.color,'font-weight':'700'}">{{ pg.label }}</span>
                      <span class="pg-count" [style]="{'background':pg.color}">
                        {{ countPermsInGroupFromTemp(u.id, pg.perms) }}/{{ pg.perms.length }}
                      </span>
                    </div>
                    <div class="pi-list">
                      @for (p of pg.perms; track p) {
                        <label class="pi-item" [class.active]="getTempPerm(u.id, p)"
                               (click)="setTempPerm(u.id, p, !getTempPerm(u.id, p))">
                          <span class="pcheck" [class.on]="getTempPerm(u.id, p)"
                                [style]="getTempPerm(u.id, p) ? {'background':pg.color,'border-color':pg.color} : {}">
                            @if (getTempPerm(u.id, p)) { <i class="pi pi-check" style="font-size:.55rem;color:#fff"></i> }
                          </span>
                          <span class="plabel">{{ permLabels[p] || p }}</span>
                          <code class="pcode">{{ p }}</code>
                        </label>
                      }
                    </div>
                  </div>
                }
              </div>

              @if (savedUserId === u.id) {
                <div class="save-ok">
                  <i class="pi pi-check-circle"></i> Permisos guardados correctamente
                </div>
              }
            </div>
          }
        </div>
      }

      @if (filtered().length === 0) {
        <div class="empty-state">
          <div class="empty-ico"><i class="pi pi-users"></i></div>
          <p style="font-weight:700;color:#374151;margin:.75rem 0 .25rem">Sin resultados</p>
          <p style="color:#9ca3af;font-size:.875rem;margin:0">Intenta con otro término de búsqueda</p>
        </div>
      }
    </div>
  </div>
</div>

<ng-template #noPerm>
  <div class="no-access">
    <div class="no-access-ico"><i class="pi pi-lock"></i></div>
    <h2>Acceso restringido</h2>
    <p>No tienes permisos para gestionar usuarios.</p>
  </div>
</ng-template>

<!-- Dialog -->
<p-dialog [header]="editMode ? 'Editar Usuario' : 'Nuevo Usuario'"
          [(visible)]="showForm" [modal]="true" [style]="{'width':'520px'}" [draggable]="false">
  <div class="dialog-form">
    <div class="form-row">
      <div class="field">
        <label class="fl">Nombre completo *</label>
        <input pInputText [(ngModel)]="form.nombreCompleto" placeholder="Ej. Ana García" />
      </div>
      <div class="field">
        <label class="fl">Usuario *</label>
        <input pInputText [(ngModel)]="form.usuario" placeholder="nombre_usuario" />
      </div>
      <div class="field">
        <label class="fl">Email *</label>
        <input pInputText [(ngModel)]="form.email" type="email" placeholder="correo@ejemplo.com" />
      </div>
      <div class="field">
        <label class="fl">{{ editMode ? 'Nueva contraseña' : 'Contraseña *' }}</label>
        <p-password [(ngModel)]="form.password" [feedback]="true" [toggleMask]="true"
                    styleClass="w-full" [inputStyle]="{'width':'100%'}"
                    [placeholder]="editMode ? 'Dejar en blanco para mantener' : 'Mín. 6 caracteres'" />
      </div>
      <div class="field">
        <label class="fl">Teléfono</label>
        <input pInputText [(ngModel)]="form.telefono" placeholder="10 dígitos" />
      </div>
      <div class="field">
        <label class="fl">Fecha de nacimiento</label>
        <input pInputText [(ngModel)]="form.fechaNacimiento" type="date" />
      </div>
      <div class="field full">
        <label class="fl">Dirección</label>
        <input pInputText [(ngModel)]="form.direccion" placeholder="Dirección completa" />
      </div>
    </div>
    @if (formMsg) {
      <div class="fmsg" [class.ok]="formOk" [class.er]="!formOk">
        <i [class]="formOk ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'"></i> {{ formMsg }}
      </div>
    }
  </div>
  <ng-template #footer>
    <p-button label="Cancelar" variant="text" (onClick)="showForm=false" />
    <p-button [label]="editMode ? 'Actualizar' : 'Crear usuario'" icon="pi pi-check"
              (onClick)="saveUser()" styleClass="btn-primary" />
  </ng-template>
</p-dialog>
  `,
  styles: [`
    .um-page { padding:1.75rem; max-width:1100px; margin:0 auto; }

    /* Header */
    .um-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem; background:#fff; padding:1.5rem 1.75rem; border-radius:16px; box-shadow:0 1px 8px rgba(0,0,0,.06); }
    .header-left { display:flex; align-items:center; gap:1rem; }
    .header-icon { width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,#6c47ff,#8b5cff); display:flex; align-items:center; justify-content:center; font-size:1.25rem; color:#fff; box-shadow:0 4px 16px rgba(108,71,255,.3); }
    .page-title { font-size:1.35rem; font-weight:800; color:#0f0a2e; margin:0; }
    .page-sub { color:#9ca3af; font-size:.82rem; margin:.2rem 0 0; }
    .header-right { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; }

    /* Stats */
    .stats-row { display:flex; gap:.75rem; margin-bottom:1.25rem; flex-wrap:wrap; }
    .stat-pill { display:flex; align-items:center; gap:.65rem; background:#fff; border-radius:12px; padding:.85rem 1.25rem; box-shadow:0 1px 6px rgba(0,0,0,.05); flex:1; min-width:130px; }
    .stat-purple i { color:#6c47ff; } .stat-blue i { color:#0ea5e9; } .stat-amber i { color:#f59e0b; }
    .stat-n { font-size:1.5rem; font-weight:800; color:#0f0a2e; }
    .stat-l { font-size:.75rem; color:#9ca3af; }

    /* User list */
    .users-list { display:flex; flex-direction:column; gap:.65rem; }
    .user-card { background:#fff; border-radius:14px; box-shadow:0 1px 6px rgba(0,0,0,.05); border:2px solid transparent; overflow:hidden; transition:box-shadow .2s,border-color .2s; }
    .user-card.expanded { border-color:rgba(108,71,255,.2); box-shadow:0 4px 24px rgba(108,71,255,.1); }
    .user-row { display:flex; align-items:center; gap:1rem; padding:1rem 1.25rem; cursor:pointer; transition:background .12s; }
    .user-row:hover { background:#fafafa; }

    .u-avatar { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; font-weight:800; color:#fff; flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,.15); }
    .u-info { display:flex; flex-direction:column; gap:.15rem; flex:1; min-width:0; overflow:hidden; }
    .u-name { font-weight:700; font-size:.95rem; color:#0f0a2e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .u-meta { font-size:.74rem; color:#9ca3af; display:flex; align-items:center; gap:.3rem; flex-wrap:wrap; }
    .u-groups { font-size:.72rem; color:#6b7280; display:flex; align-items:center; gap:.3rem; }

    .u-perms { display:flex; align-items:center; gap:.45rem; flex-shrink:0; flex-wrap:wrap; }
    .pp { display:flex; align-items:center; gap:.3rem; font-size:.7rem; font-weight:700; padding:.22rem .6rem; border-radius:20px; white-space:nowrap; }
    .pp-total { display:flex; align-items:center; gap:.3rem; background:#f3f0ff; color:#6c47ff; font-size:.72rem; font-weight:700; padding:.22rem .7rem; border-radius:20px; border:1px solid #ddd6fe; }

    .u-actions { display:flex; gap:.2rem; flex-shrink:0; }
    .chevron { color:#d1d5db; font-size:.8rem; flex-shrink:0; padding:.25rem; transition:transform .2s,color .2s; }
    .chevron.open { transform:rotate(180deg); color:#6c47ff; }

    /* Permissions panel */
    .perms-panel { border-top:1px solid #ede9fe; background:linear-gradient(180deg,#f8f7ff,#f3f0ff); padding:1.5rem; animation:slideDown .2s ease; }
    @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

    .pp-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:.75rem; margin-bottom:1.25rem; }
    .pp-title { display:flex; align-items:center; gap:.5rem; font-size:.9rem; color:#0f0a2e; }
    .pp-actions { display:flex; gap:.5rem; flex-wrap:wrap; }

    .pg-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:1rem; }
    .pg-card { background:#fff; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,.05); overflow:hidden; }
    .pg-head { display:flex; align-items:center; gap:.5rem; padding:.7rem 1rem; font-size:.875rem; }
    .pg-count { margin-left:auto; color:#fff; font-size:.65rem; font-weight:800; padding:.15rem .5rem; border-radius:20px; font-family:monospace; }

    .pi-list { padding:.7rem 1rem; display:flex; flex-direction:column; gap:.3rem; }
    .pi-item { display:flex; align-items:center; gap:.6rem; padding:.4rem .55rem; border-radius:8px; cursor:pointer; transition:background .12s; border:1px solid transparent; }
    .pi-item:hover { background:#f9fafb; }
    .pi-item.active { background:#fafbff; border-color:#ede9fe; }
    .pcheck { width:15px; height:15px; border-radius:4px; flex-shrink:0; border:2px solid #d1d5db; display:flex; align-items:center; justify-content:center; transition:all .15s; }
    .plabel { font-size:.8rem; font-weight:500; color:#374151; flex:1; }
    .pcode { font-size:.62rem; color:#c4b5fd; background:#f3f0ff; padding:.1rem .4rem; border-radius:5px; font-family:monospace; }

    .save-ok { margin-top:1rem; padding:.7rem 1rem; background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; border-radius:10px; font-size:.875rem; font-weight:600; display:flex; align-items:center; gap:.5rem; }

    /* Empty */
    .empty-state { text-align:center; padding:4rem 2rem; background:#fff; border-radius:14px; }
    .empty-ico { width:64px; height:64px; border-radius:18px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; font-size:1.6rem; color:#d1d5db; margin:0 auto 1rem; }

    /* No access */
    .no-access { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; text-align:center; padding:2rem; }
    .no-access-ico { width:80px; height:80px; border-radius:24px; background:#fee2e2; display:flex; align-items:center; justify-content:center; font-size:2rem; color:#ef4444; margin-bottom:1.25rem; }
    .no-access h2 { color:#0f0a2e; font-weight:800; margin:0 0 .5rem; }
    .no-access p { color:#9ca3af; margin:0; }

    /* Dialog */
    .dialog-form { display:flex; flex-direction:column; gap:1rem; }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    .field { display:flex; flex-direction:column; gap:.4rem; }
    .field.full { grid-column:1/-1; }
    .fl { font-weight:700; font-size:.8rem; color:#374151; }
    .fmsg { display:flex; align-items:center; gap:.5rem; padding:.7rem 1rem; border-radius:10px; font-size:.875rem; font-weight:600; }
    .fmsg.ok { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }
    .fmsg.er { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }

    /* Global btn */
    :host ::ng-deep .btn-primary { background:linear-gradient(135deg,#6c47ff,#8b5cff) !important; border:none !important; font-weight:700 !important; box-shadow:0 4px 14px rgba(108,71,255,.35) !important; }
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
  form = { nombreCompleto:'', usuario:'', email:'', password:'', telefono:'', direccion:'', fechaNacimiento:'' };
  currentUser = computed(() => this.ps.currentUser());
  filtered = computed(() => {
    const s = this.search.toLowerCase();
    return this.ps.users().filter(u => !s || u.nombreCompleto.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || u.usuario.toLowerCase().includes(s));
  });

  constructor(public ps: PermissionService, private msg: MessageService, private confirm: ConfirmationService) {}

  getAvatarColor(uid: string): string {
    let h = 0; for (let i = 0; i < uid.length; i++) h = uid.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }
  getUserGroups(uid: string): string {
    return this.ps.groups().filter(g => g.memberIds.includes(uid)).map(g => g.nombre).join(', ') || 'Sin grupos';
  }
  countPermsInGroup(u: AppUser, perms: readonly string[]): number {
    return perms.filter(p => u.permissions.includes(p as Permission)).length;
  }
  countPermsInGroupFromTemp(uid: string, perms: readonly string[]): number {
    const map = this.tempPermsMap[uid];
    if (!map) { const user = this.ps.users().find(u => u.id === uid); return user ? perms.filter(p => user.permissions.includes(p as Permission)).length : 0; }
    return perms.filter(p => map[p]).length;
  }
  toggleExpand(u: AppUser) {
    if (this.expandedUserId === u.id) { this.expandedUserId = null; }
    else { this.expandedUserId = u.id; this.savedUserId = null; if (!this.tempPermsMap[u.id]) this.initTempPerms(u); }
  }
  initTempPerms(u: AppUser) { const map: Record<string,boolean> = {}; ALL_PERMISSIONS.forEach(p => { map[p] = u.permissions.includes(p); }); this.tempPermsMap[u.id] = map; }
  getTempPerm(uid: string, perm: string): boolean { return this.tempPermsMap[uid]?.[perm] ?? false; }
  setTempPerm(uid: string, perm: string, val: boolean) {
    if (!this.tempPermsMap[uid]) { const user = this.ps.users().find(u => u.id === uid); if (user) this.initTempPerms(user); }
    this.tempPermsMap[uid][perm] = val; this.dirtyUsers.add(uid);
  }
  isDirty(uid: string): boolean { return this.dirtyUsers.has(uid); }
  toggleAll(u: AppUser, val: boolean) { if (!this.tempPermsMap[u.id]) this.initTempPerms(u); ALL_PERMISSIONS.forEach(p => { this.tempPermsMap[u.id][p] = val; }); this.dirtyUsers.add(u.id); }
  async savePermsInline(u: AppUser) {
    const map = this.tempPermsMap[u.id]; if (!map) return;
    const perms = ALL_PERMISSIONS.filter(p => map[p]) as Permission[];
    await this.ps.updateUser(u.id, { permissions: perms });
    this.dirtyUsers.delete(u.id); this.savedUserId = u.id;
    this.msg.add({ severity:'success', summary:'Permisos actualizados', detail:u.nombreCompleto, life:2500 });
    setTimeout(() => { this.savedUserId = null; }, 3000);
  }
  openCreate() { this.editMode = false; this.editId = ''; this.form = { nombreCompleto:'', usuario:'', email:'', password:'', telefono:'', direccion:'', fechaNacimiento:'' }; this.formMsg = ''; this.showForm = true; }
  openEdit(u: AppUser) { this.editMode = true; this.editId = u.id; this.form = { nombreCompleto:u.nombreCompleto, usuario:u.usuario, email:u.email, password:'', telefono:u.telefono, direccion:u.direccion, fechaNacimiento:u.fechaNacimiento }; this.formMsg = ''; this.showForm = true; }
  async saveUser() {
    if (!this.form.nombreCompleto || !this.form.usuario || !this.form.email) { this.formMsg = 'Nombre, usuario y email son obligatorios.'; this.formOk = false; return; }
    if (this.editMode) {
      const changes: any = { ...this.form }; if (!changes.password) delete changes.password;
      await this.ps.updateUser(this.editId, changes);
      this.msg.add({ severity:'success', summary:'Usuario actualizado', life:2500 }); this.showForm = false;
    } else {
      if (!this.form.password) { this.formMsg = 'La contraseña es obligatoria.'; this.formOk = false; return; }
      const result = await this.ps.createUser({ email:this.form.email, password:this.form.password, usuario:this.form.usuario, nombreCompleto:this.form.nombreCompleto, direccion:this.form.direccion, telefono:this.form.telefono, fechaNacimiento:this.form.fechaNacimiento, permissions:[] });
      if (result.ok) { this.msg.add({ severity:'success', summary:'Usuario creado', life:2500 }); this.showForm = false; }
      else { this.formMsg = result.msg; this.formOk = false; }
    }
  }
  confirmDelete(u: AppUser) {
    this.confirm.confirm({
      message: `¿Eliminar a <strong>${u.nombreCompleto}</strong>? Esta acción no se puede deshacer.`,
      header: 'Eliminar usuario', icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger', acceptLabel: 'Sí, eliminar', rejectLabel: 'Cancelar',
      accept: async () => { await this.ps.deleteUser(u.id); if (this.expandedUserId === u.id) this.expandedUserId = null; this.msg.add({ severity:'success', summary:'Usuario eliminado', life:2500 }); }
    });
  }
}
