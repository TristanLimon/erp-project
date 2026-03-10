import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ChipModule } from 'primeng/chip';
import { MessageService } from 'primeng/api';
import { PermissionService } from '../../../services/permission.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, PasswordModule, ToastModule,
    CardModule, TagModule, DividerModule,
    MessageModule, IconFieldModule, InputIconModule, ChipModule
  ],
  providers: [MessageService],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  email = '';
  password = '';
  cargando = false;
  emailTocado = false;
  passwordTocado = false;

  credentials = [
    { email: 'superadmin@demo.com', pwd: 'Admin@2024!!', label: 'SuperAdmin', color: '#6c47ff' },
    { email: 'admin@demo.com',      pwd: 'Admin@2024!!', label: 'Admin',      color: '#0ea5e9' },
    { email: 'usuario@demo.com',    pwd: 'User#12345$',  label: 'Usuario',    color: '#22c55e' },
    { email: 'dev@demo.com',        pwd: 'Dev#12345$',   label: 'Dev',        color: '#f59e0b' },
  ];

  constructor(
    private router: Router,
    private ps: PermissionService,
    private messageService: MessageService
  ) {}

  get emailInvalido(): boolean {
    return this.emailTocado && (!this.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email));
  }
  get passwordInvalida(): boolean { return this.passwordTocado && !this.password; }
  get formularioValido(): boolean {
    return !!this.email && !!this.password && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
  }

  fill(c: { email: string; pwd: string }) {
    this.email = c.email;
    this.password = c.pwd;
  }

  iniciarSesion() {
    this.emailTocado = true;
    this.passwordTocado = true;
    if (!this.formularioValido) return;
    this.cargando = true;
    setTimeout(() => {
      const user = this.ps.login(this.email, this.password);
      this.cargando = false;
      if (user) {
        this.messageService.add({ severity: 'success', summary: `¡Bienvenido, ${user.nombreCompleto}!`, life: 2000 });
        setTimeout(() => this.router.navigate(['/home']), 1200);
      } else {
        this.messageService.add({ severity: 'error', summary: 'Credenciales incorrectas', detail: 'El correo o contraseña no son válidos.', life: 4000 });
      }
    }, 800);
  }

  irRegister() { this.router.navigate(['/register']); }
}
