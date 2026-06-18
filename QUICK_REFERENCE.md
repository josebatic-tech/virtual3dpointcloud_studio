# Quick Reference Card

## 🚀 Start All Services (3 Terminals)

```bash
# Terminal 1: GPU-Accelerated VLM (llama.cpp)
cd ~/llama.cpp && ./llama-server -m models/llava-7b.gguf --port 8080 --host 0.0.0.0 -ngl 33 -n 200 -c 2048 --threads 4

# Terminal 2: CORS Proxy
node proxy-server.js

# Terminal 3: Web Server
npm run dev
```

## 📱 Access URLs

| Device | URL | Notes |
|--------|-----|-------|
| **Laptop/Desktop** | `http://localhost:5173` | Development |
| **Phone (Same WiFi)** | `http://192.168.1.135:5173` | Replace IP with yours |
| **Phone (HTTPS/iOS)** | `https://192.168.1.135:5173` | With self-signed cert |
| **Phone (ngrok)** | Use ngrok URL | `ngrok http 5173` |

## 🔍 Get Your Server IP

**Windows:**
```powershell
ipconfig | findstr IPv4
```

**Mac/Linux:**
```bash
ifconfig | grep inet
```

Look for your **Wi-Fi** or **Ethernet** IP (e.g., `192.168.1.135`)

## 📋 Key Files Modified

| File | Change |
|------|--------|
| `vite.config.js` | Added `host: '0.0.0.0'` |
| `js/constants.js` | Dynamic VLM endpoint, image optimization settings |
| `js/depth.js` | Mobile camera detection, better error handling |
| `js/describe.js` | Image resizing & quality reduction |

## ⚙️ VLM Settings

```javascript
// js/constants.js
export const VLM = {
  ENDPOINT: `http://${window.location.hostname}:3001`,
  IMAGE_QUALITY: 0.6,      // JPEG quality (reduced from 0.8)
  MAX_IMAGE_SIZE: 640,     // Pixel width (reduced from 1280)
  MAX_TOKENS: 200,         // Response length
  TEMPERATURE: 0.7,        // Creativity (0-1)
};
```

## 🔌 Service Ports

| Port | Service | Access |
|------|---------|--------|
| **5173** | Vite Dev Server | Browser: `http://0.0.0.0:5173` |
| **3001** | CORS Proxy | Used by browser internally |
| **8080** | llama.cpp VLM | Used by proxy internally |

**All listen on `0.0.0.0` (all network interfaces)**

## 📱 Mobile Troubleshooting

| Issue | Solution |
|-------|----------|
| Camera not working | Check permissions, use correct IP URL |
| iOS camera fails | Use HTTPS with cert, or ngrok tunnel |
| VLM too slow | Ensure Wi-Fi connected, lower resolution |
| Rendering laggy | Reduce density slider, disable particles |

## 📚 Documentation

- **[MOBILE_SETUP.md](MOBILE_SETUP.md)** - Full mobile setup guide
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - What was changed
- **[VLM_SETUP_GUIDE.md](VLM_SETUP_GUIDE.md)** - VLM system details
- **[README.md](README.md)** - Project overview

## 🎮 UI Tabs

| Tab | Icon | Purpose |
|-----|------|---------|
| Camera | 🎥 | Start/stop camera, device select |
| Point Cloud | ☁️ | 3D visualization controls |
| Aesthetics | 🎨 | Effects, colors, camera movement |
| AI/VLM | 🤖 | Chat with AI about scene |
| Settings | ⚙️ | Advanced configuration |

## 💡 Pro Tips

1. **First VLM Response**: ~2-3 seconds (model warming up)
2. **Subsequent Responses**: ~1-2 seconds (model cached)
3. **Mobile Performance**: Use 480p resolution for smooth operation
4. **Battery Life**: Reduce screen brightness, disable particle effects
5. **Network**: Use 2.4GHz or 5GHz Wi-Fi (avoid cellular data)

## 🐛 Common Commands

```bash
# Check if services are running
netstat -ano | grep -E "5173|3001|8080"

# Test VLM endpoint
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llava-7b","messages":[{"role":"user","content":"test"}]}'

# Get local IP
ipconfig | findstr /B "IPv4"  # Windows
ifconfig | grep "inet "       # Mac/Linux
```

## 📊 Performance Reference

| Metric | Value |
|--------|-------|
| **GPU Layers Offloaded** | 33/33 (all on GPU) |
| **Inference Speed** | 5-10 tokens/second |
| **First Response** | ~2-3 seconds |
| **Image Size** | ~30-40KB (optimized) |
| **Mobile Resolution** | 480p (auto-optimized) |

## ✅ Verification Checklist

- [ ] Services running: `netstat -ano | grep 5173`
- [ ] Vite ready: `npm run dev` shows "ready in Xms"
- [ ] Proxy running: Check terminal output
- [ ] llama.cpp loaded: Check for "offloaded 33/33"
- [ ] Access locally: `http://localhost:5173` loads app
- [ ] Access remotely: `http://<IP>:5173` from phone works
- [ ] Camera starts: Click ▶ Start button
- [ ] VLM works: Ask question in AI tab, get response

---

**Need help?** Check the full docs in `MOBILE_SETUP.md` or `IMPLEMENTATION_SUMMARY.md`
