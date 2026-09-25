# Taraoke deploy assets (Oracle Cloud free tier, ARM A1 Ubuntu)
#
# Layout on the VM:
#   /opt/taraoke            this repo (git clone or rsync)
#   /opt/taraoke/.env       secrets (LASTFM_API_KEY) — never committed
#   Caddy                   public :80/:443 → 127.0.0.1:3001 (auto TLS)
#   systemd units           taraoke.service (app), caddy (Caddy)
#
# See DEPLOY.md in this directory for the full step-by-step.