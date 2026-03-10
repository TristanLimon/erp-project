import { Component, computed, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { PermissionService } from '../../services/permission.service';
import { HasPermissionDirective } from '../../directives/has-permission.directive';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ButtonModule, TooltipModule,
            DividerModule, BadgeModule, AvatarModule, HasPermissionDirective],
  template: `
<aside class="sidebar" [class.collapsed]="collapsed">
  <!-- Logo -->
  <div class="sidebar-logo">
    <span class="logo-text" *ngIf="!collapsed">erp<span class="logo-dot">.</span></span>
    <span class="logo-text" *ngIf="collapsed">e<span class="logo-dot">.</span></span>
  </div>

  <p-divider styleClass="sidebar-divider" />

  <!-- Group context -->
  @if (currentGroup() && !collapsed) {
    <div class="group-context" [style]="{'border-color': currentGroup()!.color}">
      <div class="group-dot" [style]="{'background': currentGroup()!.color}"></div>
      <div class="flex flex-column" style="overflow:hidden">
        <span class="group-ctx-name">{{ currentGroup()!.nombre }}</span>
        <span class="group-ctx-llm" [style]="{'color': currentGroup()!.color}">
          <i class="pi pi-microchip-ai" style="font-size:.65rem"></i> {{ currentGroup()!.llmModel }}
        </span>
      </div>
    </div>
  }

  <!-- Nav -->
  <nav class="sidebar-nav">
    <!-- Global -->
    <a routerLink="/home" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}"
       class="nav-item" [pTooltip]="collapsed ? 'Mis Grupos' : ''" tooltipPosition="right">
      <i class="pi pi-th-large"></i>
      <span *ngIf="!collapsed">Mis Grupos</span>
    </a>
    <a routerLink="/home/profile" routerLinkActive="active"
       class="nav-item" [pTooltip]="collapsed ? 'Mi Perfil' : ''" tooltipPosition="right">
      <i class="pi pi-user"></i>
      <span *ngIf="!collapsed">Mi Perfil</span>
    </a>

    <!-- Group-specific -->
    @if (currentGroup()) {
      <p-divider styleClass="sidebar-divider" />
      <span *ngIf="!collapsed" class="nav-section-label">Grupo actual</span>

      <a [routerLink]="['/home/group', currentGroup()!.id]" routerLinkActive="active"
         [routerLinkActiveOptions]="{exact:true}"
         class="nav-item" [pTooltip]="collapsed ? 'Dashboard' : ''" tooltipPosition="right">
        <i class="pi pi-home"></i>
        <span *ngIf="!collapsed">Dashboard</span>
      </a>
      <a [routerLink]="['/home/group', currentGroup()!.id, 'kanban']" routerLinkActive="active"
         class="nav-item" [pTooltip]="collapsed ? 'Kanban' : ''" tooltipPosition="right">
        <i class="pi pi-table"></i>
        <span *ngIf="!collapsed">Kanban</span>
      </a>
      <a [routerLink]="['/home/group', currentGroup()!.id, 'list']" routerLinkActive="active"
         class="nav-item" [pTooltip]="collapsed ? 'Lista' : ''" tooltipPosition="right">
        <i class="pi pi-list"></i>
        <span *ngIf="!collapsed">Lista</span>
      </a>
      <a *hasPermission="['group:edit','group:delete','group:add_member']"
         [routerLink]="['/home/group', currentGroup()!.id, 'manage']" routerLinkActive="active"
         class="nav-item" [pTooltip]="collapsed ? 'Gestión Grupo' : ''" tooltipPosition="right">
        <i class="pi pi-cog"></i>
        <span *ngIf="!collapsed">Gestión Grupo</span>
      </a>
    }

    <p-divider styleClass="sidebar-divider" />

    <!-- Admin -->
    <a *hasPermission="'user:manage_permissions'"
       routerLink="/home/admin/users" routerLinkActive="active"
       class="nav-item nav-item-admin" [pTooltip]="collapsed ? 'Gestión Usuarios' : ''" tooltipPosition="right">
      <i class="pi pi-shield"></i>
      <span *ngIf="!collapsed">Gestión Usuarios</span>
    </a>
  </nav>

  <div class="sidebar-footer">
    <p-divider styleClass="sidebar-divider" />
    <!-- User -->
    @if (!collapsed) {
      <div class="user-info">
        <p-avatar [label]="currentUser()?.nombreCompleto?.charAt(0) ?? '?'" shape="circle" size="normal"
                  [style]="{'background':'#6c47ff','color':'#fff'}" />
        <div style="overflow:hidden">
          <span class="user-name">{{ currentUser()?.nombreCompleto }}</span>
          <span class="user-perms">{{ currentUser()?.permissions?.length }} permisos</span>
        </div>
      </div>
    }
    <p-button icon="pi pi-sign-out" variant="text" [pTooltip]="'Cerrar sesión'"
              tooltipPosition="right" (onClick)="cerrarSesion()"
              [style]="{'color':'#ef4444','width': collapsed ? '100%' : 'auto'}" />
  </div>

  <!-- Toggle -->
  <button class="toggle-btn" (click)="toggle()">
    <i [class]="collapsed ? 'pi pi-chevron-right' : 'pi pi-chevron-left'"></i>
  </button>
</aside>
  `,
  styleUrl: './sidebar.css'
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();

  currentUser = computed(() => this.ps.currentUser());
  currentGroup = computed(() => this.ps.currentGroup());

  constructor(private router: Router, private ps: PermissionService) {}

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (!event.ctrlKey) return;
    if (event.key === '1') { event.preventDefault(); this.router.navigate(['/home']); }
    if (event.key === '2') { event.preventDefault(); this.router.navigate(['/home/profile']); }
  }

  toggle() { this.collapsed = !this.collapsed; this.collapsedChange.emit(this.collapsed); }
  cerrarSesion() { this.ps.logout(); this.router.navigate(['/login']); }
}
