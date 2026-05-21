# Project Context: Depth / Cloud - Virtual Meeting Space

## Overview
A real-time 3D depth visualization and virtual meeting background system. Users stream their webcam, get depth estimation via ML, visualize as interactive point cloud, and customize with camera controls, particle effects, and colored backgrounds.

**Tech Stack:** Three.js, Transformers.js (Depth Anything), WebGL, Vanilla JS, HTML/CSS

---

## Architecture

### File Structure
```
js/
├── main.js                 # Entry point, loads all modules
├── ui.js                   # UI initialization, event handlers
├── three-init.js          # Three.js scene, camera, renderer setup
├── render-loop.js         # Animation frame loop (60 FPS)
├── depth.js               # Camera access, device enumeration, media constraints
├── pointcloud.js          # Point cloud geometry, vertex updates
├── environment.js         # Scene elements (grid, floor, backdrop sphere)
├── director.js            # Director panel controls (camera, effects, backgrounds)
├── particles.js           # Particle system (rain, snow, wind)
├── postprocessing.js      # Effect composer, FXAA setup
├── store.js               # Global state (get/set/ref/setRef)
├── constants.js           # DOM IDs, model paths, defaults
├── utils.js               # Utility functions
├── streamdiffusion.js     # Img2img generation integration
├── describe.js            # Scene description (Florence-2, RealTime VLM)
├── sam.js                 # SAM segmentation
├── environment.js         # Environment/scene building
├── relight.js             # Lighting controls
├── depth.js               # Depth estimation pipeline
└── camera-controls.js     # Advanced camera movement (unused, kept for reference)

index.html                  # Single-page DOM
style.css                   # Tailored styling (dark theme)
```

### Data Flow
1. **Camera input** → `depth.js:startCamera()` streams to `<video id="video">`
2. **Depth estimation** → Transformers.js (Depth Anything Small) on canvas
3. **Point cloud** → `pointcloud.js` builds geometry, uploads to GPU
4. **Rendering** → `render-loop.js` animates, `three-init.js` handles interaction
5. **Effects** → Particles and backgrounds applied per-frame
6. **Output** → Canvas display in viewport or fullscreen camera view

---

## Key Components

### State Management (`store.js`)
- **`get(key)`** / **`set(key, value)`** - Global state (reactive-style, not reactive)
- **`ref(key)`** / **`setRef(key, value)`** - Object references (Three.js objects, DOM refs)
- Example: `get('stream')` = MediaStream, `ref('camera')` = THREE.PerspectiveCamera

### Director Panel Controls
All in `js/director.js`. Controls linked directly to state:
- **Camera Speed** (`camSpeed`) → applied in render loop
- **Lens Focus** (`lensFocus`) → smooth FOV interpolation
- **Position Buttons** (-45°, +45°) → `setCameraPosition(angle)`
- **Particle Effects** (Rain/Snow/Wind) → `toggleParticles(type)` with count + opacity
- **Background Colors** (Green/Blue/Red/Yellow) → changes renderer clear color + backdrop

### Render Loop (`render-loop.js`)
Fires every `requestAnimationFrame()`:
1. Smooth FOV interpolation toward `targetFOV`
2. Keyboard input (arrow keys, WASD) applied via velocity damping
3. Point cloud rotation (if `autoRotate` enabled)
4. Particle system updates (if active)
5. Full scene render with post-processing

### Camera Controls
- **Arrow keys / WASD** → Pan X/Y with momentum damping
- **Mouse scroll** → Smooth lens zoom (FOV change, not Z position)
- **Mouse drag** → Rotate scene (set `rotX`/`rotY`)
- **Buttons** → Preset angles (-45°, +45°)

### Particle System (`particles.js`)
- Configs: rain (2000), snow (1000), wind (500) particles
- **`createParticleSystem(type, customCount)`** → Builds GPU-resident point cloud
- **`updateParticles()`** → Per-frame position updates with wrapping
- **Opacity** → Slider controls material.opacity (0-1, 10 steps)
- **Count** → Slider regenerates system (100-5000, 100 increments)

