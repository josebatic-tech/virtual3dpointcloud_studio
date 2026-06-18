// Generate self-signed certificate for HTTPS
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const certPath = path.resolve('cert.pem');
const keyPath = path.resolve('key.pem');

console.log('🔐 Generating self-signed certificate for HTTPS...');

// Use OpenSSL via spawned process (works better on Windows Git Bash)
const openssl = spawn('openssl', [
  'req',
  '-new',
  '-x509',
  '-days', '365',
  '-nodes',
  '-out', certPath,
  '-keyout', keyPath,
  '-subj', 'C=US,ST=State,L=City,O=Org,CN=192.168.1.135'
], {
  shell: true,
  stdio: 'pipe'
});

openssl.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Certificate generated successfully!');
    console.log(`📄 Certificate: ${certPath}`);
    console.log(`🔑 Key: ${keyPath}`);
    console.log('\n📝 Update vite.config.js to use HTTPS:');
    console.log(`
import fs from 'fs'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: {
      key: fs.readFileSync('./key.pem'),
      cert: fs.readFileSync('./cert.pem'),
    },
  },
});
    `);
  } else {
    console.error('❌ Failed to generate certificate');
    console.log('\nTrying alternative method...');
    generateWithNodeForge();
  }
});

// Fallback: Use node-forge if OpenSSL fails
function generateWithNodeForge() {
  import('node-forge').then(({ pki }) => {
    console.log('Generating with node-forge...');

    const keys = pki.rsa.generateKeyPair(2048);
    const cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);

    const attrs = [{
      name: 'commonName',
      value: '192.168.1.135'
    }];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([{
      name: 'basicConstraints',
      cA: true
    }]);

    cert.sign(keys.privateKey);

    fs.writeFileSync(certPath, pki.certificateToPem(cert));
    fs.writeFileSync(keyPath, pki.privateKeyToPem(keys.privateKey));

    console.log('✅ Certificate generated with node-forge!');
  }).catch(err => {
    console.error('❌ Both methods failed:', err.message);
    console.log('\nManual solution: Use ngrok for free HTTPS tunneling');
    console.log('npm install -g ngrok');
    console.log('ngrok http 5173');
  });
}
