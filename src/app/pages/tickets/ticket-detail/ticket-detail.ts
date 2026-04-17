import { Component, computed, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TabsModule } from 'primeng/tabs';
import { TimelineModule } from 'primeng/timeline';
import { MessageService, ConfirmationService } from 'primeng/api';
import { PermissionService, Ticket, TicketStatus, TicketPriority, PRIORITY_MAP } from '../../../services/permission.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

const STATUS_OPTS = [
  { label: 'Pendiente', value: 'pendiente', color: '#f59e0b' },
  { label: 'En Progreso', value: 'en_progreso', color: '#3b82f6' },
  { label: 'Revisión', value: 'revision', color: '#8b5cf6' },
  { label: 'Hecho', value: 'hecho', color: '#22c55e' },
  { label: 'Bloqueado', value: 'bloqueado', color: '#ef4444' },
];

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, TextareaModule, SelectModule,
    DatePickerModule, TagModule, AvatarModule, DividerModule,
    ToastModule, ConfirmDialogModule, TabsModule, TimelineModule,
    HasPermissionDirective
  ],
  providers: [MessageService, ConfirmationService],
  template: `
<p-toast />
<p-confirmdialog />
<div class="detail-container" *ngIf="ticket(); else noTicket">
  <!-- Header -->
  <div class="detail-header">
    <div class="flex align-items-center gap-2">
      <p-button icon="pi pi-arrow-left" variant="text" size="small"
                (onClick)="router.navigate(['/home/group', groupId, 'kanban'])" />
      <span class="ticket-id-badge">{{ ticket()!.id }}</span>
    </div>
    <div class="flex gap-2">
      <p-button *hasPermission="'ticket:delete'" label="Eliminar" icon="pi pi-trash"
                severity="danger" variant="outlined" size="small" (onClick)="eliminar()" />
      <p-button *ngIf="canEdit()" label="Guardar cambios" icon="pi pi-check"
                size="small" (onClick)="guardar()" [disabled]="!dirty" />
    </div>
  </div>

  <div class="detail-body">
    <!-- LEFT: Ticket info -->
    <div class="detail-main">
      <!-- Título -->
      <div class="field-group">
        <label class="field-label">Título</label>
        @if (canEdit()) {
          <input pInputText [(ngModel)]="form.titulo" (ngModelChange)="dirty = true" class="title-input" />
        } @else {
          <h2 class="ticket-title-display">{{ ticket()!.titulo }}</h2>
        }
      </div>

      <!-- Descripción -->
      <div class="field-group">
        <label class="field-label">Descripción</label>
        @if (canEdit()) {
          <textarea pTextarea [(ngModel)]="form.descripcion" (ngModelChange)="dirty = true"
                    rows="5" style="width:100%"></textarea>
        } @else {
          <p class="desc-display">{{ ticket()!.descripcion || 'Sin descripción' }}</p>
        }
      </div>

      <!-- Tabs: Comentarios / Historial -->
      <p-tabs value="0">
        <p-tablist>
          <p-tab value="0"><i class="pi pi-comments mr-2"></i>Comentarios ({{ ticket()!.comments.length }})</p-tab>
          <p-tab value="1"><i class="pi pi-history mr-2"></i>Historial ({{ ticket()!.history.length }})</p-tab>
        </p-tablist>
        <p-tabpanels>
          <!-- Comentarios -->
          <p-tabpanel value="0">
            <div class="comments-section">
              @for (c of ticket()!.comments; track c.id) {
                <div class="comment-item">
                  <p-avatar [label]="c.userName.charAt(0)" shape="circle" size="normal"
                            [style]="{'background': group()?.color, 'color':'#fff'}" />
                  <div class="comment-body">
                    <div class="comment-header">
                      <span class="comment-author">{{ c.userName }}</span>
                      <span class="comment-date">{{ formatDateTime(c.createdAt) }}</span>
                    </div>
                    <p class="comment-text">{{ c.text }}</p>
                  </div>
                </div>
              }
              @if (ticket()!.comments.length === 0) {
                <p class="empty-msg">Sin comentarios aún.</p>
              }

              <p-divider />
              <div *hasPermission="'ticket:comment'" class="add-comment">
                <p-avatar [label]="currentUser()!.nombreCompleto.charAt(0)" shape="circle" size="normal"
                          [style]="{'background': group()?.color, 'color':'#fff'}" />
                <div style="flex:1">
                  <textarea pTextarea [(ngModel)]="newComment" rows="2" style="width:100%"
                            placeholder="Escribe un comentario..."></textarea>
                  <p-button label="Comentar" icon="pi pi-send" size="small"
                            [disabled]="!newComment.trim()" (onClick)="addComment()"
                            styleClass="mt-2" />
                </div>
              </div>
            </div>
          </p-tabpanel>

          <!-- Historial -->
          <p-tabpanel value="1">
            <div class="history-section">
              @for (h of ticket()!.history; track h.id) {
                <div class="history-item">
                  <div class="history-icon"><i class="pi pi-pencil"></i></div>
                  <div class="history-body">
                    <span class="history-text">
                      <strong>{{ h.userName }}</strong> cambió <em>{{ h.field }}</em>
                      de "<span class="old-val">{{ h.oldValue }}</span>"
                      a "<span class="new-val">{{ h.newValue }}</span>"
                    </span>
                    <span class="history-date">{{ formatDateTime(h.changedAt) }}</span>
                  </div>
                </div>
              }
              @if (ticket()!.history.length === 0) {
                <p class="empty-msg">Sin cambios registrados.</p>
              }
            </div>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    </div>

    <!-- RIGHT: Meta info -->
    <div class="detail-sidebar">
      <!-- Estado -->
      <div class="meta-card">
        <h3 class="meta-title">Detalles</h3>

        <div class="meta-field">
          <label>Estado</label>
          @if (canEdit() || canChangeStatus()) {
            <p-select [(ngModel)]="form.status" [options]="statusOpts" optionLabel="label" optionValue="value"
                      (onChange)="dirty = true" />
          } @else {
            <span class="status-badge" [style]="{'background': statusColor(ticket()!.status) + '20', 'color': statusColor(ticket()!.status)}">
              {{ statusLabel(ticket()!.status) }}
            </span>
          }
        </div>

        <div class="meta-field" *ngIf="canEdit()">
          <label>Prioridad</label>
          <p-select [(ngModel)]="form.prioridad" [options]="prioOpts" optionLabel="label" optionValue="value"
                    (onChange)="dirty = true" />
        </div>
        <div class="meta-field" *ngIf="!canEdit()">
          <label>Prioridad</label>
          <span [style]="{'color': getPrioColor(ticket()!.prioridad), 'font-weight':'600', 'font-size':'.95rem'}">
            {{ getPrioLabel(ticket()!.prioridad) }}
          </span>
        </div>

        <div class="meta-field" *ngIf="canEdit()">
          <label>Asignado a</label>
          <p-select [(ngModel)]="form.asignadoA" [options]="memberOpts()" optionLabel="label" optionValue="value"
                    [showClear]="true" placeholder="Sin asignar" (onChange)="dirty = true"
                    [filter]="true" filterPlaceholder="Buscar miembro..." />
          <!-- Botón de autoasignación -->
          <p-button label="Asignarme" icon="pi pi-user" variant="text" size="small"
                    (onClick)="autoAssign()" [style]="{'font-size':'.75rem','padding':'0.15rem 0.4rem','margin-top':'0.25rem'}" />
          <!-- Preview del asignado -->
          @if (form.asignadoA) {
            <div class="assign-preview-mini">
              <p-avatar [label]="getAssigneeName(form.asignadoA).charAt(0)" shape="circle"
                        [style]="{'background': group()?.color, 'color':'#fff','width':'24px','height':'24px','font-size':'.7rem'}" />
              <span class="assign-preview-name">{{ getAssigneeName(form.asignadoA) }}</span>
            </div>
          }
        </div>
        <div class="meta-field" *ngIf="!canEdit()">
          <label>Asignado a</label>
          @if (ticket()!.asignadoA) {
            <div class="assign-preview-mini">
              <p-avatar [label]="getAssigneeName(ticket()!.asignadoA).charAt(0)" shape="circle"
                        [style]="{'background': group()?.color, 'color':'#fff','width':'24px','height':'24px','font-size':'.7rem'}" />
              <span class="assign-preview-name">{{ getAssigneeName(ticket()!.asignadoA) }}</span>
            </div>
          } @else {
            <span>Sin asignar</span>
          }
        </div>

        <div class="meta-field" *ngIf="canEdit()">
          <label>Fecha límite <span class="required">*</span></label>
          <p-datepicker [(ngModel)]="form.fechaLimite" dateFormat="dd/mm/yy" [showIcon]="true"
                        [minDate]="today" (onSelect)="dirty = true"
                        [style]="formErrors['fechaLimite'] ? {'border-color':'#ef4444'} : {}" />
          @if (formErrors['fechaLimite']) {
            <small class="field-error">{{ formErrors['fechaLimite'] }}</small>
          }
        </div>
        <div class="meta-field" *ngIf="!canEdit() && ticket()!.fechaLimite">
          <label>Fecha límite</label>
          <span [class.overdue]="isOverdue(ticket()!.fechaLimite!)">
            {{ formatDate(ticket()!.fechaLimite!) }}
          </span>
        </div>
        <div class="meta-field" *ngIf="!canEdit() && !ticket()!.fechaLimite">
          <label>Fecha límite</label>
          <span class="no-date-warning"><i class="pi pi-exclamation-triangle"></i> Sin fecha límite</span>
        </div>

        <p-divider />

        <div class="meta-field">
          <label>Creado por</label>
          <span>{{ getAssigneeName(ticket()!.creadoPor) || '—' }}</span>
        </div>
        <div class="meta-field">
          <label>Fecha creación</label>
          <span>{{ formatDate(ticket()!.fechaCreacion) || '—' }}</span>
        </div>
      </div>
    </div>
  </div>
</div>

<ng-template #noTicket>
  <div style="text-align:center;padding:4rem;color:#9ca3af">
    <i class="pi pi-exclamation-triangle" style="font-size:3rem"></i>
    <p>Ticket no encontrado.</p>
    <p-button label="Volver" (onClick)="router.navigate(['/home'])" />
  </div>
</ng-template>
  `,
  styles: [`
    .detail-container { padding:1.5rem; max-width:1200px; margin:0 auto; }
    .detail-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; background:#fff; padding:1rem 1.25rem; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); }
    .ticket-id-badge { font-size:.78rem; font-family:monospace; background:#f3f4f6; color:#6b7280; padding:.2rem .6rem; border-radius:6px; }
    .detail-body { display:grid; grid-template-columns:1fr 320px; gap:1.25rem; }
    @media(max-width:900px) { .detail-body { grid-template-columns:1fr; } }
    .detail-main { background:#fff; border-radius:14px; padding:1.5rem; box-shadow:0 1px 8px rgba(0,0,0,.06); }
    .detail-sidebar { display:flex; flex-direction:column; gap:1rem; }
    .meta-card { background:#fff; border-radius:14px; padding:1.25rem; box-shadow:0 1px 8px rgba(0,0,0,.06); }
    .meta-title { font-weight:800; font-size:1rem; color:#0f0a2e; margin:0 0 1rem; }
    .meta-field { display:flex; flex-direction:column; gap:.35rem; margin-bottom:.85rem; }
    .meta-field label { font-size:.78rem; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.05em; }
    .field-group { margin-bottom:1.25rem; }
    .field-label { display:block; font-weight:600; font-size:.875rem; color:#374151; margin-bottom:.4rem; }
    .title-input { width:100%; font-size:1.1rem; font-weight:700; }
    .ticket-title-display { font-size:1.4rem; font-weight:800; color:#0f0a2e; margin:0; }
    .desc-display { color:#4b5563; line-height:1.6; white-space:pre-wrap; margin:0; }
    .status-badge { display:inline-block; font-size:.82rem; font-weight:600; padding:.3rem .8rem; border-radius:20px; }
    .overdue { color:#ef4444; font-weight:600; }
    .required { color:#ef4444; }
    .field-error { color:#ef4444; font-size:.75rem; font-weight:500; }
    .no-date-warning { color:#f59e0b; font-size:.85rem; display:flex; align-items:center; gap:.35rem; }
    .assign-preview-mini { display:flex; align-items:center; gap:.5rem; margin-top:.25rem; }
    .assign-preview-name { font-size:.85rem; font-weight:600; color:#1e40af; }
    .comments-section { display:flex; flex-direction:column; gap:.85rem; }
    .comment-item { display:flex; gap:.75rem; }
    .comment-body { flex:1; background:#f9fafb; border-radius:10px; padding:.85rem; }
    .comment-header { display:flex; justify-content:space-between; margin-bottom:.35rem; }
    .comment-author { font-weight:700; font-size:.88rem; color:#0f0a2e; }
    .comment-date { font-size:.75rem; color:#9ca3af; }
    .comment-text { margin:0; font-size:.875rem; color:#374151; }
    .add-comment { display:flex; gap:.75rem; align-items:flex-start; }
    .history-section { display:flex; flex-direction:column; gap:.65rem; }
    .history-item { display:flex; align-items:flex-start; gap:.75rem; padding:.65rem; background:#f9fafb; border-radius:8px; }
    .history-icon { width:28px; height:28px; background:#e9d5ff; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .history-icon i { font-size:.7rem; color:#8b5cf6; }
    .history-body { flex:1; }
    .history-text { font-size:.82rem; color:#374151; }
    .old-val { color:#ef4444; }
    .new-val { color:#22c55e; }
    .history-date { display:block; font-size:.72rem; color:#9ca3af; margin-top:.2rem; }
    .empty-msg { color:#9ca3af; font-size:.875rem; text-align:center; padding:1rem 0; }
    .meta-field span { font-size:.88rem; color:#1f2937; font-weight:500; }
    :host ::ng-deep .meta-field .p-select { background:#f9fafb !important; border:1px solid #e5e7eb !important; border-radius:8px !important; }
    :host ::ng-deep .meta-field .p-select-label { color:#1f2937 !important; background:transparent !important; }
    :host ::ng-deep .meta-field .p-select-dropdown { color:#6b7280 !important; background:transparent !important; }
    :host ::ng-deep .meta-field .p-datepicker-input { background:#f9fafb !important; color:#1f2937 !important; border:1px solid #e5e7eb !important; }
    :host ::ng-deep .meta-field .p-datepicker-dropdown { background:#f0f0f5 !important; color:#6b7280 !important; border:1px solid #e5e7eb !important; }
    :host ::ng-deep .meta-field .p-datepicker-input-icon-container { background:#f9fafb !important; border:1px solid #e5e7eb !important; border-radius:8px !important; }
  `]
})
export class TicketDetailComponent implements OnInit {
  groupId = '';
  ticketId = '';
  dirty = false;
  newComment = '';
  today = new Date();

