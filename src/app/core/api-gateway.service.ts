import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { RateLimiterService, RateLimitExceededError } from './rate-limiter.service';
import { JsonSchemaValidatorService } from './json-schema-validator.service';

/**
 * API Gateway Service.
 *
 * Centraliza TODAS las llamadas HTTP al backend (Supabase REST API / PostgREST).
 * Reemplaza el uso directo del SDK de Supabase para operaciones CRUD.
 *
 * Flujo: Componente → PermissionService → ApiGatewayService → HttpClient → Supabase REST API
 *
 * Integra:
 * - Rate Limiting (antes de enviar la petición)
 * - JSON Schema Validation (antes de enviar datos de escritura)
 * - Logging centralizado
 */

@Injectable({ providedIn: 'root' })
export class ApiGatewayService {
  private http = inject(HttpClient);
  private rateLimiter = inject(RateLimiterService);
  private schemaValidator = inject(JsonSchemaValidatorService);

  private readonly baseUrl = environment.apiBaseUrl;

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Construye la URL completa para un recurso.
   */
  private url(resource: string): string {
    return `${this.baseUrl}/${resource}`;
  }

  /**
   * Log en desarrollo.
   */
  private log(action: string, resource: string, detail?: any): void {
    if (!environment.production) {
      console.log(
        `%c[API Gateway] ${action} → /${resource}`,
        'color: #22c55e; font-weight: bold;',
        detail ?? ''
      );
    }
  }

  // ── GET (Select) ─────────────────────────────────────────────────────────

  /**
   * SELECT genérico con filtros PostgREST.
   *
   * @param resource  Nombre de la tabla (ej: 'tickets', 'profiles')
   * @param options   Opciones de filtro PostgREST
   */
  async select<T = any>(resource: string, options?: {
    select?: string;
    filters?: Record<string, string>;
    order?: string;
    limit?: number;
    single?: boolean;
  }): Promise<T> {
    const endpoint = `${resource}:read`;
    this.rateLimiter.checkAndRecord(endpoint, 'read');

    let params = new HttpParams();
    if (options?.select) {
      params = params.set('select', options.select);
    }
    if (options?.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        params = params.set(key, value);
      });
    }
    if (options?.order) {
      params = params.set('order', options.order);
    }
    if (options?.limit) {
      params = params.set('limit', options.limit.toString());
    }

    const headers: Record<string, string> = {};
    if (options?.single) {
      headers['Accept'] = 'application/vnd.pgrst.object+json';
    }

    this.log('SELECT', resource, options?.filters);

    const result = await firstValueFrom(
      this.http.get<T>(this.url(resource), { params, headers })
    );
    return result;
  }

  // ── POST (Insert) ────────────────────────────────────────────────────────

  /**
   * INSERT genérico con validación de schema.
   *
   * @param resource    Nombre de la tabla
   * @param data        Datos a insertar
   * @param schemaName  Nombre del JSON Schema a usar para validación
   */
  async insert<T = any>(resource: string, data: any, schemaName?: string): Promise<T> {
    const endpoint = `${resource}:write`;
    this.rateLimiter.checkAndRecord(endpoint, 'write');

    // Validar con JSON Schema si se proporcionó
    if (schemaName) {
      this.schemaValidator.validateOrThrow(schemaName, data);
    }

    this.log('INSERT', resource, data);

    const result = await firstValueFrom(
      this.http.post<T[]>(this.url(resource), data, {
        headers: {
          'Prefer': 'return=representation',
        },
      })
    );

    // PostgREST retorna un array, tomamos el primer elemento
    return Array.isArray(result) ? result[0] : result;
  }

  // ── PATCH (Update) ───────────────────────────────────────────────────────

  /**
   * UPDATE genérico con filtros y validación de schema.
   *
   * @param resource    Nombre de la tabla
   * @param data        Datos a actualizar
   * @param filters     Filtros PostgREST para seleccionar filas (ej: { id: 'eq.xxx' })
   * @param schemaName  Nombre del JSON Schema
   */
  async update<T = any>(resource: string, data: any, filters: Record<string, string>, schemaName?: string): Promise<T> {
    const endpoint = `${resource}:write`;
    this.rateLimiter.checkAndRecord(endpoint, 'write');

    if (schemaName) {
      this.schemaValidator.validateOrThrow(schemaName, data);
    }

    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      params = params.set(key, value);
    });

    this.log('UPDATE', resource, { data, filters });

    const result = await firstValueFrom(
      this.http.patch<T[]>(this.url(resource), data, {
        params,
        headers: {
          'Prefer': 'return=representation',
        },
      })
    );

    return Array.isArray(result) ? result[0] : result;
  }

  // ── DELETE ───────────────────────────────────────────────────────────────

  /**
   * DELETE genérico con filtros.
   */
  async delete(resource: string, filters: Record<string, string>): Promise<void> {
    const endpoint = `${resource}:delete`;
    this.rateLimiter.checkAndRecord(endpoint, 'delete');

    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      params = params.set(key, value);
    });

    this.log('DELETE', resource, filters);

    await firstValueFrom(
      this.http.delete(this.url(resource), { params })
    );
  }

  // ── UPSERT ───────────────────────────────────────────────────────────────

  /**
   * UPSERT (insert or update on conflict).
   */
  async upsert<T = any>(resource: string, data: any, schemaName?: string): Promise<T> {
    const endpoint = `${resource}:write`;
    this.rateLimiter.checkAndRecord(endpoint, 'write');

    if (schemaName) {
      this.schemaValidator.validateOrThrow(schemaName, data);
    }

    this.log('UPSERT', resource, data);

    const result = await firstValueFrom(
      this.http.post<T[]>(this.url(resource), data, {
        headers: {
          'Prefer': 'return=representation,resolution=merge-duplicates',
        },
      })
    );

    return Array.isArray(result) ? result[0] : result;
  }

  // ── Batch Insert ─────────────────────────────────────────────────────────

  /**
   * Inserta múltiples filas de una vez.
   */
  async insertMany<T = any>(resource: string, rows: any[], schemaName?: string): Promise<T[]> {
    const endpoint = `${resource}:write`;
    this.rateLimiter.checkAndRecord(endpoint, 'write');

    if (schemaName) {
      rows.forEach((row, i) => {
        const result = this.schemaValidator.validate(schemaName, row);
        if (!result.valid) {
          const msgs = result.errors.map(e => `${e.field}: ${e.message}`).join('; ');
          throw new Error(`Validación fallida en fila ${i}: ${msgs}`);
        }
      });
    }

    this.log('INSERT_MANY', resource, { count: rows.length });

    const result = await firstValueFrom(
      this.http.post<T[]>(this.url(resource), rows, {
        headers: {
          'Prefer': 'return=representation',
        },
      })
    );

    return Array.isArray(result) ? result : [result];
  }
}
