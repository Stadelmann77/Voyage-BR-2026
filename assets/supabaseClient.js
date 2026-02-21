// assets/supabaseClient.js
// Initialises a Supabase client from window.SUPABASE_URL / window.SUPABASE_ANON
// set in assets/config.js (which is gitignored).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

if (!window.SUPABASE_URL || !window.SUPABASE_ANON) {
  console.error(
    '[supabaseClient] SUPABASE_URL or SUPABASE_ANON not defined. ' +
    'Copy assets/config.example.js → assets/config.js and fill in your values.',
  );
}

export const supabase = createClient(
  window.SUPABASE_URL  || '',
  window.SUPABASE_ANON || '',
);

/** Base URL for Supabase Edge Functions */
export const FUNCTIONS_URL = `${window.SUPABASE_URL}/functions/v1`;
