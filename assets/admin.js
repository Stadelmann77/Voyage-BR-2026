// assets/admin.js
// Admin page: GitHub OAuth via Cloudflare Worker + Git-based data editing.
// Read-only mode works without a Worker; editing requires authentication.

import { escHtml, fmtDate } from './public.js';
import { t } from './i18n.js';

const WORKER_STORAGE_KEY = 'admin_worker_url';
const TOKEN_STORAGE_KEY  = 'admin_jwt_token';

let adminToken = null;   // JWT from Worker session
let workerUrl  = null;   // Cloudflare Worker base URL

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  workerUrl = localStorage.getItem(WORKER_STORAGE_KEY) || '';

  const workerInput = document.getElementById('worker-url');
  if (workerInput) {
    workerInput.value = workerUrl;
    workerInput.addEventListener('change', () => {
      workerUrl = workerInput.value.trim().replace(/\/$/, '');
      localStorage.setItem(WORKER_STORAGE_KEY, workerUrl);
    });
  }

  // Check for token in URL hash (returned by Worker OAuth callback)
  const hash = new URLSearchParams(location.hash.replace('#', ''));
  const hashToken = hash.get('admin_token');
  if (hashToken) {
    adminToken = hashToken;
    sessionStorage.setItem(TOKEN_STORAGE_KEY, adminToken);
    // Clean hash from URL
    history.replaceState(null, '', location.pathname + location.search);
  } else {
    adminToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) || null;
  }

  if (adminToken) {
    verifyAndShowPanel();
  } else {
    showLoginForm();
  }
});

// ── Auth UI ─────────────────────────────────────────────────
function showLoginForm() {
  document.getElementById('admin-login').style.display = 'block';
  document.getElementById('admin-panel').style.display = 'none';

  const btn = document.getElementById('github-login-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const wUrl = (document.getElementById('worker-url')?.value || '').trim().replace(/\/$/, '');
    if (!wUrl) {
      const info = document.getElementById('login-info');
      info.style.display = 'flex';
      info.textContent = '⚠️ ' + t('admin.login.workerRequired');
      return;
    }
    workerUrl = wUrl;
    localStorage.setItem(WORKER_STORAGE_KEY, workerUrl);
    window.location.href = `${workerUrl}/auth/github`;
  });
}

