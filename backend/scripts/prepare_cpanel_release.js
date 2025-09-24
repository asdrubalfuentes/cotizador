#!/usr/bin/env node
/*
 Prepara un paquete para subir a cPanel:
 - Construye el frontend (vite build)
 - Crea release/cpanel-<YYYYMMDD-HHmmss>/
 - Copia backend/, frontend/dist/, package.json, README.md, DEPLOYMENT.md, .env.example
 - Crea outputs/ vacío (y copia outputs/empresas.json y outputs/logos/* si existen)
*/

const { spawnSync } = require('child_process')
const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')

function ts(){
  const d = new Date()
  const pad = (n)=> String(n).padStart(2,'0')
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function run(cmd, args, opts={}){
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts })
  if (r.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`)
  }
}

async function copyDir(src, dst, { filter } = {}){
  await fsp.mkdir(dst, { recursive: true })
  const entries = await fsp.readdir(src, { withFileTypes: true })
  for (const e of entries) {
    const s = path.join(src, e.name)
    const d = path.join(dst, e.name)
    if (filter && !filter(s, e)) continue
    if (e.isDirectory()) {
      await copyDir(s, d, { filter })
    } else if (e.isFile()) {
      await fsp.mkdir(path.dirname(d), { recursive: true })
      await fsp.copyFile(s, d)
    }
  }
}

async function main(){
  const root = path.resolve(__dirname, '..', '..')
  process.chdir(root)
  console.log('-> Construyendo frontend...')
  run('npm', ['run', 'frontend:build'])

  const relRoot = path.join(root, 'release')
  const out = path.join(relRoot, `cpanel-${ts()}`)
  await fsp.mkdir(out, { recursive: true })
  console.log('-> Carpeta release:', out)

  // Copiar backend completo
  console.log('-> Copiando backend/...')
  await copyDir(path.join(root, 'backend'), path.join(out, 'backend'))

  // Copiar dist del frontend
  const dist = path.join(root, 'frontend', 'dist')
  if (!fs.existsSync(dist)) throw new Error('frontend/dist no encontrado. ¿Falló el build?')
  console.log('-> Copiando frontend/dist ...')
  const outFrontend = path.join(out, 'frontend')
  await copyDir(dist, path.join(outFrontend, 'dist'))

  // Plantillas útiles para despliegue estático en cPanel
  // (si decides hospedar el frontend estático aparte del backend)
  try {
    await fsp.mkdir(outFrontend, { recursive: true })
    const configTpl = `// Renombra este archivo a "config.js" y súbelo al docroot de tu frontend
// Ajusta las URLs según tu entorno de producción
window.__APP_CONFIG__ = {
  API_BASE: 'https://emqx.aysafi.com', // URL pública del backend
  FRONTEND_URL: 'https://cotizador.aysafi.com' // URL pública del frontend
};
`
  await fsp.writeFile(path.join(outFrontend, 'config.js.template'), configTpl, 'utf8')

  const htaccess = `# SPA fallback + security headers para React/Vite en cPanel (Apache)
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
</IfModule>

# Seguridad: fuerza HTTPS (si tienes cert y quieres redirigir todo a https)
<IfModule mod_rewrite.c>
  RewriteCond %{HTTPS} !=on
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

<IfModule mod_headers.c>
  # Política de seguridad de contenido
  # Ajusta los dominios de backend/frontend si usas otros
  Header always set Content-Security-Policy "default-src 'self'; \
    script-src 'self' https://cdn.jsdelivr.net; \
    style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; \
    img-src 'self' data: https://emqx.aysafi.com https://emqx.aysafi.com:8443; \
    connect-src 'self' https://emqx.aysafi.com https://emqx.aysafi.com:8443 https://cdn.jsdelivr.net https://mindicador.cl; \
    font-src 'self' https://cdn.jsdelivr.net; \
    frame-ancestors 'none'; base-uri 'self'; upgrade-insecure-requests; block-all-mixed-content"

  # Cabeceras adicionales recomendadas
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "DENY"
  Header always set Referrer-Policy "no-referrer"
  Header always set Permissions-Policy "geolocation=(), camera=(), microphone=()"
</IfModule>

# HSTS (activa solo cuando ya sirves HTTPS correctamente)
# <IfModule mod_headers.c>
#   Header always set Strict-Transport-Security "max-age=15552000; includeSubDomains; preload"
# </IfModule>
`
    await fsp.writeFile(path.join(outFrontend, '.htaccess'), htaccess, 'utf8')
    console.log('-> Plantillas agregadas: frontend/config.js.template y frontend/.htaccess')

    // También colocar plantillas dentro de dist/ por conveniencia
    try {
      await fsp.writeFile(path.join(outFrontend, 'dist', '.htaccess'), htaccess, 'utf8')
      await fsp.writeFile(path.join(outFrontend, 'dist', 'config.js.template'), configTpl, 'utf8')
      console.log('-> Plantillas agregadas dentro de dist/: .htaccess y config.js.template')
    } catch (err) {
      console.warn('Aviso: no se pudieron copiar plantillas dentro de dist/', err?.message || err)
    }
  } catch (e) {
    console.warn('Aviso: no se pudieron crear plantillas estáticas para frontend:', e?.message || e)
  }

  // Copiar archivos raíz
  const rootFiles = ['package.json', 'README.md', 'DEPLOYMENT.md', '.env.example']
  for (const f of rootFiles) {
    const src = path.join(root, f)
    if (fs.existsSync(src)) {
      await fsp.copyFile(src, path.join(out, f))
    }
  }

  // outputs unificado dentro de backend/outputs
  const outOutputs = path.join(out, 'backend', 'outputs')
  await fsp.mkdir(path.join(outOutputs, 'pdfs'), { recursive: true })
  await fsp.mkdir(path.join(outOutputs, 'logos'), { recursive: true })

  // Fusionar contenidos si existen en la raíz (legacy) y/o en backend/outputs actual
  const legacyRootOutputs = path.join(root, 'outputs')
  const backendOutputs = path.join(root, 'backend', 'outputs')

  async function safeCopy(srcDir, dstDir) {
    if (fs.existsSync(srcDir)) {
      await copyDir(srcDir, dstDir)
    }
  }

  // Copiar empresas.json desde la ubicación más reciente disponible
  const candidateEmpresas = [
    path.join(backendOutputs, 'empresas.json'),
    path.join(legacyRootOutputs, 'empresas.json')
  ]
  for (const f of candidateEmpresas) {
    if (fs.existsSync(f)) {
      await fsp.copyFile(f, path.join(outOutputs, 'empresas.json'))
      break
    }
  }

  // Copiar logos y pdfs, prefiriendo backend/outputs si existe
  await safeCopy(path.join(legacyRootOutputs, 'logos'), path.join(outOutputs, 'logos'))
  await safeCopy(path.join(backendOutputs, 'logos'), path.join(outOutputs, 'logos'))
  await safeCopy(path.join(legacyRootOutputs, 'pdfs'), path.join(outOutputs, 'pdfs'))
  await safeCopy(path.join(backendOutputs, 'pdfs'), path.join(outOutputs, 'pdfs'))
  console.log('\nPaquete listo para subir a cPanel:')
  console.log(out)
  console.log('\nSugerencia para comprimir en Windows (PowerShell):')
  console.log(`Compress-Archive -Path "${out}/*" -DestinationPath "${out}.zip"`)
}

main().catch(err => {
  console.error('ERROR preparando release:', err.message)
  process.exit(1)
})
