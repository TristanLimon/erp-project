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

// Group permissions for display
const PERM_GROUPS = [
  { label: 'Tickets', icon: 'pi-ticket', perms: ALL_PERMISSIONS.filter(p => p.startsWith('ticket:')) },
  { label: 'Grupos', icon: 'pi-users', perms: ALL_PERMISSIONS.filter(p => p.startsWith('group:')) },
  { label: 'Usuarios', icon: 'pi-user', perms: ALL_PERMISSIONS.filter(p => p.startsWith('user:')) },
];

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
      <p class="page-sub">Administra usuarios y sus permisos individuales (sin roles)</p>
    </div>
    <p-button *hasPermission="'user:create'" label="Nuevo usuario" icon="pi pi-user-plus"
              (onClick)="openCreate()" />
  </div>

  <!-- Search -->
  <div class="search-bar">
    <input pInputText [(ngModel)]="search" placeholder="Buscar usuario..." style="width:280px" />
  </div>

  <!-- Users table -->
  <div class="table-card">
    <p-table [value]="filtered()" [paginator]="true" [rows]="10" styleClass="p-datatable-sm p-datatable-striped">
      <ng-template #header>
        <tr>
          <th>Usuario</th>
          <th>Email</th>
          <th style="width:120px">Permisos</th>
          <th style="width:130px">Grupos</th>
          <th style="width:100px">Acciones</th>
        </tr>
      </ng-template>
      <ng-template #body let-u>
        <tr>
          <td>
            <div class="user-cell">
              <p-avatar [label]="u.nombreCompleto.charAt(0)" shape="circle" size="normal"
                        [style]="{'background': '#6c47ff', 'color':'#fff'}" />
              <div>
                <span class="user-name">{{ u.nombreCompleto }}</span>
                <span class="user-un">@{{ u.usuario }}</span>
              </div>
            </div>
          </td>
          <td style="font-size:.83rem;color:#6b7280">{{ u.email }}</td>
          <td>
            <span class="perm-badge">{{ u.permissions.length }} / {{ totalPerms }}</span>
          </td>
          <td style="font-size:.82rem;color:#6b7280">
            {{ getUserGroups(u.id) }}
          </td>
          <td>
            <div class="flex gap-1">
              <p-button icon="pi pi-pencil" variant="text" size="small"
                        (onClick)="openEdit(u)" pTooltip="Editar usuario" />
              <p-button icon="pi pi-key" variant="text" size="small"
                        (onClick)="openPerms(u)" pTooltip="Gestionar permisos"
                        [style]="{'color':'#f59e0b'}" />
              <p-button *hasPermission="'user:delete'" icon="pi pi-trash" variant="text"
                        severity="danger" size="small"
                        (onClick)="deleteUser(u)" pTooltip="Eliminar"
                        [disabled]="u.id === currentUser()?.id" />
            </div>
          </td>
        </tr>
      </ng-template>
    </p-table>
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

<!-- Dialog permisos -->
<p-dialog header="Gestionar Permisos" [(visible)]="showPerms" [modal]="true" [style]="{'width':'600px'}">
  @if (selectedUser) {
    <div class="pt-2">
      <div class="flex align-items-center gap-2 mb-3">
        <p-avatar [label]="selectedUser.nombreCompleto.charAt(0)" shape="circle"
                  [style]="{'background':'#6c47ff','color':'#fff'}" />
        <div>
          <strong>{{ selectedUser.nombreCompleto }}</strong>
          <p class="m-0 text-sm text-color-secondary">@{{ selectedUser.usuario }}</p>
        </div>
        <div class="ml-auto flex gap-2">
          <p-button label="Todo" size="small" variant="outlined" (onClick)="toggleAll(true)" />
          <p-button label="Ninguno" size="small" variant="outlined" severity="secondary" (onClick)="toggleAll(false)" />
        </div>
      </div>

      @for (pg of permGroups; track pg.label) {
        <div class="perm-group-section">
          <div class="perm-group-header">
            <i [class]="'pi ' + pg.icon"></i>
            <span>{{ pg.label }}</span>
          </div>
          <div class="perm-checkboxes">
            @for (p of pg.perms; track p) {
              <div class="perm-check-item">
                <p-checkbox [binary]="true" [(ngModel)]="tempPerms[p]" [inputId]="p" />
                <label [for]="p">{{ p }}</label>
              </div>
            }
          </div>
        </div>
      }
    </div>
  }
  <ng-template #footer>
    <p-button label="Cancelar" variant="text" (onClick)="showPerms = false" />
    <p-button label="Guardar permisos" icon="pi pi-key" (onClick)="savePerms()" />
  </ng-template>
