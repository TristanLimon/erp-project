import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/auth/login/login').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./pages/auth/register/register').then(m => m.RegisterComponent) },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout').then(m => m.MainLayoutComponent),
    children: [
      { path: '', loadComponent: () => import('./pages/groups/group-select/group-select').then(m => m.GroupSelectComponent) },
      { path: 'group/:id', loadComponent: () => import('./pages/groups/group-dashboard/group-dashboard').then(m => m.GroupDashboardComponent) },
      { path: 'group/:id/kanban', loadComponent: () => import('./pages/tickets/kanban/kanban').then(m => m.KanbanComponent) },
      { path: 'group/:id/list', loadComponent: () => import('./pages/tickets/ticket-list/ticket-list').then(m => m.TicketListComponent) },
      { path: 'group/:id/ticket/:ticketId', loadComponent: () => import('./pages/tickets/ticket-detail/ticket-detail').then(m => m.TicketDetailComponent) },
      { path: 'group/:id/manage', loadComponent: () => import('./pages/groups/group-manage/group-manage').then(m => m.GroupManageComponent) },
      { path: 'profile', loadComponent: () => import('./pages/user/profile/profile').then(m => m.ProfileComponent) },
      { path: 'admin/users', loadComponent: () => import('./pages/admin/user-management/user-management').then(m => m.UserManagementComponent) },
      { path: 'admin/groups', loadComponent: () => import('./pages/admin/group-management/group-management').then(m => m.GroupManagementComponent) },
      { path: 'admin/permissions', loadComponent: () => import('./pages/admin/permissions-manager/permissions-manager').then(m => m.PermissionsManagerComponent) },
    ]
  },
  { path: '**', redirectTo: 'login' }
];
