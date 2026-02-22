// assets/public.js
// Shared helpers for all public pages: loading data from JSON files
// stored in data/ directory.

import { t } from './i18n.js';

// ── JSON data cache ─────────────────────────────────────────
const _cache = {};

async function loadJson(name) {
  if (_cache[name]) return _cache[name];
  const res = await fetch(`data/${name}.json`);
  if (!res.ok) throw new Error(`Failed to load data/${name}.json: ${res.status}`);
  const data = await res.json();
  _cache[name] = data;
  return data;
}

// ── Navigation active link ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
});

// ── Generic error display ───────────────────────────────────
export function showError(container, msg, detail = null) {
  const isDebug = new URLSearchParams(location.search).get('debug') === '1';
  const hint = t('error.fetch.hint');

  let html = `<div class="alert alert-danger">
    <strong>${t('error.fetch.title')}</strong><br>
    ${escHtml(msg)}<br>
    <small style="color:var(--text-light)">${escHtml(hint)}</small>`;

  if (isDebug && detail) {
    const raw = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
    html += `<details style="margin-top:.5rem">
      <summary style="cursor:pointer">${t('error.fetch.debug')}</summary>
      <pre style="white-space:pre-wrap;font-size:.8rem;margin-top:.5rem;max-height:200px;overflow:auto">${escHtml(raw)}</pre>
    </details>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

// ── Loading placeholder ─────────────────────────────────────
export function showLoading(container) {
  container.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
}

// ── Fetch helpers (from JSON files) ─────────────────────────
export async function fetchFlights(surpriseUnlocked = false) {
  const flights = await loadJson('flights');
  return surpriseUnlocked ? flights : flights.filter(f => !f.is_surprise);
}

export async function fetchLodgings(surpriseUnlocked = false) {
  const lodgings = await loadJson('lodgings');
  return surpriseUnlocked ? lodgings : lodgings.filter(l => !l.is_surprise);
}

export async function fetchTransport() {
  return loadJson('transport');
}

export async function fetchContacts() {
  return loadJson('contacts');
}

export async function fetchTravellers() {
  return loadJson('travellers');
}

export async function fetchPayments() {
  // Payments are not yet in JSON — return empty array
  return [];
}

export async function fetchExpenses() {
  return loadJson('expenses');
}

export async function fetchPeople() {
  return loadJson('people');
}

export async function fetchChecklist(surpriseUnlocked = false) {
  const items = await loadJson('checklist');
  return surpriseUnlocked ? items : items.filter(i => !i.is_surprise);
}

// ── Status badge helper ─────────────────────────────────────
export function statusBadge(text) {
  if (!text) return '';
  let cls = 'status-warn';
  if (text.includes('✅')) cls = 'status-ok';
  else if (text.includes('❌')) cls = 'status-err';
  return `<span class="status ${cls}">${escHtml(text)}</span>`;
}

// ── Escape HTML ─────────────────────────────────────────────
export function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Format date ─────────────────────────────────────────────
export function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Format CHF/BRL amounts ──────────────────────────────────
export function fmtAmt(chf, brl) {
  const parts = [];
  if (chf != null && chf !== 0) parts.push(`<strong>${Number(chf).toLocaleString('fr-CH')} CHF</strong>`);
  if (brl != null && brl !== 0) parts.push(`<span style="color:var(--text-light)">R$ ${Number(brl).toLocaleString('pt-BR')}</span>`);
  return parts.join(' / ') || '—';
}
