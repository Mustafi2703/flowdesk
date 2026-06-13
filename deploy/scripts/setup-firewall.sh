#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/scripts/setup-firewall.sh"
  exit 1
fi

ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# SSH: change 22 if your droplet uses a custom SSH port.
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"

# Keep Postgres/Redis/API private on loopback via docker-compose port bindings.
ufw --force enable
ufw status verbose
