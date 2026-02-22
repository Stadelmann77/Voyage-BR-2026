// assets/supabaseClient.js
// Initialises a Supabase client from window.SUPABASE_URL / window.SUPABASE_ANON
// set in assets/config.js (which is gitignored).
// When config.js is missing (no Supabase account), the app runs in offline mode
// using CSV data — the Supabase SDK is NOT loaded at all.

const PLACEHOLDER_URL  = 'https://YOUR_PROJECT_REF.supabase.co';
const PLACEHOLDER_ANON = 'YOUR_ANON_KEY_HERE';

/** True only when both config values are present and non-placeholder. */
export const configOk =
  !!window.SUPABASE_URL &&
  window.SUPABASE_URL  !== PLACEHOLDER_URL &&
  !!window.SUPABASE_ANON &&
  window.SUPABASE_ANON !== PLACEHOLDER_ANON;

let supabase = null;

if (configOk) {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON);
  } catch (err) {
    console.error('[supabaseClient] Failed to load Supabase SDK:', err);
  }
} else {
  console.warn(
    '[supabaseClient] Offline mode — SUPABASE_URL or SUPABASE_ANON not configured. ' +
    'Data will be loaded from CSV. To enable online mode, copy ' +
    'assets/config.example.js → assets/config.js and fill in your values.',
  );
}

export { supabase };

/** Base URL for Supabase Edge Functions */
export const FUNCTIONS_URL = configOk ? `${window.SUPABASE_URL}/functions/v1` : '';
