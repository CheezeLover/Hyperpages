#!/usr/bin/env bash
# Hyperset — one-shot setup script
# Run this once on a fresh Debian 12+ machine after cloning the repo.
set -euo pipefail

# Load environment variables from .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# ============================================================================
# Generate secure random secrets on first run (idempotent)
# ============================================================================
generate_secrets() {
  local env_file=".env"
  local changed=false

  # Helper: generate or keep a value in .env
  # Usage: ensure_secret KEY "placeholder-pattern" "openssl rand -hex 32"
  ensure_secret() {
    local key="$1"
    local placeholder_pattern="$2"
    local generate_cmd="$3"
    local current_val="${!key:-}"

    if [ -z "$current_val" ] || echo "$current_val" | grep -qiE "$placeholder_pattern"; then
      local new_val
      new_val=$(eval "$generate_cmd")
      if [ -f "$env_file" ]; then
        if grep -q "^${key}=" "$env_file"; then
          sed -i "s|^${key}=.*|${key}=${new_val}|" "$env_file"
        else
          echo "" >> "$env_file"
          echo "${key}=${new_val}" >> "$env_file"
        fi
        echo "==> Generated new ${key} (saved to $env_file)"
        changed=true
      else
        echo "WARNING: .env file not found. Cannot save ${key}."
      fi
    else
      echo "==> Using existing ${key} from $env_file"
    fi
  }

  ensure_secret AUTH_CRYPTO_KEY          "^CHANGE_ME" "openssl rand -hex 32"
  ensure_secret PORTAL_DATABASE_PASSWORD "^CHANGE_ME" "openssl rand -hex 32"

  if [ "$changed" = true ]; then
    export $(grep -v '^#' "$env_file" | xargs)
    echo ""
    echo "   IMPORTANT: Back up your .env file — these secrets cannot be recovered!"
    echo ""
  fi
}

# Run secret generation
generate_secrets

echo "==> Installing Podman and podman-compose..."
sudo apt-get update -qq
sudo apt-get install -y podman podman-compose

echo "==> Checking versions..."
podman --version
podman-compose --version

echo "==> Creating internal network (hyperset-net)..."
podman network exists hyperset-net || podman network create hyperset-net

# Always deploy with both compose files:
#   podman-compose.data.yml — stateful backends (portal-db)
#   podman-compose.yml      — application services (portal, Caddy, pages)
COMPOSE_FILES="-f podman-compose.data.yml -f podman-compose.yml"

# Use Docker image format so HEALTHCHECK instructions are preserved in all images.
# OCI format (Podman's default) silently drops HEALTHCHECK, which breaks
# depends_on: condition: service_healthy in podman-compose.
export BUILDAH_FORMAT=docker

echo "==> Building images and starting all services..."
cd "$(dirname "$0")"

# Check if containers already exist (e.g., after git pull with config changes)
if podman-compose $COMPOSE_FILES ps -q 2>/dev/null | grep -q .; then
  echo "   Existing containers found. Performing clean restart to reload config files..."
  podman-compose $COMPOSE_FILES down
fi

podman-compose $COMPOSE_FILES up --build --force-recreate -d

echo ""
echo "✓ Hyperset is starting up!"
echo ""
echo "  Next steps:"
echo "  1. Add DNS entries to your client machine's hosts file:"
echo "       <this-server-ip>  \${HYPERSET_DOMAIN:-hyperset.internal}"
echo "       <this-server-ip>  auth.\${HYPERSET_DOMAIN:-hyperset.internal}"
echo "       <this-server-ip>  pages.\${HYPERSET_DOMAIN:-hyperset.internal}"
echo ""
echo "  2. Register your first account at:"
echo "       https://auth.\${HYPERSET_DOMAIN:-hyperset.internal}"
echo ""
echo "  3. Open the portal at:"
echo "       https://\${HYPERSET_DOMAIN:-hyperset.internal}"
echo ""
echo "  Run 'podman-compose $COMPOSE_FILES logs -f' to watch live logs."
podman-compose $COMPOSE_FILES logs -f
