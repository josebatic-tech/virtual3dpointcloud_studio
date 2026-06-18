# 3D Point Cloud Studio — Real-time Depth Visualization & AI Vision

A web-based application that combines **3D depth point cloud visualization**, **real-time object segmentation (SAM)**, and **Vision Language Model scene descriptions** using LLaVA with llama.cpp GPU acceleration.

**✨ Works on Desktop, Laptop, Tablet, Phone (iOS & Android)**

## Features

✨ **3D Point Cloud Visualization** — Real-time WebGL rendering of depth maps as interactive 3D point clouds  
🎥 **Live Webcam Feed** — Stream camera input with depth estimation (all devices)  
🤖 **AI Vision Chat** — Ask questions about scenes using LLaVA VLM with GPU acceleration  
🎯 **SAM Segmentation** — Segment objects by clicking; mask-aware depth extraction  
🔄 **Viewport Toggle** — Switch between 3D point cloud and camera views  
📊 **Real-time Previews** — Simultaneous webcam, depth map, and segmentation displays  
⚡ **GPU-Accelerated** — NVIDIA GPU support for fast VLM inference (33/33 layers offloaded)  
📱 **Mobile First** — Full iOS/Android support with optimized constraints  
🎨 **VS Code Tabs UI** — Modular tab interface for Camera, Point Cloud, Aesthetics, AI, Settings  

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│    Browser (Vite Dev Server on all interfaces:5173)       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Frontend                                                  │
│  ├── Camera & Depth (WebGPU/WASM)                        │
│  ├── 3D Point Cloud (Three.js WebGL)                     │
│  ├── SAM Segmentation                                    │
│  ├── VS Code Tabs UI                                     │
│  └── VLM Chat Interface                                  │
│                                                            │
│  POST /v1/chat/completions (image + text)                │
└────────────┬─────────────────────────────────────────────┘
             │
             │ (JSON with base64 image)
             │
┌────────────▼─────────────────────────────────────────────┐
│      CORS Proxy (Node.js) - Port 3001 (all interfaces)   │
├────────────────────────────────────────────────────────────┤
│  • Strips duplicate CORS headers                          │
│  • Adds proper Access-Control-Allow-Origin headers       │
│  • Forwards requests to llama.cpp                         │
└────────────┬─────────────────────────────────────────────┘
             │
             │ (Plain HTTP)
             │
┌────────────▼─────────────────────────────────────────────┐
│   llama.cpp VLM Server - Port 8080 (all interfaces)      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  • LLaVA 7.24B Model (4.1GB, Q4_K_M quantized)          │
│  • All 33 layers offloaded to GPU (NVIDIA CUDA)          │
│  • ~5-10 tokens/second inference speed                   │
│  • OpenAI-compatible API (/v1/chat/completions)         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Service Communication

```
Device 1 (Desktop/Mobile)          Device 2 (Server/Host)
    ├─ http://192.168.1.135:5173  ──→ Vite Dev Server (5173)
    │                                 ├─ Serves HTML/JS/CSS
    │                                 └─ Listens on 0.0.0.0
    │
    ├─ POST /v1/chat/completions ──→ CORS Proxy (3001)
    │  (with image + text)            ├─ Adds CORS headers
    │                                 └─ Forwards request
    │
    └─ /v1/chat/completions ──→ llama.cpp (8080)
       (forwarded)                 └─ Returns AI response

All services listen on 0.0.0.0 (all network interfaces)
Accessible from any device on the same network
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start VLM Server (llama.cpp with GPU)

**Windows/Mac/Linux:**
```bash
cd ~/llama.cpp
./llama-server -m models/llava-7b.gguf --port 8080 --host 0.0.0.0 \
  -ngl 33 -n 200 -c 2048 --threads 4
```

This starts the GPU-accelerated VLM server on `0.0.0.0:8080`.

**Note**: First run downloads model. Subsequent runs are instant.

### 3. Start CORS Proxy (New Terminal)

```bash
node proxy-server.js
```

This forwards requests from browser to VLM on `0.0.0.0:3001`.

### 4. Start Development Server (New Terminal)

```bash
npm run dev
```

The app will be available on all network interfaces.

### 5. Access the App

**Desktop (Localhost):**
```
http://localhost:5173
```

**Mobile (Same Network):**
```
http://<YOUR_SERVER_IP>:5173
```

Get your IP:
- Windows: `ipconfig | findstr IPv4`
- Mac/Linux: `ifconfig | grep inet`

Example: `http://192.168.1.135:5173`

### 6. Use the App

1. Click **▶ Start** in Camera tab to activate your webcam
2. Grant camera permissions when prompted
3. Go to **AI/VLM** tab to ask questions about the scene
4. Use **Point Cloud** tab to adjust visualization
5. Customize appearance in **Aesthetics** tab

