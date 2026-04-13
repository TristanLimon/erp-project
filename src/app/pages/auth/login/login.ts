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
import { MessageService } from 'primeng/api';
import { PermissionService } from '../../../services/permission.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, PasswordModule, ToastModule,
    CardModule, TagModule, DividerModule,
    MessageModule, IconFieldModule, InputIconModule
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

  // Easter egg: 5 clicks en el logo
  private logoClicks = 0;
  private logoTimer: any;

  constructor(
    private router: Router,
    private ps: PermissionService,
    private messageService: MessageService
  ) {}

  get emailInvalido(): boolean {
    return this.emailTocado && (!this.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email));
  }

  get passwordInvalida(): boolean {
    return this.passwordTocado && !this.password;
  }

  get formularioValido(): boolean {
    return !!this.email && !!this.password && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
  }

  /**
   * Easter egg: 5 clicks en el logo → toast "catch u"
   * El requerimiento dice "display an alert: catch u" pero NO usamos alert() nativo.
   * Usamos p-toast de PrimeNG para no romper la regla "no alerts nativos".
   */
  onLogoClick() {
    this.logoClicks++;
    clearTimeout(this.logoTimer);
    this.logoTimer = setTimeout(() => { this.logoClicks = 0; }, 2000);
    if (this.logoClicks >= 5) {
      this.logoClicks = 0;
      this.messageService.add({
        severity: 'warn',
        summary: '👀 catch u',
        detail: '¡Te atrapé haciendo clic en el logo!',
        life: 4000,
      });
    }
  }

  async iniciarSesion() {
    this.emailTocado = true;
    this.passwordTocado = true;
    if (!this.formularioValido) return;

    this.cargando = true;
    try {
      const user = await this.ps.login(this.email, this.password);
      if (user) {
        this.messageService.add({
          severity: 'success',
          summary: `¡Bienvenido, ${user.nombreCompleto}!`,
          life: 2000,
        });
        setTimeout(() => this.router.navigate(['/home']), 1200);
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Credenciales incorrectas',
          detail: 'El correo o contraseña no son válidos.',
          life: 4000,
        });
      }
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: err.message ?? 'Error de conexión.',
        life: 4000,
      });
    } finally {
      this.cargando = false;
    }
  }

  irRegister() {
    this.router.navigate(['/register']);
  }
}
