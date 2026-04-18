import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import config from './config/supabase.js';

// Microservicios locales eliminados: ahora usamos http-proxy-middleware para enrutar a los puertos.


const app = express();

app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:4201'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Prefer', 'apikey'],
}));

app.use(express.json({ limit: '5mb' }));

// ============================================================================
// 1. RATE LIMITING (Control de Tráfico en el Gateway)
// ============================================================================

const readLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  message: { error: 'Rate limit excedido', message: 'Demasiadas peticiones de lectura (max 60/min).' }
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  message: { error: 'Rate limit excedido', message: 'Demasiadas peticiones de escritura (max 20/min).' }
});

const deleteLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10,
  message: { error: 'Rate limit excedido', message: 'Demasiadas peticiones de eliminación (max 10/min).' }
});


app.use((req, res, next) => {
  if (req.method === 'GET') return readLimiter(req, res, next);
  if (req.method === 'POST' || req.method === 'PATCH') return writeLimiter(req, res, next);
  if (req.method === 'DELETE') return deleteLimiter(req, res, next);
  next();
});



const SCHEMAS = {
  'tickets': {
    required: ['group_id', 'titulo', 'status', 'prioridad', 'creado_por'],
    properties: {
      group_id: { type: 'string', minLength: 10 },
      titulo: { type: 'string', minLength: 3, maxLength: 200 },
      status: { type: 'string', enum: ['pendiente', 'en_progreso', 'revision', 'hecho', 'bloqueado'] },
      prioridad: { type: 'string', enum: ['critica', 'alta', 'media_alta', 'media', 'media_baja', 'baja', 'minima'] },
    }
  },
  'groups': {
    required: ['nombre'],
    properties: {
      nombre: { type: 'string', minLength: 2, maxLength: 100 },
      color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
    }
  },
  'profiles': {
    required: [],
    properties: {
      nombre_completo: { type: 'string', minLength: 2, maxLength: 100 },
    }
  }
};

const schemaValidator = (req, res, next) => {
  // Solo validamos peticiones que mutan datos
  if (req.method !== 'POST' && req.method !== 'PATCH') return next();

  // Extraer el nombre del recurso de la URL (ej: /api/tickets -> tickets)
  const resource = req.path.split('/')[2];
  const schema = SCHEMAS[resource];

  // Si no hay schema estricto, dejamos pasar al microservicio
  if (!schema) return next();

  const body = Array.isArray(req.body) ? req.body : [req.body];
  const errors = [];

  for (let item of body) {
    if (req.method === 'POST') {
      for (const field of schema.required) {
        if (item[field] === undefined || item[field] === null || item[field] === '') {
          errors.push({ field, message: `El campo "${field}" es obligatorio.` });
        }
      }
    }

    for (const [key, value] of Object.entries(item)) {
      const prop = schema.properties[key];
      if (!prop || value === null) continue;
      if (typeof value === 'string') {
        if (prop.minLength && value.length < prop.minLength) errors.push({ field: key, message: `"${key}" mínimo ${prop.minLength} caracteres.` });
        if (prop.maxLength && value.length > prop.maxLength) errors.push({ field: key, message: `"${key}" máximo ${prop.maxLength} caracteres.` });
        if (prop.enum && !prop.enum.includes(value)) errors.push({ field: key, message: `"${key}" debe ser uno de: ${prop.enum.join(', ')}.` });
        if (prop.pattern && !new RegExp(prop.pattern).test(value)) errors.push({ field: key, message: `"${key}" formato inválido.` });
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validación de JSON Schema fallida en el API Gateway', details: errors });
  }

  next();
};

app.use(schemaValidator);

// ============================================================================
// 3. AUTHENTICATION (Extracción y verificación de JWT)
// ============================================================================

const authMiddleware = (req, res, next) => {
  // Ignorar validación de token en health check
  if (req.path === '/api/health') return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido por el API Gateway' });
  }

  req.userToken = authHeader.split(' ')[1];
  next();
};

app.use('/api', authMiddleware);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'API Gateway', timestamp: new Date().toISOString() });
});

// ============================================================================
// 4. ENRUTAMIENTO HACIA MICROSERVICIOS INDEPENDIENTES (Reverse Proxy)
// ============================================================================
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

// Configuración común para preservar el body (ya que express.json() lo consumió)
const proxyOptions = (target) => ({
  target,
  changeOrigin: true,
  on: { proxyReq: fixRequestBody },
});

// Tickets -> Puerto 3001 (Fastify)
app.use(createProxyMiddleware({
  ...proxyOptions('http://localhost:3001'),
  pathFilter: ['/api/tickets', '/api/ticket_comments', '/api/ticket_history']
}));

// Groups -> Puerto 3002 (Express)
app.use(createProxyMiddleware({
  ...proxyOptions('http://localhost:3002'),
  pathFilter: ['/api/groups', '/api/group_members']
}));

// Users -> Puerto 3003 (Express)
app.use(createProxyMiddleware({
  ...proxyOptions('http://localhost:3003'),
  pathFilter: ['/api/profiles']
}));

// 404
app.use('/api/*', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Iniciar servidor
app.listen(config.port, () => {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log(`║   🚀 API Gateway corriendo en puerto ${config.port}           ║`);
  console.log('║                                                  ║');
  console.log('║   ✔ Rate Limiter ACTIVO en el Gateway            ║');
  console.log('║   ✔ JSON Schema Validator ACTIVO en el Gateway   ║');
  console.log('║                                                  ║');
  console.log('║   Enrutando a Microservicios:                    ║');
  console.log('║     → Tickets (ticket-service)                   ║');
  console.log('║     → Groups  (group-service)                    ║');
  console.log('║     → Users   (user-service)                     ║');
  console.log('╚══════════════════════════════════════════════════╝');
});
