// Supabase Edge Function: verify-surprise-pin
// Deploy with: supabase functions deploy verify-surprise-pin --no-verify-jwt
//
// Required secret: SURPRISE_PIN (set via `supabase secrets set SURPRISE_PIN=xxx`)

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
    const { pin } = await req.json();

    if (!pin) {
      return new Response(
        JSON.stringify({ ok: false, error: 'PIN required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const correctPin = Deno.env.get('SURPRISE_PIN');
    if (!correctPin) {
      console.error('SURPRISE_PIN secret not configured');
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

    // PIN is correct — fetch surprise data using service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: flights, error: flightsErr } = await supabase
      .from('flights')
      .select('*')
      .eq('is_surprise', true);

    const { data: lodgings, error: lodgingsErr } = await supabase
      .from('lodgings')
      .select('*')
      .eq('is_surprise', true);

    const { data: checklist, error: checklistErr } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('is_surprise', true);

    if (flightsErr || lodgingsErr || checklistErr) {
      console.error(flightsErr, lodgingsErr, checklistErr);
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to fetch surprise data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, data: { flights, lodgings, checklist } }),
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
