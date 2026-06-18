# Mobile Setup Guide - 3D Point Cloud Studio

## 📱 Device Requirements

- **iOS**: iPhone/iPad (iOS 14.5+) - **Must use HTTPS or localhost**
- **Android**: Chrome or Firefox with WebGL support
- **Network**: Device must be on same network as the server

---

## 🔧 Server Setup (Computer/Host)

### Prerequisites
- Node.js 16+
- Python 3.8+ (for Zed camera, optional)
- NVIDIA GPU (optional, for GPU acceleration)

### Step 1: Get Server IP Address

**Windows:**
```powershell
ipconfig | findstr "IPv4"
```

Look for your **Wi-Fi** or **Ethernet** IP (e.g., `192.168.1.135`)

**Mac/Linux:**
```bash
ifconfig | grep "inet "
```

### Step 2: Start Services

From the project directory:

```bash
# Terminal 1: Start llama.cpp with GPU (for VLM features)
cd ~/llama.cpp
./llama-server -m models/llava-7b.gguf --port 8080 --host 0.0.0.0 -ngl 33 -n 200 -c 2048 --threads 4

# Terminal 2: Start CORS proxy
node proxy-server.js

# Terminal 3: Start development server (listens on all interfaces)
npm run dev
```

The server will print: `VITE v5.x.x ready in XXX ms → Local: http://0.0.0.0:5173`

---

## 📲 Access on Mobile

### From Same Network (Recommended)

1. On your phone/tablet, open Chrome or Safari
2. Navigate to: `http://<YOUR_SERVER_IP>:5173`
   - Example: `http://192.168.1.135:5173`
3. Grant camera permissions when prompted

### iOS Requirements

**IMPORTANT:** iOS Safari/Chrome **REQUIRES HTTPS** for camera access.

#### ✅ Option A: ngrok (EASIEST - Recommended)

ngrok provides instant HTTPS with zero setup:

```bash
# Install (one time)
npm install -g ngrok

# Run in new terminal
ngrok http 5173

# Copy the HTTPS URL
# Example: https://abc123def456.ngrok.io
```

Then on your iPhone:
1. Open Safari or Chrome
2. Paste the ngrok HTTPS URL
3. Grant camera permissions
4. Done! ✅

**Why ngrok is best:**
- ✅ Instant HTTPS (no certificate setup)
- ✅ No security warnings
- ✅ Works from anywhere (not just local network)
- ✅ Free tier available
- ✅ Simplest solution

#### Option B: Self-Signed HTTPS (Advanced)

See **[HTTPS_SETUP.md](HTTPS_SETUP.md)** for:
- Self-signed certificate generation
- Vite HTTPS configuration
- Dealing with iOS security warnings

```bash
# Quick: Follow HTTPS_SETUP.md for certificate generation
# Then: npm run dev
# Use: https://192.168.1.135:5173
```

#### Option C: Let's Encrypt (Production)

For a real domain with proper SSL:
See **[HTTPS_SETUP.md](HTTPS_SETUP.md)** for Let's Encrypt setup

### Android Requirements

Android Chrome generally allows HTTP camera access on local networks:

1. Open Chrome
2. Go to: `http://192.168.1.135:5173`
3. Grant camera permissions

If camera fails:
- Check Settings → Apps → Chrome → Permissions → Camera is **Allowed**
- Try Firefox instead: `https://192.168.1.135:5173` (with self-signed cert)

---

## 🎮 Mobile Usage

### Camera Tab
- Tap **▶ Start** to begin camera stream
- **Reduce resolution** (720p → 480p) for faster performance
- Toggle between **3D Cloud** and **Camera** view

### AI/VLM Tab
- **System Prompt** (optional) - guides the AI model
- **Model** selector - choose LLaVA variant
- **Message input** - ask questions about the camera scene
- Responses appear in chat history

### Other Tabs
- **Point Cloud**: Adjust density, point size, depth scale
- **Aesthetics**: Camera speed, lens focus, particle effects, colors
- **Settings**: StreamDiffusion and advanced options

---

## ⚠️ Troubleshooting

### "Camera not working"

**Check:**
1. ✅ Is the device on the same network as the server?
2. ✅ Is the server running? (Check all 3 terminals)
3. ✅ Did you grant camera permissions?
4. ✅ Is your URL correct? (e.g., `http://192.168.1.135:5173`)

**iOS Specific:**
- Try with `http://` first (not `https://`)
- If that fails, use Option B (self-signed HTTPS)
- Or use ngrok (Option C)

### "VLM response is slow"

- The app automatically **reduces image quality** on mobile for faster processing
- For faster responses:
  - Ensure **Wi-Fi 5/6 connection** (not LTE)
  - Use **720p or 480p** camera resolution
  - Reduce screen brightness to save power

### "3D rendering is laggy on mobile"

- Lower **Density slider** in Point Cloud tab
- Disable particle effects (rain/snow) in Aesthetics
- Use **Camera view** instead of 3D Cloud view
- Close other browser tabs

### "Permission denied repeatedly"

**iOS:**
- Settings → Privacy → Camera → Enable for Safari/Chrome
- Clear browser cache: Settings → App → Clear Data

**Android:**
- Settings → Apps → Chrome/Firefox → Permissions → Camera → Allow

---

## 🌐 Access from Outside Network

### Ngrok (Free & Easy)

```bash
ngrok http 5173
```

Share the ngrok URL (`https://xxxxx.ngrok.io`) with anyone

### Self-Hosted VPN

- Use WireGuard or OpenVPN to access home network
- Then access: `http://192.168.1.135:5173`

### Port Forwarding (Security Risk ⚠️)

⚠️ Only for testing. Never expose to internet without HTTPS + authentication.

```bash
# Router: Forward port 5173 → computer port 5173
# Then access: http://<YOUR_PUBLIC_IP>:5173
```

---

## 📊 Performance Tips

| Setting | Desktop | Mobile |
|---------|---------|--------|
| **Camera Res** | 1080p | 480p |
| **Point Density** | 1-2 | 4-6 |
| **Particles** | Enabled | Disabled |
| **FPS** | 60 | 30-45 |

---

## 🔌 Server Ports

| Port | Service | Used By |
|------|---------|---------|
| **5173** | Web App (Vite) | Browser, Mobile |
| **3001** | CORS Proxy | Web App → VLM |
| **8080** | llama.cpp VLM | Proxy server |

All listen on `0.0.0.0` (all network interfaces)

---

## ✅ Quick Start Checklist

- [ ] Get server IP: `ipconfig` (Windows) / `ifconfig` (Mac/Linux)
- [ ] Start llama.cpp: `./llama-server ...`
- [ ] Start proxy: `node proxy-server.js`
- [ ] Start dev server: `npm run dev`
- [ ] Open on phone: `http://<IP>:5173`
- [ ] Grant camera permissions
- [ ] Test: Click **▶ Start** in Camera tab
- [ ] Send VLM message: Go to AI tab, type message, press send

---

## 📞 Support

If camera still doesn't work:
1. Check browser console (F12 → Console)
2. Look for error messages
3. Verify server is running: `curl http://192.168.1.135:5173`
4. Test camera directly in browser settings

