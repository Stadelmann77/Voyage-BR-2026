-- ============================================================
-- Voyage Brésil 2026 — Supabase Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- AIRPORTS (for 3D globe route rendering)
-- ============================================================
create table if not exists airports (
  iata      text primary key,
  city      text not null,
  country   text not null,
  lat       numeric(9,6) not null,
  lon       numeric(9,6) not null
);

-- Seed airport data used in this trip
insert into airports (iata, city, country, lat, lon) values
  ('GVA', 'Genève',            'CH',  46.238102,   6.108929),
  ('ZRH', 'Zürich',            'CH',  47.458200,   8.555500),
  ('GRU', 'São Paulo',         'BR', -23.435600, -46.473100),
  ('VCP', 'Campinas',          'BR', -23.007400, -47.134500),
  ('BEL', 'Belém',             'BR',  -1.379200, -48.476000),
  ('MAB', 'Marabá',            'BR',  -5.369200, -49.138100),
  ('FOR', 'Fortaleza',         'BR',  -3.776200, -38.532600),
  ('LIS', 'Lisboa',            'PT',  38.781300,  -9.135900),
  ('OUR', 'Ourilândia do Norte','BR',  -6.763400, -51.049900)
on conflict (iata) do nothing;

-- ============================================================
-- TRAVELLERS
-- ============================================================
create table if not exists travellers (
  id            text primary key,  -- P1, P2, ...
  name          text not null,
  role          text,
  trip_start    date,
  trip_end      date,
  return_by     text
);

insert into travellers (id, name, role, trip_start, trip_end, return_by) values
  ('P1', 'Claudeane', 'Épouse (brésilienne)', '2026-04-27', '2026-06-06', '✈️ Avion'),
  ('P2', 'Claudio',   'Voyageur principal',   '2026-05-23', '2026-06-06', '✈️ Avion'),
  ('P3', 'Lucileide', 'Sœur de Claudeane',    '2026-05-25', null,         '🚌 Bus'),
  ('P4', 'Jhemerson', 'Neveu',                '2026-05-25', null,         '🚌 Bus')
on conflict (id) do nothing;

-- ============================================================
-- FLIGHTS
-- ============================================================
create table if not exists flights (
  id               text primary key,  -- V1, V2, ...
  passengers       text not null,
  route            text not null,
  origin_iata      text references airports(iata),
  destination_iata text references airports(iata),
  dep_date         date,
  dep_time         time,
  arr_date         date,
  arr_time         time,
  company          text,
  flight_numbers   text,
  class            text,
  booking_ref      text,
  cabin_baggage    text,
  hold_baggage     text,
  seats            text,
  price_chf        numeric(10,2),
  price_brl        numeric(10,2),
  payment_status   text,
  pax_count        integer default 1,
  notes            text,
  is_surprise      boolean not null default false
);

