// assets/admin.js
// Admin page: Supabase Auth login + CRUD for flights, lodgings, transport, payments, checklist.

import { supabase } from './supabaseClient.js';
import { escHtml, fmtDate, fmtAmt } from './public.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check existing session
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    showAdminPanel();
  } else {
    showLoginForm();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      currentUser = session.user;
      showAdminPanel();
    } else {
      currentUser = null;
      showLoginForm();
    }
  });
});

// ── Auth UI ─────────────────────────────────────────────────
function showLoginForm() {
  document.getElementById('admin-login').style.display = 'block';
  document.getElementById('admin-panel').style.display = 'none';

  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const pass  = document.getElementById('admin-pass').value;
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';

    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      errEl.textContent = `❌ ${error.message}`;
    }
  });
}

function showAdminPanel() {
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'block';

  const userEl = document.getElementById('admin-user');
  if (userEl && currentUser) userEl.textContent = currentUser.email;

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
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

// ── Flights Admin ────────────────────────────────────────────
async function loadFlightsAdmin(body) {
  const { data, error } = await supabase.from('flights').select('*').order('dep_date');
  if (error) { body.innerHTML = `<div class="alert alert-danger">${error.message}</div>`; return; }

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 style="color:var(--primary)">✈️ Vols</h2>
      <button class="btn btn-primary btn-sm" id="add-flight-btn">+ Nouveau vol</button>
    </div>
    <div id="flight-form-area"></div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>ID</th><th>Passager(s)</th><th>Route</th><th>Départ</th>
          <th>Réf.</th><th>Prix</th><th>Statut</th><th>Surprise</th><th>Actions</th>
        </tr></thead>
        <tbody>${data.map(f => flightRow(f)).join('')}</tbody>
      </table>
    </div>`;

  body.querySelector('#add-flight-btn')?.addEventListener('click', () => {
    showFlightForm(body, null);
  });

  body.querySelectorAll('.edit-flight-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const flight = data.find(f => f.id === id);
      if (flight) showFlightForm(body, flight);
    });
  });

  body.querySelectorAll('.del-flight-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer ce vol?')) return;
      const { error } = await supabase.from('flights').delete().eq('id', btn.dataset.id);
      if (error) alert(error.message);
      else loadAdminTab('flights');
    });
  });
}

function flightRow(f) {
  return `<tr>
    <td>${escHtml(f.id)}</td>
    <td>${escHtml(f.passengers)}</td>
    <td>${escHtml(f.route)}</td>
    <td>${fmtDate(f.dep_date)}</td>
    <td>${escHtml(f.booking_ref)}</td>
    <td>${fmtAmt(f.price_chf, f.price_brl)}</td>
    <td>${escHtml(f.payment_status || '')}</td>
    <td>${f.is_surprise ? '⭐' : ''}</td>
    <td>
      <button class="btn btn-sm btn-outline edit-flight-btn" data-id="${escHtml(f.id)}">✏️</button>
      <button class="btn btn-sm btn-danger del-flight-btn" data-id="${escHtml(f.id)}">🗑</button>
    </td>
  </tr>`;
}

function showFlightForm(body, flight) {
  const area = body.querySelector('#flight-form-area');
  if (!area) return;
  const isNew = !flight;
  area.innerHTML = `
    <div class="card" style="margin-bottom:1.5rem">
      <h2>${isNew ? 'Nouveau vol' : 'Modifier vol ' + escHtml(flight.id)}</h2>
      <form id="flight-form">
        <div class="form-row">
          <div class="form-group"><label>ID</label><input name="id" value="${escHtml(flight?.id || '')}" ${isNew ? '' : 'readonly'} required></div>
          <div class="form-group"><label>Passager(s)</label><input name="passengers" value="${escHtml(flight?.passengers || '')}" required></div>
        </div>
        <div class="form-group"><label>Route</label><input name="route" value="${escHtml(flight?.route || '')}" required></div>
        <div class="form-row">
          <div class="form-group"><label>IATA Origine</label><input name="origin_iata" value="${escHtml(flight?.origin_iata || '')}"></div>
          <div class="form-group"><label>IATA Destination</label><input name="destination_iata" value="${escHtml(flight?.destination_iata || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Date départ</label><input type="date" name="dep_date" value="${flight?.dep_date || ''}"></div>
          <div class="form-group"><label>Heure départ</label><input type="time" name="dep_time" value="${flight?.dep_time || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Date arrivée</label><input type="date" name="arr_date" value="${flight?.arr_date || ''}"></div>
          <div class="form-group"><label>Heure arrivée</label><input type="time" name="arr_time" value="${flight?.arr_time || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Compagnie</label><input name="company" value="${escHtml(flight?.company || '')}"></div>
          <div class="form-group"><label>N° vols</label><input name="flight_numbers" value="${escHtml(flight?.flight_numbers || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Classe</label><input name="class" value="${escHtml(flight?.class || '')}"></div>
          <div class="form-group"><label>Réf. Réservation</label><input name="booking_ref" value="${escHtml(flight?.booking_ref || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Bagage cabine</label><input name="cabin_baggage" value="${escHtml(flight?.cabin_baggage || '')}"></div>
          <div class="form-group"><label>Bagage soute</label><input name="hold_baggage" value="${escHtml(flight?.hold_baggage || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Sièges</label><input name="seats" value="${escHtml(flight?.seats || '')}"></div>
          <div class="form-group"><label>Nb Pax</label><input type="number" name="pax_count" value="${flight?.pax_count || 1}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Prix CHF</label><input type="number" step="0.01" name="price_chf" value="${flight?.price_chf || ''}"></div>
          <div class="form-group"><label>Prix BRL</label><input type="number" step="0.01" name="price_brl" value="${flight?.price_brl || ''}"></div>
        </div>
        <div class="form-group"><label>Statut paiement</label><input name="payment_status" value="${escHtml(flight?.payment_status || '')}"></div>
        <div class="form-group"><label>Notes</label><textarea name="notes">${escHtml(flight?.notes || '')}</textarea></div>
        <div class="form-group">
          <label><input type="checkbox" name="is_surprise" ${flight?.is_surprise ? 'checked' : ''}> Élément Surprise (caché par défaut)</label>
        </div>
        <div style="display:flex;gap:.75rem">
          <button type="submit" class="btn btn-primary">${isNew ? 'Créer' : 'Sauvegarder'}</button>
          <button type="button" class="btn btn-outline" id="cancel-flight-form">Annuler</button>
        </div>
        <div id="flight-form-error" class="alert alert-danger" style="display:none;margin-top:.75rem"></div>
      </form>
    </div>`;

  area.querySelector('#cancel-flight-form').addEventListener('click', () => { area.innerHTML = ''; });

  area.querySelector('#flight-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    payload.is_surprise = fd.has('is_surprise');
    payload.price_chf = payload.price_chf ? parseFloat(payload.price_chf) : null;
    payload.price_brl = payload.price_brl ? parseFloat(payload.price_brl) : null;
    payload.pax_count = parseInt(payload.pax_count) || 1;
    payload.dep_date = payload.dep_date || null;
    payload.arr_date = payload.arr_date || null;
    payload.dep_time = payload.dep_time || null;
    payload.arr_time = payload.arr_time || null;
    payload.origin_iata = payload.origin_iata || null;
    payload.destination_iata = payload.destination_iata || null;

    const errEl = area.querySelector('#flight-form-error');
    errEl.style.display = 'none';

    let dbError;
    if (isNew) {
      ({ error: dbError } = await supabase.from('flights').insert([payload]));
    } else {
      const { id, ...updates } = payload;
      ({ error: dbError } = await supabase.from('flights').update(updates).eq('id', flight.id));
    }

    if (dbError) {
      errEl.textContent = dbError.message;
      errEl.style.display = 'flex';
    } else {
      area.innerHTML = '';
      loadAdminTab('flights');
    }
  });
}

// ── Lodgings Admin ───────────────────────────────────────────
async function loadLodgingsAdmin(body) {
  const { data, error } = await supabase.from('lodgings').select('*').order('checkin_date');
  if (error) { body.innerHTML = `<div class="alert alert-danger">${error.message}</div>`; return; }

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 style="color:var(--primary)">🏨 Hébergements</h2>
      <button class="btn btn-primary btn-sm" id="add-lodging-btn">+ Nouvel hébergement</button>
    </div>
    <div id="lodging-form-area"></div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>ID</th><th>Établissement</th><th>Ville</th><th>Check-in</th><th>Check-out</th>
          <th>Prix</th><th>Surprise</th><th>Actions</th>
        </tr></thead>
        <tbody>${data.map(h => `<tr>
          <td>${escHtml(h.id)}</td>
          <td>${escHtml(h.establishment)}</td>
          <td>${escHtml(h.city)}</td>
          <td>${fmtDate(h.checkin_date)}</td>
          <td>${fmtDate(h.checkout_date)}</td>
          <td>${fmtAmt(h.price_chf, h.price_brl)}</td>
          <td>${h.is_surprise ? '⭐' : ''}</td>
          <td>
            <button class="btn btn-sm btn-outline edit-lodging-btn" data-id="${escHtml(h.id)}">✏️</button>
            <button class="btn btn-sm btn-danger del-lodging-btn" data-id="${escHtml(h.id)}">🗑</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

  body.querySelector('#add-lodging-btn')?.addEventListener('click', () => showLodgingForm(body, null, data));

  body.querySelectorAll('.edit-lodging-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = data.find(h => h.id === btn.dataset.id);
      if (item) showLodgingForm(body, item, data);
    });
  });

  body.querySelectorAll('.del-lodging-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cet hébergement?')) return;
      const { error } = await supabase.from('lodgings').delete().eq('id', btn.dataset.id);
      if (error) alert(error.message);
      else loadAdminTab('lodgings');
    });
  });
}

