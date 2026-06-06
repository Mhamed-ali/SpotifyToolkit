#!/bin/bash
echo "Starting Oracle Ubuntu Setup for Spotify Toolkit..."

# 1. Update the system
sudo apt update && sudo apt upgrade -y

# 2. Install NGINX
sudo apt install nginx -y

# 3. Install Node.js (v20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. Install PM2 globally
sudo npm install -g pm2

# 5. Setup UFW Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "----------------------------------------"
echo "Setup Complete! Here are your versions:"
node -v
npm -v
pm2 -v
nginx -v
echo "----------------------------------------"
echo "You can now clone the repository and build the app!"
