// assets/csvData.js
// Parses "BD source voyage BR 2026.csv" for offline (no Supabase) mode.
// Exposes loadCsvData() which returns { flights, lodgings, transport,
// contacts, travellers, parameters } matching the Supabase data shapes.

// ── Built-in airport coordinates ────────────────────────────
const AIRPORTS = {
  GVA: { iata: 'GVA', city: 'Geneva',    lat:  46.2363, lon:   6.1091 },
  ZRH: { iata: 'ZRH', city: 'Zurich',    lat:  47.4647, lon:   8.5492 },
  GRU: { iata: 'GRU', city: 'São Paulo', lat: -23.4356, lon: -46.4731 },
  VCP: { iata: 'VCP', city: 'Campinas',  lat: -23.0074, lon: -47.1345 },
  BEL: { iata: 'BEL', city: 'Belém',     lat:  -1.3792, lon: -48.4764 },
  FOR: { iata: 'FOR', city: 'Fortaleza', lat:  -3.7763, lon: -38.5326 },
  MAB: { iata: 'MAB', city: 'Marabá',    lat:  -5.3686, lon: -49.1380 },
  LIS: { iata: 'LIS', city: 'Lisbon',    lat:  38.7742, lon:  -9.1342 },
};

// ── Built-in checklist for offline mode ─────────────────────
export const DEFAULT_CHECKLIST = [
  { id: 'cl1',  category: 'DOCUMENTS',    action: 'Vérifier validité passeports (≥ 6 mois)',                      traveller: 'Tous',                         details: '',                                                              deadline: 'Avant départ',  done: false, is_surprise: false },
  { id: 'cl2',  category: 'DOCUMENTS',    action: 'Imprimer billets d\'avion (SWISS, TAP, Azul)',                  traveller: 'Tous',                         details: 'Réfs: YS3VET, XR2CPW, XR85TH, TNG1NT, MJ5NQC, ON3LQT',       deadline: 'Avant départ',  done: false, is_surprise: false },
  { id: 'cl3',  category: 'DOCUMENTS',    action: 'Imprimer confirmations hébergements',                           traveller: 'Tous',                         details: 'Réfs: 5474140188, 5987193612, 5331265550, 6862089551',          deadline: 'Avant départ',  done: false, is_surprise: false },
  { id: 'cl4',  category: 'DOCUMENTS',    action: 'Imprimer confirmation location Localiza',                       traveller: 'Claudio',                      details: 'Réf: MO49499YVQBC',                                             deadline: 'Avant départ',  done: false, is_surprise: false },
  { id: 'cl5',  category: 'DOCUMENTS',    action: 'Souscrire assurance voyage',                                    traveller: 'Tous',                         details: '',                                                              deadline: 'Avant départ',  done: false, is_surprise: false },
  { id: 'cl6',  category: 'VOLS',         action: 'Acheter franchise bagage soute SWISS',                          traveller: 'Claudeane',                    details: 'Vol V1 — Economy Light = 0 soute!',                             deadline: 'Avant le vol',  done: false, is_surprise: false },
  { id: 'cl7',  category: 'VOLS',         action: 'Vérifier/acheter bagage soute TAP (aller ET retour)',           traveller: 'Claudio',                      details: 'Vols V3/V4 — 0 soute inclus',                                   deadline: 'Avant le vol',  done: false, is_surprise: false },
  { id: 'cl8',  category: 'VOLS',         action: 'Sélectionner sièges Azul (app voeazul.com.br)',                 traveller: 'Claudeane + Lucileide + Jhemerson', details: 'Vols MJ5NQC + ON3LQT — 0 sièges sélectionnés',              deadline: 'Dès confirmation', done: false, is_surprise: false },
  { id: 'cl9',  category: 'VOLS',         action: 'Confirmer vols Azul EN ESPERA',                                 traveller: 'Claudeane',                    details: 'Réfs MJ5NQC + ON3LQT',                                          deadline: 'Urgent',        done: false, is_surprise: false },
  { id: 'cl10', category: 'HÉBERGEMENTS', action: 'Payer 50% Hôtel Encontro do Sol (DEADLINE 09/04/2026)',         traveller: 'Claudio',                      details: 'Réf 5331265550',                                                deadline: '09/04/2026',    done: false, is_surprise: false },
  { id: 'cl11', category: 'HÉBERGEMENTS', action: 'Vérifier/payer ASAS DEL MAR (DEADLINE 04/05/2026)',             traveller: 'Claudio',                      details: 'Réf 6862089551',                                                deadline: '04/05/2026',    done: false, is_surprise: false },
  { id: 'cl12', category: 'HÉBERGEMENTS', action: 'Payer 50% Pousada Bangalô (DEADLINE 11/05/2026)',               traveller: 'Claudio',                      details: 'Réf 5620.348.709',                                              deadline: '11/05/2026',    done: false, is_surprise: false },
  { id: 'cl13', category: 'HÉBERGEMENTS', action: 'Réserver hébergement 30/05–01/06 (nuits manquantes)',           traveller: 'Tous',                         details: 'Entre Canoa Quebrada et Jericoacoara',                           deadline: 'Urgent',        done: false, is_surprise: false },
  { id: 'cl14', category: 'HÉBERGEMENTS', action: 'Réserver hébergement 03/06–05/06 (nuits manquantes)',           traveller: 'Claudio + Claudeane',          details: 'Avant retour GVA le 05/06',                                     deadline: 'Urgent',        done: false, is_surprise: false },
  { id: 'cl15', category: 'TRANSPORT',    action: 'Télécharger app Localiza FAST',                                 traveller: 'Claudio',                      details: 'Pour prise en charge digitale sans comptoir',                    deadline: 'Avant le 23/05', done: false, is_surprise: false },
  { id: 'cl16', category: 'TRANSPORT',    action: 'Prévoir carte de crédit pour pré-autorisation Localiza (R$ 2500)', traveller: 'Claudio',                   details: 'Réf MO49499YVQBC',                                              deadline: 'Avant le 23/05', done: false, is_surprise: false },
];

