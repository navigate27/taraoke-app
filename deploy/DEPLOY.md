# Deploy Taraoke to Oracle Cloud (Always Free, ARM A1 + Ubuntu)

One Node process serves the app (static build + WebSockets + stream proxy);
Caddy fronts it with automatic HTTPS. No database.

Assumptions: subdomain `karaoke.example.com` on Cloudflare (grey cloud / DNS-only),
app lives at `/opt/taraoke` on the VM, SSH user `ubuntu`.

## 1. Oracle console (one-time)

1. Sign up at <https://oracle.com/cloud/free> (card required, no charges).
   Pick the home region closest to you — it cannot be changed later.
2. Create instance → **Ampere A1** shape `VM.Standard.A1.Flex`, **2 OCPU / 12 GB**
   (always free), image **Ubuntu 24.04**, add your SSH public key. ~50 GB boot volume.
3. Note the **public IP address**.

## 2. Open ports (two layers — both required)

**VCN security list** (Console → Networking → your VCN → Security Lists →
Default Security List → Add Ingress Rule):
- Source CIDR `0.0.0.0/0`, IP protocol `TCP`, destination port `80`
- Same again for port `443`

**Instance firewall** (Oracle's Ubuntu images ship with a catch-all REJECT):

```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

## 3. Install runtime

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs caddy git
sudo npm install -g pnpm
```

## 4. Get the code + build

The Forgejo repos are private — easiest is to `git clone` over SSH, or `rsync`
the repo from your machine:

```bash
# from your machine
rsync -a --exclude node_modules --exclude dist \
  ~/Documents/bruno/kr/ ubuntu@VM_IP:/opt/taraoke/
```

Then on the VM:

```bash
cd /opt/taraoke
pnpm install --frozen-lockfile
pnpm build          # outputs dist/
cp deploy/.env.example .env   # then edit: set LASTFM_API_KEY
chmod 600 .env
```

## 5. Run the app as a service

```bash
sudo cp deploy/taraoke.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now taraoke
curl -s localhost:3001/api/health   # → {"ok":true}
```

## 6. Caddy (reverse proxy + automatic TLS)

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/karaoke.example.com/YOUR.SUBDOMAIN.TLD/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy obtains the Let's Encrypt cert automatically once DNS points at the VM.

## 7. Cloudflare DNS

Add an **A record**: `karaoke` → VM public IP, **DNS only (grey cloud)**.
Wait for propagation, then open `https://YOUR.SUBDOMAIN.TLD` — the app should load.

## Updating

```bash
rsync ... (or git pull)
cd /opt/taraoke && pnpm install --frozen-lockfile && pnpm build
sudo systemctl restart taraoke
```

Note: restarting the app wipes active rooms (in-memory state, by design).

## Notes

- Only secret: `LASTFM_API_KEY` (suggestions/trending). No YouTube key, no DB.
- Stream bandwidth: ~2–4 Mbps flows through the VM while a song plays.
- Free-tier A1 capacity is often unavailable in popular regions — retry instance
  creation at off-peak hours, or try a different AD within the region.