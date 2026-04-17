import { Component, computed, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { PermissionService, Ticket, TicketStatus, TicketPriority, PRIORITY_MAP } from '../../../services/permission.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

const COLUMNS: { status: TicketStatus; label: string; icon: string; color: string }[] = [
  { status: 'pendiente',   label: 'Pendiente',   icon: 'pi-clock',        color: '#f59e0b' },
  { status: 'en_progreso', label: 'En Progreso',  icon: 'pi-spinner',      color: '#3b82f6' },
  { status: 'revision',    label: 'Revisión',     icon: 'pi-eye',          color: '#8b5cf6' },
  { status: 'hecho',       label: 'Hecho',        icon: 'pi-check-circle', color: '#22c55e' },
  { status: 'bloqueado',   label: 'Bloqueado',    icon: 'pi-ban',          color: '#ef4444' },
];

@Component({
  selector: 'app-kanban',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, CardModule, TagModule, BadgeModule, AvatarModule,
    TooltipModule, SelectButtonModule, InputTextModule,
    DialogModule, TextareaModule, SelectModule,
    DatePickerModule, ToastModule, MessageModule, HasPermissionDirective
  ],
  providers: [MessageService],
  template: `
<p-toast />
<div class="kanban-container">
  <!-- Toolbar -->
  <div class="kanban-toolbar">
    <div class="toolbar-left">
      <p-button icon="pi pi-arrow-left" variant="text" size="small"
                (onClick)="router.navigate(['/home/group', groupId])" pTooltip="Volver al dashboard" />
      <span class="board-title">Tablero Kanban</span>
      <span class="group-name" [style]="{'color': group()?.color}">{{ group()?.nombre }}</span>
    </div>
    <div class="toolbar-right">
      <!-- Filtros rápidos -->
      <p-button label="Mis tickets" [outlined]="filterMode() !== 'mine'" size="small"
                (onClick)="filterMode.set(filterMode() === 'mine' ? 'all' : 'mine')"
                [style]="filterMode() === 'mine' ? {'background': group()?.color, 'border-color': group()?.color} : {}" />
      <p-button label="Sin asignar" [outlined]="filterMode() !== 'unassigned'" size="small"
                (onClick)="filterMode.set(filterMode() === 'unassigned' ? 'all' : 'unassigned')" />
      <p-button label="Alta prioridad" [outlined]="filterMode() !== 'high'" size="small"
                (onClick)="filterMode.set(filterMode() === 'high' ? 'all' : 'high')" />
      <p-button *hasPermission="'ticket:create'" label="Nuevo" icon="pi pi-plus"
                (onClick)="openCreate()" styleClass="p-button-sm" />
    </div>
  </div>

  <!-- Columns -->
  <div class="kanban-board">
    @for (col of columns; track col.status) {
      <div class="kanban-col"
           (dragover)="$event.preventDefault()"
           (drop)="onDrop($event, col.status)">
        <div class="col-header" [style]="{'--cc': col.color}">
          <div class="col-title-row">
            <i [class]="'pi ' + col.icon" [style]="{'color': col.color}"></i>
            <span class="col-title">{{ col.label }}</span>
          </div>
          <span class="col-badge" [style]="{'background': col.color + '22', 'color': col.color}">
            {{ getColTickets(col.status).length }}
          </span>
        </div>

        <div class="col-body">
          @for (t of getColTickets(col.status); track t.id) {
            <div class="ticket-card"
                 [attr.draggable]="isMyTicket(t)"
                 [class.not-draggable]="!isMyTicket(t)"
                 (dragstart)="onDragStart($event, t)"
                 (click)="irTicket(t)">
              <div class="tc-priority-bar" [style]="{'background': getPrioColor(t.prioridad)}"></div>
              <div class="tc-body">
                <span class="tc-title">{{ t.titulo }}</span>
                @if (t.fechaLimite) {
                  <span class="tc-deadline" [class.overdue]="isOverdue(t.fechaLimite)">
                    <i class="pi pi-calendar"></i> {{ formatDate(t.fechaLimite) }}
                  </span>
                } @else {
                  <span class="tc-deadline tc-no-date">
                    <i class="pi pi-exclamation-triangle"></i> Sin fecha
                  </span>
                }
                <div class="tc-footer">
                  <span class="tc-prio" [style]="{'color': getPrioColor(t.prioridad)}">{{ t.prioridad }}</span>
                  @if (getAssignee(t.asignadoA); as name) {
                    <p-avatar [label]="name.charAt(0)" shape="circle" size="normal"
                              [style]="{'background': group()?.color, 'color':'#fff','width':'26px','height':'26px','font-size':'.75rem'}"
                              [pTooltip]="name" tooltipPosition="top" />
                  } @else {
                    <span class="tc-unassigned">Sin asignar</span>
                  }
                </div>
              </div>
            </div>
          }
          @if (getColTickets(col.status).length === 0) {
            <div class="col-empty">Arrastra aquí</div>
          }
        </div>
      </div>
    }
  </div>
</div>

<!-- Dialog Crear Ticket -->
<p-dialog header="Crear Ticket" [(visible)]="showCreate" [modal]="true" [style]="{'width':'540px'}">
  <div class="flex flex-column gap-3 pt-2">
    <!-- Título -->
    <div class="flex flex-column gap-1">
      <label class="field-label">Título <span class="required">*</span></label>
      <input pInputText [(ngModel)]="form.titulo" placeholder="Título del ticket"
             [style]="formErrors['titulo'] ? {'border-color':'#ef4444'} : {}" />
      @if (formErrors['titulo']) {
        <small class="field-error">{{ formErrors['titulo'] }}</small>
      }
    </div>
    <!-- Descripción -->
    <div class="flex flex-column gap-1">
      <label class="field-label">Descripción</label>
      <textarea pTextarea [(ngModel)]="form.descripcion" rows="3" placeholder="Descripción detallada..."></textarea>
    </div>
    <div class="grid">
      <div class="col-6 flex flex-column gap-1">
        <label class="field-label">Estado</label>
        <p-select [(ngModel)]="form.status" [options]="statusOptions" optionLabel="label" optionValue="value" appendTo="body" />
      </div>
      <div class="col-6 flex flex-column gap-1">
        <label class="field-label">Prioridad</label>
        <p-select [(ngModel)]="form.prioridad" [options]="priorityOptions" optionLabel="label" optionValue="value" appendTo="body" />
      </div>
    </div>
    <div class="grid">
      <div class="col-6 flex flex-column gap-1">
        <label class="field-label">Asignar a</label>
        <p-select [(ngModel)]="form.asignadoA" [options]="memberOptions()" optionLabel="label" optionValue="value"
                  [showClear]="true" placeholder="Sin asignar" appendTo="body" />
        <!-- Botón de autoasignación -->
        <p-button label="Asignarme a mí" icon="pi pi-user" variant="text" size="small"
                  styleClass="mt-1" (onClick)="autoAssign()"
                  [style]="{'font-size':'.78rem','padding':'0.25rem 0.5rem'}" />
      </div>
      <div class="col-6 flex flex-column gap-1">
        <label class="field-label">Fecha límite <span class="required">*</span></label>
        <p-datepicker [(ngModel)]="form.fechaLimite" dateFormat="dd/mm/yy" [showIcon]="true"
                      [minDate]="today" appendTo="body"
                      [style]="formErrors['fechaLimite'] ? {'border-color':'#ef4444'} : {}" />
        @if (formErrors['fechaLimite']) {
          <small class="field-error">{{ formErrors['fechaLimite'] }}</small>
        }
      </div>
    </div>
    <!-- Resumen de asignación -->
    @if (form.asignadoA) {
      <div class="assign-preview">
        <p-avatar [label]="getAssigneeName(form.asignadoA)?.charAt(0) ?? '?'" shape="circle"
                  [style]="{'background': group()?.color, 'color':'#fff','width':'32px','height':'32px'}" />
        <div class="assign-info">
          <span class="assign-name">{{ getAssigneeName(form.asignadoA) }}</span>
          <span class="assign-label">Responsable del ticket</span>
        </div>
      </div>
    }
  </div>
  <ng-template #footer>
    <p-button label="Cancelar" variant="text" (onClick)="showCreate = false" />
    <p-button label="Crear ticket" icon="pi pi-check" (onClick)="crearTicket()" />
  </ng-template>
</p-dialog>
  `,
  styles: [`
    .kanban-container { padding:1.25rem; height:calc(100vh - 80px); display:flex; flex-direction:column; }
    .kanban-toolbar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.75rem; margin-bottom:1.25rem; background:#fff; padding:1rem 1.25rem; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); }
    .toolbar-left { display:flex; align-items:center; gap:.75rem; }
    .board-title { font-weight:800; font-size:1.1rem; color:#0f0a2e; }
    .group-name { font-size:.85rem; font-weight:600; }
    .toolbar-right { display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
    .kanban-board { display:grid; grid-template-columns:repeat(5,1fr); gap:1rem; flex:1; min-height:0; overflow-x:auto; }
    @media(max-width:1200px) { .kanban-board { grid-template-columns:repeat(3,1fr); overflow-y:auto; } }
    .kanban-col { background:#f9fafb; border-radius:12px; display:flex; flex-direction:column; min-height:200px; max-height:calc(100vh - 200px); }
    .col-header { display:flex; justify-content:space-between; align-items:center; padding:.85rem 1rem; border-radius:12px 12px 0 0; border-bottom:2px solid var(--cc); background:#fff; }
    .col-title-row { display:flex; align-items:center; gap:.5rem; }
    .col-title { font-weight:700; font-size:.9rem; color:#0f0a2e; }
    .col-badge { font-size:.75rem; font-weight:700; padding:.2rem .55rem; border-radius:20px; }
    .col-body { flex:1; overflow-y:auto; padding:.75rem; display:flex; flex-direction:column; gap:.65rem; }
    .ticket-card { background:#fff; border-radius:10px; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,.07); transition:all .2s; position:relative; overflow:hidden; }
    .ticket-card:hover { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,.12); }
    .tc-priority-bar { height:3px; }
    .tc-body { padding:.85rem; }
    .tc-title { display:block; font-weight:600; font-size:.87rem; color:#0f0a2e; margin-bottom:.5rem; line-height:1.4; }
    .tc-deadline { display:flex; align-items:center; gap:.3rem; font-size:.74rem; color:#9ca3af; margin-bottom:.5rem; }
    .tc-deadline.overdue { color:#ef4444; }
    .tc-no-date { color:#f59e0b; }
    .tc-footer { display:flex; justify-content:space-between; align-items:center; }
    .tc-prio { font-size:.85rem; font-weight:600; }
    .tc-unassigned { font-size:.74rem; color:#d1d5db; }
    .not-draggable { opacity:.7; cursor:not-allowed; }
    .not-draggable:hover { transform:none; box-shadow:0 1px 4px rgba(0,0,0,.07); }
    .col-empty { text-align:center; padding:1.5rem; color:#d1d5db; font-size:.8rem; border:2px dashed #e5e7eb; border-radius:8px; }
    .field-label { font-weight:600; font-size:.875rem; color:#374151; }
    .required { color:#ef4444; }
    .field-error { color:#ef4444; font-size:.75rem; font-weight:500; }
    .assign-preview { display:flex; align-items:center; gap:.75rem; background:#f0f4ff; border-radius:10px; padding:.75rem 1rem; border:1px solid #dbeafe; }
    .assign-info { display:flex; flex-direction:column; }
    .assign-name { font-weight:700; font-size:.88rem; color:#1e40af; }
    .assign-label { font-size:.72rem; color:#6b7280; }
  `]
})
export class KanbanComponent implements OnInit {
  groupId = '';
  columns = COLUMNS;
  filterMode = signal<'all' | 'mine' | 'unassigned' | 'high'>('all');
  showCreate = false;
  draggedTicketId: string | null = null;
  today = new Date();

