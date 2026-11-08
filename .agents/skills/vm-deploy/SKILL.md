---
name: vm-deploy
description: >-
  Deploy and update the Spotify & Anghami Toolkit application on the Oracle Cloud
  Ubuntu VM (152.67.91.217 / https://toolify.ddns.net) using SSH, 2GB Swap protection,
  Nginx static asset serving (Option A), and PM2 process management. Use this skill
  whenever the user asks to deploy, update, check status, or promote branches on the VM.
---

# Oracle Cloud VM Deployment Skill (`vm-deploy`)

This skill automates deploying and updating **Spotify & Anghami Toolkit** on the Oracle Cloud Ubuntu VM (`ubuntu@152.67.91.217`, domain `https://toolify.ddns.net`).

---

## 1. Production Architecture Overview (Option A)

| Component | Configuration |
| :--- | :--- |
| **Cloud Host** | Oracle Cloud `VM.Standard.E2.1.Micro` (`152.67.91.217`, Ubuntu 20.04, 1 GB RAM + 2 GB `/swapfile`) |
| **Domain & SSL** | `https://toolify.ddns.net` (No-IP DDNS `A` record $\rightarrow$ `152.67.91.217`, Let's Encrypt Certbot SSL) |
| **SSH Key** | `C:\Users\moham\OneDrive\Desktop\spotifytoolkit2\ssh-key-2026-06-05.key` |
| **VM Repo Path** | `/home/ubuntu/spotifytoolkit` (`https://github.com/Mhamed-ali/SpotifyToolkit.git`) |
| **Web Server (Nginx)** | `/etc/nginx/sites-available/toolify` serves `/home/ubuntu/spotifytoolkit/client/dist` directly and proxies `/login`, `/callback`, `/api/auth/*`, `/refresh_token`, `/anghami/*`, and `/health` to `http://127.0.0.1:8888` |
| **Process Manager** | PM2 (`spotify-toolkit`) running `server/index.js` on `PORT=8888`, `USE_HTTPS=false` |

---

## 2. Standard Deployment Workflow

### Step 1: Commit & Push Local Changes
Before deploying to the VM, verify unit tests pass locally and push the target branch (default: `anghami-integration`, or `production` after verification):
```powershell
npm test
git push origin <branch-name>
```

### Step 2: Run the Automated VM Deployment Script
Execute the helper script [deploy-vm.ps1](./scripts/deploy-vm.ps1) from the workspace root:
```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/vm-deploy/scripts/deploy-vm.ps1 -Branch "anghami-integration"
```
To promote and deploy `production` after verifying `anghami-integration`:
```powershell
git checkout production
git merge anghami-integration
git push origin production
powershell -ExecutionPolicy Bypass -File .agents/skills/vm-deploy/scripts/deploy-vm.ps1 -Branch "production"
```

---

## 3. What the Deployment Script Does on the VM

1. **2 GB Swap Guard:** Checks if `/swapfile` is active (`swapon --show`). If not, creates and enables a 2 GB swapfile (`/swapfile`) and persists it in `/etc/fstab` so `vite build` never triggers an Out-Of-Memory (OOM) crash on the 1 GB RAM VM.
2. **Repository Sync:** Clones `/home/ubuntu/spotifytoolkit` if missing, fetches `origin`, checks out the requested branch (`anghami-integration` or `production`), and resets cleanly to `origin/<branch>`.
3. **Environment Configuration (`server/.env`):** Preserves existing Spotify credentials (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` from `/home/ubuntu/SpotifyToolkit2.0/.env.local` or `/home/ubuntu/spotifytoolkit/server/.env`) and sets:
   - `PORT=8888`
   - `HOST=127.0.0.1`
   - `USE_HTTPS=false` (Nginx terminates Let's Encrypt TLS on port 443)
   - `FRONTEND_URI=https://toolify.ddns.net`
4. **Dependencies, Unit Tests & Production Build:**
   - Installs `server` and `client` npm packages.
   - Runs `npm test` in both `server/` and `client/`.
   - Builds `client/dist` with `NODE_OPTIONS="--max-old-space-size=768" npm run build`.
5. **Nginx Static + Reverse Proxy Setup:** Updates `/etc/nginx/sites-available/toolify`, validates with `sudo nginx -t`, and reloads Nginx (`sudo systemctl reload nginx`).
6. **PM2 Reload:** Starts or restarts the `spotify-toolkit` Express backend on port `8888` and saves the PM2 process list (`pm2 save`).

---

## 4. Verification & Health Checks

After running the deployment, always verify:
1. **Local VM Health Endpoint:**
   ```powershell
   ssh -i "C:\Users\moham\OneDrive\Desktop\spotifytoolkit2\ssh-key-2026-06-05.key" ubuntu@152.67.91.217 "curl -s http://127.0.0.1:8888/health && pm2 status"
   ```
2. **Public HTTPS Domain:**
   ```powershell
   curl.exe -s https://toolify.ddns.net/health
   ```
   Expected JSON: `{"message":"Spotify & Anghami Auth Server is running","providers":{"spotify":true,"anghami":true}}`