  form = {
    titulo: '', descripcion: '', status: 'pendiente' as TicketStatus,
    prioridad: 'media' as TicketPriority, asignadoA: null as string | null, fechaLimite: null as Date | null
  };

  formErrors: Record<string, string> = {};

  ticket = computed(() => this.ps.tickets().find(t => t.id === this.ticketId) ?? null);
  group = computed(() => this.ps.groups().find(g => g.id === this.groupId) ?? null);
  currentUser = computed(() => this.ps.currentUser());

  statusOpts = STATUS_OPTS;
  prioOpts = Object.entries(PRIORITY_MAP).map(([v, d]) => ({ label: d.label, value: v as TicketPriority }));

  memberOpts = computed(() =>
    this.ps.groupMembers(this.groupId).map(u => ({ label: u.nombreCompleto, value: u.id }))
  );

  constructor(private route: ActivatedRoute, public router: Router,
              private ps: PermissionService, private msg: MessageService,
              private confirm: ConfirmationService) {}

  async ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id') ?? '';
    this.ticketId = this.route.snapshot.paramMap.get('ticketId') ?? '';
    await this.ps.setCurrentGroup(this.groupId);
    this.loadForm();
  }

  loadForm() {
    const t = this.ticket();
    if (!t) return;
    this.form = {
      titulo: t.titulo,
      descripcion: t.descripcion,
      status: t.status,
      prioridad: t.prioridad,
      asignadoA: t.asignadoA,
      fechaLimite: t.fechaLimite ? new Date(t.fechaLimite) : null,
    };
    this.dirty = false;
    this.formErrors = {};
  }

  // El creador puede editar todo; el asignado solo cambia estado/comentarios
  canEdit(): boolean {
    const t = this.ticket();
    if (!t) return false;
    const uid = this.ps.currentUser()?.id;
    return (t.creadoPor === uid && this.ps.has('ticket:edit')) || this.ps.has('ticket:edit');
  }

  canChangeStatus(): boolean {
    const t = this.ticket();
    if (!t) return false;
    const uid = this.ps.currentUser()?.id;
    return t.asignadoA === uid && this.ps.has('ticket:change_status');
  }

  autoAssign() {
    const uid = this.ps.currentUser()?.id ?? null;
    this.form.asignadoA = uid;
    this.dirty = true;
  }

  private validateForm(): boolean {
    this.formErrors = {};
    let valid = true;

    // Fecha límite obligatoria al editar
    if (!this.form.fechaLimite) {
      this.formErrors['fechaLimite'] = 'La fecha límite es obligatoria.';
      valid = false;
    } else {
      const limitDate = new Date(this.form.fechaLimite);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      // Solo validar si la fecha cambió (permitir fechas pasadas ya existentes)
      const originalDate = this.ticket()?.fechaLimite ? new Date(this.ticket()!.fechaLimite!) : null;
      const dateChanged = !originalDate || limitDate.getTime() !== originalDate.getTime();
      if (dateChanged && limitDate < todayStart) {
        this.formErrors['fechaLimite'] = 'La fecha límite no puede ser en el pasado.';
        valid = false;
      }
    }

    return valid;
  }

  async guardar() {
    if (!this.validateForm()) {
      this.msg.add({ severity: 'error', summary: 'Validación fallida', detail: 'Corrige los campos marcados.', life: 3000 });
      return;
    }

    try {
      const user = this.ps.currentUser()!;
      await this.ps.updateTicket(this.ticketId, {
        titulo: this.form.titulo,
        descripcion: this.form.descripcion,
        status: this.form.status,
        prioridad: this.form.prioridad,
        asignadoA: this.form.asignadoA,
        fechaLimite: this.form.fechaLimite ? this.form.fechaLimite.toISOString() : null,
      }, user);
      this.msg.add({ severity: 'success', summary: 'Ticket actualizado', life: 2500 });
      this.dirty = false;
      this.formErrors = {};
    } catch (err: any) {
      this.msg.add({
        severity: 'error',
        summary: 'Error al guardar',
        detail: err.message ?? 'Error inesperado.',
        life: 4000,
      });
    }
  }

  async addComment() {
    if (!this.newComment.trim()) return;
    try {
      await this.ps.addComment(this.ticketId, this.newComment, this.ps.currentUser()!);
      this.newComment = '';
      this.msg.add({ severity: 'success', summary: 'Comentario añadido', life: 2000 });
    } catch (err: any) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: err.message ?? 'Error al comentar.', life: 3000 });
    }
  }

  eliminar() {
    this.confirm.confirm({
      message: '¿Eliminar este ticket permanentemente?',
      header: 'Eliminar ticket',
      icon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        await this.ps.deleteTicket(this.ticketId);
        this.router.navigate(['/home/group', this.groupId, 'kanban']);
      }
    });
  }

  statusLabel(s: string) { return STATUS_OPTS.find(o => o.value === s)?.label ?? s; }
  statusColor(s: string) { return STATUS_OPTS.find(o => o.value === s)?.color ?? '#9ca3af'; }
  getPrioColor(p: TicketPriority) { return PRIORITY_MAP[p]?.color ?? '#9ca3af'; }
  getPrioLabel(p: TicketPriority) { return PRIORITY_MAP[p]?.label ?? p; }
  getAssigneeName(uid: string | null) { return uid ? (this.ps.getUserById(uid)?.nombreCompleto ?? uid) : 'Sin asignar'; }
  formatDate(d: string | null | undefined) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }); } catch { return d; } }
  formatDateTime(d: string) { return new Date(d).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }); }
  isOverdue(d: string) { return new Date(d) < new Date(); }
}
