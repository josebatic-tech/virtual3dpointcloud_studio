#!/usr/bin/env python3
"""
Zed 2 WebSocket Bridge Server

Streams camera frames and 3D point cloud from the Zed 2 SDK to connected WebSocket clients.
Binary protocol: [version:u32][nPoints:u32][jpegSize:u32] + JPEG + XYZ:f32*N*3 + RGB:f32*N*3

Install dependencies:
  pip install pyzed websockets numpy opencv-python
"""

import asyncio
import websockets
import numpy as np
import pyzed.sl as sl
import struct
import cv2
import json
import sys

# Global state
zed = None
connected_clients = set()
current_density = 4
is_running = True

async def handler(websocket, path):
    """Handle WebSocket client connections."""
    connected_clients.add(websocket)
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                global current_density
                if 'density' in data:
                    current_density = max(1, int(data['density']))
            except json.JSONDecodeError:
                pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)

async def capture_and_broadcast():
    """Capture frames from Zed and broadcast to all connected clients."""
    global zed, current_density, is_running

    image = sl.Mat()
    point_cloud = sl.Mat()

    print("Starting capture loop...")

    while is_running:
        if zed.grab() == sl.ERROR_CODE.SUCCESS:
            zed.retrieve_image(image, sl.VIEW.LEFT)
            zed.retrieve_measure(point_cloud, sl.MEASURE.XYZRGBA)

            # Get numpy arrays
            frame = image.get_data()  # BGRA uint8
            pc = point_cloud.get_data()  # (H, W, 4) float32 XYZRGBA

            if frame is None or pc is None:
                await asyncio.sleep(0.01)
                continue

            h, w = frame.shape[:2]

            # Subsample based on density
            y_indices = np.arange(0, h, current_density)
            x_indices = np.arange(0, w, current_density)

            # Extract subsampled frame and point cloud
            frame_sub = frame[np.ix_(y_indices, x_indices)]  # (H/d, W/d, 4) BGRA
            pc_sub = pc[np.ix_(y_indices, x_indices)]  # (H/d, W/d, 4) XYZRGBA

            # Flatten and filter valid points (not NaN)
            h_sub, w_sub = frame_sub.shape[:2]
            total_sub = h_sub * w_sub

            pc_flat = pc_sub.reshape((total_sub, 4))  # (N, 4) XYZRGBA

            # Mask valid points (Z != 0 and not NaN)
            valid_mask = np.isfinite(pc_flat[:, 0]) & np.isfinite(pc_flat[:, 1]) & np.isfinite(pc_flat[:, 2]) & (pc_flat[:, 2] != 0)

            xyz = pc_flat[valid_mask, :3].astype(np.float32)  # (N_valid, 3)
            rgba_packed = pc_flat[valid_mask, 3].astype(np.uint32)  # (N_valid,)

            # Unpack RGBA from the packed 4th float
            # In Zed, the 4th component is: packed as uint32 with BGRA order
            r = ((rgba_packed >> 16) & 0xFF).astype(np.float32) / 255.0
            g = ((rgba_packed >> 8) & 0xFF).astype(np.float32) / 255.0
            b = (rgba_packed & 0xFF).astype(np.float32) / 255.0

            rgb = np.stack([r, g, b], axis=1)  # (N_valid, 3)

            # Compress frame to JPEG (subsampled BGR)
            frame_bgr = frame_sub[:, :, :3]  # Drop alpha
            _, jpeg_bytes = cv2.imencode('.jpg', frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
            jpeg_bytes = jpeg_bytes.tobytes()
            jpeg_size = len(jpeg_bytes)

            # Build binary message
            n = xyz.shape[0]
            header = struct.pack('III', 1, n, jpeg_size)  # version=1, nPoints, jpegSize

            # Serialize XYZ and RGB as contiguous float32 arrays
            xyz_bytes = xyz.tobytes()
            rgb_bytes = rgb.tobytes()

            message = header + jpeg_bytes + xyz_bytes + rgb_bytes

            # Broadcast to all connected clients
            if connected_clients:
                # Use gather to broadcast in parallel without blocking
                await asyncio.gather(
                    *[ws.send(message) for ws in list(connected_clients)],
                    return_exceptions=True
                )

        # Yield to event loop
        await asyncio.sleep(0)

async def main():
    """Initialize Zed camera and start WebSocket server."""
    global zed, is_running

    # Initialize Zed camera
    init_params = sl.InitParameters()
    init_params.camera_resolution = sl.RESOLUTION.HD720
    init_params.depth_mode = sl.DEPTH_MODE.PERFORMANCE
    init_params.coordinate_units = sl.UNIT.METER

    zed = sl.Camera()
    err = zed.open(init_params)

    if err != sl.ERROR_CODE.SUCCESS:
        print(f"[ERROR] Failed to open Zed camera: {err}")
        sys.exit(1)

    print("[OK] Zed 2 initialized (1280x720, PERFORMANCE depth)")
    print(f"  Serial: {zed.get_camera_information().serial_number}")
    print("Starting WebSocket server on ws://localhost:8765...")

    try:
        # Start WebSocket server
        async with websockets.serve(handler, "localhost", 8765):
            print("[OK] WebSocket server listening on port 8765")
            # Run capture loop concurrently
            await capture_and_broadcast()
    except KeyboardInterrupt:
        print("\n[STOP] Stopping server...")
    finally:
        is_running = False
        zed.close()
        print("[OK] Zed camera closed")

if __name__ == "__main__":
    asyncio.run(main())