function showLodgingForm(body, item, _data) {
  const area = body.querySelector('#lodging-form-area');
  if (!area) return;
  const isNew = !item;

  area.innerHTML = `
    <div class="card" style="margin-bottom:1.5rem">
      <h2>${isNew ? 'Nouvel hébergement' : 'Modifier ' + escHtml(item.establishment)}</h2>
      <form id="lodging-form">
        <div class="form-row">
          <div class="form-group"><label>ID</label><input name="id" value="${escHtml(item?.id || '')}" ${isNew ? '' : 'readonly'} required></div>
          <div class="form-group"><label>Établissement</label><input name="establishment" value="${escHtml(item?.establishment || '')}" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Ville</label><input name="city" value="${escHtml(item?.city || '')}" required></div>
          <div class="form-group"><label>Voyageur(s)</label><input name="travellers_desc" value="${escHtml(item?.travellers_desc || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Check-in date</label><input type="date" name="checkin_date" value="${item?.checkin_date || ''}"></div>
          <div class="form-group"><label>Check-in heure</label><input type="time" name="checkin_time" value="${item?.checkin_time || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Check-out date</label><input type="date" name="checkout_date" value="${item?.checkout_date || ''}"></div>
          <div class="form-group"><label>Check-out heure</label><input type="time" name="checkout_time" value="${item?.checkout_time || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Nuits</label><input type="number" name="nights" value="${item?.nights || ''}"></div>
          <div class="form-group"><label>Type chambre</label><input name="room_type" value="${escHtml(item?.room_type || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Prix CHF</label><input type="number" step="0.01" name="price_chf" value="${item?.price_chf || ''}"></div>
          <div class="form-group"><label>Prix BRL</label><input type="number" step="0.01" name="price_brl" value="${item?.price_brl || ''}"></div>
        </div>
        <div class="form-group"><label>Réf. Confirmation</label><input name="booking_ref" value="${escHtml(item?.booking_ref || '')}"></div>
        <div class="form-group"><label>Prépaiement / Statut</label><input name="prepayment" value="${escHtml(item?.prepayment || '')}"></div>
        <div class="form-group"><label>GPS</label><input name="gps" value="${escHtml(item?.gps || '')}"></div>
        <div class="form-group">
          <label><input type="checkbox" name="is_surprise" ${item?.is_surprise ? 'checked' : ''}> Élément Surprise</label>
        </div>
        <div style="display:flex;gap:.75rem">
          <button type="submit" class="btn btn-primary">${isNew ? 'Créer' : 'Sauvegarder'}</button>
          <button type="button" class="btn btn-outline" id="cancel-lodging-form">Annuler</button>
        </div>
        <div id="lodging-form-error" class="alert alert-danger" style="display:none;margin-top:.75rem"></div>
      </form>
    </div>`;

  area.querySelector('#cancel-lodging-form').addEventListener('click', () => { area.innerHTML = ''; });

  area.querySelector('#lodging-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    payload.is_surprise = fd.has('is_surprise');
    payload.price_chf = payload.price_chf ? parseFloat(payload.price_chf) : null;
    payload.price_brl = payload.price_brl ? parseFloat(payload.price_brl) : null;
    payload.nights = payload.nights ? parseInt(payload.nights) : null;
    payload.checkin_date  = payload.checkin_date  || null;
    payload.checkout_date = payload.checkout_date || null;
    payload.checkin_time  = payload.checkin_time  || null;
    payload.checkout_time = payload.checkout_time || null;

    const errEl = area.querySelector('#lodging-form-error');
    errEl.style.display = 'none';

    let dbError;
    if (isNew) {
      ({ error: dbError } = await supabase.from('lodgings').insert([payload]));
    } else {
      const { id, ...updates } = payload;
      ({ error: dbError } = await supabase.from('lodgings').update(updates).eq('id', item.id));
    }

    if (dbError) { errEl.textContent = dbError.message; errEl.style.display = 'flex'; }
    else { area.innerHTML = ''; loadAdminTab('lodgings'); }
  });
}

