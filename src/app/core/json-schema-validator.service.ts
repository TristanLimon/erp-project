import { Injectable } from '@angular/core';

/**
 * Servicio de validación con JSON Schema.
 *
 * Define schemas para cada entidad del sistema y valida los datos
 * antes de enviarlos al API Gateway.
 */

// ── Tipos de Schema ────────────────────────────────────────────────────────

type SchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

interface SchemaProperty {
  type: SchemaType | SchemaType[];
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: 'email' | 'date' | 'date-time' | 'uuid' | 'uri';
  enum?: any[];
  description?: string;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
}

interface JsonSchema {
  $id: string;
  type: 'object';
  description: string;
  properties: Record<string, SchemaProperty>;
  required: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ── JSON Schemas ────────────────────────────────────────────────────────────

const TICKET_SCHEMA: JsonSchema = {
  $id: 'ticket',
  type: 'object',
  description: 'Schema para crear/actualizar un ticket',
  properties: {
    group_id:    { type: 'string', required: true, format: 'uuid', description: 'ID del grupo' },
    titulo:      { type: 'string', required: true, minLength: 3, maxLength: 200, description: 'Título del ticket' },
    descripcion: { type: 'string', maxLength: 5000, description: 'Descripción detallada' },
    status:      { type: 'string', required: true, enum: ['pendiente', 'en_progreso', 'revision', 'hecho', 'bloqueado'], description: 'Estado del ticket' },
    prioridad:   { type: 'string', required: true, enum: ['critica', 'alta', 'media_alta', 'media', 'media_baja', 'baja', 'minima'], description: 'Prioridad' },
    asignado_a:  { type: ['string', 'null'], format: 'uuid', description: 'ID del usuario asignado' },
    creado_por:  { type: 'string', required: true, format: 'uuid', description: 'ID del creador' },
    fecha_limite: { type: ['string', 'null'], format: 'date-time', description: 'Fecha límite del ticket' },
  },
  required: ['group_id', 'titulo', 'status', 'prioridad', 'creado_por', 'fecha_limite'],
};

const TICKET_UPDATE_SCHEMA: JsonSchema = {
  $id: 'ticket-update',
  type: 'object',
  description: 'Schema para actualización parcial de ticket',
  properties: {
    titulo:       { type: 'string', minLength: 3, maxLength: 200 },
    descripcion:  { type: 'string', maxLength: 5000 },
    status:       { type: 'string', enum: ['pendiente', 'en_progreso', 'revision', 'hecho', 'bloqueado'] },
    prioridad:    { type: 'string', enum: ['critica', 'alta', 'media_alta', 'media', 'media_baja', 'baja', 'minima'] },
    asignado_a:   { type: ['string', 'null'], format: 'uuid' },
    fecha_limite:  { type: ['string', 'null'], format: 'date-time' },
    updated_at:   { type: 'string', format: 'date-time' },
  },
  required: [],
};

const GROUP_SCHEMA: JsonSchema = {
  $id: 'group',
  type: 'object',
  description: 'Schema para crear/actualizar un grupo',
  properties: {
    nombre:      { type: 'string', required: true, minLength: 2, maxLength: 100, description: 'Nombre del grupo' },
    descripcion: { type: 'string', maxLength: 1000, description: 'Descripción del grupo' },
    llm_model:   { type: 'string', maxLength: 50, description: 'Modelo LLM asociado' },
    color:       { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: 'Color en formato hex' },
    created_by:  { type: 'string', format: 'uuid' },
  },
  required: ['nombre'],
};

const PROFILE_SCHEMA: JsonSchema = {
  $id: 'profile',
  type: 'object',
  description: 'Schema para actualizar perfil de usuario',
  properties: {
    usuario:          { type: 'string', minLength: 2, maxLength: 50 },
    nombre_completo:  { type: 'string', minLength: 2, maxLength: 100 },
    telefono:         { type: 'string', maxLength: 20 },
    direccion:        { type: 'string', maxLength: 200 },
    fecha_nacimiento: { type: 'string' },
    permissions:      { type: 'array' },
  },
  required: [],
};

const COMMENT_SCHEMA: JsonSchema = {
  $id: 'comment',
  type: 'object',
  description: 'Schema para agregar un comentario',
  properties: {
    ticket_id: { type: 'string', required: true, format: 'uuid' },
    user_id:   { type: 'string', required: true, format: 'uuid' },
    user_name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    text:      { type: 'string', required: true, minLength: 1, maxLength: 5000 },
  },
  required: ['ticket_id', 'user_id', 'user_name', 'text'],
};

const GROUP_MEMBER_SCHEMA: JsonSchema = {
  $id: 'group-member',
  type: 'object',
  description: 'Schema para agregar/actualizar miembro de grupo',
  properties: {
    group_id:    { type: 'string', required: true, format: 'uuid' },
    user_id:     { type: 'string', required: true, format: 'uuid' },
    permissions: { type: 'array' },
  },
  required: ['group_id', 'user_id'],
};

// ── Registro de Schemas ─────────────────────────────────────────────────────

const SCHEMAS: Record<string, JsonSchema> = {
  'ticket':        TICKET_SCHEMA,
  'ticket-update': TICKET_UPDATE_SCHEMA,
  'group':         GROUP_SCHEMA,
  'profile':       PROFILE_SCHEMA,
  'comment':       COMMENT_SCHEMA,
  'group-member':  GROUP_MEMBER_SCHEMA,
};

// ── Servicio ────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class JsonSchemaValidatorService {