**📱 Mobile Setup**: See [MOBILE_SETUP.md](MOBILE_SETUP.md) for iOS/Android specific instructions.

## Installation Details

### System Requirements

- **Browser**: Chrome, Firefox, Safari (WebGL support required)
- **Camera**: USB webcam or built-in camera
- **RAM**: 8GB minimum (16GB+ recommended for smooth depth inference)
- **GPU**: NVIDIA (CUDA) recommended; CPU mode supported but slower

### Optional: Python Backend (StreamDiffusion)

For real-time image generation feature (experimental):

```bash
cd backend
pip install -r requirements_sd.txt
python -m uvicorn streamdiffusion_api:app --host 0.0.0.0 --port 8001
```

## Configuration

### Vision Model Selection

**In browser (Describe section):**
- **Florence-2**: Fast, runs in-browser (250ms per frame), no API needed
- **RealTime-VLM**: More accurate, uses Ollama backend (requires `ollama serve` running)

### Depth Estimation

Edit `files/js/depth.js` to change the model:
```javascript
// Line 8
const MODEL_ID = "depth-anything/Depth-Anything-Small";
```

Other options:
- `"depth-anything/Depth-Anything-Large"` — slower, higher quality
- `"metric3d/metric-depth-small"` — metric depth values

### SAM Segmentation

The Segment Anything Model loads automatically. First run downloads ~380MB.

Click on the webcam preview to select objects. Use **◀** / **▶** buttons to browse masks.

### Point Cloud Parameters

Sidebar sliders control:
- **Pt Size** — Point size (1-8 pixels)
- **Density** — Sampling density (2-12; higher = more points)
- **Depth Scale** — Z-axis exaggeration (0.5-5x)
- **Auto-rot** — Automatic 3D rotation

## Features Explained

### Vision Language Model (Describe)

Two modes available:

| Mode | Speed | Quality | Requirements |
|------|-------|---------|--------------|
| **Florence-2** | ~250ms | Good | Browser only |
| **RealTime-VLM** | ~800ms | Excellent | Ollama + llava model |

**How it works:**
1. Click "◈ Describe Scene"
2. Current webcam frame is sent to the selected model
3. Model generates text description of the scene
4. Result appears in the "Describe" section

**Example outputs:**
- "A person sitting at a desk with a computer monitor"
- "Kitchen with white cabinets and marble countertop"
- "Indoor office space with plants and windows"

### SAM Segmentation

**Segment Anything Model** — Click objects to isolate them.

**How to use:**
1. Enable SAM toggle
2. Click on any object in the webcam preview
3. The model will segment that object with a colored mask
4. Use **◀** / **▶** to browse alternative masks
5. Depth is calculated only for the selected mask

### 3D Point Cloud

**Interactive visualization:**
- **Left-click + drag** — Rotate view
- **Scroll** — Zoom in/out
- **"3D Cloud" / "Camera" buttons** — Toggle between views

The point cloud updates in real-time as depth is estimated. Color represents depth distance.

## File Structure

```
pointcloud_vlm/
├── README.md                           ← You are here
├── files/                              ← Frontend (web app)
│   ├── index.html                      ← Main page
│   ├── style.css                       ← Styling
│   ├── js/
│   │   ├── main.js                     ← Entry point
│   │   ├── depth.js                    ← Depth estimation
│   │   ├── describe.js                 ← VLM integration
│   │   ├── sam.js                      ← Segmentation
│   │   ├── pointcloud.js               ← 3D rendering
│   │   ├── ui.js                       ← Event handlers
│   │   ├── three-init.js               ← Three.js setup
│   │   ├── store.js                    ← State management
│   │   └── utils.js                    ← Utilities
│   ├── node_modules/                   ← Dependencies (Three.js, Transformers.js)
│   └── serve.py                        ← Simple server (optional)
├── backend/                            ← Backend (optional, for StreamDiffusion)
│   ├── streamdiffusion_api.py          ← FastAPI server
│   ├── requirements_sd.txt             ← Python dependencies
│   └── start_sd.ps1                    ← Startup script
├── scene_to_image.py                   ← Legacy: image generation (not used)
└── app_scene_to_image.py               ← Legacy: Streamlit app (not used)
```

## Troubleshooting

### Camera Not Working

**Problem:** Webcam preview shows black or doesn't start  
**Solution:**
1. Verify camera is not already in use (close other apps)
2. Allow browser permission to access camera
3. Try a different browser (Safari, Firefox, Chrome)
4. Check browser console (F12) for errors

### Depth Model Won't Load

