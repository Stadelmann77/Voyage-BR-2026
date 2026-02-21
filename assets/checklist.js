// assets/checklist.js
// Checklist page: load items, PIN-protected toggling, surprise items support.
// In offline mode (!configOk): items from built-in list, state in localStorage.

import { fetchChecklist, showError, showLoading, escHtml, fmtDate } from './public.js';
import { configOk, FUNCTIONS_URL } from './supabaseClient.js';
import { t } from './i18n.js';

const LS_STATE_KEY = 'checklist_state'; // localStorage key for offline mode

let checklistPin = '';
let userName = '';
let surpriseUnlocked = sessionStorage.getItem('surprise_unlocked') === 'true';
let surpriseData = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (surpriseUnlocked) {
    const raw = sessionStorage.getItem('surprise_data');
    if (raw) { try { surpriseData = JSON.parse(raw); } catch(_) {} }
  }

  // Show offline hint banner if in offline mode
  if (!configOk) {
    const container = document.getElementById('checklist-container');
    if (container) {
      const hint = document.createElement('div');
      hint.className = 'alert alert-info';
      hint.setAttribute('data-i18n', 'offline.checklist.hint');
      hint.textContent = t('offline.checklist.hint');
      container.parentElement.insertBefore(hint, container);
    }
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

  // In offline mode, restore saved name from localStorage and hide the PIN field
  if (!configOk) {
    const saved = localStorage.getItem('checklist_user_name');
    if (saved && nameInput) nameInput.value = saved;
    // Hide PIN icon, label, and input — no server-side PIN check in offline mode
    document.querySelector('[data-i18n="checklist.pin.icon"]')?.setAttribute('style', 'display:none');
    document.querySelector('[data-i18n="checklist.pin.label"]')?.setAttribute('style', 'display:none');
    if (pinInput) pinInput.setAttribute('style', 'display:none');
  }

  saveBtn.addEventListener('click', () => {
    if (!configOk) {
      // Offline mode: only name is needed
      userName = nameInput?.value?.trim() || '';
      if (!userName) {
        alert(t('checklist.needPin'));
        return;
      }
      localStorage.setItem('checklist_user_name', userName);
    } else {
      checklistPin = pinInput?.value?.trim() || '';
      userName     = nameInput?.value?.trim() || '';
      if (!checklistPin || !userName) {
        alert(t('checklist.needPin'));
        return;
      }
    }

    saveBtn.textContent = t('checklist.unlock.done');
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

    // In offline mode, overlay localStorage state onto items
    if (!configOk) {
      const state = JSON.parse(localStorage.getItem(LS_STATE_KEY) || '{}');
      allItems = allItems.map(item => {
        const saved = state[item.id];
        if (!saved) return item;
        return { ...item, done: saved.done, done_by: saved.done_by || null, done_at: saved.done_at || null };
      });
    }

    renderChecklist(allItems, container);
  } catch (err) {
    showError(container, err.message, err.stack);
  }
}

function renderChecklist(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="alert alert-info">${t('checklist.noData')}</div>`;
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
        ? `<div class="item-done-by">${t('checklist.doneBy')} ${escHtml(item.done_by)}${item.done_at ? ' ' + t('checklist.doneOn') + ' ' + new Date(item.done_at).toLocaleDateString('fr-CH') : ''}</div>`
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

  if (!configOk) {
    // Offline mode: persist to localStorage
    if (!userName) {
      cb.checked = !done; // revert
      alert(t('checklist.needPinBar'));
      return;
    }
    const state = JSON.parse(localStorage.getItem(LS_STATE_KEY) || '{}');
    const now   = new Date().toISOString();
    if (done) {
      state[itemId] = { done: true, done_by: userName, done_at: now };
    } else {
      state[itemId] = { done: false, done_by: null, done_at: null };
    }
    localStorage.setItem(LS_STATE_KEY, JSON.stringify(state));

    // Update UI
    const wrapper = document.getElementById(`item-wrapper-${itemId}`);
    if (wrapper) {
      if (done) {
        wrapper.classList.add('done-item');
        let doneByEl = wrapper.querySelector('.item-done-by');
        if (!doneByEl) {
          doneByEl = document.createElement('div');
          doneByEl.className = 'item-done-by';
          wrapper.querySelector('.item-body').appendChild(doneByEl);
        }
        doneByEl.textContent = `${t('checklist.doneBy')} ${userName}`;
      } else {
        wrapper.classList.remove('done-item');
        const doneByEl = wrapper.querySelector('.item-done-by');
        if (doneByEl) doneByEl.remove();
      }
    }
    return;
  }

  // Online mode: call Edge Function
  if (!checklistPin || !userName) {
    cb.checked = !done; // revert
    alert(t('checklist.needPinBar'));
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
          doneByEl.textContent = `${t('checklist.doneBy')} ${userName}`;
        } else {
          wrapper.classList.remove('done-item');
          const doneByEl = wrapper.querySelector('.item-done-by');
          if (doneByEl) doneByEl.remove();
        }
      }
    } else {
      cb.checked = !done; // revert
      alert(`❌ ${json.error || t('checklist.err.update')}`);
    }
  } catch (err) {
    cb.checked = !done;
    alert(t('checklist.err.network'));
  } finally {
    cb.disabled = false;
  }
}
