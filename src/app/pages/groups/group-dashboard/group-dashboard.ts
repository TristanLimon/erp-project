import { Component, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';

import { TableModule } from 'primeng/table';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { PermissionService, Ticket, TicketStatus } from '../../../services/permission.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

const STATUS_LABELS: Record<TicketStatus, string> = {
  pendiente: 'Pendiente', en_progreso: 'En Progreso', revision: 'Revisión', hecho: 'Hecho', bloqueado: 'Bloqueado'
};
const STATUS_COLORS: Record<TicketStatus, string> = {
  pendiente: '#f59e0b', en_progreso: '#3b82f6', revision: '#8b5cf6', hecho: '#22c55e', bloqueado: '#ef4444'
};

@Component({
  selector: 'app-group-dashboard',
  standalone: true,
  imports: [
    CommonModule, ButtonModule, CardModule, TagModule, BadgeModule,
    TableModule, AvatarModule, TooltipModule,
    HasPermissionDirective
  ],
  template: `
<div class="dashboard-container" *ngIf="group()">
  <!-- Header del grupo -->
  <div class="group-header" [style]="{'--gc': group()!.color, 'border-left-color': group()!.color}">
    <div class="flex align-items-center gap-3">
      <div class="group-avatar" [style]="{'background': group()!.color}">{{ group()!.nombre.charAt(0) }}</div>
      <div>
        <h1 class="group-title">{{ group()!.nombre }}</h1>
        <div class="llm-chip" [style]="{'background': group()!.color + '22', 'color': group()!.color, 'border-color': group()!.color + '55'}">
          <i class="pi pi-microchip-ai"></i> {{ group()!.llmModel }}
        </div>
      </div>
    </div>
    <div class="header-actions">
      <p-button *hasPermission="'ticket:create'" label="Crear ticket" icon="pi pi-plus"
                (onClick)="irCrearTicket()" styleClass="p-button-sm" />
      <p-button label="Kanban" icon="pi pi-th-large" variant="outlined"
                (onClick)="irKanban()" styleClass="p-button-sm" />
      <p-button label="Lista" icon="pi pi-list" variant="outlined"
                (onClick)="irLista()" styleClass="p-button-sm" />
      <p-button *hasPermission="['group:edit','group:delete','group:add_member']"
                icon="pi pi-cog" variant="outlined" pTooltip="Gestión del grupo"
                (onClick)="irManage()" styleClass="p-button-sm" />
    </div>
  </div>

  <!-- Stats cards -->
  <div class="stats-grid">
    @for (s of statusStats(); track s.status) {
      <div class="stat-card" [style]="{'--sc': s.color}">
        <span class="stat-count">{{ s.count }}</span>
        <span class="stat-label">{{ s.label }}</span>
        <div class="stat-bar" [style]="{'background': s.color, 'width': s.pct + '%'}"></div>
      </div>
    }
  </div>

  <!-- Tickets recientes y mis tickets -->
  <div class="content-grid">
    <div class="section-card">
      <div class="section-header">
        <span class="section-title"><i class="pi pi-clock"></i> Tickets Recientes</span>
        <p-button label="Ver todos" variant="text" size="small" (onClick)="irKanban()" />
      </div>
      <p-table [value]="recentTickets()" [rows]="5" styleClass="p-datatable-sm" [paginator]="false">
        <ng-template #header>
          <tr>
            <th>Título</th>
            <th>Estado</th>
            <th>Prioridad</th>
            <th>Asignado</th>
          </tr>
        </ng-template>
        <ng-template #body let-t>
          <tr class="ticket-row" (click)="irTicket(t)">
            <td><span class="ticket-title-cell">{{ t.titulo }}</span></td>
            <td>
              <span class="status-chip" [style]="{'background': statusColor(t.status) + '22', 'color': statusColor(t.status)}">
                {{ statusLabel(t.status) }}
              </span>
            </td>
            <td><span class="priority-text">{{ t.prioridad }}</span></td>
            <td>
              @if (getUserName(t.asignadoA); as name) {
                <p-avatar [label]="name.charAt(0)" shape="circle" size="normal"
                          [style]="{'background': group()!.color, 'color':'#fff'}"
                          [pTooltip]="name" />
              } @else {
                <span style="color:#9ca3af;font-size:.8rem">Sin asignar</span>
              }
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:1.5rem">Sin tickets aún</td></tr>
        </ng-template>
      </p-table>
    </div>

    <div class="section-card">
      <div class="section-header">
        <span class="section-title"><i class="pi pi-user"></i> Mis Tickets</span>
      </div>
      @for (t of myTickets(); track t.id) {
        <div class="my-ticket-item" (click)="irTicket(t)">
          <div class="mt-dot" [style]="{'background': statusColor(t.status)}"></div>
          <div class="flex flex-column flex-1">
            <span class="mt-title">{{ t.titulo }}</span>
            <span class="mt-status">{{ statusLabel(t.status) }}</span>
          </div>
          <span class="mt-prio">{{ t.prioridad }}</span>
        </div>
      }
      @if (myTickets().length === 0) {
        <p style="text-align:center;color:#9ca3af;padding:1.5rem 0">Sin tickets asignados</p>
      }
    </div>
  </div>
</div>
  `,
  styles: [`
    .dashboard-container { padding:1.5rem; max-width:1200px; margin:0 auto; }
    .group-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; background:#fff; border-radius:14px; padding:1.5rem; margin-bottom:1.5rem; border-left:4px solid var(--gc); box-shadow:0 1px 8px rgba(0,0,0,.06); }
    .group-avatar { width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; font-weight:800; color:#fff; }
    .group-title { font-size:1.5rem; font-weight:800; color:#0f0a2e; margin:0 0 .35rem; }
    .llm-chip { display:inline-flex; align-items:center; gap:.35rem; font-size:.75rem; font-weight:600; padding:.25rem .65rem; border-radius:20px; border:1px solid; }
    .header-actions { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
    .stats-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:1rem; margin-bottom:1.5rem; }
    @media(max-width:900px) { .stats-grid { grid-template-columns:repeat(3,1fr); } }
    @media(max-width:600px) { .stats-grid { grid-template-columns:1fr 1fr; } }
    .stat-card { background:#fff; border-radius:12px; padding:1.25rem 1rem; text-align:center; position:relative; overflow:hidden; box-shadow:0 1px 6px rgba(0,0,0,.06); }
    .stat-card::after { content:''; position:absolute; bottom:0; left:0; height:3px; background:var(--sc); width:100%; }
    .stat-count { display:block; font-size:2rem; font-weight:800; color:#0f0a2e; }
    .stat-label { font-size:.8rem; color:#6b7280; }
    .stat-bar { height:3px; border-radius:2px; margin-top:.75rem; transition:width .6s; }
    .content-grid { display:grid; grid-template-columns:2fr 1fr; gap:1.25rem; }
    @media(max-width:900px) { .content-grid { grid-template-columns:1fr; } }
    .section-card { background:#fff; border-radius:14px; padding:1.25rem; box-shadow:0 1px 8px rgba(0,0,0,.06); }
    .section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }
    .section-title { font-weight:700; color:#0f0a2e; display:flex; align-items:center; gap:.5rem; }
    .ticket-row { cursor:pointer; transition:background .15s; }
    .ticket-row:hover td { background:#f9f5ff !important; }
    .ticket-title-cell { font-weight:500; font-size:.88rem; }
    .status-chip { font-size:.75rem; font-weight:600; padding:.2rem .6rem; border-radius:20px; }
    .priority-text { font-size:.9rem; }
    .my-ticket-item { display:flex; align-items:center; gap:.75rem; padding:.75rem; border-radius:8px; cursor:pointer; transition:background .15s; margin-bottom:.25rem; }
    .my-ticket-item:hover { background:#f9f5ff; }
    .mt-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
    .mt-title { font-weight:600; font-size:.88rem; color:#0f0a2e; }
    .mt-status { font-size:.75rem; color:#9ca3af; }
    .mt-prio { font-size:.9rem; margin-left:auto; }
  `]
})
export class GroupDashboardComponent implements OnInit {
  groupId = '';

  group = computed(() => this.ps.groups().find(g => g.id === this.groupId) ?? null);

  statusStats = computed(() => {
    const tickets = this.ps.ticketsByGroup(this.groupId);
    const total = tickets.length || 1;
    return (['pendiente','en_progreso','revision','hecho','bloqueado'] as TicketStatus[]).map(s => ({
      status: s,
      label: STATUS_LABELS[s],
      color: STATUS_COLORS[s],
      count: tickets.filter(t => t.status === s).length,
      pct: Math.round(tickets.filter(t => t.status === s).length / total * 100),
    }));
  });

  recentTickets = computed(() =>
    this.ps.ticketsByGroup(this.groupId)
      .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())
      .slice(0, 6)
  );

  myTickets = computed(() => {
    const uid = this.ps.currentUser()?.id;
    return this.ps.ticketsByGroup(this.groupId).filter(t => t.asignadoA === uid);
  });

  constructor(private route: ActivatedRoute, private router: Router, private ps: PermissionService) {}

  async ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id') ?? '';
    await this.ps.setCurrentGroup(this.groupId);
  }

  statusLabel(s: TicketStatus) { return STATUS_LABELS[s]; }
  statusColor(s: TicketStatus) { return STATUS_COLORS[s]; }

  getUserName(uid: string | null): string | null {
    if (!uid) return null;
    return this.ps.getUserById(uid)?.nombreCompleto ?? null;
  }

  irKanban()       { this.router.navigate(['/home/group', this.groupId, 'kanban']); }
  irLista()        { this.router.navigate(['/home/group', this.groupId, 'list']); }
  irCrearTicket()  { this.router.navigate(['/home/group', this.groupId, 'ticket', 'new']); }
  irManage()       { this.router.navigate(['/home/group', this.groupId, 'manage']); }
  irTicket(t: Ticket) { this.router.navigate(['/home/group', this.groupId, 'ticket', t.id]); }
}
