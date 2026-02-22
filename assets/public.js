// assets/public.js
// Shared helpers for all public pages: loading data from JSON files
// stored in data/ directory.

import { t } from './i18n.js';

async function loadJson(name) {
  const res = await fetch(`data/${name}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load data/${name}.json: ${res.status}`);
  const data = await res.json();
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

/**
 * Fetch bilingual content section.
 * @param {string} lang    'fr' or 'pt-BR'
 * @param {string} section 'baggage' | 'seats' | 'attractions' | 'restaurants' | 'documents'
 * @returns {Promise<Array>}
 */
export async function fetchContent(lang, section) {
  const safeLang    = ['fr', 'pt-BR'].includes(lang) ? lang : 'fr';
  const validSections = ['baggage', 'seats', 'attractions', 'restaurants', 'documents'];
  const safeSection = validSections.includes(section) ? section : 'baggage';
  const key = `${safeLang}/content/${safeSection}`;
  const res = await fetch(`data/${key}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load data/${key}.json: ${res.status}`);
  const data = await res.json();
  return data;
}

/**
 * Sanitize a filename: keep alphanumerics, dots, hyphens, underscores;
 * replace everything else with underscores; truncate to 200 chars.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilename(name) {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+/, '')  // strip leading dots, hyphens, underscores
    .slice(0, 200) || 'file';
}

/**
 * Make a filename unique by inserting a timestamp before the extension.
 * @param {string} name
 * @returns {string}
 */
export function uniqueFilename(name) {
  const ts  = Date.now();
  const dot = name.lastIndexOf('.');
  if (dot > 0) return name.slice(0, dot) + '_' + ts + name.slice(dot);
  return name + '_' + ts;
}

// ── Status badge helper ─────────────────────────────────────
export function statusBadge(text) {
  if (!text) return '';
  let cls = 'status-warn';
  if (text.includes('✅')) cls = 'status-ok';
  else if (text.includes('❌')) cls = 'status-err';
  return `<span class="status ${cls}">${escHtml(text)}</span>`;
}

// ── Parse BRL amount (handles pt-BR format "3.182,30" → 3182.30) ──
export function parseBrl(val) {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  // pt-BR format: dots as thousands separators, comma as decimal separator
  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  // Standard float string (no commas): parse as-is
  return parseFloat(s);
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
