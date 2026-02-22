// assets/flights.js
// Flight list page + 3D globe modal using globe.gl

import { fetchFlights, escHtml, fmtDate, fmtAmt, statusBadge } from './public.js';
import { t } from './i18n.js';

let globeInstance = null;
let surpriseUnlocked = sessionStorage.getItem('surprise_unlocked') === 'true';

// ── Initialise ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (surpriseUnlocked) showSurpriseSection();

  await loadFlights();
  setupSurprisePin();
  setupGlobeModal();
});

// ── Load & render flights ───────────────────────────────────
async function loadFlights() {
  const tbody = document.getElementById('flights-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="11"><div class="loading-center"><div class="spinner"></div></div></td></tr>';

  try {
    const flights = await fetchFlights(surpriseUnlocked);
    renderFlightsTable(flights, tbody);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="alert alert-danger">⚠️ ${escHtml(err.message)}</div></td></tr>`;
    if (new URLSearchParams(location.search).get('debug') === '1') {
      console.error('[flights] fetch error:', err);
    }
  }
}

function renderFlightsTable(flights, tbody) {
  if (!flights || flights.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-light)">${t('flights.noData')}</td></tr>`;
    return;
  }

  tbody.innerHTML = flights.map(f => {
    const surprise = f.is_surprise ? '⭐ ' : '';
    return `<tr>
      <td><strong>${escHtml(f.id)}</strong></td>
      <td>${surprise}${escHtml(f.passengers)}</td>
      <td>
        <strong>${escHtml(f.route)}</strong><br>
        <small style="color:var(--text-light)">${escHtml(f.company)} — ${escHtml(f.flight_numbers)}</small>
      </td>
      <td>${fmtDate(f.dep_date)}<br><small>${escHtml(f.dep_time || '')}</small></td>
      <td>${fmtDate(f.arr_date)}<br><small>${escHtml(f.arr_time || '')}</small></td>
      <td><small>${escHtml(f.cabin_baggage)}</small><br><small>${escHtml(f.hold_baggage)}</small></td>
      <td><small>${escHtml(f.seats || t('flights.seats.short'))}</small></td>
      <td><small>${escHtml(f.booking_ref)}</small></td>
      <td>${fmtAmt(f.price_chf, f.price_brl)}</td>
      <td>${statusBadge(f.payment_status)}</td>
      <td>
        <button class="btn btn-sm btn-outline globe-btn"
          data-origin="${escHtml(f.origin_iata || '')}"
          data-dest="${escHtml(f.destination_iata || '')}"
          data-label="${escHtml(f.route)}"
          data-olat="${f.origin?.lat || ''}"
          data-olon="${f.origin?.lon || ''}"
          data-dlat="${f.destination?.lat || ''}"
          data-dlon="${f.destination?.lon || ''}"
          data-flight='${JSON.stringify({ id: f.id, route: f.route, company: f.company, booking_ref: f.booking_ref, dep_date: f.dep_date, dep_time: f.dep_time, arr_date: f.arr_date, arr_time: f.arr_time, class: f.class, seats: f.seats, cabin_baggage: f.cabin_baggage, hold_baggage: f.hold_baggage, pax_count: f.pax_count, notes: f.notes }).replace(/'/g, "&#39;")}'>
          🌍 ${t('th.flight.globe')}
        </button>
      </td>
    </tr>`;
  }).join('');
}

// ── Globe Modal ─────────────────────────────────────────────
function setupGlobeModal() {
  const overlay = document.getElementById('globe-modal');
  const closeBtn = document.getElementById('globe-close');
  if (!overlay || !closeBtn) return;

  // Delegate click from table
  document.addEventListener('click', e => {
    const btn = e.target.closest('.globe-btn');
    if (!btn) return;
    e.preventDefault();

    const oLat = parseFloat(btn.dataset.olat);
    const oLon = parseFloat(btn.dataset.olon);
    const dLat = parseFloat(btn.dataset.dlat);
    const dLon = parseFloat(btn.dataset.dlon);

    let flight;
    try { flight = JSON.parse(btn.dataset.flight); } catch(_) { flight = {}; }

    openGlobeModal(
      btn.dataset.label,
      { lat: oLat, lon: oLon, iata: btn.dataset.origin },
      { lat: dLat, lon: dLon, iata: btn.dataset.dest },
      flight
    );
  });

  closeBtn.addEventListener('click', closeGlobeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeGlobeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeGlobeModal(); });
}

function openGlobeModal(label, origin, dest, flight) {
  const overlay = document.getElementById('globe-modal');
  const titleEl = document.getElementById('globe-title');
  const footerEl = document.getElementById('globe-footer');

  if (titleEl) titleEl.textContent = `🌍 ${label}`;
  if (footerEl) footerEl.innerHTML = renderFlightDetails(flight);

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  initGlobe(origin, dest);
}

function closeGlobeModal() {
  const overlay = document.getElementById('globe-modal');
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
  // Destroy globe to free memory
  if (globeInstance) {
    const container = document.getElementById('globe-container');
    if (container) container.innerHTML = '';
    globeInstance = null;
  }
}

