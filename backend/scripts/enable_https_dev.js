#!/usr/bin/env node
// Generates self-signed certs for local HTTPS and prints env hints
const fs = require('fs')
const path = require('path')
const selfsigned = require('selfsigned')

const DEFAULT_CERT_DIR = path.join(__dirname, '..', '..', 'certs-dev')
fs.mkdirSync(DEFAULT_CERT_DIR, { recursive: true })

const attrs = [{ name: 'commonName', value: 'localhost' }]
const pems = selfsigned.generate(attrs, { days: 365, algorithm: 'sha256', keySize: 2048 })

const certPath = path.join(DEFAULT_CERT_DIR, 'localhost.crt')
const keyPath = path.join(DEFAULT_CERT_DIR, 'localhost.key')
const caPath = path.join(DEFAULT_CERT_DIR, 'localhost.ca-bundle.crt')

fs.writeFileSync(certPath, pems.cert, 'utf8')
fs.writeFileSync(keyPath, pems.private, 'utf8')
fs.writeFileSync(caPath, pems.cert, 'utf8')

console.log('Dev certs created at:', DEFAULT_CERT_DIR)
console.log('Set env to enable HTTPS locally:')
console.log('  HTTPS=true')
console.log('  TLS_CERT_FILE=' + certPath)
console.log('  TLS_KEY_FILE=' + keyPath)
console.log('  TLS_CA_FILE=' + caPath)
console.log('Then run: npm run backend')