async function verifyAndShowPanel() {
  if (!workerUrl) {
    showLoginForm();
    return;
  }
  try {
    const res = await fetch(`${workerUrl}/api/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error('Session invalide');
    const user = await res.json();
    showAdminPanel(user);
  } catch (_) {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    adminToken = null;
    showLoginForm();
  }
}

function showAdminPanel(user) {
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'block';

  const userEl = document.getElementById('admin-user');
  if (userEl) userEl.textContent = user.login || user.name || 'Admin';

  const avatarEl = document.getElementById('admin-avatar');
  if (avatarEl && user.avatar_url) {
    avatarEl.src = user.avatar_url;
    avatarEl.alt = user.login;
    avatarEl.style.display = 'inline-block';
  }

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    adminToken = null;
    location.reload();
  });

  loadAdminTab('flights');

  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadAdminTab(btn.dataset.tab);
    });
  });
}

// ── Tab routing ─────────────────────────────────────────────
async function loadAdminTab(tab) {
  const body = document.getElementById('admin-tab-body');
  if (!body) return;
  body.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

  const loaders = {
    flights:   loadFlightsAdmin,
    lodgings:  loadLodgingsAdmin,
    transport: loadTransportAdmin,
    payments:  loadPaymentsAdmin,
    checklist: loadChecklistAdmin,
  };

  const loader = loaders[tab];
  if (loader) await loader(body);
  else body.innerHTML = '<div class="alert alert-info">Onglet non disponible.</div>';
}

// ── Git commit helper ────────────────────────────────────────
async function commitFile(path, content, message) {
  if (!workerUrl || !adminToken) throw new Error('Non authentifié');
  const res = await fetch(`${workerUrl}/api/commit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      files: [{ path, content: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Commit failed');
  return data;
}

// ── Status dropdown helper ───────────────────────────────────
const FLIGHT_STATUSES = [
  '✅ Payé - MC ****4753',
  '✅ Payé - Booking.com (A/R)',
  '✅ Payé - Booking.com',
  '✅ Inclus A/R',
  '⚠️ En Espera (Trip.com)',
  '⚠️ EN ESPERA',
  '⚠️ À PAYER',
  '❌ Annulé',
];

const LODGING_STATUSES = [
  '✅ OUI - Prépaiement total',
  '❌ NON requis',
  '❌ NON PAYÉ — à payer',
  '⚠️ À PAYER',
];

const TRANSPORT_STATUSES = [
  '✅ Payé',
  '⚠️ À PAYER à la prise',
  '❌ Annulé',
];

function statusSelect(currentVal, options, id) {
  const opts = options.includes(currentVal) ? options : [currentVal, ...options];
  return `<select id="${escHtml(id)}" class="status-edit-select" style="max-width:220px;font-size:.85rem">
    ${opts.map(o => `<option value="${escHtml(o)}" ${o === currentVal ? 'selected' : ''}>${escHtml(o)}</option>`).join('')}
  </select>`;
}

// ── Flights Admin ────────────────────────────────────────────
async function loadFlightsAdmin(body) {
  let flights;
  try {
    const res = await fetch('data/flights.json');
    flights = await res.json();
  } catch (e) {
    body.innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
    return;
  }

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 style="margin:0">✈️ Vols (${flights.length})</h2>
      <button class="btn btn-primary btn-sm" id="save-flights-btn">💾 Enregistrer les statuts</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>ID</th><th>Passager(s)</th><th>Route</th><th>Réf.</th>
        <th>Bagages soute</th><th>Sièges</th><th>Statut paiement</th>
      </tr></thead>
      <tbody>
        ${flights.map(f => `<tr>
          <td>${escHtml(f.id)}</td>
          <td>${escHtml(f.passengers)}</td>
          <td>${escHtml(f.route)}</td>
          <td>${escHtml(f.booking_ref || '—')}</td>
          <td><input type="text" data-id="${escHtml(f.id)}" data-field="hold_baggage"
              value="${escHtml(f.hold_baggage || '')}"
              style="width:140px;font-size:.85rem" class="flight-field-input"></td>
          <td><input type="text" data-id="${escHtml(f.id)}" data-field="seats"
              value="${escHtml(f.seats || '')}"
              style="width:120px;font-size:.85rem" class="flight-field-input"></td>
          <td>${statusSelect(f.payment_status || '—', FLIGHT_STATUSES, 'fs-' + f.id)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>
    <div id="flights-save-msg" style="margin-top:.75rem"></div>`;

  document.getElementById('save-flights-btn').addEventListener('click', async () => {
    const msgEl = document.getElementById('flights-save-msg');
    try {
      // Collect edits
      document.querySelectorAll('.flight-field-input').forEach(inp => {
        const idx = flights.findIndex(f => f.id === inp.dataset.id);
        if (idx >= 0) flights[idx][inp.dataset.field] = inp.value.trim();
      });
      document.querySelectorAll('[id^="fs-"]').forEach(sel => {
        const id = sel.id.replace('fs-', '');
        const idx = flights.findIndex(f => f.id === id);
        if (idx >= 0) flights[idx].payment_status = sel.value;
      });
      const result = await commitFile('data/flights.json', flights, 'admin: update flights status/baggage/seats');
      msgEl.innerHTML = `<div class="alert alert-success">✅ Enregistré — commit ${escHtml(result.commit_sha?.slice(0, 7) || '')}</div>`;
    } catch (e) {
      msgEl.innerHTML = `<div class="alert alert-danger">❌ ${escHtml(e.message)}</div>`;
    }
  });
}

// ── Lodgings Admin ───────────────────────────────────────────
async function loadLodgingsAdmin(body) {
  let lodgings;
  try {
    const res = await fetch('data/lodgings.json');
    lodgings = await res.json();
  } catch (e) {
    body.innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
    return;
  }

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 style="margin:0">🏨 Hébergements (${lodgings.length})</h2>
      <button class="btn btn-primary btn-sm" id="save-lodgings-btn">💾 Enregistrer</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>ID</th><th>Établissement</th><th>Ville</th><th>Réf.</th><th>Prépaiement / Statut</th>
      </tr></thead>
      <tbody>
        ${lodgings.map(h => `<tr>
          <td>${escHtml(h.id)}</td>
          <td>${escHtml(h.establishment)}</td>
          <td>${escHtml(h.city)}</td>
          <td>${escHtml(h.booking_ref || '—')}</td>
          <td>${statusSelect(h.prepayment || '—', LODGING_STATUSES, 'ls-' + h.id)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>
    <div id="lodgings-save-msg" style="margin-top:.75rem"></div>`;

  document.getElementById('save-lodgings-btn').addEventListener('click', async () => {
    const msgEl = document.getElementById('lodgings-save-msg');
    try {
      document.querySelectorAll('[id^="ls-"]').forEach(sel => {
        const id = sel.id.replace('ls-', '');
        const idx = lodgings.findIndex(h => h.id === id);
        if (idx >= 0) lodgings[idx].prepayment = sel.value;
      });
      const result = await commitFile('data/lodgings.json', lodgings, 'admin: update lodgings status');
      msgEl.innerHTML = `<div class="alert alert-success">✅ Enregistré — commit ${escHtml(result.commit_sha?.slice(0, 7) || '')}</div>`;
    } catch (e) {
      msgEl.innerHTML = `<div class="alert alert-danger">❌ ${escHtml(e.message)}</div>`;
    }
  });
}

// ── Transport Admin ──────────────────────────────────────────
async function loadTransportAdmin(body) {
  let transport;
  try {
    const res = await fetch('data/transport.json');
    transport = await res.json();
  } catch (e) {
    body.innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
    return;
  }

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 style="margin:0">🚗 Transport (${transport.length})</h2>
      <button class="btn btn-primary btn-sm" id="save-transport-btn">💾 Enregistrer</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>ID</th><th>Véhicule</th><th>Agence</th><th>Réf.</th><th>Statut</th>
      </tr></thead>
      <tbody>
        ${transport.map(tr => `<tr>
          <td>${escHtml(tr.id)}</td>
          <td>${escHtml(tr.vehicle)}</td>
          <td>${escHtml(tr.agency)}</td>
          <td>${escHtml(tr.booking_ref || '—')}</td>
          <td>${statusSelect(tr.payment_status || '—', TRANSPORT_STATUSES, 'ts-' + tr.id)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>
    <div id="transport-save-msg" style="margin-top:.75rem"></div>`;

  document.getElementById('save-transport-btn').addEventListener('click', async () => {
    const msgEl = document.getElementById('transport-save-msg');
    try {
      document.querySelectorAll('[id^="ts-"]').forEach(sel => {
        const id = sel.id.replace('ts-', '');
        const idx = transport.findIndex(t => t.id === id);
        if (idx >= 0) transport[idx].payment_status = sel.value;
      });
      const result = await commitFile('data/transport.json', transport, 'admin: update transport status');
      msgEl.innerHTML = `<div class="alert alert-success">✅ Enregistré — commit ${escHtml(result.commit_sha?.slice(0, 7) || '')}</div>`;
    } catch (e) {
      msgEl.innerHTML = `<div class="alert alert-danger">❌ ${escHtml(e.message)}</div>`;
    }
  });
}

// ── Payments Admin ───────────────────────────────────────────
async function loadPaymentsAdmin(body) {
  let expenses, people;
  try {
    [expenses, people] = await Promise.all([
      fetch('data/expenses.json').then(r => r.json()),
      fetch('data/people.json').then(r => r.json()),
    ]);
  } catch (e) {
    body.innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
    return;
  }

  const peopleNames = people.map(p => p.name);

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 style="margin:0">💰 Dépenses & Bénéficiaires (${expenses.length})</h2>
      <button class="btn btn-primary btn-sm" id="save-expenses-btn">💾 Enregistrer</button>
    </div>
    <p style="color:var(--text-light);font-size:.85rem;margin-bottom:1rem">
      Cochez les bénéficiaires de chaque dépense. La quote-part est calculée selon le poids de chaque personne.
    </p>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>ID</th><th>Libellé</th><th>CHF</th><th>BRL</th><th>Payé par</th>
        ${peopleNames.map(n => `<th>${escHtml(n)}</th>`).join('')}
        <th>Statut</th>
      </tr></thead>
      <tbody>
        ${expenses.map(exp => `<tr>
          <td style="font-size:.8rem">${escHtml(exp.id)}</td>
          <td style="max-width:200px;font-size:.85rem">${escHtml(exp.label)}</td>
          <td style="font-size:.85rem">${exp.amount_chf ?? '—'}</td>
          <td style="font-size:.85rem">${exp.amount_brl ?? '—'}</td>
          <td>
            <select data-exp="${escHtml(exp.id)}" data-field="paid_by" style="font-size:.85rem">
              ${peopleNames.map(n => `<option value="${escHtml(n)}" ${n === exp.paid_by ? 'selected' : ''}>${escHtml(n)}</option>`).join('')}
            </select>
          </td>
          ${peopleNames.map(n => `<td style="text-align:center">
            <input type="checkbox" data-exp="${escHtml(exp.id)}" data-person="${escHtml(n)}"
              ${(exp.beneficiaries || []).includes(n) ? 'checked' : ''}>
          </td>`).join('')}
          <td>
            <input type="text" data-exp="${escHtml(exp.id)}" data-field="status"
              value="${escHtml(exp.status || '')}" style="width:180px;font-size:.8rem">
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>
    <div id="expenses-save-msg" style="margin-top:.75rem"></div>`;

  document.getElementById('save-expenses-btn').addEventListener('click', async () => {
    const msgEl = document.getElementById('expenses-save-msg');
    try {
      // Collect checkbox state for beneficiaries
      expenses.forEach(exp => {
        exp.beneficiaries = peopleNames.filter(n => {
          const cb = document.querySelector(`input[type=checkbox][data-exp="${exp.id}"][data-person="${n}"]`);
          return cb && cb.checked;
        });
      });
      // Collect paid_by and status
      document.querySelectorAll('select[data-field="paid_by"]').forEach(sel => {
        const idx = expenses.findIndex(e => e.id === sel.dataset.exp);
        if (idx >= 0) expenses[idx].paid_by = sel.value;
      });
      document.querySelectorAll('input[data-field="status"]').forEach(inp => {
        const idx = expenses.findIndex(e => e.id === inp.dataset.exp);
        if (idx >= 0) expenses[idx].status = inp.value.trim();
      });

      const result = await commitFile('data/expenses.json', expenses, 'admin: update expense beneficiaries');
      msgEl.innerHTML = `<div class="alert alert-success">✅ Enregistré — commit ${escHtml(result.commit_sha?.slice(0, 7) || '')}</div>`;
    } catch (e) {
      msgEl.innerHTML = `<div class="alert alert-danger">❌ ${escHtml(e.message)}</div>`;
    }
  });
}

// ── Checklist Admin ──────────────────────────────────────────
async function loadChecklistAdmin(body) {
  let items;
  try {
    const res = await fetch('data/checklist.json');
    items = await res.json();
  } catch (e) {
    body.innerHTML = `<div class="alert alert-danger">${escHtml(e.message)}</div>`;
    return;
  }

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 style="margin:0">✅ Checklist (${items.length} items)</h2>
      <button class="btn btn-primary btn-sm" id="save-checklist-btn">💾 Enregistrer</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Catégorie</th><th>Tâche</th><th>Assigné</th><th>Fait?</th><th>Fait par / le</th></tr></thead>
      <tbody>
        ${items.map(item => `<tr>
          <td style="font-size:.8rem">${escHtml(item.id)}</td>
          <td style="font-size:.85rem">${escHtml(item.category || '—')}</td>
          <td style="font-size:.85rem">${escHtml(item.task)}</td>
          <td style="font-size:.85rem">${escHtml(item.assigned_to || '—')}</td>
          <td style="text-align:center">
            <input type="checkbox" data-id="${escHtml(item.id)}" ${item.done ? 'checked' : ''}>
          </td>
          <td style="font-size:.8rem;color:var(--text-light)">
            ${item.done_by ? escHtml(item.done_by) + ' — ' + escHtml(item.done_at || '') : ''}
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>
    <div id="checklist-save-msg" style="margin-top:.75rem"></div>`;

  document.getElementById('save-checklist-btn').addEventListener('click', async () => {
    const msgEl = document.getElementById('checklist-save-msg');
    try {
      items.forEach(item => {
        const cb = document.querySelector(`input[type=checkbox][data-id="${item.id}"]`);
        if (cb) item.done = cb.checked;
      });
      const result = await commitFile('data/checklist.json', items, 'admin: update checklist');
      msgEl.innerHTML = `<div class="alert alert-success">✅ Enregistré — commit ${escHtml(result.commit_sha?.slice(0, 7) || '')}</div>`;
    } catch (e) {
      msgEl.innerHTML = `<div class="alert alert-danger">❌ ${escHtml(e.message)}</div>`;
    }
  });
}
