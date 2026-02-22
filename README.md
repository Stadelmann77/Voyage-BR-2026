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
| `lodgings.html` | Hébergements avec détails et liens GPS / Google Maps |
| `transport.html` | Location voiture Localiza |
| `payments.html` | Résumé paiements — répartition pondérée par personne |
| `contacts.html` | Contacts: compagnies, hôtels, urgences (avec liens Google Maps) |
| `checklist.html` | Checklist collaborative (PIN protégé) |
| `admin.html` | Administration (authentification GitHub OAuth via Cloudflare Worker) |

---

## 🗄️ Architecture données Git-based

Toutes les données sont stockées dans des fichiers JSON versionnés sous `data/` :

| Fichier | Description |
|---------|-------------|
| `data/flights.json`     | Vols (passagers, routes, prix, statut, sièges, bagages) |
| `data/lodgings.json`    | Hébergements (dates, prix, statut, GPS) |
| `data/transport.json`   | Location voiture (dates, prix, statut) |
| `data/contacts.json`    | Contacts avec coordonnées GPS / Google Maps |
| `data/travellers.json`  | Liste des voyageurs |
| `data/people.json`      | Voyageurs avec **poids de pondération** pour la répartition des dépenses |
| `data/expenses.json`    | Dépenses détaillées avec bénéficiaires et catégories |
| `data/checklist.json`   | Checklist collaborative |
| `data/parameters.json`  | Paramètres (taux de change de secours, PIN surprise) |

### Modèle de pondération (payments)

Chaque voyageur a un **poids** défini dans `data/people.json` :

| Personne  | Poids |
|-----------|-------|
| Claudio   | 1.0   |
| Claudeane | 1.0   |
| Lucileide | 1.0   |
| Jhemerson | 0.5   |

La quote-part de chaque bénéficiaire pour une dépense = `(poids_personne / somme_poids_bénéficiaires) × montant`.

### Taux de change CHF/BRL

Le taux est récupéré **en temps réel** depuis une API publique lors du chargement de la page Paiements :
1. Essai : `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/chf.json`
2. Fallback : `https://api.exchangerate-api.com/v4/latest/CHF`
3. Fallback ultime : valeur stockée dans `data/parameters.json` (`chf_brl_rate`)

---

## 🔐 Admin — Authentification GitHub OAuth

L'administration est protégée via **GitHub OAuth** et un **Cloudflare Worker**.

Le site fonctionne entièrement **en mode lecture** sans Worker. Les contrôles d'édition n'apparaissent qu'après authentification.

### Déployer le Worker

#### Prérequis

- [Compte Cloudflare](https://dash.cloudflare.com/) (plan gratuit suffisant)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) : `npm install -g wrangler`
- Une **GitHub OAuth App** (voir ci-dessous)

#### 1. Créer une GitHub OAuth App

1. Allez dans *GitHub → Settings → Developer settings → OAuth Apps → New OAuth App*
2. Remplissez :
   - **Application name** : `Voyage BR 2026 Admin`
   - **Homepage URL** : `https://stadelmann77.github.io/Voyage-BR-2026`
   - **Authorization callback URL** : `https://voyage-br-2026-admin.YOUR_SUBDOMAIN.workers.dev/auth/callback`
3. Notez le **Client ID** et générez un **Client Secret**

#### 2. Déployer le Worker

```bash
cd cloudflare-worker
wrangler login
wrangler deploy
```

#### 3. Configurer les secrets

```bash
wrangler secret put GITHUB_CLIENT_ID      # Client ID de l'OAuth App
wrangler secret put GITHUB_CLIENT_SECRET  # Client Secret
wrangler secret put JWT_SECRET            # Chaîne aléatoire ≥ 32 caractères (ex: openssl rand -base64 32)
```

#### 4. Mettre à jour le callback URL GitHub

Après le déploiement, mettez à jour l'OAuth App GitHub avec l'URL réelle du Worker :
`https://<worker-name>.<subdomain>.workers.dev/auth/callback`

#### 5. Utiliser l'admin

1. Allez sur `admin.html`
2. Collez l'URL du Worker dans le champ dédié
3. Cliquez **Se connecter avec GitHub**
4. Approuvez l'autorisation GitHub → vous serez redirigé vers l'admin

---

## 📍 Google Maps

Les pages **Hébergements** et **Contacts** affichent automatiquement un lien **📍 Maps** pour les entrées disposant de coordonnées GPS (`lat`/`lon`).

Pour ajouter un lien Maps à un contact, ajoutez `lat` et `lon` dans `data/contacts.json` :
```json
{ "id": "C5", "organization": "...", "lat": -23.56155, "lon": -46.63295, ... }
```

---

## 📁 Structure du projet

```
Voyage-BR-2026/
├── index.html
├── flights.html
├── lodgings.html
├── transport.html
├── payments.html          # Répartition pondérée + taux CHF/BRL temps réel
├── contacts.html          # Liens Google Maps intégrés
├── checklist.html
├── admin.html             # Admin GitHub OAuth
├── data/
│   ├── flights.json
│   ├── lodgings.json
│   ├── transport.json
│   ├── contacts.json      # lat/lon ajoutés pour les hôtels
│   ├── travellers.json
│   ├── people.json        # Poids de pondération par personne (NEW)
│   ├── expenses.json      # Dépenses avec bénéficiaires (NEW)
│   ├── checklist.json
│   └── parameters.json
├── assets/
│   ├── styles.css
│   ├── public.js          # Helpers partagés (fetchExpenses, fetchPeople...)
│   ├── admin.js           # Admin GitHub OAuth + CRUD Git-based
│   ├── i18n.js
│   ├── i18n/
│   │   ├── fr.js
│   │   └── pt-BR.js
│   ├── flights.js
│   └── checklist.js
├── cloudflare-worker/     # NEW — Backend admin
│   ├── index.js           # Cloudflare Worker (GitHub OAuth + Git commits)
│   └── wrangler.toml      # Config Worker
└── README.md
```

---

## 🌐 Changement de langue

Le site supporte **Français (FR)** et **Português-BR (PT)**.

- Cliquez sur **FR** / **PT** dans la barre de navigation.
- Le choix est persisté dans `localStorage`.
- La langue par défaut est le **Français**.

---

## 🔧 Développement local

```bash
# Servir le site localement (ES modules require HTTP server)
npx serve .
# ou
python -m http.server 8080
```

Puis ouvrez `http://localhost:8080`.

---

## 🔐 Sécurité

- **Aucun secret** dans le repo.
- **Admin** restreint à l'utilisateur GitHub `Stadelmann77` (vérifié côté Worker).
- **JWT** signé HS256, valide 8 heures, stocké en `sessionStorage` (jamais en cookie ou localStorage permanent).
- **Commits Git** créés via l'API GitHub avec le token OAuth de l'utilisateur — traçabilité complète.
- Le site fonctionne entièrement **en lecture seule** sans Worker.
