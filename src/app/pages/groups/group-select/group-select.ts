import { Component, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ColorPickerModule } from 'primeng/colorpicker';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PermissionService, Group } from '../../../services/permission.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

@Component({
  selector: 'app-group-select',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, CardModule, TagModule, BadgeModule, AvatarModule,
    DialogModule, InputTextModule, ColorPickerModule, ToastModule,
    HasPermissionDirective
  ],
  providers: [MessageService],
  template: `
<p-toast />
<div class="group-select-container">
  <div class="header-row">
    <div>
      <h1 class="page-title">Mis Espacios de Trabajo</h1>
      <p class="page-sub">Selecciona un grupo para continuar</p>
    </div>
    <p-button *hasPermission="'group:create'" label="Nuevo grupo" icon="pi pi-plus"
              (onClick)="showCreate = true" styleClass="p-button-sm" />
  </div>

  <div class="groups-grid">
    @for (g of myGroups(); track g.id) {
      <div class="group-card" (click)="selectGroup(g)" [style]="{'--gc': g.color}">
        <div class="gc-top">
          <div class="gc-avatar" [style]="{'background': g.color}">
            {{ g.nombre.charAt(0) }}
          </div>
          <div class="gc-info">
            <span class="gc-name">{{ g.nombre }}</span>
            <span class="gc-desc">{{ g.descripcion }}</span>
          </div>
        </div>
        <div class="gc-model-badge" [style]="{'background': g.color + '22', 'border-color': g.color + '55', 'color': g.color}">
          <i class="pi pi-microchip-ai" style="font-size:.75rem"></i>
          {{ g.llmModel }}
        </div>
        <div class="gc-footer">
          <span class="gc-members"><i class="pi pi-users"></i> {{ g.memberIds.length }} miembros</span>
          <i class="pi pi-arrow-right gc-arrow"></i>
        </div>
      </div>
    }

    @if (myGroups().length === 0) {
      <div class="empty-state">
        <i class="pi pi-users" style="font-size:3rem;color:#c4b8ff"></i>
        <p>No perteneces a ningún grupo todavía.</p>
      </div>
    }
  </div>
</div>

<!-- Dialog crear grupo -->
<p-dialog header="Crear nuevo grupo" [(visible)]="showCreate" [modal]="true" [style]="{'width':'420px'}">
  <div class="flex flex-column gap-3 pt-2">
    <div class="flex flex-column gap-1">
      <label class="field-label">Nombre *</label>
      <input pInputText [(ngModel)]="newGroup.nombre" placeholder="Ej. Equipo Backend" />
    </div>
    <div class="flex flex-column gap-1">
      <label class="field-label">Descripción</label>
      <input pInputText [(ngModel)]="newGroup.descripcion" placeholder="Descripción del grupo" />
    </div>
    <div class="flex flex-column gap-1">
      <label class="field-label">Modelo LLM</label>
      <input pInputText [(ngModel)]="newGroup.llmModel" placeholder="Ej. GPT-4o, Claude 3.5..." />
    </div>
    <div class="flex align-items-center gap-3">
      <label class="field-label">Color</label>
      <p-colorpicker [(ngModel)]="newGroup.color" format="hex" />
      <span style="font-size:.85rem;color:#666">#{{ newGroup.color }}</span>
    </div>
  </div>
  <ng-template #footer>
    <p-button label="Cancelar" variant="text" (onClick)="showCreate = false" />
    <p-button label="Crear" icon="pi pi-check" (onClick)="crearGrupo()" />
  </ng-template>
</p-dialog>
  `,
  styles: [`
    .group-select-container { padding: 2rem; max-width: 1100px; margin: 0 auto; }
    .header-row { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2rem; }
    .page-title { font-size:1.75rem; font-weight:800; color:#0f0a2e; margin:0; }
    .page-sub { color:#6b7280; margin:.25rem 0 0; }
    .groups-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px,1fr)); gap:1.25rem; }
    .group-card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:1.5rem; cursor:pointer; transition:all .25s; position:relative; overflow:hidden; }
    .group-card::before { content:''; position:absolute; top:0; left:0; right:0; height:4px; background:var(--gc); }
    .group-card:hover { transform:translateY(-3px); box-shadow:0 8px 30px rgba(0,0,0,.1); border-color:var(--gc); }
    .gc-top { display:flex; align-items:center; gap:.85rem; margin-bottom:1rem; }
    .gc-avatar { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.2rem; font-weight:800; color:#fff; flex-shrink:0; }
    .gc-info { display:flex; flex-direction:column; }
    .gc-name { font-weight:700; font-size:1rem; color:#0f0a2e; }
    .gc-desc { font-size:.8rem; color:#9ca3af; margin-top:.15rem; }
    .gc-model-badge { display:inline-flex; align-items:center; gap:.35rem; font-size:.75rem; font-weight:600; padding:.3rem .7rem; border-radius:20px; border:1px solid; margin-bottom:.85rem; }
    .gc-footer { display:flex; justify-content:space-between; align-items:center; padding-top:.75rem; border-top:1px solid #f3f4f6; }
    .gc-members { font-size:.8rem; color:#9ca3af; display:flex; align-items:center; gap:.35rem; }
    .gc-arrow { color:#d1d5db; font-size:.85rem; transition:transform .2s; }
    .group-card:hover .gc-arrow { transform:translateX(4px); color:#6c47ff; }
    .empty-state { grid-column:1/-1; text-align:center; padding:4rem; color:#9ca3af; }
    .field-label { font-weight:600; font-size:.875rem; color:#374151; }
  `]
})
export class GroupSelectComponent {
  showCreate = false;
  newGroup = { nombre: '', descripcion: '', llmModel: 'GPT-4o', color: '6c47ff' };

  myGroups = computed(() => this.ps.myGroups());

  constructor(private ps: PermissionService, private router: Router, private msg: MessageService) {}

  async selectGroup(g: Group) {
    await this.ps.setCurrentGroup(g.id);
    this.router.navigate(['/home/group', g.id]);
  }

  async crearGrupo() {
    if (!this.newGroup.nombre.trim()) return;
    const uid = this.ps.currentUser()!.id;
    await this.ps.createGroup({
      nombre: this.newGroup.nombre,
      descripcion: this.newGroup.descripcion,
      llmModel: this.newGroup.llmModel,
      color: '#' + this.newGroup.color,
      memberIds: [uid],
    });
    this.msg.add({ severity: 'success', summary: 'Grupo creado', life: 3000 });
    this.showCreate = false;
    this.newGroup = { nombre: '', descripcion: '', llmModel: 'GPT-4o', color: '6c47ff' };
  }
}
