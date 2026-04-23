# Express server modules

Node **handlers and libraries** for `index.js` (API routes, internal jobs). Angular lives under `src/`; this tree is server-only.

| Directory | Contents |
|-----------|----------|
| **`lib/`** | Shared utilities: Firestore Admin (`admin-firestore.js`, `firebase-admin-init.js`), auth helpers (`auth-claims.js`, `auth-display-names.js`), `contest-internal-auth.js` (env / file secret resolution), `stats-aggregate.js`, rate-limit primitives (`client-ip.js`, `in-memory-rate-limit.js`), `firestore-timestamp-iso.js`. |
| **`middleware/`** | `require-auth.js`, `require-admin.js`, `request-id.middleware.js`, `rate-limit-hooks.middleware.js`. |
| **`contests/`** | Weekly contests: join/read/checkout/scoring/transition HTTP handlers, public mapping, transition matrix, blocking-entry guard. |
| **`leaderboards/`** | Leaderboard HTTP API, query helpers, snapshot rebuild job, email-verified filtering. |
| **`gameplay/`** | `POST /api/v1/me/gameplay-events` and gameplay event logging. |
| **`admin/`** | Admin dashboard HTTP (`admin-contests`, `admin-users`). |
| **`payments/`** | Stripe client (`stripe-server.js`), `POST .../webhooks/stripe` (`stripe-webhook.http.js`). |

Co-located tests: `**/*.test.js` anywhere under `server/` (see `npm run test:server` in root `package.json`).
