import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';
import { PermissionService } from '../../../services/permission.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, PasswordModule, ToastModule,
    CardModule, DividerModule, MessageModule, DatePickerModule
  ],
  providers: [MessageService],
  template: `
<p-toast position="top-right" />
<div class="register-wrap">
  <div class="register-card">
    <h1 class="reg-title">Crear cuenta</h1>
    <p class="reg-sub">Completa tus datos para registrarte</p>

    <div class="grid mt-4">
      <div class="col-12 md:col-6 flex flex-column gap-1">
        <label class="field-label">Nombre completo *</label>
        <input pInputText [(ngModel)]="form.nombreCompleto" placeholder="Tu nombre completo" />
      </div>
      <div class="col-12 md:col-6 flex flex-column gap-1">
        <label class="field-label">Usuario *</label>
        <input pInputText [(ngModel)]="form.usuario" placeholder="nombre_usuario" />
      </div>
      <div class="col-12 md:col-6 flex flex-column gap-1">
        <label class="field-label">Email *</label>
        <input pInputText [(ngModel)]="form.email" type="email" placeholder="tu@correo.com" />
      </div>
      <div class="col-12 md:col-6 flex flex-column gap-1">
        <label class="field-label">Contraseña *</label>
        <p-password [(ngModel)]="form.password" [toggleMask]="true" [feedback]="true"
                    styleClass="w-full" [inputStyle]="{'width':'100%'}" />
      </div>
      <div class="col-12 md:col-6 flex flex-column gap-1">
        <label class="field-label">Teléfono</label>
        <input pInputText [(ngModel)]="form.telefono" placeholder="10 dígitos" />
      </div>
      <div class="col-12 md:col-6 flex flex-column gap-1">
        <label class="field-label">Fecha de nacimiento</label>
        <p-datepicker [(ngModel)]="form.fechaNacimiento" dateFormat="dd/mm/yy" [showIcon]="true" />
      </div>
      <div class="col-12 flex flex-column gap-1">
        <label class="field-label">Dirección</label>
        <input pInputText [(ngModel)]="form.direccion" placeholder="Dirección completa" />
      </div>
    </div>

    <p-button label="Crear cuenta" icon="pi pi-user-plus" styleClass="w-full mt-4 justify-content-center"
              [loading]="loading" (onClick)="register()"
              [style]="{'background':'#6c47ff','border-color':'#6c47ff','font-weight':'700'}" />
    <p-divider />
    <div class="text-center" style="font-size:.88rem;color:#4a3a8a">
      ¿Ya tienes cuenta?
      <p-button label="Inicia sesión" variant="text" (onClick)="router.navigate(['/login'])"
                [style]="{'color':'#6c47ff','font-weight':'700','font-size':'.88rem'}" />
    </div>
  </div>
</div>
  `,
  styles: [`
    .register-wrap { min-height:100vh; background:#f8f7ff; display:flex; align-items:center; justify-content:center; padding:2rem; }
    .register-card { background:#fff; border-radius:20px; padding:2.5rem; width:100%; max-width:680px; box-shadow:0 4px 24px rgba(108,71,255,.1); }
    .reg-title { font-size:1.75rem; font-weight:800; color:#0f0a2e; margin:0; }
    .reg-sub { color:#6b7280; margin:.35rem 0 0; }
    .field-label { font-weight:600; font-size:.875rem; color:#374151; }
  `]
})
export class RegisterComponent {
  loading = false;
  form = {
    nombreCompleto: '', usuario: '', email: '', password: '',
    telefono: '', direccion: '', fechaNacimiento: null as Date | null
  };

  constructor(public router: Router, private ps: PermissionService, private msg: MessageService) {}

  register() {
    const { nombreCompleto, usuario, email, password } = this.form;
    if (!nombreCompleto || !usuario || !email || !password) {
      this.msg.add({ severity: 'warn', summary: 'Campos requeridos', detail: 'Nombre, usuario, email y contraseña son obligatorios.' });
      return;
    }
    this.loading = true;
    setTimeout(() => {
      const result = this.ps.createUser({
        nombreCompleto, usuario, email, password,
        telefono: this.form.telefono,
        direccion: this.form.direccion,
        fechaNacimiento: this.form.fechaNacimiento?.toISOString() ?? '',
        permissions: ['ticket:create','ticket:view','ticket:change_status','ticket:comment','group:view','user:view'],
      });
      this.loading = false;
      if (result.ok) {
        this.msg.add({ severity: 'success', summary: '¡Cuenta creada!', detail: 'Puedes iniciar sesión ahora.', life: 3000 });
        setTimeout(() => this.router.navigate(['/login']), 2000);
      } else {
        this.msg.add({ severity: 'error', summary: 'Error', detail: result.msg });
      }
    }, 600);
  }
}
