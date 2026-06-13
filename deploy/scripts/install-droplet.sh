#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/scripts/install-droplet.sh"
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx ufw fail2ban jq

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" >/etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker nginx fail2ban

mkdir -p /opt/scrumfolks-tms /var/backups/scrumfolks-tms
chown -R "${SUDO_USER:-root}:${SUDO_USER:-root}" /opt/scrumfolks-tms /var/backups/scrumfolks-tms

echo "Install complete."
echo "Next: clone repo to /opt/scrumfolks-tms, create backend/.env, run setup-firewall.sh, then deploy.sh."
