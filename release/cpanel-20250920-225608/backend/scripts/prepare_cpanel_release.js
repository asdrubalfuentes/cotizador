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
  await copyDir(dist, path.join(out, 'frontend', 'dist'))

  // Copiar archivos raíz
  const rootFiles = ['package.json', 'README.md', 'DEPLOYMENT.md', '.env.example']
  for (const f of rootFiles) {
    const src = path.join(root, f)
    if (fs.existsSync(src)) {
      await fsp.copyFile(src, path.join(out, f))
    }
  }

  // outputs mínimo
  const outOutputs = path.join(out, 'outputs')
  await fsp.mkdir(path.join(outOutputs, 'pdfs'), { recursive: true })
  await fsp.mkdir(path.join(outOutputs, 'logos'), { recursive: true })
  // Copiar empresas.json si existe, y logos si existen
  const empresasJson = path.join(root, 'outputs', 'empresas.json')
  if (fs.existsSync(empresasJson)) {
    await fsp.copyFile(empresasJson, path.join(outOutputs, 'empresas.json'))
  }
  const logosDir = path.join(root, 'outputs', 'logos')
  if (fs.existsSync(logosDir)) {
    await copyDir(logosDir, path.join(outOutputs, 'logos'))
  }
  console.log('\nPaquete listo para subir a cPanel:')
  console.log(out)
  console.log('\nSugerencia para comprimir en Windows (PowerShell):')
  console.log(`Compress-Archive -Path "${out}/*" -DestinationPath "${out}.zip"`)
}

main().catch(err => {
  console.error('ERROR preparando release:', err.message)
  process.exit(1)
})