function renderFlightDetails(f) {
  if (!f) return '';
  return `<dl>
    <dt>${t('globe.ref')}</dt><dd>${escHtml(f.booking_ref)}</dd>
    <dt>${t('globe.company')}</dt><dd>${escHtml(f.company)}</dd>
    <dt>${t('globe.class')}</dt><dd>${escHtml(f.class)}</dd>
    <dt>${t('globe.dep')}</dt><dd>${fmtDate(f.dep_date)} ${escHtml(f.dep_time || '')}</dd>
    <dt>${t('globe.arr')}</dt><dd>${fmtDate(f.arr_date)} ${escHtml(f.arr_time || '')}</dd>
    <dt>${t('globe.cabinBag')}</dt><dd>${escHtml(f.cabin_baggage)}</dd>
    <dt>${t('globe.holdBag')}</dt><dd>${escHtml(f.hold_baggage)}</dd>
    <dt>${t('globe.seats')}</dt><dd>${escHtml(f.seats || t('flights.seats.none'))}</dd>
    <dt>${t('globe.pax')}</dt><dd>${escHtml(String(f.pax_count || 1))}</dd>
    ${f.notes ? `<dt>${t('globe.notes')}</dt><dd>${escHtml(f.notes)}</dd>` : ''}
  </dl>`;
}

// ── 3D Globe using globe.gl ─────────────────────────────────
function initGlobe(origin, dest) {
  const container = document.getElementById('globe-container');
  if (!container) return;
  container.innerHTML = ''; // clear previous

  if (!window.Globe) {
    container.innerHTML = `<div style="color:#fff;display:flex;align-items:center;justify-content:center;height:100%;font-size:.9rem">${t('flights.globe.loading')}</div>`;
    // globe.gl is loaded from CDN in flights.html; wait a moment
    const check = setInterval(() => {
      if (window.Globe) {
        clearInterval(check);
        container.innerHTML = '';
        buildGlobe(container, origin, dest);
      }
    }, 200);
    return;
  }
  buildGlobe(container, origin, dest);
}

function buildGlobe(container, origin, dest) {
  const hasCoords = (p) => p && !isNaN(p.lat) && !isNaN(p.lon);

  const arcsData = hasCoords(origin) && hasCoords(dest)
    ? [{ startLat: origin.lat, startLng: origin.lon, endLat: dest.lat, endLng: dest.lon, color: '#E74C8B' }]
    : [];

  const pointsData = [
    hasCoords(origin) ? { lat: origin.lat, lng: origin.lon, label: origin.iata, size: 0.3, color: '#60A5FA' } : null,
    hasCoords(dest)   ? { lat: dest.lat,   lng: dest.lon,   label: dest.iata,   size: 0.3, color: '#34D399' } : null,
  ].filter(Boolean);

  const midLat = hasCoords(origin) && hasCoords(dest) ? (origin.lat + dest.lat) / 2 : 20;
  const midLon = hasCoords(origin) && hasCoords(dest) ? (origin.lon + dest.lon) / 2 : 0;

  // Size globe to fit container
  const w = container.clientWidth;
  const h = container.clientHeight;

  const g = window.Globe({ animateIn: true })(container)
    .width(w)
    .height(h)
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
    .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true)
    .atmosphereColor('#3b82f6')
    .atmosphereAltitude(0.2)
    .arcsData(arcsData)
    .arcColor('color')
    .arcDashLength(0.5)
    .arcDashGap(0.15)
    .arcDashAnimateTime(1800)
    .arcStroke(2.5)
    .arcAltitudeAutoScale(0.4)
    .pointsData(pointsData)
    .pointColor('color')
    .pointAltitude('size')
    .pointRadius(0.6)
    .pointLabel('label');

  // Point camera at midpoint
  g.pointOfView({ lat: midLat, lng: midLon, altitude: 2.2 }, 800);

  globeInstance = g;
}

// ── Surprise PIN ────────────────────────────────────────────
function setupSurprisePin() {
  const trigger = document.getElementById('surprise-trigger');
  const overlay = document.getElementById('surprise-overlay');
  const closeBtn = document.getElementById('surprise-close');
  const form = document.getElementById('surprise-pin-form');
  if (!trigger || !overlay || !form) return;

  // Open dialog from hidden footer trigger
  trigger.addEventListener('click', () => {
    if (surpriseUnlocked) return;
    overlay.classList.remove('hidden');
    document.getElementById('surprise-pin-input')?.focus();
  });

  // Close dialog
  if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const pin = document.getElementById('surprise-pin-input')?.value?.trim();
    if (!pin) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '…';

    try {
      const params = await fetch('data/parameters.json').then(r => r.json());
      const expectedPin = params.find(p => p.key === 'surprise_pin')?.value;

      if (expectedPin && pin === expectedPin) {
        surpriseUnlocked = true;
        sessionStorage.setItem('surprise_unlocked', 'true');
        overlay.classList.add('hidden');
        showSurpriseSection();
        await loadFlights(); // reload to include surprise flights
      } else {
        const err = document.getElementById('surprise-pin-error');
        if (err) err.textContent = t('flights.surprise.wrongPin');
      }
    } catch (_) {
      const err = document.getElementById('surprise-pin-error');
      if (err) err.textContent = t('flights.surprise.netErr');
    } finally {
      btn.disabled = false;
      btn.textContent = t('flights.surprise.btn');
    }
  });
}

function showSurpriseSection() {
  const content = document.getElementById('surprise-content');
  const trigger = document.getElementById('surprise-trigger');
  if (content) content.classList.add('visible');
  // Hide the trigger once unlocked
  if (trigger) trigger.style.display = 'none';
}
