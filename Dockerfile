# Stage 1: Build the Angular application
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Firebase + API config for the Angular bundle (set in Cloud Build / trigger per environment).
# Use separate triggers + substitution sets for production vs staging Firebase projects.
ARG DEPLOYMENT=production
ARG FIREBASE_API_KEY
ARG FIREBASE_AUTH_DOMAIN
ARG FIREBASE_PROJECT_ID
ARG FIREBASE_STORAGE_BUCKET
ARG FIREBASE_MESSAGING_SENDER_ID
ARG FIREBASE_APP_ID
ARG FIREBASE_MEASUREMENT_ID
ARG API_BASE_URL=
# Optional — Stripe publishable key for Angular (`pk_test_` staging / `pk_live` prod); see docs/stripe.md
ARG STRIPE_PUBLISHABLE_KEY=
# Express Admin SDK must use the same DB as the Angular client (`environment.firestoreDatabaseId`).
# Production: `roster-riddles`. Staging builds: pass empty so Express uses `(default)` (see server/admin-firestore.js).
ARG FIRESTORE_DATABASE_ID=roster-riddles
# Story AD-4 — Angular bundle: omit admin affordance when false (see scripts/generate-env-prod.mjs)
ARG ADMIN_DASHBOARD_UI_ENABLED=
# Story P5 / GL-C1 — Angular `contestsPaymentsEnabled` when `true` at build (`generate-env-prod.mjs`). Cloud Build passes `true` by default (`cloudbuild.yaml`); local Docker builds omitting this arg stay `false`.
ARG CONTESTS_PAYMENTS_ENABLED=false
# GL-C2 — dashed “simulated” strip / card copy. Prod: only when `true`; staging default handled in `generate-env-prod.mjs`. Empty = production live-oriented UX.
ARG SIMULATED_CONTESTS_UI_ENABLED=
# Optional — max signed-in session in days (`0`/`off` = none). See `generate-env-prod.mjs` / `AuthSessionExpiryService`.
ARG AUTH_SESSION_MAX_DAYS=

ENV DEPLOYMENT=$DEPLOYMENT \
    FIREBASE_API_KEY=$FIREBASE_API_KEY \
    FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN \
    FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID \
    FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET \
    FIREBASE_MESSAGING_SENDER_ID=$FIREBASE_MESSAGING_SENDER_ID \
    FIREBASE_APP_ID=$FIREBASE_APP_ID \
    FIREBASE_MEASUREMENT_ID=$FIREBASE_MEASUREMENT_ID \
    API_BASE_URL=$API_BASE_URL \
    STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY \
    FIRESTORE_DATABASE_ID=$FIRESTORE_DATABASE_ID \
    ADMIN_DASHBOARD_UI_ENABLED=$ADMIN_DASHBOARD_UI_ENABLED \
    CONTESTS_PAYMENTS_ENABLED=$CONTESTS_PAYMENTS_ENABLED \
    SIMULATED_CONTESTS_UI_ENABLED=$SIMULATED_CONTESTS_UI_ENABLED \
    AUTH_SESSION_MAX_DAYS=$AUTH_SESSION_MAX_DAYS

# Fail fast with a clear message if Cloud Build did not pass --build-arg (see cloudbuild.yaml + trigger substitutions)
RUN if [ -z "${FIREBASE_API_KEY:-}" ] || [ -z "${FIREBASE_PROJECT_ID:-}" ]; then \
  echo "ERROR: Firebase build-args are empty. Set Cloud Build substitution variables _FIREBASE_API_KEY, _FIREBASE_AUTH_DOMAIN, _FIREBASE_PROJECT_ID, _FIREBASE_STORAGE_BUCKET, _FIREBASE_MESSAGING_SENDER_ID, _FIREBASE_APP_ID on the trigger that runs this Dockerfile (and optional _FIREBASE_MEASUREMENT_ID, _API_BASE_URL)." >&2; \
  exit 1; \
fi

# Generate env file + Angular build (production or staging config)
RUN node scripts/generate-env-prod.mjs && \
    if [ "$DEPLOYMENT" = "staging" ]; then npx ng build --configuration staging; else npx ng build --configuration production; fi

# Stage 2: Serve the application
FROM node:20-alpine

WORKDIR /app

ARG FIRESTORE_DATABASE_ID=roster-riddles
ENV FIRESTORE_DATABASE_ID=$FIRESTORE_DATABASE_ID

# Copy package files for production dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy the built application from builder stage
COPY --from=builder /app/dist ./dist
COPY index.js .
COPY server ./server

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "index.js"] 