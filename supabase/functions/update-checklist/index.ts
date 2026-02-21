// Supabase Edge Function: update-checklist
// Deploy with: supabase functions deploy update-checklist --no-verify-jwt
//
// Required secret: CHECKLIST_PIN (set via `supabase secrets set CHECKLIST_PIN=xxx`)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pin, id, done, done_by } = await req.json();

    // Validate inputs
    if (!pin || !id || typeof done !== 'boolean' || !done_by?.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: 'pin, id, done (boolean), and done_by are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verify PIN
    const correctPin = Deno.env.get('CHECKLIST_PIN');
    if (!correctPin) {
      console.error('CHECKLIST_PIN secret not configured');
      return new Response(
        JSON.stringify({ ok: false, error: 'Server misconfiguration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (pin !== correctPin) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid PIN' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // PIN verified — update checklist using service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { error } = await supabase.rpc('toggle_checklist_item', {
      p_id: id,
      p_done: done,
      p_done_by: done_by.trim(),
    });

    if (error) {
      console.error(error);
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to update checklist item' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
