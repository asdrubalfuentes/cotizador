#!/usr/bin/env bash
set -euo pipefail

# Monolithic VPS deployment (backend + frontend by Node)
# Requirements: ssh, scp, tar on local; sshd + Node/npm on VPS; optional pm2.

CFG_FILE="${1:-deploy.vps.json}"
if [[ ! -f "$CFG_FILE" ]]; then
  echo "No se encontró $CFG_FILE. Copia deploy.vps.example.json a deploy.vps.json y edítalo." >&2
  exit 1
fi

host=$(jq -r .host "$CFG_FILE")
port=$(jq -r .port "$CFG_FILE")
user=$(jq -r .username "$CFG_FILE")
key=$(jq -r .privateKey "$CFG_FILE")
deployPath=$(jq -r .deployPath "$CFG_FILE")
backendPort=$(jq -r .backendPort "$CFG_FILE")

tmpfile=$(mktemp -t cotizador-XXXXXX.tgz)
tar -czf "$tmpfile" \
  --exclude=node_modules \
  --exclude=frontend/node_modules \
  --exclude=.git \
  --exclude=release \
  --exclude=.env \
  --exclude=outputs \
  --exclude=backend/outputs \
  .

IDENTITY_ARGS=()
if [[ "$key" != "null" && -n "$key" ]]; then
  IDENTITY_ARGS=(-i "$key")
fi

scp -P "$port" "${IDENTITY_ARGS[@]}" "$tmpfile" "$user@$host:/tmp/$(basename "$tmpfile")"

ENV_CONTENT=$(jq -r '.env | to_entries[] | "\(.key)=\(.value)"' "$CFG_FILE" | sed 's/\r$//' | sed "s/'/'\\''/g")

ssh -p "$port" "${IDENTITY_ARGS[@]}" "$user@$host" "bash -lc '
  set -e
  mkdir -p "$deployPath"
  tar -xzf "/tmp/$(basename "$tmpfile")" -C "$deployPath"
  rm -f "/tmp/$(basename "$tmpfile")"
  cd "$deployPath"
  command -v node >/dev/null || echo "[WARN] Node.js no encontrado en el VPS. Instálalo."
  command -v npm >/dev/null || echo "[WARN] npm no encontrado en el VPS."
  npm ci
  cd frontend && npm ci && npm run build && cd ..
  printf "%s\n" '$ENV_CONTENT' > .env
  if ! command -v pm2 >/dev/null; then npm i -g pm2; fi
  pm2 start backend/server.js --name cotizador --update-env || pm2 restart cotizador --update-env
  pm2 save || true
'"

echo "Despliegue completado. Revisa pm2 status en el VPS."
