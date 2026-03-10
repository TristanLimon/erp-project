import { Component, computed, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DividerModule } from 'primeng/divider';
import { ColorPickerModule } from 'primeng/colorpicker';
import { MessageService, ConfirmationService } from 'primeng/api';
import { PermissionService } from '../../../services/permission.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

@Component({
  selector: 'app-group-manage',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, TableModule, AvatarModule,
    TagModule, DialogModule, ToastModule, ConfirmDialogModule,
    DividerModule, ColorPickerModule, HasPermissionDirective
  ],
  providers: [MessageService, ConfirmationService],
  template: `
<p-toast />
<p-confirmdialog />
<div class="manage-container">
  <div class="manage-header">
    <p-button icon="pi pi-arrow-left" variant="text" size="small"
              (onClick)="router.navigate(['/home/group', groupId])" />
    <div>
      <h1 class="page-title">Gestión del Grupo</h1>
      <p class="page-sub" [style]="{'color': group()?.color}">{{ group()?.nombre }}</p>
    </div>
  </div>

  <div class="manage-grid">
    <!-- Configuración básica -->
    <div class="card-section" *hasPermission="['group:edit']">
      <h2 class="section-title"><i class="pi pi-cog"></i> Configuración</h2>
      <div class="flex flex-column gap-3">
        <div class="flex flex-column gap-1">
          <label class="field-label">Nombre del grupo</label>
          <input pInputText [(ngModel)]="editNombre" />
        </div>
        <div class="flex flex-column gap-1">
          <label class="field-label">Descripción</label>
          <input pInputText [(ngModel)]="editDesc" />
        </div>
        <div class="flex flex-column gap-1">
          <label class="field-label">Modelo LLM</label>
          <input pInputText [(ngModel)]="editLLM" placeholder="Ej. GPT-4o, Claude 3.5..." />
        </div>
        <div class="flex align-items-center gap-3">
          <label class="field-label">Color</label>
          <p-colorpicker [(ngModel)]="editColor" format="hex" />
        </div>
        <p-button label="Guardar configuración" icon="pi pi-check" (onClick)="saveConfig()" styleClass="p-button-sm" />
      </div>

      <p-divider />

      <div *hasPermission="'group:delete'">
        <h3 class="danger-title">Zona de peligro</h3>
        <p class="danger-desc">Eliminar el grupo eliminará toda su información permanentemente.</p>
        <p-button label="Eliminar grupo" icon="pi pi-trash" severity="danger"
                  variant="outlined" size="small" (onClick)="eliminarGrupo()" />
      </div>
    </div>

    <!-- Miembros -->
    <div class="card-section">
      <div class="section-header-row">
        <h2 class="section-title"><i class="pi pi-users"></i> Miembros ({{ members().length }})</h2>
        <p-button *hasPermission="'group:add_member'" label="Añadir miembro" icon="pi pi-user-plus"
                  size="small" (onClick)="showAdd = true" />
      </div>

      <p-table [value]="members()" styleClass="p-datatable-sm">
        <ng-template #header>
          <tr>
            <th>Usuario</th>
            <th>Email</th>
            <th>Permisos</th>
            <th style="width:80px"></th>
          </tr>
        </ng-template>
        <ng-template #body let-u>
          <tr>
            <td>
              <div class="user-cell">
                <p-avatar [label]="u.nombreCompleto.charAt(0)" shape="circle" size="normal"
                          [style]="{'background': group()?.color, 'color':'#fff'}" />
                <div>
                  <span class="user-name">{{ u.nombreCompleto }}</span>
                  <span class="user-username">@{{ u.usuario }}</span>
                </div>
              </div>
            </td>
            <td style="font-size:.83rem;color:#6b7280">{{ u.email }}</td>
            <td>
              <span class="perm-count">{{ u.permissions.length }} permisos</span>
            </td>
            <td>
              <p-button *hasPermission="'group:remove_member'"
                        icon="pi pi-user-minus" variant="text" severity="danger" size="small"
                        (onClick)="removeMember(u)" pTooltip="Remover del grupo"
                        [disabled]="u.id === currentUser()?.id" />
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  </div>
</div>

<!-- Dialog añadir miembro -->
<p-dialog header="Añadir miembro por email" [(visible)]="showAdd" [modal]="true" [style]="{'width':'380px'}">
  <div class="flex flex-column gap-3 pt-2">
    <div class="flex flex-column gap-1">
      <label class="field-label">Email del usuario</label>
      <input pInputText [(ngModel)]="addEmail" placeholder="usuario@ejemplo.com" type="email" />
    </div>
    @if (addMsg) {
      <p [style]="{'color': addOk ? '#22c55e' : '#ef4444', 'font-size':'.875rem'}">{{ addMsg }}</p>
    }
  </div>
  <ng-template #footer>
    <p-button label="Cancelar" variant="text" (onClick)="showAdd = false; addMsg = ''" />
    <p-button label="Añadir" icon="pi pi-check" (onClick)="addMember()" />
  </ng-template>
</p-dialog>
  `,
  styles: [`
    .manage-container { padding:1.5rem; max-width:1100px; margin:0 auto; }
    .manage-header { display:flex; align-items:center; gap:1rem; margin-bottom:1.5rem; background:#fff; padding:1rem 1.25rem; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); }
    .page-title { font-size:1.3rem; font-weight:800; color:#0f0a2e; margin:0; }
    .page-sub { margin:.15rem 0 0; font-size:.9rem; font-weight:600; }
    .manage-grid { display:grid; grid-template-columns:350px 1fr; gap:1.25rem; }
    @media(max-width:900px) { .manage-grid { grid-template-columns:1fr; } }
    .card-section { background:#fff; border-radius:14px; padding:1.5rem; box-shadow:0 1px 8px rgba(0,0,0,.06); }
    .section-title { font-size:1rem; font-weight:700; color:#0f0a2e; margin:0 0 1.25rem; display:flex; align-items:center; gap:.5rem; }
    .section-header-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }
    .field-label { font-weight:600; font-size:.875rem; color:#374151; }
    .danger-title { font-size:.95rem; font-weight:700; color:#ef4444; margin:0 0 .5rem; }
    .danger-desc { font-size:.83rem; color:#9ca3af; margin:0 0 .85rem; }
    .user-cell { display:flex; align-items:center; gap:.65rem; }
    .user-name { display:block; font-weight:600; font-size:.875rem; color:#0f0a2e; }
    .user-username { display:block; font-size:.75rem; color:#9ca3af; }
    .perm-count { font-size:.78rem; background:#f3f4f6; color:#6b7280; padding:.2rem .55rem; border-radius:20px; }
  `]
})
export class GroupManageComponent implements OnInit {
  groupId = '';
  showAdd = false;
  addEmail = '';
  addMsg = '';
  addOk = false;