  /**
   * Valida un objeto contra un schema registrado.
   */
  validate(schemaName: string, data: any): ValidationResult {
    const schema = SCHEMAS[schemaName];
    if (!schema) {
      return { valid: false, errors: [{ field: '_schema', message: `Schema "${schemaName}" no encontrado.` }] };
    }

    const errors: ValidationError[] = [];

    // Verificar campos requeridos
    for (const reqField of schema.required) {
      const value = data[reqField];
      if (value === undefined || value === null || value === '') {
        const prop = schema.properties[reqField];
        // Permitir null si el tipo incluye 'null'
        if (value === null && prop?.type && (Array.isArray(prop.type) && prop.type.includes('null'))) {
          continue;
        }
        errors.push({
          field: reqField,
          message: `El campo "${reqField}" es obligatorio.`,
          value,
        });
      }
    }

    // Validar propiedades individuales
    for (const [key, value] of Object.entries(data)) {
      const prop = schema.properties[key];
      if (!prop) continue; // Ignorar campos no definidos en el schema

      // Saltar si es null y el tipo lo permite
      if (value === null) {
        if (Array.isArray(prop.type) && prop.type.includes('null')) continue;
        if (prop.required) {
          errors.push({ field: key, message: `"${key}" no puede ser null.`, value });
        }
        continue;
      }

      // Verificar tipo
      if (value !== undefined && value !== null) {
        const expectedTypes = Array.isArray(prop.type) ? prop.type : [prop.type];
        const actualType = typeof value === 'object' && Array.isArray(value) ? 'array' : typeof value;
        if (!expectedTypes.includes(actualType as SchemaType)) {
          errors.push({ field: key, message: `"${key}" debe ser de tipo ${expectedTypes.join(' | ')}, pero es ${actualType}.`, value });
          continue;
        }
      }

      // Validaciones de string
      if (typeof value === 'string') {
        if (prop.minLength !== undefined && value.length < prop.minLength) {
          errors.push({ field: key, message: `"${key}" debe tener al menos ${prop.minLength} caracteres.`, value });
        }
        if (prop.maxLength !== undefined && value.length > prop.maxLength) {
          errors.push({ field: key, message: `"${key}" no puede exceder ${prop.maxLength} caracteres.`, value });
        }
        if (prop.pattern) {
          const regex = new RegExp(prop.pattern);
          if (!regex.test(value)) {
            errors.push({ field: key, message: `"${key}" no cumple con el formato requerido.`, value });
          }
        }
        if (prop.format === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push({ field: key, message: `"${key}" debe ser un email válido.`, value });
          }
        }
        if (prop.format === 'date-time') {
          const d = new Date(value);
          if (isNaN(d.getTime())) {
            errors.push({ field: key, message: `"${key}" debe ser una fecha válida en formato ISO.`, value });
          }
        }
        if (prop.enum && !prop.enum.includes(value)) {
          errors.push({ field: key, message: `"${key}" debe ser uno de: ${prop.enum.join(', ')}.`, value });
        }
      }

      // Validaciones numéricas
      if (typeof value === 'number') {
        if (prop.minimum !== undefined && value < prop.minimum) {
          errors.push({ field: key, message: `"${key}" debe ser al menos ${prop.minimum}.`, value });
        }
        if (prop.maximum !== undefined && value > prop.maximum) {
          errors.push({ field: key, message: `"${key}" no puede exceder ${prop.maximum}.`, value });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Valida y lanza error si los datos no son válidos.
   */
  validateOrThrow(schemaName: string, data: any): void {
    const result = this.validate(schemaName, data);
    if (!result.valid) {
      const messages = result.errors.map(e => `${e.field}: ${e.message}`).join('; ');
      throw new Error(`Validación fallida [${schemaName}]: ${messages}`);
    }
  }

  /**
   * Retorna los schemas disponibles.
   */
  getSchemaNames(): string[] {
    return Object.keys(SCHEMAS);
  }

  /**
   * Obtiene un schema por nombre.
   */
  getSchema(name: string): JsonSchema | undefined {
    return SCHEMAS[name];
  }
}
