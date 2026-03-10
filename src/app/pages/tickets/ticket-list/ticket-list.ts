import { Component, computed, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { PermissionService, Ticket, TicketStatus, TicketPriority, PRIORITY_MAP } from '../../../services/permission.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

const STATUS_OPTS = [
  { label: 'Todos', value: '' },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'En Progreso', value: 'en_progreso' },
  { label: 'Revisión', value: 'revision' },
  { label: 'Hecho', value: 'hecho' },
  { label: 'Bloqueado', value: 'bloqueado' },
];
const STATUS_COLORS: Record<string, string> = {
  pendiente: '#f59e0b', en_progreso: '#3b82f6', revision: '#8b5cf6', hecho: '#22c55e', bloqueado: '#ef4444'
};

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, TableModule, TagModule, InputTextModule, SelectModule,
    TooltipModule, AvatarModule, IconFieldModule, InputIconModule,
    ToastModule, ConfirmDialogModule, HasPermissionDirective
  ],
  providers: [MessageService, ConfirmationService],
  template: `
<p-toast />
<p-confirmdialog />
<div class="list-container">
  <div class="list-toolbar">
    <div class="toolbar-left">
      <p-button icon="pi pi-arrow-left" variant="text" size="small"
                (onClick)="router.navigate(['/home/group', groupId])" />
      <span class="page-title">Lista de Tickets</span>
      <span class="group-label" [style]="{'color': group()?.color}">{{ group()?.nombre }}</span>
    </div>
    <div class="toolbar-right">
      <p-iconfield>
        <p-inputicon class="pi pi-search" />
        <input pInputText [(ngModel)]="search" placeholder="Buscar..." style="width:200px" (ngModelChange)="onFilter()" />
      </p-iconfield>
      <p-select [(ngModel)]="filterStatus" [options]="statusOpts" optionLabel="label" optionValue="value"
                (onChange)="onFilter()" placeholder="Estado" style="width:150px" />
      <p-select [(ngModel)]="filterAssignee" [options]="assigneeOpts()" optionLabel="label" optionValue="value"
                (onChange)="onFilter()" placeholder="Asignado" style="width:160px" [showClear]="true" />
      <!-- Quick filters -->
      <p-button label="Mis tickets" size="small" [outlined]="qFilter() !== 'mine'"
                (onClick)="qFilter.set(qFilter() === 'mine' ? '' : 'mine'); onFilter()" />
      <p-button label="Sin asignar" size="small" [outlined]="qFilter() !== 'unassigned'"
                (onClick)="qFilter.set(qFilter() === 'unassigned' ? '' : 'unassigned'); onFilter()" />
      <p-button label="Alta prioridad" size="small" [outlined]="qFilter() !== 'high'"
                (onClick)="qFilter.set(qFilter() === 'high' ? '' : 'high'); onFilter()" />
      <p-button *hasPermission="'ticket:create'" label="Nuevo" icon="pi pi-plus"
                (onClick)="irKanban()" size="small" />
    </div>
  </div>

  <div class="table-card">
    <p-table [value]="filtered()" [paginator]="true" [rows]="15"
             [rowsPerPageOptions]="[10,15,25,50]"
             [sortField]="'fechaCreacion'" [sortOrder]="-1"
             styleClass="p-datatable-sm p-datatable-striped"
             [globalFilterFields]="['titulo','status','prioridad']">
      <ng-template #header>
        <tr>
          <th pSortableColumn="id" style="width:80px">ID ↕</th>
          <th pSortableColumn="titulo">Título ↕</th>
          <th pSortableColumn="status" style="width:130px">Estado ↕</th>
          <th style="width:100px">Prioridad</th>
          <th style="width:170px">Asignado a</th>
          <th pSortableColumn="fechaLimite" style="width:130px">Fecha límite ↕</th>
          <th style="width:90px">Acciones</th>
        </tr>
      </ng-template>
      <ng-template #body let-t>
        <tr class="ticket-row" (click)="irTicket(t)">
          <td><span class="ticket-id">{{ t.id }}</span></td>
          <td><span class="ticket-title">{{ t.titulo }}</span></td>
          <td>
            <span class="status-chip" [style]="{'background': statusColor(t.status) + '20', 'color': statusColor(t.status), 'border-color': statusColor(t.status) + '40'}">
              {{ statusLabel(t.status) }}
            </span>
          </td>
          <td>
            <span [style]="{'color': getPrioColor(t.prioridad), 'font-weight': '700'}">{{ t.prioridad }}</span>
          </td>
          <td>
            @if (getAssignee(t.asignadoA); as name) {
              <div class="assignee-cell">
                <p-avatar [label]="name.charAt(0)" shape="circle" size="normal"
                          [style]="{'background': group()?.color, 'color':'#fff','width':'28px','height':'28px','font-size':'.8rem'}" />
                <span>{{ name }}</span>
              </div>
            } @else {
              <span class="unassigned">Sin asignar</span>
            }
          </td>
          <td>
            @if (t.fechaLimite) {
              <span [class.overdue]="isOverdue(t.fechaLimite)" style="font-size:.85rem">
                {{ formatDate(t.fechaLimite) }}
              </span>
            } @else {
              <span style="color:#d1d5db;font-size:.8rem">—</span>
            }
          </td>
          <td (click)="$event.stopPropagation()">
            <div class="flex gap-1">
              <p-button icon="pi pi-eye" variant="text" size="small" (onClick)="irTicket(t)" pTooltip="Ver detalle" />
              <p-button *hasPermission="'ticket:delete'" icon="pi pi-trash" variant="text" severity="danger"
                        size="small" (onClick)="eliminar(t)" pTooltip="Eliminar" />
            </div>
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr><td colspan="7" style="text-align:center;padding:2rem;color:#9ca3af">No hay tickets con estos filtros.</td></tr>
      </ng-template>
    </p-table>
  </div>
</div>
  `,
  styles: [`
    .list-container { padding:1.5rem; max-width:1300px; margin:0 auto; }
    .list-toolbar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.75rem; margin-bottom:1.25rem; background:#fff; padding:1rem 1.25rem; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); }
    .toolbar-left { display:flex; align-items:center; gap:.75rem; }
    .toolbar-right { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
    .page-title { font-weight:800; font-size:1.1rem; color:#0f0a2e; }
    .group-label { font-size:.85rem; font-weight:600; }
    .table-card { background:#fff; border-radius:14px; box-shadow:0 1px 8px rgba(0,0,0,.06); overflow:hidden; }
    .ticket-row { cursor:pointer; }
    .ticket-row:hover td { background:#f9f5ff !important; }
    .ticket-id { font-size:.75rem; color:#9ca3af; font-family:monospace; }
    .ticket-title { font-weight:600; font-size:.875rem; color:#0f0a2e; }
    .status-chip { font-size:.75rem; font-weight:600; padding:.25rem .65rem; border-radius:20px; border:1px solid; white-space:nowrap; }
    .assignee-cell { display:flex; align-items:center; gap:.5rem; font-size:.85rem; }
    .unassigned { font-size:.8rem; color:#d1d5db; }
    .overdue { color:#ef4444; font-weight:600; }
  `]
})
export class TicketListComponent implements OnInit {
  groupId = '';
  search = '';
  filterStatus = '';
  filterAssignee = '';
  qFilter = signal('');
  statusOpts = STATUS_OPTS;

