import localtunnel from 'localtunnel';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const envPath = path.join(rootDir, '.env.local');

async function waitWithCountdown(waitTimeMs) {
  return new Promise((resolve) => {
    let remaining = Math.ceil(waitTimeMs / 1000);
    console.log(`\n(Press ENTER to skip waiting and retry immediately)`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Write initial
    process.stdout.write(`\r⏳ Retrying in ${remaining} seconds... `);
    remaining--;

    const interval = setInterval(() => {
      if (remaining <= 0) {
        clearInterval(interval);
        rl.close();
        process.stdout.write('\n');
        resolve();
      } else {
        process.stdout.write(`\r⏳ Retrying in ${remaining} seconds... `);
        remaining--;
      }
    }, 1000);

    rl.on('line', () => {
      clearInterval(interval);
      rl.close();
      process.stdout.write('\n⏩ Skipping wait...\n');
      resolve();
    });
  });
}

async function startTunnelAndServer() {
  try {
    const targetSubdomain = 'spotify-toolkit'; // PROD Subdomain
    const expectedUrl = `https://${targetSubdomain}.loca.lt`;
    const baseDelayMs = 60000; // Configurable base wait time (x)
    let tunnel = null;
    let attempts = 0;

    while (!tunnel) {
      attempts++;
      console.log(`\n⏳ Starting LocalTunnel on port 3000 (Attempt ${attempts})...`);
      
      try {
        tunnel = await localtunnel({ 
          port: 3000, 
          local_host: '127.0.0.1',
          subdomain: targetSubdomain 
        });

        if (tunnel.url !== expectedUrl) {
          const waitTime = Math.pow(2, attempts - 1) * 60000; // 1m, 2m, 4m, 8m...
          console.warn(`⚠️ Tunnel assigned unexpected URL: ${tunnel.url}`);
          console.warn(`⚠️ Expected: ${expectedUrl}`);
          tunnel.close();
          tunnel = null;
          await waitWithCountdown(waitTime);
        }
      } catch (err) {
        const waitTime = Math.pow(2, attempts - 1) * 60000; // 1m, 2m, 4m, 8m...
        console.error('❌ Error starting tunnel:', err.message);
        await waitWithCountdown(waitTime);
      }
    }

  console.log(`\n✅ Tunnel connected!`);
  console.log(`===================================================`);
  console.log(`🌐 Public URL: ${tunnel.url}`);
  console.log(`===================================================\n`);

    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      envContent = envContent.replace(
        /SPOTIFY_REDIRECT_URI=.*/g, 
        `SPOTIFY_REDIRECT_URI=${tunnel.url}/api/auth/callback`
      );
      
      envContent = envContent.replace(
        /FRONTEND_URI=.*/g, 
        `FRONTEND_URI=${tunnel.url}`
      );

      fs.writeFileSync(envPath, envContent);
      console.log('✅ Automatically updated .env.local with new tunnel URL.');
      console.log('⚠️  ACTION REQUIRED: Make sure to add this URL to your Spotify Developer Dashboard:\n');
      console.log(`   ${tunnel.url}/api/auth/callback\n`);
    } else {
      console.warn('⚠️ .env.local not found!');
    }

    // 3. Start Next.js PRODUCTION Server
    console.log('🚀 Starting Next.js PRODUCTION server...\n');
    const nextProcess = spawn('npm', ['run', 'start'], { 
      cwd: rootDir,
      stdio: 'inherit',
      shell: true 
    });

    nextProcess.on('close', (code) => {
      console.log(`\n🛑 Next.js server stopped (Code: ${code})`);
      tunnel.close();
    });

    tunnel.on('close', () => {
      console.log('🔌 Tunnel closed.');
    });

  } catch (error) {
    console.error('\n❌ Failed to start tunnel or server:', error);
    process.exit(1);
  }
}

startTunnelAndServer();
