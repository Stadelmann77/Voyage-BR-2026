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

## 📴 Mode hors-ligne (CSV)

Si `assets/config.js` est absent ou contient les valeurs placeholder, le site fonctionne **automatiquement en mode hors-ligne** : les données sont chargées depuis le fichier `BD source voyage BR 2026.csv` inclus dans le repo.

### Ce qui fonctionne en mode hors-ligne

| Page | Comportement |
|------|-------------|
| `index.html` | Affiche voyageurs + alertes + itinéraire depuis CSV |
| `flights.html` | Liste des vols + globe 3D (coordonnées d'aéroports intégrées) |
| `lodgings.html` | Tous les hébergements depuis CSV |
| `transport.html` | Location voiture depuis CSV |
| `contacts.html` | Tous les contacts depuis CSV |
| `checklist.html` | Checklist avec état persisté dans `localStorage` (par appareil) |
| `payments.html` | Message explicatif — totaux par personne nécessitent Supabase |

Un bandeau **📴 Mode hors-ligne (CSV) — Supabase non configuré** s'affiche en haut de chaque page.

### Activer Supabase plus tard

Suivez les étapes de la section **⚙️ Configuration** ci-dessous pour activer la synchronisation temps réel, la checklist partagée et les paiements par personne.

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

## 🌐 Changement de langue

Le site supporte **Français (FR)** et **Português-BR (PT)**.

- Cliquez sur les boutons **FR** / **PT** dans la barre de navigation pour changer la langue.
- Le choix est persisté dans `localStorage` et s'applique à toutes les pages.
- La langue par défaut est le **Français**.

---

## 🔧 Dépannage

### Spinners infinis / données non chargées

Si les pages affichent des spinners infinis ou un bandeau d'erreur de configuration:

1. **`assets/config.js` manquant** — Copiez `assets/config.example.js` → `assets/config.js` et remplissez vos clés Supabase.
2. **Clés placeholder** — Vérifiez que `SUPABASE_URL` et `SUPABASE_ANON` ne contiennent plus les valeurs d'exemple.
3. **Fichier servi localement** — Ouvrez directement `index.html` ne fonctionne pas (modules ES). Utilisez `npx serve .` ou `python -m http.server`.
4. **Erreurs RLS** — Vérifiez que les politiques RLS dans Supabase autorisent la lecture publique (anon) pour les tables utilisées.

### Mode débogage

Ajoutez `?debug=1` à n'importe quelle URL pour afficher des détails d'erreur supplémentaires (stack trace, payload de réponse) dans une section dépliable sous les messages d'erreur.

Exemple: `https://stadelmann77.github.io/Voyage-BR-2026/flights.html?debug=1`

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
│   ├── csvData.js           # Parser CSV + données hors-ligne (aéroports, checklist)
│   ├── styles.css           # Styles globaux
│   ├── public.js            # Helpers partagés (fetch, render, erreurs) — routing online/offline
│   ├── i18n.js              # Module i18n — t(), setLang(), toggle
│   ├── i18n/
│   │   ├── fr.js            # Traductions françaises
│   │   └── pt-BR.js         # Traductions portugaises (BR)
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

Ce même fichier CSV sert de source de données en **mode hors-ligne** : `assets/csvData.js` le parse automatiquement lorsque Supabase n'est pas configuré.

---

## 🛠️ Technologies

- **Frontend**: HTML5, CSS3, JavaScript ES modules (pas de build, compatible GitHub Pages)
- **Globe 3D**: [globe.gl](https://globe.gl/) + Three.js
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL + RLS + Edge Functions + Auth)