insert into flights (id, passengers, route, origin_iata, destination_iata, dep_date, dep_time, arr_date, arr_time, company, flight_numbers, class, booking_ref, cabin_baggage, hold_baggage, seats, price_chf, price_brl, payment_status, pax_count, notes, is_surprise) values
  ('V1','Claudeane','GVA → ZRH → GRU','GVA','GRU','2026-04-27','20:05','2026-04-28','05:25','SWISS','LX2819 + LX92','Economy Light (K)','YS3VET','1 main (8kg, 118lcm)','⚠️ 0 SOUTE','Non sélectionnés',290.15,null,'✅ Payé - MC ****4753',1,'Terminal 1 GVA',false),
  ('V2','Claudeane','VCP → BEL → Ourilândia do Norte','VCP','OUR','2026-05-07','21:45','2026-05-08','09:45','Azul (via Trip.com)','AD2954 + AD5108','Economy','TNG1NT / AKE4YZ','1 pers + 1 cabine (10kg)','✅ 1 soute (23kg)','Non sélectionnés',311.80,null,'⚠️ En Espera (Trip.com)',1,'Escale Belém',true),
  ('V3','Claudio','GVA → Lisbonne → FOR','GVA','FOR','2026-05-23','13:00','2026-05-23','21:20','TAP Portugal','TP941 + TP35','Économique','XR2CPW','1 petit + 1 cabine (10kg)','⚠️ 0 SOUTE','Non sélectionnés',845.81,null,'✅ Payé - Booking.com (A/R)',1,'Billet A/R',false),
  ('V4','Claudio','FOR → Lisbonne → GVA (retour)','FOR','GVA','2026-06-05','22:50','2026-06-06','17:30','TAP Portugal','TP36 + TP942','Économique','XR2CPW','1 petit + 1 cabine (10kg)','⚠️ 0 SOUTE','10A (TP36) / 7E (TP942)',0,null,'✅ Inclus A/R (845.81 CHF)',1,'Retour inclus dans V3',false),
  ('V5','Claudeane','FOR → Lisbonne → GVA (retour)','FOR','GVA','2026-06-05','22:50','2026-06-06','17:30','TAP Portugal','TP36 + TP942','Économique','XR85TH','1 petit + 1 cabine (10kg)','✅ 1 soute (23kg)','10C (TP36) / 7F (TP942)',552.15,null,'✅ Payé - Booking.com',1,null,false),
  ('V6','Claudeane + Lucileide + Jhemerson','MAB → BEL','MAB','BEL','2026-05-25','14:50','2026-05-25','15:55','Azul','AD 4210','—','MJ5NQC','0 (non sélectionné)','0 (non sélectionné)','11D / 11E / 11F',null,1300.17,'⚠️ EN ESPERA - 3 pax',3,'Remplace LI2NWF',false),
  ('V7','Claudeane + Lucileide + Jhemerson','BEL → FOR','BEL','FOR','2026-05-25','18:00','2026-05-25','19:55','Azul','AD 4101','—','ON3LQT','0 (non sélectionné)','0 (non sélectionné)','11A / 11B / 11C',null,799.14,'⚠️ EN ESPERA - 3 pax',3,'Remplace ZLT7RZ',false)
on conflict (id) do nothing;

-- ============================================================
-- LODGINGS
-- ============================================================
create table if not exists lodgings (
  id                     text primary key,  -- H1, H2, ...
  travellers_desc        text not null,
  establishment          text not null,
  city                   text not null,
  checkin_date           date,
  checkin_time           time,
  checkout_date          date,
  checkout_time          time,
  nights                 integer,
  room_type              text,
  breakfast              text,
  price_chf              numeric(10,2),
  price_brl              numeric(10,2),
  prepayment             text,
  free_cancellation_until date,
  booking_ref            text,
  parking                text,
  wifi                   text,
  gps                    text,
  lat                    numeric(9,6),
  lon                    numeric(9,6),
  is_surprise            boolean not null default false
);

insert into lodgings (id, travellers_desc, establishment, city, checkin_date, checkin_time, checkout_date, checkout_time, nights, room_type, breakfast, price_chf, price_brl, prepayment, free_cancellation_until, booking_ref, parking, wifi, gps, lat, lon, is_surprise) values
  ('H1','Claudeane (+ fille)','Free Palace Hotel','São Paulo','2026-04-27','13:00','2026-04-30','12:00',3,'Lits Jumeaux Standard','✅ OUI',103,691.65,'❌ NON requis','2026-04-24','5474140188','R$ 35/jour','Gratuit','S 023° 33.693, W 46° 37.977',-23.561550,-46.633283,false),
  ('H2','Claudio (seul)','Maly Boutique Hotel','Fortaleza (Praia do Futuro)','2026-05-23','14:00','2026-05-25','12:00',2,'Suite avec Balcon (vue jardin/piscine)','✅ OUI',116,779.62,'✅ OUI - Prépaiement total','2026-05-17','5987193612','Pas de parking','Gratuit','S 003° 43.880, W 38° 27.466',-3.731333,-38.457767,false),
  ('H3','Claudio + Claudeane + Lucileide + Jhemerson','Hotel Encontro do Sol','Fortaleza (Meireles)','2026-05-25','13:30','2026-05-27','12:00',2,'Quadruple Classique','✅ OUI',125,840,'❌ NON PAYÉ — 50% à payer avant le 09/04/2026','2026-04-24','5331265550','Pas de parking','Gratuit','S 003° 43.418, W 38° 30.401',-3.723633,-38.506683,false),
  ('H4','Claudio + Claudeane + Lucileide + Jhemerson','ASAS DEL MAR - SUITES','Canoa Quebrada','2026-05-27','14:00','2026-05-30','12:00',3,'Quadruple - Vue sur Mer','Non mentionné',294,1968,'❌ NON PAYÉ — vérifier, 50% avant 04/05','2026-05-19','6862089551','Gratuit (public)','Gratuit','S 004° 31.671, W 37° 41.874',-4.527850,-37.697900,false),
  ('H5','Claudio + Claudeane + Lucileide + Jhemerson','Pousada Bangalô','Jericoacoara','2026-06-01','12:00','2026-06-03','12:00',2,'2× Double/Twin Standard','✅ OUI',129,861.12,'❌ NON PAYÉ — 50% à payer avant le 11/05/2026','2026-05-26','5620.348.709','Public (supplément possible)','Gratuit','S 002° 47.867, W 40° 30.843',-2.797783,-40.514050,false)
