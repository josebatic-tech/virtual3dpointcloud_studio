#!/usr/bin/env python3
"""
ZED 2 Spatial Mapping from Recording
Builds a 3D mesh from a recorded .svo2 file.
"""

import pyzed.sl as sl
import sys
import time
import os

def main():
    recording_file = "zed_recording_example.svo2"

    if not os.path.exists(recording_file):
        print(f"[ERROR] Recording file not found: {recording_file}")
        sys.exit(1)

    print(f"[INFO] Loading recording: {recording_file}")

    # Create camera object
    zed = sl.Camera()
    init_params = sl.InitParameters()
    init_params.set_from_svo_file(recording_file)
    init_params.depth_mode = sl.DEPTH_MODE.PERFORMANCE
    init_params.coordinate_units = sl.UNIT.METER

    # Open camera from SVO file
    err = zed.open(init_params)
    if err != sl.ERROR_CODE.SUCCESS:
        print(f"[ERROR] Failed to open recording: {err}")
        sys.exit(1)

    print(f"[OK] Recording opened")

    # Get total frames
    total_frames = zed.get_svo_number_of_frames()
    print(f"     Total frames: {total_frames}")

    # Enable positional tracking (required for spatial mapping)
    print("[INFO] Enabling positional tracking...")
    tracking_params = sl.PositionalTrackingParameters()
    err = zed.enable_positional_tracking(tracking_params)
    if err != sl.ERROR_CODE.SUCCESS:
        print(f"[WARNING] Positional tracking failed: {err}")

    # Enable spatial mapping
    print("[INFO] Enabling spatial mapping...")
    err = zed.enable_spatial_mapping()
    if err != sl.ERROR_CODE.SUCCESS:
        print(f"[ERROR] Failed to enable spatial mapping: {err}")
        zed.close()
        sys.exit(1)

    print("[OK] Spatial mapping enabled")
    print("[INFO] Processing recording...")

    frame_count = 0
    start_time = time.time()

    try:
        while frame_count < total_frames:
            if zed.grab() == sl.ERROR_CODE.SUCCESS:
                mapping_state = zed.get_spatial_mapping_state()
                frame_count += 1

                progress = (frame_count / total_frames) * 100
                elapsed = time.time() - start_time
                fps = frame_count / elapsed if elapsed > 0 else 0

                print(f"\r[{frame_count:4d}/{total_frames}] {progress:5.1f}% | FPS: {fps:5.1f} | State: {mapping_state.name}  ", end="", flush=True)

                # Mesh is generated automatically as we process frames
            else:
                print(f"[WARNING] Frame {frame_count} failed")
                time.sleep(0.01)

    except KeyboardInterrupt:
        print("\n[STOP] Stopping processing...")

    elapsed = time.time() - start_time
    print(f"\n[INFO] Processed {frame_count} frames in {elapsed:.1f} seconds")

    # Extract and save mesh
    print("[INFO] Extracting final mesh...")
    mesh = sl.Mesh()
    zed.extract_whole_mesh(mesh)

    vertices = mesh.getNbVertices()
    triangles = mesh.getNbTriangles()
    print(f"[OK] Mesh extracted: {vertices} vertices, {triangles} triangles")

    if vertices > 0:
        # Save mesh
        mesh_file = "zed_spatial_map.obj"
        mesh.save(mesh_file)
        print(f"[OK] Mesh saved to: {mesh_file}")

        # Also save as PLY for better quality
        mesh_ply = "zed_spatial_map.ply"
        mesh.save(mesh_ply)
        print(f"[OK] Mesh also saved as: {mesh_ply}")
    else:
        print("[WARNING] No mesh generated (recording may be too short)")

    # Cleanup
    zed.disable_spatial_mapping()
    zed.close()
    print("[OK] Recording closed")

if __name__ == "__main__":
    main()
