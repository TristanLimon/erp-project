import { Component, computed, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { DatePickerModule } from 'primeng/datepicker';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { PermissionService, Ticket, TicketStatus, PRIORITY_MAP, TicketPriority } from '../../../services/permission.service';

const STATUS_COLORS: Record<string, string> = {
  pendiente: '#f59e0b', en_progreso: '#3b82f6', revision: '#8b5cf6', hecho: '#22c55e', bloqueado: '#ef4444'
};
const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', en_progreso: 'En Progreso', revision: 'Revisión', hecho: 'Hecho', bloqueado: 'Bloqueado'
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, PasswordModule, DatePickerModule,
    AvatarModule, TagModule, TableModule, DividerModule,
    ToastModule, ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  template: `
<p-toast />
<p-confirmdialog />
<div class="profile-container">
  <!-- Avatar & Summary -->
  <div class="profile-hero">
    <div class="avatar-wrap" [style]="{'background': '#6c47ff22', 'border': '3px solid #6c47ff'}">
      <span class="avatar-letter">{{ user()?.nombreCompleto?.charAt(0) }}</span>
    </div>
    <div class="hero-info">
      <h1 class="hero-name">{{ user()?.nombreCompleto }}</h1>
      <p class="hero-username">@{{ user()?.usuario }}</p>
      <p class="hero-email"><i class="pi pi-envelope"></i> {{ user()?.email }}</p>
      <div class="perm-chips">
        @for (p of user()?.permissions?.slice(0,5); track p) {
          <span class="perm-chip">{{ p }}</span>
        }
        @if ((user()?.permissions?.length ?? 0) > 5) {
          <span class="perm-chip more">+{{ (user()?.permissions?.length ?? 0) - 5 }} más</span>
        }
      </div>
    </div>

    <!-- Resumen tickets -->
    <div class="ticket-summary">
      @for (s of ticketSummary(); track s.status) {
        <div class="ts-item" [style]="{'border-color': s.color}">
          <span class="ts-count" [style]="{'color': s.color}">{{ s.count }}</span>
          <span class="ts-label">{{ s.label }}</span>
        </div>
      }
    </div>
  </div>

  <div class="profile-body">
    <!-- Editar perfil -->
    <div class="profile-card">
      <h2 class="card-title"><i class="pi pi-user-edit"></i> Editar perfil</h2>
      <div class="grid">
        <div class="col-12 md:col-6 flex flex-column gap-1">
          <label class="field-label">Nombre completo</label>
          <input pInputText [(ngModel)]="form.nombreCompleto" />
        </div>
        <div class="col-12 md:col-6 flex flex-column gap-1">
          <label class="field-label">Nombre de usuario</label>
          <input pInputText [(ngModel)]="form.usuario" />
        </div>
        <div class="col-12 md:col-6 flex flex-column gap-1">
          <label class="field-label">Email</label>
          <input pInputText [(ngModel)]="form.email" type="email" />
        </div>
        <div class="col-12 md:col-6 flex flex-column gap-1">
          <label class="field-label">Teléfono</label>
          <input pInputText [(ngModel)]="form.telefono" />
        </div>
        <div class="col-12 md:col-6 flex flex-column gap-1">
          <label class="field-label">Dirección</label>
          <input pInputText [(ngModel)]="form.direccion" />
        </div>
        <div class="col-12 md:col-6 flex flex-column gap-1">
          <label class="field-label">Fecha de nacimiento</label>
          <p-datepicker [(ngModel)]="form.fechaNacimiento" dateFormat="dd/mm/yy" [showIcon]="true" />
        </div>
        <div class="col-12 md:col-6 flex flex-column gap-1">
          <label class="field-label">Nueva contraseña (opcional)</label>
          <p-password [(ngModel)]="form.password" [feedback]="true" [toggleMask]="true"
                      styleClass="w-full" [inputStyle]="{'width':'100%'}" placeholder="Dejar en blanco para no cambiar" />
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <p-button label="Guardar cambios" icon="pi pi-check" (onClick)="guardar()" />
        <p-button label="Cancelar" variant="outlined" (onClick)="resetForm()" />
      </div>
    </div>

    <!-- Mis tickets asignados -->
    <div class="profile-card">
      <h2 class="card-title"><i class="pi pi-ticket"></i> Mis Tickets Asignados ({{ myTickets().length }})</h2>
      <p-table [value]="myTickets()" [paginator]="true" [rows]="8" styleClass="p-datatable-sm">
        <ng-template #header>
          <tr>
            <th>Título</th>
            <th style="width:130px">Estado</th>
            <th style="width:100px">Prioridad</th>
            <th style="width:130px">Grupo</th>
            <th style="width:130px">Fecha límite</th>
          </tr>
        </ng-template>
        <ng-template #body let-t>
          <tr class="tr-clickable" (click)="irTicket(t)">
            <td style="font-weight:600;font-size:.875rem">{{ t.titulo }}</td>
            <td>
              <span class="status-chip" [style]="{'background': statusColor(t.status) + '20', 'color': statusColor(t.status)}">
                {{ statusLabel(t.status) }}
              </span>
            </td>
            <td [style]="{'color': getPrioColor(t.prioridad), 'font-weight':'700'}">{{ t.prioridad }}</td>
            <td style="font-size:.82rem;color:#6b7280">{{ getGroupName(t.groupId) }}</td>
            <td style="font-size:.82rem" [class.overdue]="t.fechaLimite && isOverdue(t.fechaLimite)">
              {{ t.fechaLimite ? formatDate(t.fechaLimite) : '—' }}
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="5" style="text-align:center;padding:1.5rem;color:#9ca3af">Sin tickets asignados.</td></tr>
        </ng-template>
      </p-table>
    </div>
  </div>
</div>
  `,
  styles: [`
    .profile-container { padding:1.5rem; max-width:1200px; margin:0 auto; }
    .profile-hero { background:#fff; border-radius:16px; padding:2rem; margin-bottom:1.5rem; display:flex; align-items:flex-start; gap:1.5rem; flex-wrap:wrap; box-shadow:0 1px 8px rgba(0,0,0,.06); }
    .avatar-wrap { width:80px; height:80px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .avatar-letter { font-size:2rem; font-weight:800; color:#6c47ff; }
    .hero-info { flex:1; }
    .hero-name { font-size:1.5rem; font-weight:800; color:#0f0a2e; margin:0; }
    .hero-username { color:#9ca3af; margin:.2rem 0; font-size:.9rem; }
    .hero-email { color:#6b7280; font-size:.875rem; display:flex; align-items:center; gap:.4rem; margin:.2rem 0 .75rem; }
    .perm-chips { display:flex; flex-wrap:wrap; gap:.35rem; }
    .perm-chip { font-size:.7rem; padding:.2rem .55rem; background:#f3f4f6; color:#6b7280; border-radius:20px; font-family:monospace; }
    .perm-chip.more { background:#e9d5ff; color:#8b5cf6; }
    .ticket-summary { display:flex; gap:1rem; flex-wrap:wrap; }
    .ts-item { display:flex; flex-direction:column; align-items:center; padding:.75rem 1.25rem; border:2px solid; border-radius:12px; min-width:80px; }
    .ts-count { font-size:1.75rem; font-weight:800; }
    .ts-label { font-size:.72rem; color:#6b7280; text-align:center; }
    .profile-body { display:flex; flex-direction:column; gap:1.25rem; }
    .profile-card { background:#fff; border-radius:14px; padding:1.5rem; box-shadow:0 1px 8px rgba(0,0,0,.06); }
    .card-title { font-size:1rem; font-weight:800; color:#0f0a2e; margin:0 0 1.25rem; display:flex; align-items:center; gap:.5rem; }
    .field-label { font-weight:600; font-size:.875rem; color:#374151; }
    .tr-clickable { cursor:pointer; }
    .tr-clickable:hover td { background:#f9f5ff !important; }
    .status-chip { font-size:.75rem; font-weight:600; padding:.25rem .65rem; border-radius:20px; }
    .overdue { color:#ef4444; font-weight:600; }
  `]
})
export class ProfileComponent implements OnInit {
  user = computed(() => this.ps.currentUser());

