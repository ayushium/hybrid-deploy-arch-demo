#!/bin/bash
# Pasted into the EC2 Launch Template's user-data field.
#
# Reliability rules for this script, learned the hard way:
#   - one runtime dependency (mysql2), so npm has little to get wrong
#   - public repo, so no credentials are needed at boot
#   - idempotent schema, created by the app itself at startup
#   - systemd, so a crash restarts instead of failing the health check
#
# First place to look when an instance won't go healthy: /var/log/user-data.log
set -euxo pipefail
exec > >(tee /var/log/user-data.log) 2>&1

dnf install -y git
dnf install -y nodejs22 || dnf install -y nodejs20 || dnf install -y nodejs
npm i -g pnpm@9

REPO="https://github.com/<OWNER>/<REPO>"
git clone --depth 1 "$REPO" /opt/app
cd /opt/app

# --filter '...' installs and builds only the API and the packages it depends
# on, skipping React, Vite and Wrangler entirely. Saves ~60s per boot.
pnpm install --frozen-lockfile --filter "@campuswall/api..."
pnpm --filter "@campuswall/api..." build

cat >/etc/app.env <<'ENV'
DB_HOST=<RDS_ENDPOINT>
DB_USER=admin
DB_PASS=<RDS_PASSWORD>
DB_NAME=campuswall
PORT=3000
STRESS_ENABLED=true
ENV
chmod 600 /etc/app.env

cat >/etc/systemd/system/campuswall.service <<'UNIT'
[Unit]
Description=Campus Wall API
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=/etc/app.env
WorkingDirectory=/opt/app/apps/api
ExecStart=/usr/bin/node /opt/app/apps/api/dist/server.js
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now campuswall
