# Supabase Setup — Voyage Brésil 2026

## 1. Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **anon (public) key** from *Settings → API*.

---

## 2. Apply the schema

In the Supabase dashboard, open **SQL Editor** and run the contents of [`schema.sql`](./schema.sql).

This will:
- Create all tables (`airports`, `travellers`, `flights`, `lodgings`, `transport`, `contacts`, `parameters`, `participants_payments`, `checklist_items`).
- Insert the initial seed data from the CSV.
- Enable Row Level Security (RLS) with appropriate policies.
- Create the `toggle_checklist_item` security-definer RPC function.

---

## 3. Configure secrets in Supabase

Two secrets must be stored in Supabase **Vault** (never committed to the repo):

| Secret name        | Description                                    |
|--------------------|------------------------------------------------|
| `SURPRISE_PIN`     | PIN that unlocks the "surprise" section        |
| `CHECKLIST_PIN`    | PIN required to toggle checklist items         |

To add secrets via Supabase CLI:
```bash
supabase secrets set SURPRISE_PIN=your_secret_pin
supabase secrets set CHECKLIST_PIN=your_other_secret_pin
```

Or via the dashboard: **Settings → Edge Functions → Secrets**.

---

## 4. Deploy Edge Functions

### Prerequisites
```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

### Deploy both functions
```bash
supabase functions deploy verify-surprise-pin --no-verify-jwt
supabase functions deploy update-checklist --no-verify-jwt
```

`--no-verify-jwt` allows anonymous frontend calls (the functions verify PINs themselves).

### Function endpoints

After deployment the functions are available at:
```
https://<project-ref>.supabase.co/functions/v1/verify-surprise-pin
https://<project-ref>.supabase.co/functions/v1/update-checklist
```

Update `assets/config.js` (see section 5) with the correct `SUPABASE_URL` — the function base URL is derived automatically.

---

## 5. Configure the frontend

Copy `assets/config.example.js` to `assets/config.js` and fill in your values:

```js
// assets/config.js  — DO NOT COMMIT THIS FILE
window.SUPABASE_URL  = 'https://<project-ref>.supabase.co';
window.SUPABASE_ANON = 'your-anon-key-here';
```

`assets/config.js` is listed in `.gitignore` to prevent accidental commits.

---

## 6. Enable GitHub Pages

1. Push the repository to GitHub.
2. Go to *Settings → Pages*.
3. Set **Source** to `main` branch, root folder (`/`).
4. The site will be available at `https://<username>.github.io/Voyage-BR-2026/`.

---

## Edge Function: `verify-surprise-pin`

**POST** `/functions/v1/verify-surprise-pin`

Request body:
```json
{ "pin": "1234" }
```

Response on success (200):
```json
{ "ok": true }
```

Response on failure (401):
```json
{ "ok": false, "error": "Invalid PIN" }
```

The frontend stores a session flag when the PIN is correct; surprise items are then loaded via a separate Supabase RPC/query.

---

## Edge Function: `update-checklist`

**POST** `/functions/v1/update-checklist`

Request body:
```json
{
  "pin":     "5678",
  "id":      "uuid-of-checklist-item",
  "done":    true,
  "done_by": "Claudio"
}
```

Response on success (200):
```json
{ "ok": true }
```

Response on failure (401 / 400):
```json
{ "ok": false, "error": "..." }
```

---

## RLS summary

| Table                  | Public SELECT             | Authenticated write |
|------------------------|---------------------------|---------------------|
| airports               | ✅ all rows               | ✅                  |
| travellers             | ✅ all rows               | ✅                  |
| flights                | ✅ non-surprise rows only | ✅                  |
| lodgings               | ✅ non-surprise rows only | ✅                  |
| transport              | ✅ all rows               | ✅                  |
| contacts               | ✅ all rows               | ✅                  |
| parameters             | ✅ all rows               | ✅                  |
| participants_payments  | ✅ all rows               | ✅                  |
| checklist_items        | ✅ non-surprise rows only | ✅                  |

Surprise rows are only accessible when the `app.surprise_unlocked` session variable is set to `'true'` by the `verify-surprise-pin` edge function (via a Supabase service-role call that sets the session variable before returning data).

> **Note:** The simplest production approach is to have the edge function return the surprise data directly (using the service_role key server-side) rather than relying on `current_setting`. The RLS policy shown is a reference implementation.