on conflict (id) do nothing;

-- ============================================================
-- TRANSPORT
-- ============================================================
create table if not exists transport (
  id               text primary key,  -- T1, ...
  driver           text,
  vehicle          text,
  agency           text,
  start_date       date,
  start_time       time,
  end_date         date,
  end_time         time,
  duration_days    integer,
  price_brl        numeric(10,2),
  preauth_brl      numeric(10,2),
  payment_status   text,
  booking_ref      text,
  agency_address   text,
  notes            text
);

insert into transport (id, driver, vehicle, agency, start_date, start_time, end_date, end_time, duration_days, price_brl, preauth_brl, payment_status, booking_ref, agency_address, notes) values
  ('T1','Claudio + conducteur additionnel','SUV AUTOMATIQUE','Localiza','2026-05-23','22:00','2026-06-05','18:00',13,3132.30,2500,'⚠️ À PAYER à la prise','MO49499YVQBC','AV SENADOR CARLOS JEREISSATI 21, SERRINHA, FORTALEZA, CE','Annulation gratuite >48h. 24h/24.')
on conflict (id) do nothing;

-- ============================================================
-- CONTACTS
-- ============================================================
create table if not exists contacts (
  id           text primary key,  -- C1, C2, ...
  organization text not null,
  phone        text,
  address_web  text,
  notes        text
);

insert into contacts (id, organization, phone, address_web, notes) values
  ('C1','SWISS Service Center','+41 (0) 848 700 700','swiss.com/webcheckin','Réf YS3VET'),
  ('C2','TAP Portugal','—','flytap.com','Réf XR2CPW / XR85TH'),
  ('C3','Azul Linhas Aéreas','4003-1118 / 0800 887 1118','voeazul.com.br','Réf MJ5NQC + ON3LQT + TNG1NT'),
  ('C4','Booking.com (assist. FR)','0445 111 635','your.booking.com','+33 1 57 32 92 09'),
  ('C5','Free Palace Hotel','+55 11 3271 8596','RUA TAMANDARE 246, Liberdade, SP','GPS: S023°33.693 W46°37.977'),
  ('C6','Maly Boutique Hotel','+55 85 99111 0568','Av Clóvis Arrais Maia 2790, Fortaleza','GPS: S003°43.880 W38°27.466'),
  ('C7','Hotel Encontro do Sol','+55 85 3031 6222','Rua Monsenhor Bruno 122, Meireles','GPS: S003°43.418 W38°30.401'),
  ('C8','ASAS DEL MAR','+55 85 99856 8461','DT SITIO ESTEVAO, Canoa Quebrada','GPS: S004°31.671 W37°41.874'),
  ('C9','Localiza Rent a Car','App Localiza (FAST)','Aéroport Fortaleza','Réf MO49499YVQBC'),
  ('C10','Police (Polícia Militar)','190',null,null),
  ('C11','SAMU (ambulance)','192',null,null),
  ('C12','Pompiers (Bombeiros)','193',null,null),
  ('C13','Ambassade Suisse','+55 61 3443 5500','Brasília',null),
  ('C14','Claudio (personnel)','+41762470577',null,null),
  ('C15','Pousada Bangalô (Jericoacoara)','+55 88 99904 5258','Rua Novo Jeri, S/N, Jericoacoara, CEP 62598-000','GPS: S002°47.867 W40°30.843. Réf 5620.348.709')
