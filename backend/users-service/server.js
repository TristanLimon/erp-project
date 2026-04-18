import express from 'express';
import fetch from 'node-fetch';
import config from '../config/supabase.js';

const app = express();
app.use(express.json());

function supabaseHeaders(req, extra = {}) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  
  return {
    'apikey': config.supabaseKey,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

app.get('/api/:resource(profiles)', async (req, res) => {
  try {
    const url = new URL(`${config.restBaseUrl}/${req.params.resource}`);
    for (const [key, value] of Object.entries(req.query)) url.searchParams.set(key, String(value));

    const headers = supabaseHeaders(req);
    if (req.headers.accept) headers['Accept'] = req.headers.accept;

    const response = await fetch(url.toString(), { headers });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno (Users Express)' });
  }
});

app.patch('/api/:resource(profiles)', async (req, res) => {
  try {
    const url = new URL(`${config.restBaseUrl}/${req.params.resource}`);
    for (const [key, value] of Object.entries(req.query)) url.searchParams.set(key, String(value));

    const response = await fetch(url.toString(), {
      method: 'PATCH',
      headers: supabaseHeaders(req, { 'Prefer': 'return=representation' }),
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno (Users Express)' });
  }
});

app.delete('/api/:resource(profiles)', async (req, res) => {
  try {
    const url = new URL(`${config.restBaseUrl}/${req.params.resource}`);
    for (const [key, value] of Object.entries(req.query)) url.searchParams.set(key, String(value));

    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: supabaseHeaders(req),
    });
    res.status(response.status).end();
  } catch (err) {
    res.status(500).json({ error: 'Error interno (Users Express)' });
  }
});

app.listen(3003, () => {
  console.log('✅ Users Service (Express) escuchando en puerto 3003');
});
