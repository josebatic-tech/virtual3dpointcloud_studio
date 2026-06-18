# HTTPS Setup for iOS (Camera Access)

iOS **requires HTTPS** for camera access. Here are your options:

---

## ✅ Option 1: ngrok (EASIEST - Recommended)

### Installation

```bash
npm install -g ngrok
```

Or download from: https://ngrok.com/download

### Running ngrok

```bash
ngrok http 5173
```

You'll see output like:
```
Forwarding                    https://abc123def456.ngrok.io -> http://localhost:5173
```

### Use on iOS

1. Copy the **https:// URL** from ngrok output
2. Open in iOS Safari or Chrome
3. Grant camera permissions
4. Done! ✅

**Advantages:**
- ✅ Instant HTTPS (no certificate setup)
- ✅ Works on any network (including remote)
- ✅ No security warnings
- ✅ Free tier available
- ✅ Easiest solution

---

## Option 2: Self-Signed Certificate (Advanced)

If you prefer HTTPS without ngrok:

### Windows (PowerShell)

```powershell
# Generate certificate
$cert = New-SelfSignedCertificate -DnsName "192.168.1.135" `
  -CertStoreLocation "cert:\CurrentUser\My" `
  -FriendlyName "3DPointCloud" `
  -NotAfter (Get-Date).AddYears(1)

# Export as PEM
Export-PfxCertificate -Cert $cert -FilePath "cert.pfx" `
  -Password (ConvertTo-SecureString "password" -AsPlainText -Force)

# Convert PFX to PEM (requires OpenSSL)
openssl pkcs12 -in cert.pfx -out cert.pem -clcerts -nokeys
openssl pkcs12 -in cert.pfx -out key.pem -nocerts -nodes
```

### Mac/Linux

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -nodes \
  -out cert.pem -keyout key.pem -days 365 \
  -subj "/C=US/ST=State/L=City/O=Org/CN=192.168.1.135"
```

### Update Vite Config

Edit `vite.config.js`:

```javascript
import fs from 'fs'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: {
      key: fs.readFileSync('./key.pem'),
      cert: fs.readFileSync('./cert.pem'),
    },
  },
})
```

### Restart Dev Server

```bash
npm run dev
```

### Use on iOS

1. Open `https://192.168.1.135:5173`
2. **IMPORTANT**: Tap **"Visit Website"** on the security warning
3. Grant camera permissions
4. Done! ✅

**Note:** You'll see a security warning because it's self-signed. This is normal and safe for local development.

---

## Option 3: Let's Encrypt (Production)

For a real domain with valid HTTPS:

```bash
# Install Certbot
sudo apt-get install certbot

# Generate certificate for yourdomain.com
sudo certbot certonly --standalone -d yourdomain.com

# Use certificate in vite.config.js
https: {
  key: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/fullchain.pem'),
}
```

---

## 📱 Comparison

| Method | Setup | iOS | Android | Remote | Cost |
|--------|-------|-----|---------|--------|------|
| **ngrok** | 2 min | ✅ Easy | ✅ Easy | ✅ Yes | Free |
| **Self-Signed** | 5 min | ⚠️ Warning | ✅ Easy | ❌ No | Free |
| **Let's Encrypt** | 15 min | ✅ Easy | ✅ Easy | ✅ Yes | Free |

---

## 🚀 Quick Start with ngrok

```bash
# Terminal 1-3: Start services (as before)
npm run dev
node proxy-server.js
./llama-server ...

# Terminal 4: Start ngrok
ngrok http 5173

# Copy the HTTPS URL to your phone
# Example: https://abc123.ngrok.io
```

---

## ⚠️ Troubleshooting

### "Certificate not trusted" on iOS

**Solution:** Tap **"Visit Website"** (self-signed cert warning is normal)

### Camera still doesn't work

1. Check HTTPS URL is correct
2. Grant camera permissions
3. Try in **Safari** first (Chrome sometimes has issues)
4. Clear browser cache: Settings → Safari → Clear History and Website Data

### ngrok URL keeps changing

**Upgrade to ngrok Pro:**
- Get a stable domain
- Sign up at https://ngrok.com

---

## 🔒 Security Note

For **local development only**:
- Self-signed certificates are fine
- ngrok free tier has rate limits
- Never expose production keys

For **production**, use proper SSL certificates (Let's Encrypt, AWS, etc.)

---

## 📚 Resources

- ngrok: https://ngrok.com
- Let's Encrypt: https://letsencrypt.org
- Vite HTTPS: https://vitejs.dev/config/#server-https