  group = computed(() => this.ps.groups().find(g => g.id === this.groupId) ?? null);

  assigneeOpts = computed(() => [
    { label: 'Todos', value: '' },
    ...this.ps.groupMembers(this.groupId).map(u => ({ label: u.nombreCompleto, value: u.id }))
  ]);

  private _filtered = signal<Ticket[]>([]);
  filtered = computed(() => this._filtered());

  constructor(private route: ActivatedRoute, public router: Router, private ps: PermissionService,
              private msg: MessageService, private confirm: ConfirmationService) {}

  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id') ?? '';
    this.ps.setCurrentGroup(this.groupId);
    this.onFilter();
  }

  onFilter() {
    let tickets = this.ps.ticketsByGroup(this.groupId);
    const uid = this.ps.currentUser()?.id;
    if (this.qFilter() === 'mine') tickets = tickets.filter(t => t.asignadoA === uid);
    else if (this.qFilter() === 'unassigned') tickets = tickets.filter(t => !t.asignadoA);
    else if (this.qFilter() === 'high') tickets = tickets.filter(t => ['critica','alta'].includes(t.prioridad));
    if (this.filterStatus) tickets = tickets.filter(t => t.status === this.filterStatus);
    if (this.filterAssignee) tickets = tickets.filter(t => t.asignadoA === this.filterAssignee);
    if (this.search) {
      const s = this.search.toLowerCase();
      tickets = tickets.filter(t => t.titulo.toLowerCase().includes(s) || t.descripcion.toLowerCase().includes(s));
    }
    this._filtered.set(tickets);
  }

  statusLabel(s: string) { return STATUS_OPTS.find(o => o.value === s)?.label ?? s; }
  statusColor(s: string) { return STATUS_COLORS[s] ?? '#9ca3af'; }
  getPrioColor(p: TicketPriority) { return PRIORITY_MAP[p]?.color ?? '#9ca3af'; }
  getAssignee(uid: string | null) { return uid ? this.ps.getUserById(uid)?.nombreCompleto : null; }
  formatDate(d: string) { return new Date(d).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }); }
  isOverdue(d: string) { return new Date(d) < new Date(); }

  irTicket(t: Ticket) { this.router.navigate(['/home/group', this.groupId, 'ticket', t.id]); }
  irKanban() { this.router.navigate(['/home/group', this.groupId, 'kanban']); }

  eliminar(t: Ticket) {
    this.confirm.confirm({
      message: `¿Eliminar el ticket "${t.titulo}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.ps.deleteTicket(t.id);
        this.onFilter();
        this.msg.add({ severity: 'success', summary: 'Ticket eliminado', life: 2500 });
      }
    });
  }
}