### Background Colors (`director.js`)
- **Green** (#1a5f3f), **Blue** (#0d3b66), **Red** (#6b1a23), **Yellow** (#8b7b2f)
- Updates both:
  - Renderer clear color: `renderer.setClearColor(hex, 1)`
  - Backdrop sphere material color (if exists)

### Depth Visualization (`pointcloud.js`)
- Builds grid geometry from depth map (W × H vertices)
- Vertex positions interpolated from depth + video color
- Material: PointsMaterial with `sizeAttenuation: true`
- **Density slider** rebuilds geometry (divides res by 2-12)
- **Pt Size slider** adjusts material.size (1-8)
- **Depth Scale slider** multiplies Z position (0.5-5x)

---

## Important Patterns

### Don't
- ❌ Use HTML data attributes for state (use `store.js`)
- ❌ Add click listeners without checking element existence (`?.` pattern)
- ❌ Hardcode DOM IDs (define in `constants.js:DOM`)
- ❌ Import unnecessary dependencies (check if Three.js already has it)
- ❌ Modify renderer state outside `three-init.js` and `director.js`

### Do
- ✅ Use `get()` / `set()` for state, `ref()` / `setRef()` for object refs
- ✅ Bind sliders via `ui.js:bindSlider(id, callback, isFloat)`
- ✅ Handle element not found with `?.addEventListener`
- ✅ Store DOM IDs in `constants.js`
- ✅ Keep particle system self-contained in `particles.js`
- ✅ Smooth transitions with interpolation (e.g., FOV toward target)

---

## UI Structure (Sidebar Sections)

1. **Camera** - Start/Depth/Stop buttons, device selector, view toggle
2. **Director** - Speed slider, Lens slider, Position buttons (-45°/+45°), colors, effects
3. **Point Cloud** - Pt Size, Density, Depth, Auto-rotate
4. **Previews** - Webcam, Depth map, SAM mask toggles
5. **Describe** - Florence-2 / RealTime VLM mode
6. **StreamDiffusion** - Prompt, generation toggle
7. **Segment (SAM)** - Segmentation controls

---

## Common Tasks

### Add a New Slider
1. Add HTML in `index.html` with `<input id="...">` and value display `<span class="val">`
2. Bind in `ui.js`: `bindSlider('id', (v) => set('key', v), isFloat)`
3. Use state in render loop: `get('key')`
4. Example: Particle count slider already implemented

### Add a New Button
1. Add HTML button with unique ID
2. Add event listener in `director.js`: `document.getElementById('btnId')?.addEventListener('click', handleClick)`
3. Toggle active state: `button?.classList.toggle('active', condition)`

### Add a New Effect
1. Create particle config in `particles.js:particleConfigs`
2. Call `createParticleSystem('type')` from director
3. Update in render loop via `updateParticles()`

### Change Background
- Call `setColorBackground(colorName)` with 'green'/'blue'/'red'/'yellow'
- Updates renderer clear color + backdrop sphere

### Adjust Camera Speed
- Slider in Director (camSpeed: 0.01-0.3)
- Applied in render loop: `const speed = get('camSpeed')`

---

## Known Constraints

- **Depth model**: Depth Anything Small (not quantized for browser speed)
- **Rendering**: WebGL 2.0 required, max point cloud ~500k vertices
- **Mobile**: Touch support for rotation (1 finger), pinch-zoom (2 fingers)
- **Performance**: Depth processing every frame can be throttled via density slider
- **Colors**: Limited to 4 presets (not custom color picker)

---

## Testing Checklist

- [ ] Start camera, confirm stream visible in preview
- [ ] Depth estimation starts/stops smoothly
- [ ] Point cloud rotates/pans with mouse/touch
- [ ] Camera position buttons snap to -45°/+45°
- [ ] Speed slider changes keyboard movement speed
- [ ] Lens slider smoothly interpolates FOV (no jumps)
- [ ] Particle effects (rain/snow/wind) spawn and animate
- [ ] Particle count slider regenerates system without freezing
- [ ] Particle opacity slider adjusts visibility smoothly
- [ ] Background colors change full world (clear color + sphere)
- [ ] Switch between 3D Cloud and Camera view smoothly
- [ ] SAM segmentation works when enabled
- [ ] StreamDiffusion generation runs on camera frames

---

## Future Enhancements

- [ ] Custom background colors (color picker)
- [ ] Depth-of-field post-processing
- [ ] Recording/streaming setup
- [ ] Avatar/character positioning
- [ ] More particle effects (confetti, sparkles)
- [ ] Lighting controls (intensity, color)
- [ ] Scene composition guides (rule of thirds)
- [ ] Performance monitoring (FPS counter)

---

## Notes

- Removed FXAA and post-processing effects per simplification
- Camera-controls.js kept for reference but not used (use keyboard + scroll instead)
- Backdrop sphere optional (colors apply via renderer.setClearColor regardless)
- All sliders use momentum damping for smooth feel
- Particle systems use GPU-resident geometry (PointsMaterial) for performance
