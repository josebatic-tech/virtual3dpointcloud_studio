import { get, ref, setRef } from './store.js';
import { VLM } from './constants.js';
import { setCameraPosition, setColorBackground, toggleParticles } from './director.js';
import { describeViaVLM } from './describe.js';

/**
 * Director agent: turns natural-language commands (typed or spoken)
 * into app actions. Tries a fast rule-based parser first; if nothing
 * matches, falls back to the local LLM (llama.cpp via the CORS proxy)
 * asking for a structured JSON command.
 */

const LLM_SYSTEM_PROMPT = `You convert a spoken command for a 3D point cloud studio app into a JSON action.
Allowed actions:
  {"action":"set_background","value":"green|blue|red|yellow"}
  {"action":"set_particles","value":"rain|snow|wind|off"}
  {"action":"set_auto_rotate","value":"on|off"}
  {"action":"set_camera","value":"left|right|center"}
  {"action":"zoom","value":"in|out"}
  {"action":"set_person_only","value":"on|off"}
  {"action":"fullscreen"}
  {"action":"describe_scene"}
  {"action":"none"}
Respond with ONLY the JSON object, nothing else.`;

/** Parse a command with keyword rules. Returns {action, value} or null. */
export function parseCommand(text) {
  const t = text.toLowerCase();
  const wantsOff = /\b(stop|off|remove|clear|disable|no more|hide)\b/.test(t);

  if (/\b(describe|caption|what (do you|can you) see|what'?s (in|on)|tell me about)\b/.test(t)) {
    return { action: 'describe_scene' };
  }
  if (/\bfull\s?screen\b/.test(t)) return { action: 'fullscreen' };

  if (/\b(person only|only me|just me|hide .*background|remove .*background|cut .*background)\b/.test(t)) {
    return { action: 'set_person_only', value: 'on' };
  }
  if (/\b(show .*background|everything back|disable person)\b/.test(t)) {
    return { action: 'set_person_only', value: 'off' };
  }

  if (/\brain/.test(t)) return { action: 'set_particles', value: wantsOff ? 'off' : 'rain' };
  if (/\bsnow/.test(t)) return { action: 'set_particles', value: wantsOff ? 'off' : 'snow' };
  if (/\bwind/.test(t)) return { action: 'set_particles', value: wantsOff ? 'off' : 'wind' };
  if (/\bparticles?\b/.test(t) && wantsOff) return { action: 'set_particles', value: 'off' };

  if (/\b(rotate|rotation|rotating|spin|orbit)\b/.test(t)) {
    return { action: 'set_auto_rotate', value: wantsOff ? 'off' : 'on' };
  }

  if (/\bzoom\s*out\b/.test(t) || /\b(further|farther|away)\b/.test(t)) return { action: 'zoom', value: 'out' };
  if (/\bzoom\b/.test(t) || /\bcloser\b/.test(t)) return { action: 'zoom', value: 'in' };

  if (/\b(camera|view|look)\b/.test(t)) {
    if (/\bleft\b/.test(t)) return { action: 'set_camera', value: 'left' };
    if (/\bright\b/.test(t)) return { action: 'set_camera', value: 'right' };
    if (/\b(center|centre|reset|front)\b/.test(t)) return { action: 'set_camera', value: 'center' };
  }

  const color = (t.match(/\b(green|blue|red|yellow)\b/) || [])[1];
  if (color) return { action: 'set_background', value: color };

  return null;
}

/** Ask the local LLM to map free-form text to a command. */
async function parseViaLLM(text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${VLM.ENDPOINT}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      signal: controller.signal,
      body: JSON.stringify({
        model: VLM.MODEL,
        messages: [
          { role: 'system', content: LLM_SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        max_tokens: 60,
        temperature: 0,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const json = content.match(/\{[\s\S]*\}/);
    if (!json) return null;
    const cmd = JSON.parse(json[0]);
    return cmd.action && cmd.action !== 'none' ? cmd : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function setAutoRotate(on) {
  if (!!get('autoRotate') !== on) document.getElementById('btnRotate')?.click();
}

function setPersonOnly(on) {
  const el = document.getElementById('togPersonOnly');
  if (el && el.checked !== on) {
    el.checked = on;
    el.dispatchEvent(new Event('change'));
  }
}

function setParticles(value) {
  const cur = get('particleType');
  if (value === 'off') {
    if (cur) toggleParticles(cur);
  } else if (cur !== value) {
    toggleParticles(value);
  }
}

function zoom(dir) {
  const cur = ref('targetFOV') ?? 55;
  const next = Math.max(20, Math.min(100, cur + (dir === 'in' ? -15 : 15)));
  setRef('targetFOV', next);
  const slider = document.getElementById('lensFocus');
  if (slider) {
    slider.value = next;
    const val = document.getElementById('lensFocusVal');
    if (val) val.textContent = next;
  }
}

/** Execute a parsed command. Returns a human-readable confirmation. */
async function executeCommand(cmd, originalText) {
  switch (cmd.action) {
    case 'set_background':
      setColorBackground(cmd.value);
      return `Background set to ${cmd.value}.`;
    case 'set_particles':
      setParticles(cmd.value);
      return cmd.value === 'off' ? 'Particles off.' : `${cmd.value} on.`;
    case 'set_auto_rotate':
      setAutoRotate(cmd.value === 'on');
      return `Auto-rotate ${cmd.value}.`;
    case 'set_camera':
      setCameraPosition(cmd.value === 'left' ? -45 : cmd.value === 'right' ? 45 : 0);
      return `Camera ${cmd.value}.`;
    case 'zoom':
      zoom(cmd.value);
      return `Zoomed ${cmd.value}.`;
    case 'set_person_only':
      setPersonOnly(cmd.value === 'on');
      return `Person-only mode ${cmd.value}.`;
    case 'fullscreen':
      ref('toggleFullscreen')?.();
      return 'Toggled fullscreen.';
    case 'describe_scene': {
      const result = await describeViaVLM(originalText || 'Describe what you see in one short sentence.');
      return result.error ? `Describe failed: ${result.error}` : result.content;
    }
    default:
      return null;
  }
}

/**
 * Main entry point: run a natural-language director command.
 * Returns a confirmation string for the UI.
 */
export async function runDirectorCommand(text) {
  if (!text || !text.trim()) return 'I did not catch that.';

  let cmd = parseCommand(text);
  if (!cmd) cmd = await parseViaLLM(text);
  if (!cmd) return `No matching command for: "${text}"`;

  const reply = await executeCommand(cmd, text);
  return reply || `No matching command for: "${text}"`;
}
