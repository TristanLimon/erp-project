import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { PermissionService } from '../services/permission.service';
import { SupabaseService } from '../services/supabase.service';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

/**
 * Guard de autenticación con Supabase.
 * Verifica si hay sesión activa antes de permitir el acceso.
 */
export const authGuard: CanActivateFn = () => {
  const ps = inject(PermissionService);
  const sb = inject(SupabaseService);
  const router = inject(Router);

  // Si ya hay usuario en memoria, permitir
  if (ps.currentUser()) return true;

  // Si no, verificar sesión de Supabase
  return from(sb.client.auth.getSession()).pipe(
    map(({ data }) => {
      if (data.session?.user) {
        // La sesión existe; loadUserData se llama en el constructor del servicio
        return true;
      }
      router.navigate(['/login']);
      return false;
    })
  );
};
