/**
 * Map a mouse click on a video element to actual pixel coordinates.
 *
 * The small 140x80 preview uses object-fit: cover, which crops the video.
 * This function reverses that cropping to find the true video pixel.
 */
export function clickToVideoCoords(video, clientX, clientY) {
  const rect = video.getBoundingClientRect();
  const clickX = clientX - rect.left;
  const clickY = clientY - rect.top;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = rect.width;
  const ch = rect.height;

  const videoAspect = vw / vh;
  const containerAspect = cw / ch;

  let pixelX, pixelY;

  if (videoAspect > containerAspect) {
    const renderH = ch;
    const renderW = renderH * videoAspect;
    const offsetX = (cw - renderW) / 2;
    pixelX = ((clickX - offsetX) / renderW) * vw;
    pixelY = (clickY / renderH) * vh;
  } else {
    const renderW = cw;
    const renderH = renderW / videoAspect;
    const offsetY = (ch - renderH) / 2;
    pixelX = (clickX / renderW) * vw;
    pixelY = ((clickY - offsetY) / renderH) * vh;
  }

  return {
    x: Math.max(0, Math.min(vw - 1, pixelX)),
    y: Math.max(0, Math.min(vh - 1, pixelY)),
  };
}

/**
 * Create an offscreen canvas with a mirrored video frame.
 * Returns { canvas, ctx, width, height }.
 */
export function mirrorFrame(video, width, height) {
  const w = width || video.videoWidth;
  const h = height || video.videoHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.scale(-1, 1);
  ctx.drawImage(video, -w, 0, w, h);
  return { canvas: c, ctx, width: w, height: h };
}

/**
 * Get an element by id, with optional null guard.
 * Throws if element is missing (helps catch stale DOM references).
 */
export function getElem(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

/** Update textContent and className of an element in one call. */
export function setText(id, text, className) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (className !== undefined) el.className = className;
}
