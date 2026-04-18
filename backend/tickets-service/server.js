import Fastify from 'fastify';
import fetch from 'node-fetch';
import config from '../config/supabase.js';

const fastify = Fastify({ logger: true });

function supabaseHeaders(request, extra = {}) {
  // Extraer el token que nos pasa el API Gateway
  const authHeader = request.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  
  return {
    'apikey': config.supabaseKey,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Helper para armar URL con query params
function buildUrl(resource, query) {
  const url = new URL(`${config.restBaseUrl}/${resource}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

// ── RUTAS ───────────────────────────────────────────────────────────────────

fastify.get('/api/:resource', async (request, reply) => {
  const { resource } = request.params;
  if (!['tickets', 'ticket_comments', 'ticket_history'].includes(resource)) {
    return reply.callNotFound();
  }

  try {
    const url = buildUrl(resource, request.query);
    const headers = supabaseHeaders(request);
    if (request.headers.accept) headers['Accept'] = request.headers.accept;

    const response = await fetch(url, { headers });
    const data = await response.json();
    return reply.code(response.status).send(data);
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Error interno del servidor (Fastify)' });
  }
});

fastify.post('/api/:resource', async (request, reply) => {
  const { resource } = request.params;
  if (!['tickets', 'ticket_comments', 'ticket_history'].includes(resource)) {
    return reply.callNotFound();
  }

  try {
    const response = await fetch(`${config.restBaseUrl}/${resource}`, {
      method: 'POST',
      headers: supabaseHeaders(request, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(request.body),
    });
    const data = await response.json();
    return reply.code(response.status).send(data);
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Error interno del servidor (Fastify)' });
  }
});

fastify.patch('/api/:resource', async (request, reply) => {
  const { resource } = request.params;
  if (resource !== 'tickets') return reply.callNotFound();

  try {
    const url = buildUrl(resource, request.query);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: supabaseHeaders(request, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(request.body),
    });
    const data = await response.json();
    return reply.code(response.status).send(data);
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Error interno del servidor (Fastify)' });
  }
});

fastify.delete('/api/:resource', async (request, reply) => {
  const { resource } = request.params;
  if (resource !== 'tickets') return reply.callNotFound();

  try {
    const url = buildUrl(resource, request.query);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: supabaseHeaders(request),
    });
    return reply.code(response.status).send();
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: 'Error interno del servidor (Fastify)' });
  }
});

// ── INICIO DEL SERVIDOR ─────────────────────────────────────────────────────

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('✅ Tickets Service (Fastify) escuchando en puerto 3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
