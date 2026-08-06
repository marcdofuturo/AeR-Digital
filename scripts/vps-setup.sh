#!/bin/bash
# AeR Digital — VPS Setup Script (Hostinger, Ubuntu 24.04)
set -euo pipefail

echo "=== AeR Digital VPS Setup ==="
echo "Phase 1: System updates + Docker"

# Update system
apt-get update -qq && apt-get upgrade -y -qq

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt-get install -y -qq docker-compose-plugin

# Start Docker
systemctl enable docker
systemctl start docker

echo "Phase 2: Firewall (UFW)"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp
ufw --force enable
ufw status verbose

echo "Phase 3: Create app directory"
mkdir -p /opt/ar-digital
cd /opt/ar-digital

echo "Phase 4: Docker network"
docker network create ar-net 2>/dev/null || true

echo "=== Setup complete ==="
docker --version
docker compose version
