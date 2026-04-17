import { Injectable } from '@angular/core';

/**
 * Rate Limiter con Sliding Window.
 *
 * Controla la cantidad de peticiones por endpoint en una ventana de tiempo.
 * Si se excede el límite, lanza un error RateLimitExceededError.
 */

export class RateLimitExceededError extends Error {
  constructor(public endpoint: string, public retryAfterMs: number) {
    super(`Rate limit excedido para "${endpoint}". Intenta de nuevo en ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = 'RateLimitExceededError';
  }
}

interface WindowEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  /** Máximo de peticiones permitidas en la ventana */
  maxRequests: number;
  /** Duración de la ventana en milisegundos */
  windowMs: number;
}

/** Configuraciones por defecto por tipo de operación */
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  'read':   { maxRequests: 60, windowMs: 60_000 },   // 60 lecturas / minuto
  'write':  { maxRequests: 20, windowMs: 60_000 },   // 20 escrituras / minuto
  'auth':   { maxRequests: 5,  windowMs: 60_000 },   // 5 intentos auth / minuto
  'delete': { maxRequests: 10, windowMs: 60_000 },   // 10 deletes / minuto
};

@Injectable({ providedIn: 'root' })
export class RateLimiterService {
  private windows = new Map<string, WindowEntry>();
  private configs = new Map<string, RateLimitConfig>();

  constructor() {
    // Cargar configs por defecto
    Object.entries(DEFAULT_CONFIGS).forEach(([key, config]) => {
      this.configs.set(key, config);
    });
  }

  /**
   * Establece una configuración personalizada para un endpoint.
   */
  setConfig(endpoint: string, config: RateLimitConfig): void {
    this.configs.set(endpoint, config);
  }

  /**
   * Verifica si la petición está permitida y registra el timestamp.
   * Lanza RateLimitExceededError si se excede el límite.
   *
   * @param endpoint Identificador del endpoint (ej: 'tickets:read', 'auth:login')
   * @param operationType Tipo de operación para obtener la config (ej: 'read', 'write', 'auth')
   */
  checkAndRecord(endpoint: string, operationType: 'read' | 'write' | 'auth' | 'delete' = 'read'): void {
    const config = this.configs.get(endpoint) ?? this.configs.get(operationType) ?? DEFAULT_CONFIGS['read'];
    const now = Date.now();

    // Obtener o crear la ventana
    let entry = this.windows.get(endpoint);
    if (!entry) {
      entry = { timestamps: [] };
      this.windows.set(endpoint, entry);
    }

    // Limpiar timestamps fuera de la ventana (sliding window)
    const windowStart = now - config.windowMs;
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

    // Verificar límite
    if (entry.timestamps.length >= config.maxRequests) {
      const oldestInWindow = entry.timestamps[0];
      const retryAfterMs = oldestInWindow + config.windowMs - now;
      throw new RateLimitExceededError(endpoint, Math.max(retryAfterMs, 1000));
    }

    // Registrar este request
    entry.timestamps.push(now);
  }

  /**
   * Retorna cuántas peticiones quedan disponibles para un endpoint.
   */
  remaining(endpoint: string, operationType: 'read' | 'write' | 'auth' | 'delete' = 'read'): number {
    const config = this.configs.get(endpoint) ?? this.configs.get(operationType) ?? DEFAULT_CONFIGS['read'];
    const entry = this.windows.get(endpoint);
    if (!entry) return config.maxRequests;

    const windowStart = Date.now() - config.windowMs;
    const activeCount = entry.timestamps.filter(ts => ts > windowStart).length;
    return Math.max(0, config.maxRequests - activeCount);
  }

  /**
   * Resetea el contador de un endpoint específico.
   */
  reset(endpoint: string): void {
    this.windows.delete(endpoint);
  }

  /**
   * Resetea todos los contadores.
   */
  resetAll(): void {
    this.windows.clear();
  }
}