on conflict (id) do nothing;

-- ============================================================
-- PARAMETERS
-- ============================================================
create table if not exists parameters (
  key   text primary key,
  value text
);

insert into parameters (key, value) values
  ('chf_brl_rate', '6.7')
on conflict (key) do nothing;

-- ============================================================
-- PARTICIPANTS PAYMENTS
-- ============================================================
create table if not exists participants_payments (
  id             uuid primary key default uuid_generate_v4(),
  traveller_id   text references travellers(id),
  category       text not null,
  detail         text not null,
  price_chf      numeric(10,2),
  price_brl      numeric(10,2),
  paid           text,
  notes          text
);

insert into participants_payments (traveller_id, category, detail, price_chf, price_brl, paid, notes) values
  ('P2','Vol','GVA→FOR A/R (TAP)',845.81,null,'✅ OUI','Booking.com, réf XR2CPW'),
  ('P2','Hôtel','Maly Boutique, 2 nuits',116,779.62,'✅ Prépayé','1 pers, suite balcon'),
  ('P2','Hôtel','Encontro do Sol, 2 nuits (1/4)',31.25,210,'⚠️ 50%','4 pers, part 1/4'),
  ('P2','Hôtel','ASAS DEL MAR, 3 nuits (1/4)',73.50,492,'❌ Non payé','4 pers, part 1/4'),
  ('P2','Voiture','Localiza SUV 13 jours',null,3132.30,'❌ Non payé','Pré-auth R$2500 à la prise'),
  ('P2','Hôtel','Pousada Bangalô, 2 nuits (1/4)',32.25,215.28,'❌ Non payé','4 pers, part 1/4'),
  ('P1','Vol','GVA→GRU (SWISS aller)',290.15,null,'✅ OUI','MC ****4753, réf YS3VET'),
  ('P1','Vol','FOR→GVA (TAP retour)',552.15,null,'✅ OUI','Booking.com, réf XR85TH'),
  ('P1','Vol','MAB→BEL→FOR (Azul, 1/3)',null,699.77,'⚠️ En espera','R$(1300.17+799.14)/3. MJ5NQC+ON3LQT'),
  ('P1','Vol','VCP→BEL→Ourilândia (Azul/Trip)',311.80,null,'⚠️ En espera','Réf TNG1NT/AKE4YZ'),
  ('P1','Hôtel','Free Palace São Paulo (1/2)',51.50,345.825,'❌ Non payé','2 pers, part 1/2'),
  ('P1','Hôtel','Encontro do Sol (1/4)',31.25,210,'❌ Non payé','4 pers, part 1/4'),
  ('P1','Hôtel','ASAS DEL MAR (1/4)',73.50,492,'❌ Non payé','4 pers, part 1/4'),
  ('P1','Hôtel','Pousada Bangalô, 2 nuits (1/4)',32.25,215.28,'❌ Non payé','4 pers, part 1/4');

-- ============================================================
-- CHECKLIST ITEMS
-- ============================================================
create table if not exists checklist_items (
  id          uuid primary key default uuid_generate_v4(),
  category    text not null,
  traveller   text,
  action      text not null,
  details     text,
  deadline    text,
  done        boolean not null default false,
  done_by     text,
  done_at     timestamptz,
  is_surprise boolean not null default false
);

