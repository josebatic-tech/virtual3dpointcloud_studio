#!/usr/bin/env python3
"""
ZED 2 Spatial Mapping - Simple Example
Builds a 3D mesh in real-time from stereo depth.
"""

import pyzed.sl as sl
import sys
import time

def main():
    print("[INFO] Initializing ZED 2 Camera...")

    # Create camera object
    zed = sl.Camera()
    init_params = sl.InitParameters()
    init_params.camera_resolution = sl.RESOLUTION.HD720
    init_params.depth_mode = sl.DEPTH_MODE.PERFORMANCE
    init_params.coordinate_units = sl.UNIT.METER

    # Open camera
    err = zed.open(init_params)
    if err != sl.ERROR_CODE.SUCCESS:
        print(f"[ERROR] Failed to open camera: {err}")
        sys.exit(1)

    print(f"[OK] Camera opened: {zed.get_camera_information().camera_model.name}")
    print(f"     Serial: {zed.get_camera_information().serial_number}")

    # Enable spatial mapping
    mapping_params = sl.SpatialMappingParameters()
    mapping_params.resolution = sl.SpatialMappingParameters.RESOLUTION.MEDIUM  # MEDIUM, HIGH, LOW
    mapping_params.max_memory = 1024  # MB

    err = zed.enable_spatial_mapping(mapping_params)
    if err != sl.ERROR_CODE.SUCCESS:
        print(f"[ERROR] Failed to enable spatial mapping: {err}")
        zed.close()
        sys.exit(1)

    print("[OK] Spatial mapping enabled (MEDIUM resolution)")
    print("[INFO] Capturing frames... press Ctrl+C to stop")

    frame_count = 0
    start_time = time.time()

    try:
        while True:
            if zed.grab() == sl.ERROR_CODE.SUCCESS:
                # Get spatial mapping state
                mapping_state = zed.get_spatial_mapping_state()
                frame_count += 1

                elapsed = time.time() - start_time
                fps = frame_count / elapsed if elapsed > 0 else 0

                print(f"\r[{frame_count:4d}] FPS: {fps:5.1f} | Mapping: {mapping_state.name}  ", end="", flush=True)

                # Request mesh update
                if frame_count % 30 == 0:  # Every 30 frames
                    zed.request_mesh_generation(sl.MeshType.FUSED)
            else:
                print("[WARNING] Grab failed, retrying...")
                time.sleep(0.01)

    except KeyboardInterrupt:
        print("\n[STOP] Stopping capture...")

    print(f"\n[INFO] Captured {frame_count} frames in {elapsed:.1f} seconds")

    # Extract and save mesh
    print("[INFO] Extracting mesh...")
    mesh = sl.Mesh()
    zed.extract_whole_mesh(mesh)

    print(f"[OK] Mesh extracted: {mesh.getNbVertices()} vertices, {mesh.getNbTriangles()} triangles")

    # Save mesh
    mesh_file = "zed_spatial_map.obj"
    mesh.save(mesh_file)
    print(f"[OK] Mesh saved to: {mesh_file}")

    # Cleanup
    zed.disable_spatial_mapping()
    zed.close()
    print("[OK] Camera closed")

if __name__ == "__main__":
    main()