**Problem:** "Downloading transformers models" takes forever or fails  
**Solution:**
1. Check internet connection (model is ~500MB)
2. Increase timeout in `depth.js` (line 140)
3. Use smaller model: `"Depth-Anything-Small"` (already default)
4. Check browser console for network errors

### Ollama Not Responding

**Problem:** "RealTime-VLM" mode says "error"  
**Solution:**
1. Verify Ollama is running: `ollama serve`
2. Check CORS is enabled: `$env:OLLAMA_ORIGINS="*"` (PowerShell)
3. Verify model is pulled: `ollama list` (should show `llava`)
4. Test API: `curl http://localhost:11434/api/tags`

### SAM Takes Too Long to Load

**Problem:** "loading…" under SAM toggle for more than 2 minutes  
**Solution:**
1. First run downloads ~380MB — this is normal
2. Check internet connection
3. Try again (it's cached after first run)
4. Use browser DevTools Network tab to see progress

### 3D View Doesn't Appear / Black Canvas

**Problem:** 3D point cloud canvas is black or doesn't render  
**Solution:**
1. Click "3D Cloud" button to ensure it's active
2. Try rotating with mouse drag (might be just zoomed out)
3. Check browser console for WebGL errors
4. Ensure hardware acceleration is enabled in browser settings
5. Try a different browser (WebGL support varies)

### Performance Issues

**Problem:** Slow frame rate or stuttering  
**Solution:**
1. Reduce **Density** slider (fewer points = faster)
2. Reduce **Pt Size** slider
3. Use smaller depth model (already using "Small")
4. Close other browser tabs
5. Try camera view instead of 3D (less rendering)

### CORS Errors

**Problem:** "Access to XMLHttpRequest has been blocked by CORS"  
**Solution:**
1. Ensure Ollama has `OLLAMA_ORIGINS="*"` set before starting
2. Restart Ollama: kill process and rerun with env variable
3. Use separate terminal so env vars persist

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F12` | Open Developer Console |
| `Scroll` | Zoom 3D view |
| `Left-drag` | Rotate 3D view |

## Development

### Adding a New VLM Model

Edit `files/js/describe.js`:

```javascript
// Add new endpoint
async function describeViaCustomAPI(imageB64) {
  const res = await fetch('http://your-api:port/endpoint', {
    method: 'POST',
    body: JSON.stringify({ image_b64: imageB64 })
  });
  return (await res.json()).caption;
}

// Wire up in describeScene():
if (mode === 'custom') {
  return await describeViaCustomAPI(frameB64);
}
```

### Modifying Depth Resolution

In `files/js/depth.js`:

```javascript
// Line 130 — change output resolution
const depthData = await pipe({
  image: canvas,
  // Add options here
});
```

### Customizing Colors

In `files/style.css`, modify CSS variables:

```css
:root {
  --accent: #0077cc;      /* UI accent color */
  --bg: #eef1f7;          /* Background */
  --text: #1a2040;        /* Text color */
}
```

## Performance Tips

1. **Use GPU if available** — Much faster than CPU
2. **Reduce point density** — Trade detail for FPS
3. **Use Florence-2 mode** — Faster than Ollama VLM
4. **Smaller depth model** — Already using "Small" by default
5. **Close browser tabs** — Reduce memory/CPU competition

## Known Limitations

- **No audio support** — Vision-only application
- **Webcam required** — Can't use uploaded images yet
- **Single camera** — No multi-camera support
- **Offline VLM** — Florence-2 only; RealTime-VLM requires Ollama
- **No model customization** — Depth/SAM models are fixed (for stability)

## Future Enhancements

- [ ] Image upload (no webcam needed)
- [ ] Point cloud export (PLY/OBJ format)
- [ ] Custom depth models selector
- [ ] Multi-camera support
- [ ] Real-time video recording
- [ ] StreamDiffusion integration (in progress)

## Credits

- **Depth Anything** — https://github.com/LiheYoung/Depth-Anything
- **Segment Anything** — https://github.com/facebookresearch/segment-anything
- **Florence-2** — https://github.com/microsoft/Florence
- **Three.js** — https://threejs.org/
- **Transformers.js** — https://xenova.github.io/transformers.js/
- **RealTime-VLM** — https://github.com/alessioborgi/RealTime-VLM
- **Ollama** — https://ollama.ai/

## License

MIT License — feel free to use and modify this project.

## Support

For issues or questions:
1. Check the **Troubleshooting** section above
2. Review browser console (F12) for error messages
3. Check Ollama logs: `ollama serve` output
4. Open an issue on GitHub: https://github.com/josebatic-tech/pointcloud_vlm/issues

---

**Happy depth exploring!** 🚀
