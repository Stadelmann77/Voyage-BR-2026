// assets/supabaseClient.js
// Initialises a Supabase client from window.SUPABASE_URL / window.SUPABASE_ANON
// set in assets/config.js (which is gitignored).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLACEHOLDER_URL  = 'https://YOUR_PROJECT_REF.supabase.co';
const PLACEHOLDER_ANON = 'YOUR_ANON_KEY_HERE';

/** True only when both config values are present and non-placeholder. */
export const configOk =
  !!window.SUPABASE_URL &&
  window.SUPABASE_URL  !== PLACEHOLDER_URL &&
  !!window.SUPABASE_ANON &&
  window.SUPABASE_ANON !== PLACEHOLDER_ANON;

if (!configOk) {
  console.error(
    '[supabaseClient] SUPABASE_URL or SUPABASE_ANON not defined or still placeholder. ' +
    'Copy assets/config.example.js → assets/config.js and fill in your values.',
  );
}

export const supabase = createClient(
  window.SUPABASE_URL  || '',
  window.SUPABASE_ANON || '',
);

/** Base URL for Supabase Edge Functions */
export const FUNCTIONS_URL = `${window.SUPABASE_URL}/functions/v1`;
