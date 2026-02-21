# 🇧🇷 Voyage Brésil 2026

Site web interactif hébergé sur GitHub Pages pour organiser le voyage familial au Brésil 2026.

## 🌐 Voir le site

[https://stadelmann77.github.io/Voyage-BR-2026/](https://stadelmann77.github.io/Voyage-BR-2026/)

---

## 📋 Pages disponibles

| Page | Description |
|------|-------------|
| `index.html` | Tableau de bord — résumé, voyageurs, alertes, itinéraire |
| `flights.html` | Liste des vols avec globe 3D interactif |
| `lodgings.html` | Hébergements avec détails et liens GPS |
| `transport.html` | Location voiture Localiza |
| `payments.html` | Résumé paiements par personne |
| `contacts.html` | Contacts: compagnies, hôtels, urgences |
| `checklist.html` | Checklist collaborative (PIN protégé) |
| `admin.html` | Administration (authentification Supabase) |

---

## ⚙️ Configuration

### 1. Créer votre projet Supabase

1. Allez sur [https://supabase.com](https://supabase.com) et créez un projet.
2. Notez votre **Project URL** et **anon (public) key** dans *Settings → API*.

### 2. Appliquer le schéma SQL

Dans le **SQL Editor** de Supabase, exécutez le contenu de [`supabase/schema.sql`](supabase/schema.sql).

### 3. Configurer les secrets

Ajoutez ces secrets dans Supabase (**Settings → Edge Functions → Secrets**):
- `SURPRISE_PIN` — PIN pour déverrouiller la section surprise
- `CHECKLIST_PIN` — PIN pour cocher les items de la checklist

Ces PINs ne sont **jamais** stockés dans le repo.

### 4. Déployer les Edge Functions

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase functions deploy verify-surprise-pin --no-verify-jwt
supabase functions deploy update-checklist --no-verify-jwt
```

### 5. Configurer le frontend

```bash
cp assets/config.example.js assets/config.js
```

Éditez `assets/config.js`:
```js
window.SUPABASE_URL  = 'https://YOUR_PROJECT_REF.supabase.co';
window.SUPABASE_ANON = 'YOUR_ANON_KEY_HERE';
```

> ⚠️ `assets/config.js` est dans `.gitignore` — ne le commitez jamais!

### 6. Activer GitHub Pages

1. Allez dans *Settings → Pages* de votre repo.
2. Source: branche `main`, dossier racine `/`.
3. Le site sera disponible sur `https://stadelmann77.github.io/Voyage-BR-2026/`.

---

## 🔐 Sécurité

- **Clé anon Supabase** uniquement dans le frontend (publique par design, protégée par RLS).
- **PINs** jamais stockés dans le repo — vérifiés côté serveur via les Edge Functions.
- **Admin** protégé par Supabase Auth (email + mot de passe).
- **Données surprises** cachées par défaut via RLS et révélées uniquement après vérification PIN serveur.

---

## 📁 Structure du projet

```
Voyage-BR-2026/
├── index.html          # Dashboard
├── flights.html        # Vols + globe 3D
├── lodgings.html       # Hébergements
├── transport.html      # Transport
├── payments.html       # Paiements par personne
├── contacts.html       # Contacts
├── checklist.html      # Checklist collaborative
├── admin.html          # Administration
├── assets/
│   ├── config.example.js    # Template de config (copier → config.js)
│   ├── config.js            # ⚠️ Gitignored — vos clés Supabase
│   ├── supabaseClient.js    # Client Supabase + URL fonctions
│   ├── styles.css           # Styles globaux
│   ├── public.js            # Helpers partagés (fetch, render)
│   ├── flights.js           # Globe 3D + surprise PIN
│   ├── checklist.js         # Checklist PIN-protégée
│   └── admin.js             # Admin CRUD
├── supabase/
│   ├── schema.sql           # Schéma DB + seed data + RLS
│   ├── README.md            # Guide Supabase complet
│   └── functions/
│       ├── verify-surprise-pin/index.ts
│       └── update-checklist/index.ts
└── README.md
```

---

## 📊 Données source

Les données initiales sont importées depuis `BD source voyage BR 2026.csv` via le seed SQL dans `supabase/schema.sql`.

---

## 🛠️ Technologies

- **Frontend**: HTML5, CSS3, JavaScript ES modules (pas de build, compatible GitHub Pages)
- **Globe 3D**: [globe.gl](https://globe.gl/) + Three.js
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL + RLS + Edge Functions + Auth)