insert into checklist_items (category, traveller, action, details, deadline, is_surprise) values
  ('DOCUMENTS','Claudio','Passeport valide','Validité > 6 mois après retour','Avant départ',false),
  ('DOCUMENTS','Claudeane','Passeport + titre de séjour CH','Vérifier titre de séjour CH valide','Avant départ',false),
  ('DOCUMENTS','Tous','Copies documents (numérique)','Photos passeports, billets dans cloud','Avant départ',false),
  ('VOLS','Claudeane','Check-in SWISS LX2819+LX92','Réf YS3VET - GVA T1','24h avant 27/04',false),
  ('VOLS','Claudeane','⚠️ Acheter bagage soute SWISS!','Economy Light = 0 soute!','DÈS QUE POSSIBLE',false),
  ('VOLS','Claudio','Check-in TAP TP941+TP35','Réf XR2CPW','24h avant 23/05',false),
  ('VOLS','Claudio','⚠️ Vérifier bagage soute TAP','Confirmation dit 0 soute','DÈS QUE POSSIBLE',false),
  ('VOLS','Claud./Lucil./Jhem.','⚠️ Confirmer vols Azul (EN ESPERA)','MJ5NQC+ON3LQT. Bagages = 0!',null,false),
  ('HÉBERGEMENTS','Claudio','⚠️ Payer 50% Encontro do Sol','Deadline 09/04. Tél +55 85 3031 6222','Avant 09/04 ⚠️',false),
  ('HÉBERGEMENTS','Claudio','⚠️ Vérifier ASAS DEL MAR','Si 50%: payer avant 04/05','Avant 04/05',false),
  ('HÉBERGEMENTS','Claudio','⚠️ Payer 50% Pousada Bangalô','Deadline 11/05. Réf 5620.348.709','Avant 11/05',false),
  ('HÉBERGEMENTS','Tous','⚠️ RÉSERVER 2 NUITS (03-05/06)!','TROU: 2 nuits avant vol retour!','URGENT!',false),
  ('TRANSPORT','Claud./Lucil./Jhem.','⚠️ Transport Ourilândia → Marabá','Accès aéroport MAB 25/05','Avant 25/05',true),
  ('TRANSPORT','Claudio','Télécharger app Localiza (FAST)','Retirada Digital sans comptoir','Avant 23/05',false);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table airports enable row level security;
alter table travellers enable row level security;
alter table flights enable row level security;
alter table lodgings enable row level security;
alter table transport enable row level security;
alter table contacts enable row level security;
alter table parameters enable row level security;
alter table participants_payments enable row level security;
alter table checklist_items enable row level security;

-- Public read of non-surprise data (airports, travellers, contacts, parameters always public)
create policy "airports_public_read" on airports for select using (true);
create policy "travellers_public_read" on travellers for select using (true);
create policy "contacts_public_read" on contacts for select using (true);
create policy "parameters_public_read" on parameters for select using (true);
create policy "transport_public_read" on transport for select using (true);
create policy "payments_public_read" on participants_payments for select using (true);

-- Flights: public reads non-surprise rows; surprise rows need session var set by edge function
create policy "flights_public_read" on flights for select
  using (is_surprise = false or current_setting('app.surprise_unlocked', true) = 'true');

-- Lodgings: same pattern
create policy "lodgings_public_read" on lodgings for select
  using (is_surprise = false or current_setting('app.surprise_unlocked', true) = 'true');

-- Checklist: same pattern
create policy "checklist_public_read" on checklist_items for select
  using (is_surprise = false or current_setting('app.surprise_unlocked', true) = 'true');

-- Writes restricted to authenticated admin users only (except checklist done flag via RPC)
create policy "flights_admin_write" on flights for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "lodgings_admin_write" on lodgings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "transport_admin_write" on transport for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "contacts_admin_write" on contacts for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "travellers_admin_write" on travellers for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "payments_admin_write" on participants_payments for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "checklist_admin_write" on checklist_items for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- RPC: toggle checklist item (called by update-checklist edge function with service_role)
-- ============================================================
create or replace function toggle_checklist_item(
  p_id     uuid,
  p_done   boolean,
  p_done_by text
)
returns void
language plpgsql
security definer
as $$
begin
  update checklist_items
  set done = p_done,
      done_by = case when p_done then p_done_by else null end,
      done_at  = case when p_done then now() else null end
  where id = p_id;
end;
$$;
