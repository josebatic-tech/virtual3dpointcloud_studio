import { setText } from './utils.js';
import { DOM } from './constants.js';
import { initUI } from './ui.js';

window.addEventListener('DOMContentLoaded', () => {
  initUI();
  setText(DOM.STATUS, 'waiting…');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('UNHANDLED REJECTION:', e.reason?.stack || e.reason);
  setText(DOM.STATUS, 'error: ' + (e.reason?.message || e.reason), 'error');
});
