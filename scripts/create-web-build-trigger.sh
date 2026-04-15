#!/usr/bin/env bash
# Create a Cloud Build trigger that builds with this repo's cloudbuild.yaml (Firebase build-args),
# not Cloud Run's Dockerfile-only autodetect (which omits --build-arg FIREBASE_*).
#
# Prerequisite: GitHub connected in Cloud Build (Repositories) — note the connection *region*.
#
# Usage:
#   export GCP_PROJECT_ID=your-project
#   export CB_REGION=us-central1                    # region of the GitHub connection (not necessarily Cloud Run)
#   export GITHUB_CONNECTION=your-connection-name   # Cloud Build → Repositories → Connection name
#   export GITHUB_REPO=owner-repo                   # Repository id shown in Cloud Build (often "owner-repo")
#   ./scripts/create-web-build-trigger.sh
#
# Optional: TRIGGER_NAME (default: roster-riddles-web-main), BRANCH_PATTERN (default: ^main$)
#
# After create: open the trigger → Substitution variables → set all _FIREBASE_* (and optional _STRIPE_PUBLISHABLE_KEY).
#
# Update an existing trigger to use cloudbuild.yaml:
#   gcloud builds triggers update TRIGGER_ID \
#     --project="$GCP_PROJECT_ID" --region="$CB_REGION" \
#     --build-config=cloudbuild.yaml \
#     --branch-pattern='^main$'

set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${CB_REGION:?Set CB_REGION (GitHub connection region)}"
: "${GITHUB_CONNECTION:?Set GITHUB_CONNECTION}"
: "${GITHUB_REPO:?Set GITHUB_REPO (repository resource name segment)}"

TRIGGER_NAME="${TRIGGER_NAME:-roster-riddles-web-main}"
BRANCH_PATTERN="${BRANCH_PATTERN:-^main$}"

REPO_RESOURCE="projects/${GCP_PROJECT_ID}/locations/${CB_REGION}/connections/${GITHUB_CONNECTION}/repositories/${GITHUB_REPO}"

exec gcloud builds triggers create github \
  --project="${GCP_PROJECT_ID}" \
  --name="${TRIGGER_NAME}" \
  --region="${CB_REGION}" \
  --repository="${REPO_RESOURCE}" \
  --branch-pattern="${BRANCH_PATTERN}" \
  --build-config=cloudbuild.yaml