// ── CSV section parser ───────────────────────────────────────
const SECTION_NAMES = new Set(['VOLS', 'HÉBERGEMENTS', 'TRANSPORT', 'CONTACTS', 'VOYAGEURS', 'PARAMÈTRES']);

function parseCsvSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = {};
  let currentSection = null;
  let headers = null;

  for (const line of lines) {
    const cells = line.split(';');
    const firstCell = cells[0].trim();

    // Skip completely empty / separator lines
    if (cells.every(c => !c.trim())) continue;

    // Section header detection (first cell is a known section name, rest empty)
    if (SECTION_NAMES.has(firstCell) && cells.slice(1).every(c => !c.trim())) {
      currentSection = firstCell;
      sections[currentSection] = [];
      headers = null;
      continue;
    }

    if (!currentSection) continue;

    // PARAMÈTRES rows are key;value pairs (no column header row)
    if (currentSection === 'PARAMÈTRES') {
      if (firstCell) sections[currentSection].push({ key: firstCell, value: (cells[1] || '').trim() });
      continue;
    }

    // First non-empty row after section header = column headers
    if (!headers) {
      headers = cells.map(c => c.trim());
      continue;
    }

    // Skip empty data rows
    if (!firstCell) continue;

    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = (cells[i] || '').trim(); });
    sections[currentSection].push(obj);
  }

  return sections;
}

// ── Value helpers ────────────────────────────────────────────

