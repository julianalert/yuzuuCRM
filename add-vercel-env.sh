#!/bin/bash
# Run this after: vercel login && vercel link
# Usage: bash add-vercel-env.sh

ENV_FILE=".env.local"

while IFS='=' read -r key value; do
  # Skip comments and blank lines
  [[ "$key" =~ ^#.*$ ]] && continue
  [[ -z "$key" ]] && continue

  # Strip inline comments from value
  value="${value%%#*}"
  # Strip surrounding quotes
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  # Trim whitespace
  value="$(echo "$value" | xargs)"

  echo "Adding $key..."
  echo "$value" | npx vercel env add "$key" production --force
done < "$ENV_FILE"

echo "Done! Trigger a new deployment: npx vercel --prod"