  form = {
    nombreCompleto: '', usuario: '', email: '', telefono: '',
    direccion: '', fechaNacimiento: null as Date | null, password: ''
  };

  myTickets = computed(() => {
    const uid = this.ps.currentUser()?.id;
    return this.ps.tickets().filter(t => t.asignadoA === uid);
  });

  ticketSummary = computed(() => {
    const tickets = this.myTickets();
    return [
      { status: 'pendiente',   label: 'Pendiente',   color: '#f59e0b', count: tickets.filter(t => t.status === 'pendiente').length },
      { status: 'en_progreso', label: 'En Progreso',  color: '#3b82f6', count: tickets.filter(t => t.status === 'en_progreso').length },
      { status: 'hecho',       label: 'Hecho',        color: '#22c55e', count: tickets.filter(t => t.status === 'hecho').length },
    ];
  });

  constructor(private ps: PermissionService, private router: Router,
              private msg: MessageService, private confirm: ConfirmationService) {}

  ngOnInit() { this.resetForm(); }

  resetForm() {
    const u = this.user();
    if (!u) return;
    this.form = {
      nombreCompleto: u.nombreCompleto,
      usuario: u.usuario,
      email: u.email,
      telefono: u.telefono,
      direccion: u.direccion,
      fechaNacimiento: u.fechaNacimiento ? new Date(u.fechaNacimiento) : null,
      password: '',
    };
  }

  guardar() {
    const uid = this.user()!.id;
    const changes: any = {
      nombreCompleto: this.form.nombreCompleto,
      usuario: this.form.usuario,
      email: this.form.email,
      telefono: this.form.telefono,
      direccion: this.form.direccion,
      fechaNacimiento: this.form.fechaNacimiento?.toISOString() ?? '',
    };
    if (this.form.password) changes.password = this.form.password;
    this.ps.updateUser(uid, changes);
    this.msg.add({ severity: 'success', summary: 'Perfil actualizado', life: 2500 });
    this.form.password = '';
  }

  statusLabel(s: string) { return STATUS_LABELS[s] ?? s; }
  statusColor(s: string) { return STATUS_COLORS[s] ?? '#9ca3af'; }
  getPrioColor(p: TicketPriority) { return PRIORITY_MAP[p]?.color ?? '#9ca3af'; }
  getGroupName(gid: string) { return this.ps.groups().find(g => g.id === gid)?.nombre ?? '—'; }
  formatDate(d: string) { return new Date(d).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }); }
  isOverdue(d: string) { return new Date(d) < new Date(); }
  irTicket(t: Ticket) { this.router.navigate(['/home/group', t.groupId, 'ticket', t.id]); }
}