// ── Transport Admin ──────────────────────────────────────────
async function loadTransportAdmin(body) {
  const { data, error } = await supabase.from('transport').select('*').order('start_date');
  if (error) { body.innerHTML = `<div class="alert alert-danger">${error.message}</div>`; return; }

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 style="color:var(--primary)">🚗 Transport</h2>
      <button class="btn btn-primary btn-sm" id="add-transport-btn">+ Nouveau transport</button>
    </div>
    <div id="transport-form-area"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Véhicule</th><th>Agence</th><th>Début</th><th>Fin</th><th>Prix BRL</th><th>Réf.</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>${data.map(t => `<tr>
          <td>${escHtml(t.id)}</td>
          <td>${escHtml(t.vehicle)}</td>
          <td>${escHtml(t.agency)}</td>
          <td>${fmtDate(t.start_date)}</td>
          <td>${fmtDate(t.end_date)}</td>
          <td>${t.price_brl != null ? 'R$ ' + Number(t.price_brl).toLocaleString('pt-BR') : '—'}</td>
          <td>${escHtml(t.booking_ref)}</td>
          <td>${escHtml(t.payment_status || '')}</td>
          <td>
            <button class="btn btn-sm btn-outline edit-transport-btn" data-id="${escHtml(t.id)}">✏️</button>
            <button class="btn btn-sm btn-danger del-transport-btn" data-id="${escHtml(t.id)}">🗑</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

  body.querySelector('#add-transport-btn')?.addEventListener('click', () => showTransportForm(body, null, data));
  body.querySelectorAll('.edit-transport-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = data.find(t => t.id === btn.dataset.id);
      if (item) showTransportForm(body, item, data);
    });
  });
  body.querySelectorAll('.del-transport-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer?')) return;
      const { error } = await supabase.from('transport').delete().eq('id', btn.dataset.id);
      if (error) alert(error.message);
      else loadAdminTab('transport');
    });
  });
}

function showTransportForm(body, item, _data) {
  const area = body.querySelector('#transport-form-area');
  if (!area) return;
  const isNew = !item;

  area.innerHTML = `
    <div class="card" style="margin-bottom:1.5rem">
      <h2>${isNew ? 'Nouveau transport' : 'Modifier ' + escHtml(item.id)}</h2>
      <form id="transport-form">
        <div class="form-row">
          <div class="form-group"><label>ID</label><input name="id" value="${escHtml(item?.id || '')}" ${isNew ? '' : 'readonly'} required></div>
          <div class="form-group"><label>Conducteur</label><input name="driver" value="${escHtml(item?.driver || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Véhicule</label><input name="vehicle" value="${escHtml(item?.vehicle || '')}"></div>
          <div class="form-group"><label>Agence</label><input name="agency" value="${escHtml(item?.agency || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Date début</label><input type="date" name="start_date" value="${item?.start_date || ''}"></div>
          <div class="form-group"><label>Date fin</label><input type="date" name="end_date" value="${item?.end_date || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Prix BRL</label><input type="number" step="0.01" name="price_brl" value="${item?.price_brl || ''}"></div>
          <div class="form-group"><label>Pré-auth BRL</label><input type="number" step="0.01" name="preauth_brl" value="${item?.preauth_brl || ''}"></div>
        </div>
        <div class="form-group"><label>Réf. Réservation</label><input name="booking_ref" value="${escHtml(item?.booking_ref || '')}"></div>
        <div class="form-group"><label>Statut paiement</label><input name="payment_status" value="${escHtml(item?.payment_status || '')}"></div>
        <div class="form-group"><label>Adresse agence</label><input name="agency_address" value="${escHtml(item?.agency_address || '')}"></div>
        <div class="form-group"><label>Notes</label><textarea name="notes">${escHtml(item?.notes || '')}</textarea></div>
        <div style="display:flex;gap:.75rem">
          <button type="submit" class="btn btn-primary">${isNew ? 'Créer' : 'Sauvegarder'}</button>
          <button type="button" class="btn btn-outline" id="cancel-transport-form">Annuler</button>
        </div>
        <div id="transport-form-error" class="alert alert-danger" style="display:none;margin-top:.75rem"></div>
      </form>
    </div>`;

  area.querySelector('#cancel-transport-form').addEventListener('click', () => { area.innerHTML = ''; });

  area.querySelector('#transport-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    payload.price_brl  = payload.price_brl  ? parseFloat(payload.price_brl)  : null;
    payload.preauth_brl = payload.preauth_brl ? parseFloat(payload.preauth_brl) : null;
    payload.start_date = payload.start_date || null;
    payload.end_date   = payload.end_date   || null;

    const errEl = area.querySelector('#transport-form-error');
    errEl.style.display = 'none';

    let dbError;
    if (isNew) {
      ({ error: dbError } = await supabase.from('transport').insert([payload]));
    } else {
      const { id, ...updates } = payload;
      ({ error: dbError } = await supabase.from('transport').update(updates).eq('id', item.id));
    }

    if (dbError) { errEl.textContent = dbError.message; errEl.style.display = 'flex'; }
    else { area.innerHTML = ''; loadAdminTab('transport'); }
  });
}

// ── Payments Admin ───────────────────────────────────────────
async function loadPaymentsAdmin(body) {
  const { data, error } = await supabase
    .from('participants_payments')
    .select('*, traveller:travellers(id,name)')
    .order('traveller_id');

  if (error) { body.innerHTML = `<div class="alert alert-danger">${error.message}</div>`; return; }

  body.innerHTML = `
    <h2 style="color:var(--primary);margin-bottom:1rem">💰 Paiements par personne</h2>
    <div class="alert alert-info" style="margin-bottom:1rem">Cliquez sur ✏️ pour modifier un élément. Gérez les lignes de paiement individuellement.</div>
    <div id="payment-form-area"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Voyageur</th><th>Catégorie</th><th>Détail</th><th>CHF</th><th>BRL</th><th>Payé?</th><th>Notes</th><th>Actions</th></tr></thead>
        <tbody>${data.map(p => `<tr id="pay-row-${escHtml(p.id)}">
          <td>${escHtml(p.traveller?.name || p.traveller_id)}</td>
          <td>${escHtml(p.category)}</td>
          <td>${escHtml(p.detail)}</td>
          <td>${p.price_chf != null ? Number(p.price_chf).toLocaleString('fr-CH') + ' CHF' : '—'}</td>
          <td>${p.price_brl != null ? 'R$ ' + Number(p.price_brl).toLocaleString('pt-BR') : '—'}</td>
          <td>${escHtml(p.paid || '—')}</td>
          <td><small>${escHtml(p.notes || '')}</small></td>
          <td>
            <button class="btn btn-sm btn-outline edit-payment-btn" data-id="${escHtml(p.id)}">✏️</button>
            <button class="btn btn-sm btn-danger del-payment-btn" data-id="${escHtml(p.id)}">🗑</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

  body.querySelectorAll('.del-payment-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cette ligne?')) return;
      const { error } = await supabase.from('participants_payments').delete().eq('id', btn.dataset.id);
      if (error) alert(error.message);
      else loadAdminTab('payments');
    });
  });

  body.querySelectorAll('.edit-payment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = data.find(p => p.id === btn.dataset.id);
      if (item) showPaymentInlineEdit(body, item, data);
    });
  });
}

function showPaymentInlineEdit(body, item, allData) {
  const area = body.querySelector('#payment-form-area');
  if (!area) return;

  area.innerHTML = `
    <div class="card" style="margin-bottom:1.5rem">
      <h2>Modifier paiement</h2>
      <form id="payment-form">
        <div class="form-row">
          <div class="form-group"><label>Catégorie</label><input name="category" value="${escHtml(item.category)}" required></div>
          <div class="form-group"><label>Détail</label><input name="detail" value="${escHtml(item.detail)}" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Prix CHF</label><input type="number" step="0.01" name="price_chf" value="${item.price_chf || ''}"></div>
          <div class="form-group"><label>Prix BRL</label><input type="number" step="0.01" name="price_brl" value="${item.price_brl || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Statut paiement</label><input name="paid" value="${escHtml(item.paid || '')}"></div>
          <div class="form-group"><label>Notes</label><input name="notes" value="${escHtml(item.notes || '')}"></div>
        </div>
        <div style="display:flex;gap:.75rem">
          <button type="submit" class="btn btn-primary">Sauvegarder</button>
          <button type="button" class="btn btn-outline" id="cancel-payment-form">Annuler</button>
        </div>
        <div id="payment-form-error" class="alert alert-danger" style="display:none;margin-top:.75rem"></div>
      </form>
    </div>`;

  area.querySelector('#cancel-payment-form').addEventListener('click', () => { area.innerHTML = ''; });

  area.querySelector('#payment-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const updates = Object.fromEntries(fd.entries());
    updates.price_chf = updates.price_chf ? parseFloat(updates.price_chf) : null;
    updates.price_brl = updates.price_brl ? parseFloat(updates.price_brl) : null;

    const errEl = area.querySelector('#payment-form-error');
    errEl.style.display = 'none';

    const { error: dbError } = await supabase.from('participants_payments').update(updates).eq('id', item.id);
    if (dbError) { errEl.textContent = dbError.message; errEl.style.display = 'flex'; }
    else { area.innerHTML = ''; loadAdminTab('payments'); }
  });
}

// ── Checklist Admin ──────────────────────────────────────────
async function loadChecklistAdmin(body) {
  const { data, error } = await supabase.from('checklist_items').select('*').order('category').order('id');
  if (error) { body.innerHTML = `<div class="alert alert-danger">${error.message}</div>`; return; }

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h2 style="color:var(--primary)">✅ Checklist</h2>
      <button class="btn btn-primary btn-sm" id="add-checklist-btn">+ Nouvel élément</button>
    </div>
    <div id="checklist-form-area"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Catégorie</th><th>Voyageur</th><th>Action</th><th>Deadline</th><th>Fait?</th><th>Surprise</th><th>Actions</th></tr></thead>
        <tbody>${data.map(c => `<tr>
          <td>${escHtml(c.category)}</td>
          <td>${escHtml(c.traveller || '—')}</td>
          <td>${escHtml(c.action)}</td>
          <td>${escHtml(c.deadline || '—')}</td>
          <td>${c.done ? `✅ ${escHtml(c.done_by || '')}` : '☐'}</td>
          <td>${c.is_surprise ? '⭐' : ''}</td>
          <td>
            <button class="btn btn-sm btn-outline edit-checklist-btn" data-id="${escHtml(c.id)}">✏️</button>
            <button class="btn btn-sm btn-danger del-checklist-btn" data-id="${escHtml(c.id)}">🗑</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

  body.querySelector('#add-checklist-btn')?.addEventListener('click', () => showChecklistItemForm(body, null, data));
  body.querySelectorAll('.edit-checklist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = data.find(c => c.id === btn.dataset.id);
      if (item) showChecklistItemForm(body, item, data);
    });
  });
  body.querySelectorAll('.del-checklist-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer?')) return;
      const { error } = await supabase.from('checklist_items').delete().eq('id', btn.dataset.id);
      if (error) alert(error.message);
      else loadAdminTab('checklist');
    });
  });
}

