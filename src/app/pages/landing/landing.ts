import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { AvatarModule } from 'primeng/avatar';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [ButtonModule, ToolbarModule, CardModule, TagModule, DividerModule, AvatarModule],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class LandingComponent {
  stats = [
    { value: '10k+', label: 'usuarios' },
    { value: '99.9%', label: 'uptime' },
    { value: '< 1s', label: 'respuesta' },
  ];

  features = [
    { num: '01', icon: 'pi pi-bolt',   title: 'Rápido',  description: 'Respuestas instantáneas sin tiempos de espera. Optimizado para que tu flujo nunca se detenga.' },
    { num: '02', icon: 'pi pi-shield', title: 'Seguro',  description: 'Tus datos siempre protegidos y bajo tu control. Cifrado de extremo a extremo en todo momento.' },
    { num: '03', icon: 'pi pi-star',   title: 'Simple',  description: 'Interfaz diseñada para que te enfoques en lo que importa. Sin ruido, sin curva de aprendizaje.' },
  ];

  constructor(private router: Router) {}

  irLogin()    { this.router.navigate(['/login']); }
  irRegister() { this.router.navigate(['/register']); }
}