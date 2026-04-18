import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Solo interceptar peticiones al API de Supabase
  const isSupabaseRequest = req.url.startsWith(environment.supabaseUrl);
  if (!isSupabaseRequest) {
    return next(req);
  }

  // Obtener token de la sesión guardada en localStorage
  const storageKey = Object.keys(localStorage).find(k =>
    k.startsWith('sb-') && k.endsWith('-auth-token')
  );
  const sessionData = storageKey ? localStorage.getItem(storageKey) : null;
  let accessToken = '';

  if (sessionData) {
    try {
      const parsed = JSON.parse(sessionData);
      accessToken = parsed?.access_token ?? '';
    } catch { /* ignorar */ }
  }

  // Clonar la petición con los headers de autenticación
  const authReq = req.clone({
    setHeaders: {
      'apikey': environment.supabaseKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
    },
  });

  // Log de la petición (solo en desarrollo)
  if (!environment.production) {
    console.log(
      `%c[API Gateway] ${req.method} ${req.url.replace(environment.supabaseUrl, '')}`,
      'color: #6c47ff; font-weight: bold;'
    );
  }

  const startTime = Date.now();

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const duration = Date.now() - startTime;

      if (!environment.production) {
        console.error(
          `%c[API Gateway] ERROR ${error.status} (${duration}ms) ${req.method} ${req.url.replace(environment.supabaseUrl, '')}`,
          'color: #ef4444; font-weight: bold;',
          error.message
        );
      }

      switch (error.status) {
        case 401:
          // Token expirado o inválido → redirigir al login
          console.warn('[Interceptor] Sesión expirada. Redirigiendo al login...');
          localStorage.removeItem(storageKey ?? '');
          router.navigate(['/login']);
          break;

        case 403:
          console.warn('[Interceptor] Acceso denegado (403).');
          break;

        case 429:
          console.warn('[Interceptor] Rate limit excedido (429). Espera antes de reintentar.');
          break;

        case 0:
          console.error('[Interceptor] Error de red. Verifica tu conexión a internet.');
          break;

        default:
          if (error.status >= 500) {
            console.error('[Interceptor] Error del servidor:', error.status);
          }
          break;
      }

      return throwError(() => error);
    })
  );
};
