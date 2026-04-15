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

ENV DEPLOYMENT=$DEPLOYMENT \
    FIREBASE_API_KEY=$FIREBASE_API_KEY \
    FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN \
    FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID \
    FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET \
    FIREBASE_MESSAGING_SENDER_ID=$FIREBASE_MESSAGING_SENDER_ID \
    FIREBASE_APP_ID=$FIREBASE_APP_ID \
    FIREBASE_MEASUREMENT_ID=$FIREBASE_MEASUREMENT_ID \
    API_BASE_URL=$API_BASE_URL \
    STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY

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