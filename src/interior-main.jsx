import React from 'react';
import ReactDOM from 'react-dom/client';
import AppShell from './components/AppShell';
import './styles.css';

// ── postMessage bridge ─────────────────────────────────────────
// Listens for NOVA_INTERIOR_TASK_START from parent nova.html
// and triggers the Interior Agent workflow automatically.

function notifyParent(type, payload = {}) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, source: 'interior-studio', ...payload }, '*');
    }
  } catch (_) { /* cross-origin guard */ }
}

// Expose to React app via window so agentRunner can call it.
window.__novaInteriorBridge = { notifyParent };

window.addEventListener('message', (event) => {
  const { type, prompt, taskId, mode } = event.data || {};
  if (type !== 'NOVA_INTERIOR_TASK_START') return;

  // Wait for store to be ready then auto-start.
  const tryStart = () => {
    const store = window.__interiorStore;
    if (!store) { setTimeout(tryStart, 120); return; }
    const state = store.getState();
    if (!state.isGenerating) {
      // Pre-fill the requirement with the NOVA prompt.
      if (prompt) {
        // Trigger generation with prompt derived from NOVA task.
        import('./utils/agentRunner').then(({ runInteriorAgents }) => {
          const requirements = {
            projectName: prompt,
            roomType: detectRoomType(prompt),
            roomWidth: 8,
            roomDepth: 7,
            ceilingHeight: 3.2,
            style: detectStyle(prompt),
            colorMood: 'warm oat · natural wood · stone',
            requiredZones: 'Dining, lounge, bar counter',
            furnitureNeeds: 'Tables, chairs, bar counter, lighting',
            budgetLevel: 'Premium',
            referenceImages: [],
          };
          runInteriorAgents(requirements, state).then(() => {
            notifyParent('NOVA_INTERIOR_RENDER_READY', { taskId, outputs: { status: 'viewer_ready' } });
          });
        });
      }
    }
    notifyParent('NOVA_INTERIOR_VIEWER_READY', { taskId });
  };

  // Small delay to let React mount.
  setTimeout(tryStart, 400);
});

function detectRoomType(prompt = '') {
  const t = prompt.toLowerCase();
  if (t.includes('咖啡') || t.includes('cafe') || t.includes('coffee')) return 'Café / coffee shop';
  if (t.includes('餐廳') || t.includes('restaurant')) return 'Restaurant';
  if (t.includes('辦公') || t.includes('office')) return 'Office';
  return 'Modern commercial interior';
}

function detectStyle(prompt = '') {
  const t = prompt.toLowerCase();
  if (t.includes('現代') || t.includes('modern')) return 'warm minimal luxury';
  if (t.includes('工業') || t.includes('industrial')) return 'dark luxury';
  if (t.includes('極簡') || t.includes('minimal')) return 'minimal white';
  return 'warm minimal luxury';
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><AppShell /></React.StrictMode>
);