</p-dialog>
  `,
  styles: [`
    .um-container { padding:1.5rem; max-width:1200px; margin:0 auto; }
    .um-header { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem; background:#fff; padding:1.25rem 1.5rem; border-radius:14px; box-shadow:0 1px 6px rgba(0,0,0,.06); }
    .page-title { font-size:1.4rem; font-weight:800; color:#0f0a2e; margin:0; display:flex; align-items:center; gap:.5rem; }
    .page-sub { color:#9ca3af; font-size:.875rem; margin:.25rem 0 0; }
    .search-bar { margin-bottom:1rem; }
    .table-card { background:#fff; border-radius:14px; box-shadow:0 1px 8px rgba(0,0,0,.06); overflow:hidden; }
    .user-cell { display:flex; align-items:center; gap:.65rem; }
    .user-name { display:block; font-weight:600; font-size:.875rem; color:#0f0a2e; }
    .user-un { display:block; font-size:.75rem; color:#9ca3af; }
    .perm-badge { font-size:.78rem; background:#e9d5ff; color:#7c3aed; padding:.2rem .6rem; border-radius:20px; font-weight:600; }
    .field-label { font-weight:600; font-size:.875rem; color:#374151; }
    .perm-group-section { margin-bottom:1rem; }
    .perm-group-header { display:flex; align-items:center; gap:.5rem; font-weight:700; font-size:.9rem; color:#0f0a2e; margin-bottom:.65rem; padding:.5rem .75rem; background:#f9fafb; border-radius:8px; }
    .perm-checkboxes { display:grid; grid-template-columns:repeat(2,1fr); gap:.5rem; padding:0 .5rem; }
    .perm-check-item { display:flex; align-items:center; gap:.5rem; }
    .perm-check-item label { font-size:.8rem; font-family:monospace; color:#374151; cursor:pointer; }
  `]
})
export class UserManagementComponent {
  search = '';
  showForm = false;
  showPerms = false;
  editMode = false;
  editId = '';
  formMsg = '';
  formOk = false;
  selectedUser: AppUser | null = null;
  tempPerms: Record<string, boolean> = {};
  permGroups = PERM_GROUPS;
  totalPerms = ALL_PERMISSIONS.length;

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

  getUserGroups(uid: string) {
    return this.ps.groups().filter(g => g.memberIds.includes(uid)).map(g => g.nombre).join(', ') || '—';
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

  openPerms(u: AppUser) {
    this.selectedUser = u;
    this.tempPerms = {};
    ALL_PERMISSIONS.forEach(p => { this.tempPerms[p] = u.permissions.includes(p); });
    this.showPerms = true;
  }

  toggleAll(val: boolean) {
    ALL_PERMISSIONS.forEach(p => { this.tempPerms[p] = val; });
  }

  savePerms() {
    if (!this.selectedUser) return;
    const perms = ALL_PERMISSIONS.filter(p => this.tempPerms[p]) as Permission[];
    this.ps.updateUser(this.selectedUser.id, { permissions: perms });
    this.msg.add({ severity: 'success', summary: 'Permisos actualizados', life: 2500 });
    this.showPerms = false;
  }

  deleteUser(u: AppUser) {
    this.confirm.confirm({
      message: `¿Eliminar al usuario ${u.nombreCompleto}?`,
      header: 'Eliminar usuario',
      icon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.ps.deleteUser(u.id);
        this.msg.add({ severity: 'success', summary: 'Usuario eliminado', life: 2500 });
      }
    });
  }
}
