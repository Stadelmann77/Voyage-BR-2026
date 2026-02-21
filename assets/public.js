// assets/public.js
// Shared helpers for all public pages: loading data from Supabase and rendering utilities.

import { supabase, configOk } from './supabaseClient.js';
import { t } from './i18n.js';

// ── Navigation active link ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });

  // Show config error banner if Supabase is not configured
  if (!configOk) {
    showConfigBanner();
  }
});

// ── Config error banner ─────────────────────────────────────
export function showConfigBanner() {
  if (document.getElementById('config-error-banner')) return; // already shown
  const main = document.querySelector('main');
  if (!main) return;

  const banner = document.createElement('div');
  banner.id = 'config-error-banner';
  banner.className = 'config-error-banner';
  banner.innerHTML = `
    <strong data-i18n="error.config.title">${t('error.config.title')}</strong>
    <p data-i18n="error.config.msg">${t('error.config.msg')}</p>
    <p><strong data-i18n="error.config.next">${t('error.config.next')}</strong></p>
    <ol>
      <li data-i18n="error.config.step1">${t('error.config.step1')}</li>
      <li data-i18n="error.config.step2">${t('error.config.step2')}</li>
      <li data-i18n="error.config.step3">${t('error.config.step3')}</li>
    </ol>`;
  main.insertBefore(banner, main.firstChild);
}

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

// ── Fetch helpers ───────────────────────────────────────────
export async function fetchFlights(surpriseUnlocked = false) {
  let query = supabase
    .from('flights')
    .select('*, origin:airports!origin_iata(iata,city,lat,lon), destination:airports!destination_iata(iata,city,lat,lon)')
    .order('dep_date');
  if (!surpriseUnlocked) query = query.eq('is_surprise', false);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchLodgings(surpriseUnlocked = false) {
  let query = supabase.from('lodgings').select('*').order('checkin_date');
  if (!surpriseUnlocked) query = query.eq('is_surprise', false);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchTransport() {
  const { data, error } = await supabase.from('transport').select('*').order('start_date');
  if (error) throw error;
  return data;
}

export async function fetchContacts() {
  const { data, error } = await supabase.from('contacts').select('*').order('id');
  if (error) throw error;
  return data;
}

export async function fetchTravellers() {
  const { data, error } = await supabase.from('travellers').select('*').order('id');
  if (error) throw error;
  return data;
}

export async function fetchPayments() {
  const { data, error } = await supabase
    .from('participants_payments')
    .select('*, traveller:travellers(id,name)')
    .order('traveller_id');
  if (error) throw error;
  return data;
}

export async function fetchChecklist(surpriseUnlocked = false) {
  let query = supabase.from('checklist_items').select('*').order('category').order('id');
  if (!surpriseUnlocked) query = query.eq('is_surprise', false);
  const { data, error } = await query;
  if (error) throw error;
  return data;
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
