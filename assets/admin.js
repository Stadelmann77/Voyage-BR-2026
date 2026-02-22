// assets/admin.js
// Admin page: GitHub OAuth via Cloudflare Worker + Git-based data editing.
// Read-only mode works without a Worker; editing requires authentication.

import { escHtml, fmtDate, parseBrl, sanitizeFilename, uniqueFilename } from './public.js';
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
    content:   loadContentAdmin,
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

// Commit multiple files in one request (supports encoding per file)
async function commitFiles(files, message) {
  if (!workerUrl || !adminToken) throw new Error('Non authentifié');
  const res = await fetch(`${workerUrl}/api/commit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, files }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Commit failed');
  return data;
}

// Read a File as base64 string (data URL → strip prefix)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // data:<type>;base64,<data>
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
        <th>Statut</th><th>Payé %</th><th>Montant payé</th>
      </tr></thead>
      <tbody>
        ${expenses.map(exp => {
          // Build initial payer rows HTML for multi-payer editor
          const payerRows = exp.payments
            ? exp.payments.map((p, i) => `
                <div class="payer-row" data-exp="${escHtml(exp.id)}" data-idx="${i}" style="display:flex;gap:.25rem;align-items:center;margin-bottom:.2rem">
                  <select class="payer-name" style="font-size:.8rem">
                    ${peopleNames.map(n => `<option value="${escHtml(n)}" ${n === p.by ? 'selected' : ''}>${escHtml(n)}</option>`).join('')}
                  </select>
                  <input class="payer-amount" type="number" step="0.01" min="0" value="${p.amount_brl ?? p.amount_chf ?? ''}" style="width:70px;font-size:.8rem" placeholder="montant">
                  <button class="btn-remove-payer" type="button" style="font-size:.8rem;padding:.1rem .35rem;background:#fee2e2;border:none;border-radius:.25rem;cursor:pointer">×</button>
                </div>`).join('')
            : `<div class="payer-row" data-exp="${escHtml(exp.id)}" data-idx="0" style="display:flex;gap:.25rem;align-items:center;margin-bottom:.2rem">
                <select class="payer-name" style="font-size:.8rem">
                  ${peopleNames.map(n => `<option value="${escHtml(n)}" ${n === exp.paid_by ? 'selected' : ''}>${escHtml(n)}</option>`).join('')}
                </select>
                <input class="payer-amount" type="number" step="0.01" min="0" value="" style="width:70px;font-size:.8rem" placeholder="montant">
                <button class="btn-remove-payer" type="button" style="font-size:.8rem;padding:.1rem .35rem;background:#fee2e2;border:none;border-radius:.25rem;cursor:pointer">×</button>
              </div>`;
          return `<tr>
            <td style="font-size:.8rem">${escHtml(exp.id)}</td>
            <td style="max-width:200px;font-size:.85rem">${escHtml(exp.label)}</td>
            <td style="font-size:.85rem">${exp.amount_chf ?? '—'}</td>
            <td style="font-size:.85rem">${exp.amount_brl ?? '—'}</td>
            <td>
              <div class="payers-editor" data-exp="${escHtml(exp.id)}" style="min-width:220px">
                <div class="payer-rows">${payerRows}</div>
                <button class="btn-add-payer" type="button" data-exp="${escHtml(exp.id)}" style="font-size:.75rem;padding:.1rem .4rem;margin-top:.2rem">+ Ajouter</button>
              </div>
            </td>
            ${peopleNames.map(n => `<td style="text-align:center">
              <input type="checkbox" data-exp="${escHtml(exp.id)}" data-person="${escHtml(n)}"
                ${(exp.beneficiaries || []).includes(n) ? 'checked' : ''}>
            </td>`).join('')}
            <td>
              <input type="text" data-exp="${escHtml(exp.id)}" data-field="status"
                value="${escHtml(exp.status || '')}" style="width:180px;font-size:.8rem">
            </td>
            <td>
              <input type="number" min="0" max="100" step="1"
                data-exp="${escHtml(exp.id)}" data-field="paid_pct"
                value="${exp.paid_ratio != null ? Math.round(Number(exp.paid_ratio) * 100) : ''}"
                style="width:60px;font-size:.85rem" placeholder="0–100">
            </td>
            <td>
              <input type="text"
                data-exp="${escHtml(exp.id)}" data-field="paid_amount"
                value="${exp.paid_amount != null ? exp.paid_amount : ''}"
                style="width:80px;font-size:.85rem" placeholder="montant">
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    <div id="expenses-save-msg" style="margin-top:.75rem"></div>`;

  // Helper: round a currency amount to 2 decimal places
  function roundCurrency(v) { return Math.round(v * 100) / 100; }

  // Auto-update: Paid % ↔ Paid amount
  body.addEventListener('input', e => {
    const inp = e.target;
    if (!inp.dataset.exp) return;
    const exp = expenses.find(ex => ex.id === inp.dataset.exp);
    if (!exp) return;
    const amount = parseBrl(exp.amount_brl) || exp.amount_chf || 0;

    if (inp.dataset.field === 'paid_pct') {
      const pct = parseFloat(inp.value);
      if (!isNaN(pct) && amount > 0) {
        const ratio = Math.min(1, Math.max(0, pct / 100));
        const amtInp = body.querySelector(`input[data-exp="${exp.id}"][data-field="paid_amount"]`);
        if (amtInp) amtInp.value = roundCurrency(amount * ratio);
      }
    } else if (inp.dataset.field === 'paid_amount') {
      const paidAmt = parseFloat(inp.value);
      if (!isNaN(paidAmt) && amount > 0) {
        const ratio = Math.min(1, Math.max(0, paidAmt / amount));
        const pctInp = body.querySelector(`input[data-exp="${exp.id}"][data-field="paid_pct"]`);
        if (pctInp) pctInp.value = Math.round(ratio * 100);
      }
    }
  });

  // Multi-payer editor: add/remove payer rows
  body.addEventListener('click', e => {
    if (e.target.classList.contains('btn-add-payer')) {
      const expId = e.target.dataset.exp;
      const editor = body.querySelector(`.payers-editor[data-exp="${expId}"] .payer-rows`);
      if (!editor) return;
      const newRow = document.createElement('div');
      newRow.className = 'payer-row';
      newRow.dataset.exp = expId;
      newRow.style.cssText = 'display:flex;gap:.25rem;align-items:center;margin-bottom:.2rem';
      newRow.innerHTML = `<select class="payer-name" style="font-size:.8rem">
        ${peopleNames.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('')}
      </select>
      <input class="payer-amount" type="number" step="0.01" min="0" value="" style="width:70px;font-size:.8rem" placeholder="montant">
      <button class="btn-remove-payer" type="button" style="font-size:.8rem;padding:.1rem .35rem;background:#fee2e2;border:none;border-radius:.25rem;cursor:pointer">×</button>`;
      editor.appendChild(newRow);
    }
    if (e.target.classList.contains('btn-remove-payer')) {
      const row = e.target.closest('.payer-row');
      const editor = row && row.closest('.payers-editor .payer-rows');
      if (editor && editor.querySelectorAll('.payer-row').length > 1) {
        row.remove();
      }
    }
  });

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
      // Collect payer data from multi-payer editors
      body.querySelectorAll('.payers-editor').forEach(editor => {
        const expId = editor.dataset.exp;
        const idx = expenses.findIndex(e => e.id === expId);
        if (idx < 0) return;
        const rows = editor.querySelectorAll('.payer-row');
        const isBrlExp = expenses[idx].amount_brl != null;
        const payerEntries = [];
        rows.forEach(row => {
          const name = row.querySelector('.payer-name')?.value;
          const amt = parseFloat(row.querySelector('.payer-amount')?.value);
          if (name) {
            const entry = { by: name };
            if (!isNaN(amt) && amt > 0) {
              if (isBrlExp) entry.amount_brl = roundCurrency(amt);
              else          entry.amount_chf = roundCurrency(amt);
            }
            payerEntries.push(entry);
          }
        });
        // If more than 1 payer, or the single payer has an explicit amount → use payments array
        const hasAmounts = payerEntries.some(p => p.amount_brl != null || p.amount_chf != null);
        if (payerEntries.length > 1 || (payerEntries.length === 1 && hasAmounts)) {
          expenses[idx].payments = payerEntries;
          delete expenses[idx].paid_by;
        } else if (payerEntries.length === 1) {
          expenses[idx].paid_by = payerEntries[0].by;
          delete expenses[idx].payments;
        }
      });
      document.querySelectorAll('input[data-field="status"]').forEach(inp => {
        const idx = expenses.findIndex(e => e.id === inp.dataset.exp);
        if (idx >= 0) expenses[idx].status = inp.value.trim();
      });
      // Collect paid_ratio (canonical) and derive paid_amount from it
      document.querySelectorAll('input[data-field="paid_pct"]').forEach(inp => {
        const idx = expenses.findIndex(e => e.id === inp.dataset.exp);
        if (idx < 0) return;
        const pct = parseFloat(inp.value);
        if (!isNaN(pct) && inp.value.trim() !== '') {
          const ratio = Math.min(1, Math.max(0, pct / 100));
          expenses[idx].paid_ratio = ratio;
          const amount = parseBrl(expenses[idx].amount_brl) || expenses[idx].amount_chf || 0;
          if (amount > 0) {
            expenses[idx].paid_amount = roundCurrency(amount * ratio);
          } else {
            delete expenses[idx].paid_amount;
          }
        } else {
          delete expenses[idx].paid_ratio;
          delete expenses[idx].paid_amount;
        }
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

// ── Content Admin ────────────────────────────────────────────
const CONTENT_SECTIONS = ['baggage', 'seats', 'attractions', 'restaurants', 'documents'];
const CONTENT_SECTION_LABELS = {
  baggage: '🧳 Bagages',
  seats: '💺 Sièges',
  attractions: '🗺️ Attractions',
  restaurants: '🍽️ Restaurants',
  documents: '📄 Documents',
};

async function loadContentAdmin(body) {
  // State
  let currentLang = 'fr';
  let currentSection = 'baggage';
  let items = [];
  let editingIdx = -1; // -1 = new item

  function contentPath() {
    return `data/${currentLang}/content/${currentSection}.json`;
  }

  async function fetchItems() {
    const res = await fetch(contentPath() + '?_=' + Date.now());
    if (!res.ok) return [];
    return res.json();
  }

  function generateId() {
    return currentSection + '_' + Date.now();
  }

  function renderList() {
    const listEl = body.querySelector('#content-item-list');
    if (!listEl) return;
    if (items.length === 0) {
      listEl.innerHTML = `<p style="color:var(--text-light);padding:.5rem 0">${escHtml(t('admin.content.noItems'))}</p>`;
      return;
    }
    listEl.innerHTML = items.map((item, idx) => `
      <div class="content-list-row" style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--border,#e5e7eb)">
        <span style="flex:1;font-size:.9rem">${escHtml(item.id)} — ${escHtml(item.title)}</span>
        <button class="btn btn-outline btn-sm content-edit-btn" data-idx="${idx}">${escHtml(t('common.edit'))}</button>
        <button class="btn btn-outline btn-sm content-del-btn" data-idx="${idx}" style="color:#dc2626">${escHtml(t('admin.content.deleteItem'))}</button>
      </div>`).join('');
  }

  function clearForm() {
    body.querySelector('#ci-id').value = '';
    body.querySelector('#ci-title').value = '';
    body.querySelector('#ci-description').value = '';
    body.querySelector('#ci-date').value = '';
    body.querySelector('#ci-links').value = '';
    body.querySelector('#ci-attachments').value = '';
    editingIdx = -1;
    body.querySelector('#content-form-title').textContent = t('admin.content.newItem');
    body.querySelector('#content-msg').innerHTML = '';
  }

  function fillForm(item, idx) {
    editingIdx = idx;
    body.querySelector('#ci-id').value = item.id || '';
    body.querySelector('#ci-title').value = item.title || '';
    body.querySelector('#ci-description').value = item.description || '';
    body.querySelector('#ci-date').value = item.date || '';
    body.querySelector('#ci-links').value = item.links ? JSON.stringify(item.links) : '';
    body.querySelector('#ci-attachments').value = item.attachments ? JSON.stringify(item.attachments) : '';
    body.querySelector('#content-form-title').textContent = t('common.edit') + ': ' + escHtml(item.title);
    body.querySelector('#content-msg').innerHTML = '';
  }

  async function reloadItems() {
    items = await fetchItems();
    renderList();
    clearForm();
  }

  // ── Render shell
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
      <h2 style="margin:0">📝 ${escHtml(t('admin.tab.content'))}</h2>
    </div>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;align-items:flex-end">
      <div>
        <label style="font-weight:600;display:block;margin-bottom:.25rem">${escHtml(t('admin.content.lang'))}</label>
        <select id="content-lang-sel" class="status-edit-select">
          <option value="fr">FR — Français</option>
          <option value="pt-BR">PT — Português</option>
        </select>
      </div>
      <div>
        <label style="font-weight:600;display:block;margin-bottom:.25rem">${escHtml(t('admin.content.section'))}</label>
        <select id="content-section-sel" class="status-edit-select">
          ${CONTENT_SECTIONS.map(s => `<option value="${escHtml(s)}">${escHtml(CONTENT_SECTION_LABELS[s] || s)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:start" id="content-grid">
      <!-- List -->
      <div class="card" style="padding:1rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
          <strong>${escHtml(t('admin.content.section'))}</strong>
          <button class="btn btn-primary btn-sm" id="content-new-btn">${escHtml(t('admin.content.newItem'))}</button>
        </div>
        <div id="content-item-list"><div class="loading-center"><div class="spinner"></div></div></div>
      </div>

      <!-- Form -->
      <div class="card" style="padding:1rem">
        <strong id="content-form-title" style="display:block;margin-bottom:.75rem">${escHtml(t('admin.content.newItem'))}</strong>
        <div style="display:grid;gap:.65rem">
          <div>
            <label style="font-size:.85rem;font-weight:600">${escHtml(t('admin.content.id'))}</label>
            <input type="text" id="ci-id" style="width:100%;box-sizing:border-box;font-size:.85rem" placeholder="auto">
          </div>
          <div>
            <label style="font-size:.85rem;font-weight:600">${escHtml(t('admin.content.title'))}</label>
            <input type="text" id="ci-title" style="width:100%;box-sizing:border-box;font-size:.85rem">
          </div>
          <div>
            <label style="font-size:.85rem;font-weight:600">${escHtml(t('admin.content.description'))}</label>
            <textarea id="ci-description" rows="3" style="width:100%;box-sizing:border-box;font-size:.85rem"></textarea>
          </div>
          <div>
            <label style="font-size:.85rem;font-weight:600">${escHtml(t('admin.content.date'))}</label>
            <input type="text" id="ci-date" style="width:100%;box-sizing:border-box;font-size:.85rem" placeholder="YYYY-MM-DD">
          </div>
          <div>
            <label style="font-size:.85rem;font-weight:600">${escHtml(t('admin.content.links'))}</label>
            <textarea id="ci-links" rows="2" style="width:100%;box-sizing:border-box;font-size:.85rem" placeholder='[{"label":"...","url":"..."}]'></textarea>
          </div>
          <div>
            <label style="font-size:.85rem;font-weight:600">${escHtml(t('admin.content.attachments'))}</label>
            <textarea id="ci-attachments" rows="2" style="width:100%;box-sizing:border-box;font-size:.85rem" placeholder='[{"label":"...","url":"...","type":"pdf"}]'></textarea>
          </div>

          <!-- Upload -->
          <div style="border:1px dashed var(--border,#e5e7eb);border-radius:.5rem;padding:.75rem">
            <label style="font-size:.85rem;font-weight:600;display:block;margin-bottom:.35rem">${escHtml(t('admin.content.upload'))}</label>
            <input type="file" id="ci-file" accept=".pdf,.jpg,.jpeg,.png" style="font-size:.85rem">
            <button class="btn btn-outline btn-sm" id="ci-upload-btn" style="margin-top:.5rem">${escHtml(t('admin.content.uploadBtn'))}</button>
            <div id="ci-upload-msg" style="font-size:.8rem;margin-top:.35rem"></div>
          </div>

          <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.25rem">
            <button class="btn btn-outline btn-sm" id="content-cancel-btn">${escHtml(t('admin.content.cancelEdit'))}</button>
            <button class="btn btn-primary btn-sm" id="content-save-btn">${escHtml(t('admin.content.saveItem'))}</button>
          </div>
          <div id="content-msg" style="margin-top:.25rem"></div>
        </div>
      </div>
    </div>`;

  // Load initial items
  await reloadItems();

  // ── Lang / section selectors
  body.querySelector('#content-lang-sel').addEventListener('change', async e => {
    currentLang = e.target.value;
    await reloadItems();
  });
  body.querySelector('#content-section-sel').addEventListener('change', async e => {
    currentSection = e.target.value;
    await reloadItems();
  });

  // ── New item
  body.querySelector('#content-new-btn').addEventListener('click', () => {
    clearForm();
  });

  // ── Cancel
  body.querySelector('#content-cancel-btn').addEventListener('click', () => {
    clearForm();
  });

  // ── Edit / delete via list
  body.querySelector('#content-item-list').addEventListener('click', e => {
    const editBtn = e.target.closest('.content-edit-btn');
    const delBtn  = e.target.closest('.content-del-btn');
    if (editBtn) {
      fillForm(items[Number(editBtn.dataset.idx)], Number(editBtn.dataset.idx));
    } else if (delBtn) {
      const idx = Number(delBtn.dataset.idx);
      if (!confirm(t('admin.content.confirmDelete').replace('{name}', items[idx]?.title || items[idx]?.id || ''))) return;
      items.splice(idx, 1);
      saveItemsAndReload('admin: delete content item');
    }
  });

  // ── File upload
  body.querySelector('#ci-upload-btn').addEventListener('click', async () => {
    const msgEl = body.querySelector('#ci-upload-msg');
    const fileInput = body.querySelector('#ci-file');
    const file = fileInput.files[0];
    if (!file) { msgEl.textContent = '⚠️ Aucun fichier sélectionné.'; return; }

    // Validate type
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png)$/i)) {
      msgEl.textContent = '⚠️ Format non supporté (pdf/jpg/png).';
      return;
    }

    msgEl.textContent = '⏳ Upload en cours…';
    try {
      const safeName = uniqueFilename(sanitizeFilename(file.name));
      const uploadPath = `assets/uploads/${safeName}`;
      const base64content = await fileToBase64(file);
      await commitFiles(
        [{ path: uploadPath, content: base64content, encoding: 'base64' }],
        `admin: upload file ${safeName}`,
      );
      msgEl.innerHTML = `✅ Fichier uploadé: <code>${escHtml(uploadPath)}</code>`;

      // Append to attachments textarea
      const attEl = body.querySelector('#ci-attachments');
      let existing = [];
      try { existing = JSON.parse(attEl.value || '[]'); } catch (_) { existing = []; }
      const ext = safeName.split('.').pop().toLowerCase();
      const type = ext === 'pdf' ? 'pdf' : 'image';
      existing.push({ label: file.name, url: uploadPath, type });
      attEl.value = JSON.stringify(existing, null, 2);
    } catch (err) {
      msgEl.innerHTML = `❌ ${escHtml(err.message)}`;
    }
  });

  // ── Save item
  body.querySelector('#content-save-btn').addEventListener('click', async () => {
    const msgEl = body.querySelector('#content-msg');
    const idVal    = body.querySelector('#ci-id').value.trim() || generateId();
    const title    = body.querySelector('#ci-title').value.trim();
    const desc     = body.querySelector('#ci-description').value.trim();
    const date     = body.querySelector('#ci-date').value.trim();
    const linksRaw = body.querySelector('#ci-links').value.trim();
    const attRaw   = body.querySelector('#ci-attachments').value.trim();

    if (!title) { msgEl.innerHTML = '<div class="alert alert-danger">⚠️ Le titre est requis.</div>'; return; }

    let links = [];
    let attachments = [];
    try { if (linksRaw) links = JSON.parse(linksRaw); } catch (_) {
      msgEl.innerHTML = '<div class="alert alert-danger">⚠️ JSON invalide dans « Liens ».</div>'; return;
    }
    try { if (attRaw) attachments = JSON.parse(attRaw); } catch (_) {
      msgEl.innerHTML = '<div class="alert alert-danger">⚠️ JSON invalide dans « Pièces jointes ».</div>'; return;
    }

    const newItem = { id: idVal, title };
    if (desc)              newItem.description  = desc;
    if (date)              newItem.date         = date;
    if (links.length)      newItem.links        = links;
    if (attachments.length) newItem.attachments = attachments;

    if (editingIdx >= 0) {
      items[editingIdx] = newItem;
    } else {
      items.push(newItem);
    }

    await saveItemsAndReload('admin: update content ' + currentSection);
  });

  async function saveItemsAndReload(message) {
    const msgEl = body.querySelector('#content-msg');
    try {
      const result = await commitFile(contentPath(), items, message);
      if (msgEl) msgEl.innerHTML = `<div class="alert alert-success">✅ ${escHtml(t('admin.content.saved'))} — commit ${escHtml(result.commit_sha?.slice(0, 7) || '')}</div>`;
      // Refresh the list
      items = await fetchItems();
      renderList();
      clearForm();
    } catch (e) {
      if (msgEl) msgEl.innerHTML = `<div class="alert alert-danger">❌ ${escHtml(e.message)}</div>`;
    }
  }
}
