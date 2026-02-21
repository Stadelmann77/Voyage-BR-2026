// assets/public.js
// Shared helpers for all public pages: loading data from Supabase and rendering utilities.

import { supabase } from './supabaseClient.js';

// ── Navigation active link ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
});

// ── Generic error display ───────────────────────────────────
export function showError(container, msg) {
  container.innerHTML = `<div class="alert alert-danger">⚠️ ${msg}</div>`;
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
