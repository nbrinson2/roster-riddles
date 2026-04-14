import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { requireFirebaseAuth } from './server/require-auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

const MLB_API = 'https://statsapi.mlb.com/api/v1';

/** Public — load balancers / uptime checks */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API routes (must be registered before static / SPA fallback)

/** Public — MLB proxy (game works when logged out) */
app.get('/api/v1/mlb/people/:id', async (req, res, next) => {
  try {
    const url = `${MLB_API}/people/${encodeURIComponent(req.params.id)}`;
    const r = await fetch(url);
    const body = await r.text();
    res.status(r.status).type('application/json').send(body);
  } catch (err) {
    next(err);
  }
});

/**
 * Protected — verifies Firebase ID token (Bearer). Example for Story 5; attach `requireFirebaseAuth`
 * to future contest/score routes the same way.
 */
app.get('/api/v1/me', requireFirebaseAuth, (req, res) => {
  res.status(200).json({
    uid: req.user.uid,
    email: req.user.email,
    emailVerified: req.user.emailVerified,
  });
});

// Serve static files from the Angular app
const distPath = join(__dirname, 'dist/roster-riddles/browser');
app.use('/', express.static(distPath));

// SPA fallback - serve index.html for any route not found
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(join(distPath, 'index.html'));
  }
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
});