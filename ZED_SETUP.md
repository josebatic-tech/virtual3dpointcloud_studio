# Zed 2 Camera Integration Setup

This app now supports the Zed 2 stereo camera with real-time depth and point cloud streaming via the native Zed SDK.

## Quick Start

### 1. Install Python Dependencies

```bash
pip install pyzed websockets numpy opencv-python
```

**Note:** The `pyzed` package requires the Zed SDK to be installed on your system. Download from: https://www.stereolabs.com/developers/release/

### 2. Run the Zed WebSocket Bridge Server

Before starting the app, run the WebSocket server in a terminal:

```bash
python zed_server.py
```

Expected output:
```
✓ Zed 2 initialized (1280×720, PERFORMANCE depth)
  Serial: XXXXXXXXX
Starting WebSocket server on ws://localhost:8765...
✓ WebSocket server listening on port 8765
```

### 3. Use in the App

1. **Open the app** in your browser (http://localhost:5174/)
2. **Start Camera** — select your Zed 2 from the device dropdown
3. **Zed Connect** button appears → Click it to connect to the bridge server
4. **Click Depth** to start the depth stream
   - The app will NOT load the ML depth model when using Zed
   - Instead, it receives real 3D point cloud data from the SDK
5. **Adjust density slider** to control point cloud subsampling (matches server-side)

## Technical Details

### Binary Protocol (WebSocket)

The server sends frames in this format:

```
Header (12 bytes):
  [version: u32] [nPoints: u32] [jpegSize: u32]
Payload:
  [JPEG RGB frame: jpegSize bytes]
  [XYZ coords: nPoints * 3 * f32]
  [RGB colors: nPoints * 3 * f32]
```

### Data Flow

```
Zed 2 Camera
  ↓ (pyzed SDK)
Python Server (zed_server.py)
  ↓ (binary WebSocket frames)
Browser (js/zed.js)
  ↓ (parse + decode)
Three.js Scene (ref('points') geometry)
  ↓
OpenGL Rendering
```

### Key Differences from ML Depth Mode

| Feature | ML Depth | Zed 2 SDK |
|---------|----------|-----------|
| Model Loading | Downloads ~20MB | None |
| Depth Latency | ~100-200ms per frame | ~30ms (SDK) |
| Accuracy | Estimated from single RGB frame | Real stereo depth |
| Point Cloud | Reconstructed from 2D depth map | Native 3D XYZ from SDK |
| Resolution | Configurable (360p–1080p) | Fixed at 1280×720 (configurable in code) |
| Performance | GPU-accelerated (WASM/WebGPU) | SDK (CUDA on NVIDIA GPUs) |

## Troubleshooting

### "Cannot connect to Zed server"
- Ensure `python zed_server.py` is running
- Check the server is listening on port 8765
- Verify the Zed 2 camera is connected via USB

### "Zed SDK not found"
- Install the Zed SDK: https://www.stereolabs.com/developers/release/
- Verify pyzed installation: `python -c "import pyzed.sl"`

### Slow performance
- Increase the **Density** slider to reduce point count (more aggressive subsampling)
- Ensure your GPU/CPU has adequate performance
- Check system resource usage while running

### Camera selection not showing Zed option
- The Zed 2 must be connected via USB before opening the app
- Refresh the browser after connecting the camera

## Configuration

Edit `zed_server.py` to adjust:

```python
init_params.camera_resolution = sl.RESOLUTION.HD720  # Change to HD1080, VGA, etc.
init_params.depth_mode = sl.DEPTH_MODE.PERFORMANCE  # Or QUALITY, ULTRA
init_params.coordinate_units = sl.UNIT.METER  # Or MILLIMETER, CENTIMETER
```

Then restart the server.

## Files Modified/Added

- **New:** `zed_server.py` — Python WebSocket bridge
- **New:** `js/zed.js` — Browser client module
- **Modified:** `index.html` — Added Zed connect UI
- **Modified:** `js/constants.js` — Added Zed constants
- **Modified:** `js/depth.js` — Added Zed detection
- **Modified:** `js/ui.js` — Added Zed integration logic

## Notes

- The Zed row only appears when a Zed camera device is detected in the device list
- When Zed is connected, the ML depth model is never loaded (saves bandwidth)
- Camera switch and resolution changes properly clean up Zed connection
- Point cloud density slider updates are sent to the server in real-time
