import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { PermissionService } from '../services/permission.service';

export const authGuard: CanActivateFn = () => {
  const ps = inject(PermissionService);
  const router = inject(Router);
  if (ps.currentUser()) return true;
  router.navigate(['/login']);
  return false;
};
