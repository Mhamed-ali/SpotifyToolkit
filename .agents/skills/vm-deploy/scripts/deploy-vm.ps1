param(
    [string]$Branch = "anghami-integration",
    [string]$VmHost = "ubuntu@152.67.91.217",
    [string]$SshKey = "C:\Users\moham\OneDrive\Desktop\spotifytoolkit2\ssh-key-2026-06-05.key"
)

$ErrorActionPreference = "Stop"

Write-Host "==> Starting deployment of branch '$Branch' to $VmHost..." -ForegroundColor Cyan

$remoteScript = @'
set -e

echo "--- [1/6] Checking 2GB Swapfile on 1GB RAM VM ---"
if [ "$(swapon --show | wc -l)" -eq 0 ]; then
    echo "Creating 2GB /swapfile..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
fi
free -h

echo "--- [2/6] Cloning or updating /home/ubuntu/spotifytoolkit ($BRANCH) ---"
if [ ! -d "/home/ubuntu/spotifytoolkit/.git" ]; then
    git clone https://github.com/Mhamed-ali/SpotifyToolkit.git /home/ubuntu/spotifytoolkit
fi
cd /home/ubuntu/spotifytoolkit
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "--- [3/6] Configuring server/.env ---"
if [ ! -f "/home/ubuntu/spotifytoolkit/server/.env" ]; then
    touch /home/ubuntu/spotifytoolkit/server/.env
fi

# Migrate Spotify credentials from SpotifyToolkit2.0/.env.local if not already in server/.env
if ! grep -q "^SPOTIFY_CLIENT_ID=" /home/ubuntu/spotifytoolkit/server/.env && [ -f "/home/ubuntu/SpotifyToolkit2.0/.env.local" ]; then
    CLIENT_ID=$(grep "^SPOTIFY_CLIENT_ID=" /home/ubuntu/SpotifyToolkit2.0/.env.local | cut -d= -f2-)
    CLIENT_SECRET=$(grep "^SPOTIFY_CLIENT_SECRET=" /home/ubuntu/SpotifyToolkit2.0/.env.local | cut -d= -f2-)
    REDIRECT_URI=$(grep "^SPOTIFY_REDIRECT_URI=" /home/ubuntu/SpotifyToolkit2.0/.env.local | cut -d= -f2-)

    cat > /home/ubuntu/spotifytoolkit/server/.env <<EOF
PORT=8888
HOST=127.0.0.1
USE_HTTPS=false
LOG_LEVEL=info
FRONTEND_URI=https://toolify.ddns.net
SPOTIFY_CLIENT_ID=${CLIENT_ID}
SPOTIFY_CLIENT_SECRET=${CLIENT_SECRET}
REDIRECT_URI=${REDIRECT_URI:-https://toolify.ddns.net/api/auth/callback}
ANGHAMI_CLIENT_ID=
ANGHAMI_CLIENT_SECRET=
ANGHAMI_API_KEY=
ANGHAMI_REDIRECT_URI=https://toolify.ddns.net/anghami/callback
ANGHAMI_SDK_URL=https://sdk.anghami.com/v1
EOF
fi

echo "--- [4/6] Installing dependencies, running tests, and building client/dist ---"
cd /home/ubuntu/spotifytoolkit/server
npm install --no-audit --no-fund
npm test

cd /home/ubuntu/spotifytoolkit/client
npm install --no-audit --no-fund
npm test
NODE_OPTIONS="--max-old-space-size=768" npm run build

echo "--- [5/6] Configuring Nginx (Option A: Static dist + API Reverse Proxy) ---"
sudo tee /etc/nginx/sites-available/toolify > /dev/null <<'NGINX_EOF'
server {
    server_name toolify.ddns.net;

    root /home/ubuntu/spotifytoolkit/client/dist;
    index index.html;

    # Backend OAuth & API routes proxied to Express on port 8888
    location ~ ^/(login|callback|refresh_token|health|anghami|api/auth)(/.*)?$ {
        proxy_pass http://127.0.0.1:8888;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA Static Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/toolify.ddns.net/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/toolify.ddns.net/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = toolify.ddns.net) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name toolify.ddns.net;
    return 404; # managed by Certbot
}
NGINX_EOF

sudo nginx -t
sudo systemctl reload nginx

echo "--- [6/6] Restarting PM2 process (spotify-toolkit) ---"
pm2 delete spotify-toolkit 2>/dev/null || true
cd /home/ubuntu/spotifytoolkit/server
pm2 start index.js --name "spotify-toolkit" --env production
pm2 save

sleep 2
curl -s http://127.0.0.1:8888/health
echo ""
pm2 status
'@

$remoteScript = $remoteScript.Replace('$BRANCH', $Branch).Replace("`r`n", "`n")
$remoteScript | ssh -i $SshKey -o BatchMode=yes $VmHost "bash -s"