/** Convert DD.MM.YYYY or DD/MM/YYYY → YYYY-MM-DD, or return null. */
function parseDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Extract first DD/MM/YYYY date from a free-text string. Returns null for negative-marked values. */
function extractDate(s) {
  if (!s || s.includes('❌') || s.includes('⚠️')) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Parse a European-formatted float (comma as decimal separator). */
function parseNum(s) {
  if (!s) return null;
  const n = parseFloat(s.replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

/** Parse integer, returning null on failure. */
function parseIntSafe(s) {
  if (!s) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/** Extract all 3-letter uppercase IATA-like codes from a route string. */
function extractIataCodes(route) {
  return (route.match(/\b([A-Z]{3})\b/g) || []);
}

/**
 * Parse a GPS coordinate string such as "S 023° 33.693, W 46° 37.977".
 * Returns { lat, lon } in decimal degrees, or { lat: null, lon: null }.
 */
function parseGPS(gps) {
  if (!gps) return { lat: null, lon: null };
  const m = gps.match(/([NS])\s*0*(\d+)°\s*([\d.]+)[,\s]+([EW])\s*0*(\d+)°\s*([\d.]+)/);
  if (!m) return { lat: null, lon: null };
  const lat = (m[1] === 'S' ? -1 : 1) * (parseInt(m[2], 10) + parseFloat(m[3]) / 60);
  const lon = (m[4] === 'W' ? -1 : 1) * (parseInt(m[5], 10) + parseFloat(m[6]) / 60);
  return { lat, lon };
}

// ── Section mappers ──────────────────────────────────────────

function mapFlights(rows) {
  return rows.map(r => {
    const iatas     = extractIataCodes(r['Itinéraire'] || '');
    const originIata = iatas[0] || null;
    const destIata   = iatas[iatas.length - 1] || null;
    const originAp   = originIata ? AIRPORTS[originIata] : null;
    const destAp     = destIata   ? AIRPORTS[destIata]   : null;

    return {
      id:               r['ID'],
      passengers:       r['Passager(s)'],
      route:            r['Itinéraire'],
      dep_date:         parseDate(r['Date Départ']),
      dep_time:         r['Heure Départ']   || null,
      arr_date:         parseDate(r['Date Arrivée']),
      arr_time:         r['Heure Arrivée']  || null,
      company:          r['Compagnie'],
      flight_numbers:   r['N° Vols'],
      class:            r['Classe'],
      booking_ref:      r['Réf. Réservation'],
      cabin_baggage:    r['Bagage Cabine'],
      hold_baggage:     r['Bagage Soute'],
      seats:            r['Sièges']          || null,
      price_chf:        parseNum(r['Prix CHF']),
      price_brl:        parseNum(r['Prix BRL']),
      payment_status:   r['Statut Paiement'],
      pax_count:        parseIntSafe(r['Nb Pax']) || 1,
      notes:            r['Notes']           || null,
      is_surprise:      false,
      origin_iata:      originIata,
      destination_iata: destIata,
      origin:           originAp ? { iata: originIata, lat: originAp.lat, lon: originAp.lon } : null,
      destination:      destAp   ? { iata: destIata,   lat: destAp.lat,   lon: destAp.lon   } : null,
    };
  });
}

function mapLodgings(rows) {
  return rows.map(r => {
    const { lat, lon } = parseGPS(r['GPS']);
    return {
      id:                      r['ID'],
      travellers_desc:         r['Voyageur(s)'],
      establishment:           r['Établissement'],
      city:                    r['Ville'],
      checkin_date:            parseDate(r['Date CheckIn']),
      checkin_time:            r['Heure CheckIn']   || null,
      checkout_date:           parseDate(r['Date CheckOut']),
      checkout_time:           r['Heure CheckOut']  || null,
      nights:                  parseIntSafe(r['Nuits']),
      room_type:               r['Chambre'],
      breakfast:               r['Petit-déj.']      || null,
      price_chf:               parseNum(r['Prix CHF']),
      price_brl:               parseNum(r['Prix BRL']),
      prepayment:              r['Prépaiement'],
      free_cancellation_until: extractDate(r['Annulation gratuite']),
      booking_ref:             r['Réf. Confirmation'],
      parking:                 r['Parking']          || null,
      wifi:                    r['WiFi']             || null,
      gps:                     r['GPS']              || null,
      lat,
      lon,
      is_surprise:             false,
    };
  });
}

function mapTransport(rows) {
  return rows.map(r => ({
    id:             r['ID'],
    driver:         r['Conducteur(s)'],
    vehicle:        r['Véhicule'],
    agency:         r['Agence'],
    start_date:     parseDate(r['Date Début']),
    start_time:     r['Heure Début']          || null,
    end_date:       parseDate(r['Date Fin']),
    end_time:       r['Heure Fin']            || null,
    duration_days:  parseIntSafe(r['Durée (jours)']),
    price_brl:      parseNum(r['Prix BRL']),
    preauth_brl:    parseNum(r['Pré-autorisation BRL']),
    payment_status: r['Statut Paiement'],
    booking_ref:    r['Réf.'],
    agency_address: r['Adresse Agence']       || null,
    notes:          r['Notes']                || null,
  }));
}

function mapContacts(rows) {
  return rows.map(r => ({
    id:           r['ID'],
    organization: r['Organisme'],
    phone:        r['Téléphone']    || null,
    address_web:  r['Adresse / Web'] || null,
    notes:        r['Notes']        || null,
  }));
}

function mapTravellers(rows) {
  return rows.map(r => ({
    id:         r['ID'],
    name:       r['Nom'],
    role:       r['Rôle'],
    trip_start: parseDate(r['Date Début Voyage']),
    trip_end:   parseDate(r['Date Fin Voyage']),   // null for "après …"
    return_by:  r['Retour par']  || null,
  }));
}

function mapParameters(rows) {
  return rows.map(r => {
    const key = r.key === 'Taux CHF/BRL' ? 'chf_brl_rate' : r.key;
    const value = r.value.replace(',', '.');
    return { key, value };
  });
}

// ── Main loader (with in-memory cache) ──────────────────────
let _cache = null;

/**
 * Fetch and parse the CSV file.
 * Result is cached after the first successful load.
 * @returns {Promise<{flights, lodgings, transport, contacts, travellers, parameters}>}
 */
export async function loadCsvData() {
  if (_cache) return _cache;

  const res = await fetch('BD%20source%20voyage%20BR%202026.csv');
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);

  const text = await res.text();
  const sections = parseCsvSections(text);

  _cache = {
    flights:    mapFlights(    sections['VOLS']         || []),
    lodgings:   mapLodgings(   sections['HÉBERGEMENTS'] || []),
    transport:  mapTransport(  sections['TRANSPORT']    || []),
    contacts:   mapContacts(   sections['CONTACTS']     || []),
    travellers: mapTravellers( sections['VOYAGEURS']    || []),
    parameters: mapParameters( sections['PARAMÈTRES']   || []),
  };

  return _cache;
}
