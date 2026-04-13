import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { ColorPickerModule } from 'primeng/colorpicker';
import { BadgeModule } from 'primeng/badge';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService, ConfirmationService } from 'primeng/api';
import { PermissionService, Group } from '../../../services/permission.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

@Component({
  selector: 'app-group-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, DialogModule, ToastModule, ConfirmDialogModule,
    TooltipModule, DividerModule, ColorPickerModule, BadgeModule,
    IconFieldModule, InputIconModule, HasPermissionDirective
  ],
  providers: [MessageService, ConfirmationService],
  template: `
<p-toast position="top-right" />
<p-confirmdialog />

<div *hasPermission="['group:create','group:edit','group:delete','group:view']; else noPerm">
  <div class="gm-page">

    <!-- Header -->
    <div class="gm-header">
      <div class="header-left">
        <div class="header-icon"><i class="pi pi-folder-open"></i></div>
        <div>
          <h1 class="page-title">Administración de Grupos</h1>
          <p class="page-sub">{{ ps.groups().length }} grupos en total · {{ totalMemberships() }} membresías</p>
        </div>
      </div>
      <div class="header-right">
        <p-iconfield>
          <p-inputicon class="pi pi-search" />
          <input pInputText [(ngModel)]="search" placeholder="Buscar grupo..." style="width:220px" />
        </p-iconfield>
        <p-button *hasPermission="'group:create'" label="Nuevo grupo" icon="pi pi-plus"
                  (onClick)="openCreate()" styleClass="btn-primary" />
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-pill stat-purple">
        <i class="pi pi-folder"></i>
        <span class="stat-n">{{ ps.groups().length }}</span>
        <span class="stat-l">Grupos</span>
      </div>
      <div class="stat-pill stat-blue">
        <i class="pi pi-users"></i>
        <span class="stat-n">{{ totalMemberships() }}</span>
        <span class="stat-l">Membresías</span>
      </div>
      <div class="stat-pill stat-green">
        <i class="pi pi-ticket"></i>
        <span class="stat-n">{{ ps.tickets().length }}</span>
        <span class="stat-l">Tickets totales</span>
      </div>
    </div>

    <!-- Group grid -->
    <div class="groups-grid">
      @for (g of filtered(); track g.id) {
        <div class="group-card" [style]="{'--gc': g.color}">
          <div class="gc-stripe" [style]="{'background': g.color}"></div>

          <div class="gc-body">
            <div class="gc-top">
              <div class="gc-avatar" [style]="{'background': g.color}">
                {{ g.nombre.charAt(0) }}
              </div>
              <div class="gc-info">
                <span class="gc-name">{{ g.nombre }}</span>
                @if (g.descripcion) {
                  <span class="gc-desc">{{ g.descripcion }}</span>
                }
              </div>
            </div>

            <div class="gc-meta">
              <span class="gc-badge" [style]="{'background': g.color+'22','color':g.color,'border-color':g.color+'55'}">
                <i class="pi pi-microchip-ai" style="font-size:.7rem"></i>{{ g.llmModel }}
              </span>
            </div>

            <div class="gc-stats">
              <div class="gcs-item">
                <i class="pi pi-users"></i>
                <span>{{ g.memberIds.length }} miembro{{ g.memberIds.length !== 1 ? 's' : '' }}</span>
              </div>
              <div class="gcs-item">
                <i class="pi pi-ticket"></i>
                <span>{{ ticketCount(g.id) }} ticket{{ ticketCount(g.id) !== 1 ? 's' : '' }}</span>
              </div>
            </div>

            <div class="gc-members-preview">
              @for (uid of g.memberIds.slice(0, 5); track uid) {
                <div class="member-dot" [style]="{'background': g.color}"
                     [pTooltip]="getMemberName(uid)" tooltipPosition="top">
                  {{ getMemberInitial(uid) }}
                </div>
              }
              @if (g.memberIds.length > 5) {
                <div class="member-dot more">+{{ g.memberIds.length - 5 }}</div>
              }
            </div>
          </div>

          <div class="gc-actions">
            <p-button icon="pi pi-arrow-right" label="Ir al grupo" size="small" variant="outlined"
                      (onClick)="irGrupo(g)" pTooltip="Ver dashboard del grupo" tooltipPosition="top"
                      [style]="{'border-color': g.color, 'color': g.color}" />
            <p-button *hasPermission="['group:edit','group:add_member','group:remove_member']"
                      icon="pi pi-cog" size="small" variant="text"
                      pTooltip="Gestionar grupo" tooltipPosition="top"
                      (onClick)="irManage(g)"
                      [style]="{'color': g.color}" />
            <p-button *hasPermission="'group:delete'" icon="pi pi-trash" size="small"
                      variant="text" severity="danger"
                      pTooltip="Eliminar grupo" tooltipPosition="top"
                      (onClick)="confirmarEliminar(g)" />
          </div>
        </div>
      }

      @if (filtered().length === 0) {
        <div class="empty-state">
          <div class="empty-ico"><i class="pi pi-folder-open"></i></div>
          <p style="font-weight:700;color:#374151;margin:.75rem 0 .25rem">Sin grupos</p>
          <p style="color:#9ca3af;font-size:.875rem;margin:0">
            {{ search ? 'No hay coincidencias con "' + search + '"' : 'Aún no se han creado grupos.' }}
          </p>
          <p-button *hasPermission="'group:create'" label="Crear primer grupo" icon="pi pi-plus"
                    (onClick)="openCreate()" styleClass="btn-primary" [style]="{'margin-top':'1rem'}" />
        </div>
      }
    </div>
  </div>
</div>

<ng-template #noPerm>
  <div class="no-access">
    <div class="no-access-ico"><i class="pi pi-lock"></i></div>
    <h2>Acceso restringido</h2>
    <p>No tienes permisos para administrar grupos.</p>
  </div>
</ng-template>

<!-- Dialog crear grupo -->
<p-dialog header="Crear nuevo grupo" [(visible)]="showCreate" [modal]="true"
          [style]="{'width':'440px'}" [draggable]="false">
  <div class="dialog-form">
    <div class="field">
      <label class="fl">Nombre *</label>
      <input pInputText [(ngModel)]="form.nombre" placeholder="Ej. Equipo Backend" />
    </div>
    <div class="field">
      <label class="fl">Descripción</label>
      <input pInputText [(ngModel)]="form.descripcion" placeholder="Descripción del grupo" />
    </div>
    <div class="field">
      <label class="fl">Modelo LLM</label>
      <input pInputText [(ngModel)]="form.llmModel" placeholder="Ej. GPT-4o, Claude 3.5..." />
    </div>
    <div class="field-row">
      <label class="fl">Color del grupo</label>
      <p-colorpicker [(ngModel)]="form.color" format="hex" />
      <span class="color-preview" [style]="{'background':'#'+form.color}">#{{ form.color }}</span>
    </div>
    @if (formMsg) {
      <div class="fmsg er"><i class="pi pi-exclamation-circle"></i> {{ formMsg }}</div>
    }
  </div>
  <ng-template #footer>
    <p-button label="Cancelar" variant="text" (onClick)="showCreate = false" />
    <p-button label="Crear grupo" icon="pi pi-check" (onClick)="crearGrupo()" styleClass="btn-primary" />
  </ng-template>
</p-dialog>
  `,
  styles: [`
    .gm-page { padding:1.75rem; max-width:1200px; margin:0 auto; }

    .gm-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem; background:#fff; padding:1.5rem 1.75rem; border-radius:16px; box-shadow:0 1px 8px rgba(0,0,0,.06); }
    .header-left { display:flex; align-items:center; gap:1rem; }
    .header-icon { width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,#0ea5e9,#38bdf8); display:flex; align-items:center; justify-content:center; font-size:1.25rem; color:#fff; box-shadow:0 4px 16px rgba(14,165,233,.3); }
    .page-title { font-size:1.35rem; font-weight:800; color:#0f0a2e; margin:0; }
    .page-sub { color:#9ca3af; font-size:.82rem; margin:.2rem 0 0; }
    .header-right { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; }

    .stats-row { display:flex; gap:.75rem; margin-bottom:1.25rem; flex-wrap:wrap; }
    .stat-pill { display:flex; align-items:center; gap:.65rem; background:#fff; border-radius:12px; padding:.85rem 1.25rem; box-shadow:0 1px 6px rgba(0,0,0,.05); flex:1; min-width:130px; }
    .stat-purple i { color:#6c47ff; } .stat-blue i { color:#0ea5e9; } .stat-green i { color:#22c55e; }
    .stat-n { font-size:1.5rem; font-weight:800; color:#0f0a2e; }
    .stat-l { font-size:.75rem; color:#9ca3af; }

    .groups-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:1.25rem; }

    .group-card { background:#fff; border-radius:16px; box-shadow:0 1px 8px rgba(0,0,0,.06); border:1px solid #f3f4f6; overflow:hidden; display:flex; flex-direction:column; transition:box-shadow .2s,transform .2s; }
    .group-card:hover { box-shadow:0 6px 28px rgba(0,0,0,.1); transform:translateY(-2px); }
    .gc-stripe { height:4px; }
    .gc-body { padding:1.25rem 1.25rem .75rem; flex:1; }
    .gc-top { display:flex; align-items:flex-start; gap:.85rem; margin-bottom:.85rem; }
    .gc-avatar { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.2rem; font-weight:800; color:#fff; flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,.15); }
    .gc-info { display:flex; flex-direction:column; min-width:0; }
    .gc-name { font-weight:700; font-size:1rem; color:#0f0a2e; }
    .gc-desc { font-size:.78rem; color:#9ca3af; margin-top:.15rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .gc-meta { margin-bottom:.75rem; }
    .gc-badge { display:inline-flex; align-items:center; gap:.3rem; font-size:.72rem; font-weight:600; padding:.25rem .65rem; border-radius:20px; border:1px solid; }

    .gc-stats { display:flex; gap:1rem; margin-bottom:.85rem; }
    .gcs-item { display:flex; align-items:center; gap:.4rem; font-size:.78rem; color:#6b7280; }
    .gcs-item i { font-size:.75rem; color:#9ca3af; }

    .gc-members-preview { display:flex; align-items:center; gap:.25rem; flex-wrap:wrap; }
    .member-dot { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:.68rem; font-weight:700; color:#fff; cursor:default; box-shadow:0 1px 3px rgba(0,0,0,.2); }
    .member-dot.more { background:#e5e7eb; color:#6b7280; font-size:.65rem; }

    .gc-actions { display:flex; align-items:center; gap:.35rem; padding:.75rem 1.25rem 1rem; border-top:1px solid #f3f4f6; flex-wrap:wrap; }

    .empty-state { grid-column:1/-1; text-align:center; padding:4rem 2rem; background:#fff; border-radius:16px; box-shadow:0 1px 8px rgba(0,0,0,.04); }
    .empty-ico { width:72px; height:72px; border-radius:20px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; font-size:2rem; color:#d1d5db; margin:0 auto 1rem; }

    .no-access { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; text-align:center; padding:2rem; }
    .no-access-ico { width:80px; height:80px; border-radius:24px; background:#fee2e2; display:flex; align-items:center; justify-content:center; font-size:2rem; color:#ef4444; margin-bottom:1.25rem; }
    .no-access h2 { color:#0f0a2e; font-weight:800; margin:0 0 .5rem; }
    .no-access p { color:#9ca3af; margin:0; }

    .dialog-form { display:flex; flex-direction:column; gap:1rem; }
    .field { display:flex; flex-direction:column; gap:.4rem; }
    .field-row { display:flex; align-items:center; gap:.75rem; }
    .fl { font-weight:700; font-size:.82rem; color:#374151; }
    .color-preview { font-size:.78rem; color:#6b7280; font-family:monospace; padding:.2rem .5rem; border-radius:6px; border:1px solid #e5e7eb; }
    .fmsg { display:flex; align-items:center; gap:.5rem; padding:.7rem 1rem; border-radius:10px; font-size:.875rem; font-weight:600; }
    .fmsg.er { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }

    :host ::ng-deep .btn-primary { background:linear-gradient(135deg,#0ea5e9,#38bdf8) !important; border:none !important; font-weight:700 !important; box-shadow:0 4px 14px rgba(14,165,233,.35) !important; }
  `]
})
export class GroupManagementComponent implements OnInit {
  search = '';
  showCreate = false;
  formMsg = '';
  form = { nombre: '', descripcion: '', llmModel: 'GPT-4o', color: '6c47ff' };