function showChecklistItemForm(body, item, _data) {
  const area = body.querySelector('#checklist-form-area');
  if (!area) return;
  const isNew = !item;

  area.innerHTML = `
    <div class="card" style="margin-bottom:1.5rem">
      <h2>${isNew ? 'Nouvel élément' : 'Modifier élément'}</h2>
      <form id="checklist-item-form">
        <div class="form-row">
          <div class="form-group">
            <label>Catégorie</label>
            <select name="category">
              ${['DOCUMENTS','VOLS','HÉBERGEMENTS','TRANSPORT','Général'].map(c =>
                `<option value="${c}" ${item?.category === c ? 'selected' : ''}>${c}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group"><label>Voyageur</label><input name="traveller" value="${escHtml(item?.traveller || '')}"></div>
        </div>
        <div class="form-group"><label>Action</label><input name="action" value="${escHtml(item?.action || '')}" required></div>
        <div class="form-group"><label>Détails</label><input name="details" value="${escHtml(item?.details || '')}"></div>
        <div class="form-group"><label>Deadline</label><input name="deadline" value="${escHtml(item?.deadline || '')}"></div>
        <div class="form-group">
          <label><input type="checkbox" name="is_surprise" ${item?.is_surprise ? 'checked' : ''}> Élément Surprise</label>
        </div>
        <div style="display:flex;gap:.75rem">
          <button type="submit" class="btn btn-primary">${isNew ? 'Créer' : 'Sauvegarder'}</button>
          <button type="button" class="btn btn-outline" id="cancel-checklist-item-form">Annuler</button>
        </div>
        <div id="checklist-item-form-error" class="alert alert-danger" style="display:none;margin-top:.75rem"></div>
      </form>
    </div>`;

  area.querySelector('#cancel-checklist-item-form').addEventListener('click', () => { area.innerHTML = ''; });

  area.querySelector('#checklist-item-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    payload.is_surprise = fd.has('is_surprise');

    const errEl = area.querySelector('#checklist-item-form-error');
    errEl.style.display = 'none';

    let dbError;
    if (isNew) {
      ({ error: dbError } = await supabase.from('checklist_items').insert([payload]));
    } else {
      ({ error: dbError } = await supabase.from('checklist_items').update(payload).eq('id', item.id));
    }

    if (dbError) { errEl.textContent = dbError.message; errEl.style.display = 'flex'; }
    else { area.innerHTML = ''; loadAdminTab('checklist'); }
  });
}