  editNombre = '';
  editDesc = '';
  editLLM = '';
  editColor = '';

  group = computed(() => this.ps.groups().find(g => g.id === this.groupId) ?? null);
  members = computed(() => this.ps.groupMembers(this.groupId));
  currentUser = computed(() => this.ps.currentUser());

  constructor(private route: ActivatedRoute, public router: Router,
              private ps: PermissionService, private msg: MessageService,
              private confirm: ConfirmationService) {}

  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id') ?? '';
    this.ps.setCurrentGroup(this.groupId);
    const g = this.group();
    if (g) {
      this.editNombre = g.nombre;
      this.editDesc = g.descripcion ?? '';
      this.editLLM = g.llmModel;
      this.editColor = g.color.replace('#', '');
    }
  }

  saveConfig() {
    this.ps.updateGroup(this.groupId, {
      nombre: this.editNombre,
      descripcion: this.editDesc,
      llmModel: this.editLLM,
      color: '#' + this.editColor,
    });
    this.msg.add({ severity: 'success', summary: 'Grupo actualizado', life: 2500 });
  }

  addMember() {
    const user = this.ps.users().find(u => u.email === this.addEmail.trim());
    if (!user) { this.addMsg = 'Usuario no encontrado.'; this.addOk = false; return; }
    if (this.group()?.memberIds.includes(user.id)) {
      this.addMsg = 'Ya es miembro del grupo.'; this.addOk = false; return;
    }
    this.ps.addMemberToGroup(this.groupId, user.id);
    this.addMsg = `${user.nombreCompleto} añadido correctamente.`;
    this.addOk = true;
    this.addEmail = '';
  }

  removeMember(u: any) {
    this.confirm.confirm({
      message: `¿Remover a ${u.nombreCompleto} del grupo?`,
      header: 'Confirmar',
      icon: 'pi pi-user-minus',
      accept: () => {
        this.ps.removeMemberFromGroup(this.groupId, u.id);
        this.msg.add({ severity: 'success', summary: 'Miembro removido', life: 2500 });
      }
    });
  }

  eliminarGrupo() {
    this.confirm.confirm({
      message: `¿Eliminar el grupo "${this.group()?.nombre}" permanentemente?`,
      header: 'Eliminar grupo',
      icon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.ps.deleteGroup(this.groupId);
        this.router.navigate(['/home']);
        this.msg.add({ severity: 'success', summary: 'Grupo eliminado', life: 2500 });
      }
    });
  }
}
