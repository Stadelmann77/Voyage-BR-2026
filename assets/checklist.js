// assets/checklist.js
// Checklist page: load items, PIN-protected toggling, surprise items support.

import { fetchChecklist, showError, showLoading, escHtml, fmtDate } from './public.js';
import { FUNCTIONS_URL } from './supabaseClient.js';

let checklistPin = '';
let userName = '';
let surpriseUnlocked = sessionStorage.getItem('surprise_unlocked') === 'true';
let surpriseData = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (surpriseUnlocked) {
    const raw = sessionStorage.getItem('surprise_data');
    if (raw) { try { surpriseData = JSON.parse(raw); } catch(_) {} }
  }

  setupPinBar();
  await loadChecklist();
});

// ── PIN Unlock bar ──────────────────────────────────────────
function setupPinBar() {
  const pinInput  = document.getElementById('checklist-pin');
  const nameInput = document.getElementById('checklist-name');
  const saveBtn   = document.getElementById('checklist-save-pin');

  if (!saveBtn) return;

  saveBtn.addEventListener('click', () => {
    checklistPin = pinInput?.value?.trim() || '';
    userName     = nameInput?.value?.trim() || '';

    if (!checklistPin || !userName) {
      alert('Veuillez entrer votre PIN et votre nom.');
      return;
    }

    saveBtn.textContent = '✅ Prêt';
    saveBtn.disabled = true;

    // Enable all checkboxes
    document.querySelectorAll('.checklist-check').forEach(cb => cb.disabled = false);
  });
}

// ── Load checklist ──────────────────────────────────────────
async function loadChecklist() {
  const container = document.getElementById('checklist-container');
  if (!container) return;
  showLoading(container);

  try {
    const items = await fetchChecklist(false);

    let allItems = [...items];
    if (surpriseUnlocked && surpriseData?.checklist) {
      allItems = [...allItems, ...surpriseData.checklist];
    }

    renderChecklist(allItems, container);
  } catch (err) {
    showError(container, err.message);
  }
}

function renderChecklist(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="alert alert-info">Aucun élément dans la checklist.</div>';
    return;
  }

  // Group by category
  const byCategory = {};
  items.forEach(item => {
    const cat = item.category || 'Général';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  });

  const catIcons = {
    'DOCUMENTS':    '📄',
    'VOLS':         '✈️',
    'HÉBERGEMENTS': '🏨',
    'TRANSPORT':    '🚗',
    'Général':      '📋',
  };

  let html = '';
  for (const [cat, catItems] of Object.entries(byCategory)) {
    const icon = catIcons[cat] || '📌';
    const total = catItems.length;
    const done = catItems.filter(i => i.done).length;
    html += `<div class="checklist-category">${icon} ${escHtml(cat)} <span style="font-weight:400;color:var(--text-light);font-size:.82rem">(${done}/${total})</span></div>`;

    catItems.forEach(item => {
      const doneClass = item.done ? 'done-item' : '';
      const surprise  = item.is_surprise ? '⭐ ' : '';
      const doneBy    = item.done && item.done_by
        ? `<div class="item-done-by">✅ Fait par ${escHtml(item.done_by)}${item.done_at ? ' le ' + new Date(item.done_at).toLocaleDateString('fr-CH') : ''}</div>`
        : '';

      html += `<div class="checklist-item ${doneClass}" id="item-wrapper-${item.id}">
        <input type="checkbox" class="checklist-check"
          id="check-${item.id}"
          data-id="${item.id}"
          ${item.done ? 'checked' : ''}
          disabled>
        <div class="item-body">
          <div class="item-action">${surprise}${escHtml(item.action)}</div>
          <div class="item-meta">
            ${item.traveller ? `<span>👤 ${escHtml(item.traveller)}</span>` : ''}
            ${item.details   ? `<span>${escHtml(item.details)}</span>` : ''}
            ${item.deadline  ? `<span>🗓 ${escHtml(item.deadline)}</span>` : ''}
          </div>
          ${doneBy}
        </div>
      </div>`;
    });
  }

  container.innerHTML = html;

  // Attach change listeners
  container.querySelectorAll('.checklist-check').forEach(cb => {
    cb.addEventListener('change', handleToggle);
  });
}

async function handleToggle(e) {
  const cb     = e.target;
  const itemId = cb.dataset.id;
  const done   = cb.checked;

  if (!checklistPin || !userName) {
    cb.checked = !done; // revert
    alert('Veuillez entrer votre PIN et votre nom dans la barre en haut.');
    return;
  }

  cb.disabled = true;

  try {
    const res = await fetch(`${FUNCTIONS_URL}/update-checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: checklistPin, id: itemId, done, done_by: userName }),
    });
    const json = await res.json();

    if (json.ok) {
      const wrapper = document.getElementById(`item-wrapper-${itemId}`);
      if (wrapper) {
        if (done) {
          wrapper.classList.add('done-item');
          // Update done_by display
          let doneByEl = wrapper.querySelector('.item-done-by');
          if (!doneByEl) {
            doneByEl = document.createElement('div');
            doneByEl.className = 'item-done-by';
            wrapper.querySelector('.item-body').appendChild(doneByEl);
          }
          doneByEl.textContent = `✅ Fait par ${userName}`;
        } else {
          wrapper.classList.remove('done-item');
          const doneByEl = wrapper.querySelector('.item-done-by');
          if (doneByEl) doneByEl.remove();
        }
      }
    } else {
      cb.checked = !done; // revert
      alert(`❌ ${json.error || 'Erreur lors de la mise à jour.'}`);
    }
  } catch (err) {
    cb.checked = !done;
    alert('❌ Erreur réseau. Réessayez.');
  } finally {
    cb.disabled = false;
  }
}