  form = {
    titulo: '', descripcion: '', status: 'pendiente' as TicketStatus,
    prioridad: 'media' as TicketPriority, asignadoA: null as string | null, fechaLimite: null as Date | null
  };

  formErrors: Record<string, string> = {};

  group = computed(() => this.ps.groups().find(g => g.id === this.groupId) ?? null);

  statusOptions = COLUMNS.map(c => ({ label: c.label, value: c.status }));
  priorityOptions = Object.entries(PRIORITY_MAP).map(([v, d]) => ({ label: d.label, value: v as TicketPriority }));

  memberOptions = computed(() =>
    this.ps.groupMembers(this.groupId).map(u => ({ label: u.nombreCompleto, value: u.id }))
  );

  allTickets = computed(() => {
    const tickets = this.ps.ticketsByGroup(this.groupId);
    const uid = this.ps.currentUser()?.id;
    const mode = this.filterMode();
    if (mode === 'mine') return tickets.filter(t => t.asignadoA === uid);
    if (mode === 'unassigned') return tickets.filter(t => !t.asignadoA);
    if (mode === 'high') return tickets.filter(t => ['critica','alta'].includes(t.prioridad));
    return tickets;
  });

  constructor(private route: ActivatedRoute, public router: Router, private ps: PermissionService, private msg: MessageService) {}

