import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
    const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error("[youtube-oauth] Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET");
      throw new Error("Server config error: Missing YouTube credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const frontendRedirectUri = url.searchParams.get('redirect_uri');

<<<<<<< HEAD
    console.log(`[youtube-oauth] Incoming Request - Action: ${action}, Code present: ${!!code}, State: ${state}`);

    // 1. CALLBACK / TOKEN EXCHANGE
    if (code && state) {
      // Die redirect_uri muss EXAKT die sein, die auch beim 'init' Schritt an Google gesendet wurde
      const usedRedirectUri = frontendRedirectUri || `${supabaseUrl}/functions/v1/youtube-oauth`;
      console.log(`[youtube-oauth] Attempting token exchange with redirect_uri: ${usedRedirectUri}`);
=======
    // Ermittle die Frontend URL aus Secrets oder Fallback
    const envUrl = Deno.env.get('FRONTEND_URL');
    const frontendUrl = (envUrl && envUrl !== 'undefined') ? envUrl.replace(/\/$/, '') : 'http://localhost:5173';

    // 1. CALLBACK HANDLING (Von Google oder vom Frontend)
    if (code && state) {
      console.log(`[youtube-oauth] Processing callback for user: ${state}`);
      
      const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
      const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');
      const redirectUri = `${supabaseUrl}/functions/v1/youtube-oauth`;
>>>>>>> 65504e1a1a9b7404a74d4860322ffeb58ab56886

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: usedRedirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (!tokens.access_token) {
<<<<<<< HEAD
        console.error("[youtube-oauth] Google Token Exchange Failed:", JSON.stringify(tokens, null, 2));
        return new Response(JSON.stringify({ 
          error: tokens.error_description || tokens.error || 'Failed to exchange code',
          google_error: tokens 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log("[youtube-oauth] Success: Received tokens. Fetching channel info...");

=======
        console.error('[youtube-oauth] Token error:', tokens);
        if (action === 'callback') { // Aufruf vom Frontend per fetch
          return new Response(JSON.stringify({ error: tokens.error_description || 'Token exchange failed' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        // Direkter Browser-Redirect von Google
        return new Response(null, {
          status: 302, headers: { 'Location': `${frontendUrl}/integrations?error=token_failed` }
        });
      }

      // Channel Daten abrufen
>>>>>>> 65504e1a1a9b7404a74d4860322ffeb58ab56886
      const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const channelData = await channelResponse.json();
      const channel = channelData.items?.[0];

      if (!channel) {
<<<<<<< HEAD
        console.error("[youtube-oauth] Google Channel API Error:", JSON.stringify(channelData, null, 2));
        throw new Error('No YouTube channel found for this account. Please make sure you have a channel created.');
=======
        if (action === 'callback') {
          return new Response(JSON.stringify({ error: 'No YouTube channel found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(null, {
          status: 302, headers: { 'Location': `${frontendUrl}/integrations?error=no_channel` }
        });
>>>>>>> 65504e1a1a9b7404a74d4860322ffeb58ab56886
      }

      // In Datenbank speichern
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
<<<<<<< HEAD
      
      // Speichern der Integration
      const { error: dbError } = await supabase.from('integrations').upsert({
=======
      await supabase.from('integrations').upsert({
>>>>>>> 65504e1a1a9b7404a74d4860322ffeb58ab56886
        user_id: state,
        platform: 'youtube',
        platform_user_id: channel.id,
        channel_name: channel.snippet.title,
        channel_id: channel.id,
        profile_image_url: channel.snippet.thumbnails?.default?.url,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        is_active: true,
<<<<<<< HEAD
        connected_at: new Date().toISOString(),
      }, { 
        onConflict: 'user_id,platform,platform_user_id' 
      });

      if (dbError) {
        console.error("[youtube-oauth] Database Upsert Error:", dbError);
        throw new Error(`Failed to save integration: ${dbError.message}`);
      }

      console.log("[youtube-oauth] Integration saved successfully for channel:", channel.snippet.title);

      return new Response(JSON.stringify({ 
        success: true, 
        channel: { name: channel.snippet.title } 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. INIT
    if (action === 'init') {
      const userId = url.searchParams.get('user_id');
      const redirectUri = url.searchParams.get('redirect_uri');
      
      if (!userId || !redirectUri) {
        throw new Error('Missing user_id or redirect_uri parameters');
      }
=======
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform_user_id' });

      // Antwort-Logik
      if (action === 'callback') {
        return new Response(JSON.stringify({ success: true, channel: { name: channel.snippet.title } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(null, {
        status: 302,
        headers: { 'Location': `${frontendUrl}/integrations?success=youtube&channel=${encodeURIComponent(channel.snippet.title)}` }
      });
    }

    // 2. INIT HANDLING
    if (action === 'init') {
      const userId = url.searchParams.get('user_id');
      if (!userId) throw new Error('Missing user_id');
>>>>>>> 65504e1a1a9b7404a74d4860322ffeb58ab56886

      console.log(`[youtube-oauth] Initiating OAuth for user: ${userId}, Redirecting back to: ${redirectUri}`);

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube')}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${userId}`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

<<<<<<< HEAD
    throw new Error('Invalid request action');
  } catch (error) {
    console.error('[youtube-oauth] Fatal Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
=======
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[youtube-oauth] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
>>>>>>> 65504e1a1a9b7404a74d4860322ffeb58ab56886
    });
  }
});