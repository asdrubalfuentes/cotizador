#!/usr/bin/env node
/*
 Monolithic VPS deployer (backend + frontend served by Node)
 - Requires: ssh, scp, tar on local; sshd on remote; Node/npm on remote.
 - Optional: pm2 on remote (script installs if missing).

 Usage:
   node backend/scripts/deploy_vps_monolithic.js --config deploy.vps.json

 Config file (deploy.vps.json) example:
 {
   "host": "1.2.3.4",
   "port": 22,
   "username": "ubuntu",
   "privateKey": "C:/Users/you/.ssh/id_rsa", // optional if agent/ssh config is in place
   "deployPath": "/opt/cotizador",
   "backendPort": 5000,
   "domain": "emqx.aysafi.com",           // backend domain (optional, for Nginx hints)
   "frontendDomain": "cotizador.aysafi.com", // optional, for env
   "useNginx": false,                        // monolítico puro por defecto
   "env": {
     "NODE_ENV": "production",
     "FRONTEND_URL": "https://cotizador.aysafi.com",
     "PUBLIC_API_BASE": "",              // vacío si monolítico
     "JWT_SECRET": "cambia-esto",
     "ADMIN_PASSWORD": "admin-pass",
     "MORGAN_FORMAT": "combined"
     // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, OUTPUT_DIR, etc.
   }
 }
*/

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function sh(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function hasCmd(cmd) {
  try {
    execSync(process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function readConfig() {
  const idx = process.argv.indexOf('--config');
  const file = idx !== -1 ? process.argv[idx + 1] : 'deploy.vps.json';
  if (!fs.existsSync(file)) {
    const example = path.join(process.cwd(), 'deploy.vps.example.json');
    if (!fs.existsSync(example)) {
      fs.writeFileSync(example, JSON.stringify({
        host: '1.2.3.4',
        port: 22,
        username: 'ubuntu',
        privateKey: path.join(os.homedir(), '.ssh', 'id_rsa'),
        deployPath: '/opt/cotizador',
        backendPort: 5000,
        domain: 'emqx.example.com',
        frontendDomain: 'cotizador.example.com',
        useNginx: false,
        env: {
          NODE_ENV: 'production',
          FRONTEND_URL: 'https://cotizador.example.com',
          PUBLIC_API_BASE: '',
          JWT_SECRET: 'cambia-esto',
          ADMIN_PASSWORD: 'admin-pass',
          MORGAN_FORMAT: 'combined'
        }
      }, null, 2));
    }
    console.error(`No se encontró ${file}. Se generó un ejemplo en deploy.vps.example.json.`);
    process.exit(1);
  }
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

function buildEnv(envObj) {
  const lines = [];
  for (const [k, v] of Object.entries(envObj || {})) {
    // Escapar comillas
    const val = String(v).replace(/\n/g, '\\n');
    lines.push(`${k}=${val}`);
  }
  return lines.join('\n') + '\n';
}

function main() {
  const cfg = readConfig();

  // Preflight local
  for (const cmd of ['ssh', 'scp', 'tar']) {
    if (!hasCmd(cmd)) {
      console.error(`Necesitas '${cmd}' instalado en tu máquina local.`);
      process.exit(1);
    }
  }

  // Crear paquete tar.gz excluyendo node_modules/.git/release/outputs
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotizador-deploy-'));
  const tarFile = path.join(tmpDir, `cotizador-${stamp}.tgz`);
  const exclude = [
    '--exclude=node_modules',
    '--exclude=frontend/node_modules',
    '--exclude=.git',
    '--exclude=release',
    '--exclude=.env',
    '--exclude=outputs',
    '--exclude=backend/outputs'
  ].join(' ');
  sh(`tar -czf "${tarFile}" ${exclude} .`);

  // Subir paquete
  const sshPort = cfg.port || 22;
  const identity = cfg.privateKey ? `-i "${cfg.privateKey}"` : '';
  const remoteTmp = `/tmp/${path.basename(tarFile)}`;
  sh(`scp -P ${sshPort} ${identity} "${tarFile}" ${cfg.username}@${cfg.host}:${remoteTmp}`);

  // Comandos remotos
  const deployPath = cfg.deployPath || '/opt/cotizador';
  const envContent = buildEnv(cfg.env || {});
    // Escapar comillas simples para here-doc con delimitador entrecomillado ('EOF')
    // Sustituimos ' por '\'' (cierra, escapa y reabre)
    const envEscaped = envContent.replace(/'/g, "'\\'" + "'" + "'");
  const remote = [
    `set -e`,
    `mkdir -p ${deployPath}`,
    `tar -xzf ${remoteTmp} -C ${deployPath}`,
    `rm -f ${remoteTmp}`,
    `cd ${deployPath}`,
    `command -v node >/dev/null || echo "[WARN] Node.js no encontrado en el VPS. Instálalo antes de continuar."`,
    `command -v npm >/dev/null || echo "[WARN] npm no encontrado en el VPS."`,
    // deps
    `npm ci`,
    `cd frontend && npm ci && npm run build && cd ..`,
    // .env
    `cat > .env << 'EOF'\n${envEscaped}EOF`,
    // PM2
    `if ! command -v pm2 >/dev/null; then npm i -g pm2; fi`,
    `pm2 start backend/server.js --name cotizador --update-env || pm2 restart cotizador --update-env`,
    `pm2 save || true`
  ].join(' && ');

  sh(`ssh -p ${sshPort} ${identity} ${cfg.username}@${cfg.host} '${remote.replace(/'/g, `'"'"'`)}'`);

  console.log('\nDespliegue completado. Verifica:');
  console.log(`- pm2 status (en el VPS)`);
  console.log(`- curl http://localhost:${cfg.backendPort || 5000}/`);
  if (cfg.env && cfg.env.FRONTEND_URL) console.log(`- Abre ${cfg.env.FRONTEND_URL}`);
  console.log('\nSugerencia Nginx (opcional, para 443 público): mira DEPLOYMENT.md sección VPS monolítico.');
}

try { main(); } catch (err) {
  console.error('\n[ERROR] Falló el despliegue:', err?.message || err);
  process.exit(1);
}