  async ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id') ?? '';
    await this.ps.setCurrentGroup(this.groupId);
  }

  getColTickets(status: TicketStatus) {
    return this.allTickets().filter(t => t.status === status);
  }

  getPrioColor(p: TicketPriority) { return PRIORITY_MAP[p]?.color ?? '#9ca3af'; }
  getAssignee(uid: string | null) { return uid ? this.ps.getUserById(uid)?.nombreCompleto : null; }
  getAssigneeName(uid: string | null) { return uid ? this.ps.getUserById(uid)?.nombreCompleto ?? null : null; }
  isMyTicket(t: Ticket): boolean { return t.asignadoA === this.ps.currentUser()?.id; }
  formatDate(d: string) { return new Date(d).toLocaleDateString('es-MX', { day:'2-digit', month:'short' }); }
  isOverdue(d: string) { return new Date(d) < new Date(); }

  onDragStart(event: DragEvent, t: Ticket) {
    if (!this.isMyTicket(t)) {
      event.preventDefault();
      return;
    }
    this.draggedTicketId = t.id;
    event.dataTransfer?.setData('ticketId', t.id);
  }

  async onDrop(event: DragEvent, newStatus: TicketStatus) {
    event.preventDefault();
    const ticketId = event.dataTransfer?.getData('ticketId') ?? this.draggedTicketId;
    if (!ticketId) return;

    // Verificar que el ticket esté asignado al usuario actual
    const ticket = this.allTickets().find(t => t.id === ticketId);
    if (!ticket || !this.isMyTicket(ticket)) {
      this.msg.add({ severity: 'warn', summary: 'No permitido', detail: 'Solo puedes mover tickets asignados a ti.', life: 3000 });
      this.draggedTicketId = null;
      return;
    }

    if (!this.ps.has('ticket:change_status')) {
      this.msg.add({ severity: 'warn', summary: 'Sin permiso', detail: 'No tienes permiso para cambiar estado.', life: 3000 });
      return;
    }
    const user = this.ps.currentUser()!;
    await this.ps.updateTicket(ticketId, { status: newStatus }, user);
    this.draggedTicketId = null;
  }

  irTicket(t: Ticket) { this.router.navigate(['/home/group', this.groupId, 'ticket', t.id]); }

  openCreate() {
    this.form = { titulo: '', descripcion: '', status: 'pendiente', prioridad: 'media', asignadoA: null, fechaLimite: null };
    this.formErrors = {};
    this.showCreate = true;
  }

  autoAssign() {
    const uid = this.ps.currentUser()?.id ?? null;
    this.form.asignadoA = uid;
  }

  private validateForm(): boolean {
    this.formErrors = {};
    let valid = true;

    // Título obligatorio
    if (!this.form.titulo.trim()) {
      this.formErrors['titulo'] = 'El título es obligatorio.';
      valid = false;
    } else if (this.form.titulo.trim().length < 3) {
      this.formErrors['titulo'] = 'El título debe tener al menos 3 caracteres.';
      valid = false;
    }

    // Fecha límite obligatoria
    if (!this.form.fechaLimite) {
      this.formErrors['fechaLimite'] = 'La fecha límite es obligatoria.';
      valid = false;
    } else {
      // Verificar que la fecha no sea en el pasado
      const limitDate = new Date(this.form.fechaLimite);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (limitDate < todayStart) {
        this.formErrors['fechaLimite'] = 'La fecha límite no puede ser en el pasado.';
        valid = false;
      }
    }

    return valid;
  }

  async crearTicket() {
    if (!this.validateForm()) {
      this.msg.add({ severity: 'error', summary: 'Formulario incompleto', detail: 'Corrige los campos marcados en rojo.', life: 3000 });
      return;
    }

    try {
      const user = this.ps.currentUser()!;
      await this.ps.createTicket({
        groupId: this.groupId,
        titulo: this.form.titulo,
        descripcion: this.form.descripcion,
        status: this.form.status,
        prioridad: this.form.prioridad,
        asignadoA: this.form.asignadoA,
        creadoPor: user.id,
        fechaLimite: this.form.fechaLimite ? this.form.fechaLimite.toISOString() : null,
      });
      this.msg.add({ severity: 'success', summary: 'Ticket creado', life: 2500 });
      this.showCreate = false;
    } catch (err: any) {
      this.msg.add({
        severity: 'error',
        summary: 'Error al crear ticket',
        detail: err.message ?? 'Error inesperado.',
        life: 4000,
      });
    }
  }
}