  filtered = computed(() => {
    const s = this.search.toLowerCase();
    return this.ps.groups().filter(g => !s || g.nombre.toLowerCase().includes(s) || (g.descripcion ?? '').toLowerCase().includes(s));
  });

  totalMemberships = computed(() => this.ps.groups().reduce((sum, g) => sum + g.memberIds.length, 0));

  constructor(public ps: PermissionService, private router: Router,
              private msg: MessageService, private confirm: ConfirmationService) {}

  ngOnInit() {}

  ticketCount(groupId: string): number {
    return this.ps.tickets().filter((t: any) => t.groupId === groupId).length;
  }

  getMemberName(uid: string): string {
    return this.ps.getUserById(uid)?.nombreCompleto ?? 'Usuario';
  }

  getMemberInitial(uid: string): string {
    return (this.ps.getUserById(uid)?.nombreCompleto?.charAt(0) ?? '?').toUpperCase();
  }

  irGrupo(g: Group) {
    this.ps.setCurrentGroup(g.id);
    this.router.navigate(['/home/group', g.id]);
  }

  irManage(g: Group) {
    this.ps.setCurrentGroup(g.id);
    this.router.navigate(['/home/group', g.id, 'manage']);
  }

  openCreate() {
    this.form = { nombre: '', descripcion: '', llmModel: 'GPT-4o', color: '6c47ff' };
    this.formMsg = '';
    this.showCreate = true;
  }

  async crearGrupo() {
    if (!this.form.nombre.trim()) {
      this.formMsg = 'El nombre del grupo es obligatorio.';
      return;
    }
    try {
      await this.ps.createGroup({
        nombre: this.form.nombre,
        descripcion: this.form.descripcion,
        llmModel: this.form.llmModel,
        color: '#' + this.form.color,
        memberIds: [],
      });
      this.msg.add({ severity: 'success', summary: 'Grupo creado', life: 2500 });
      this.showCreate = false;
    } catch (e: any) {
      this.formMsg = e.message ?? 'Error al crear el grupo.';
    }
  }

  confirmarEliminar(g: Group) {
    this.confirm.confirm({
      message: `¿Eliminar el grupo <strong>${g.nombre}</strong> y todos sus tickets?`,
      header: 'Eliminar grupo',
      icon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        await this.ps.deleteGroup(g.id);
        this.msg.add({ severity: 'success', summary: 'Grupo eliminado', life: 2500 });
      }
    });
  }
}
