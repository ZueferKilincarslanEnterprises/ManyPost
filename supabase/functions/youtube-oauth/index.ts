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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    // Ermittle die Frontend URL aus Secrets oder Fallback
    const envUrl = Deno.env.get('FRONTEND_URL');
    const frontendUrl = (envUrl && envUrl !== 'undefined') ? envUrl.replace(/\/$/, '') : 'http://localhost:5173';

    // 1. CALLBACK HANDLING (Von Google oder vom Frontend)
    if (code && state) {
      console.log(`[youtube-oauth] Processing callback for user: ${state}`);
      
      const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
      const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET');
      const redirectUri = `${supabaseUrl}/functions/v1/youtube-oauth`;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId!,
          client_secret: clientSecret!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();

      if (!tokens.access_token) {
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
      const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const channelData = await channelResponse.json();
      const channel = channelData.items?.[0];

      if (!channel) {
        if (action === 'callback') {
          return new Response(JSON.stringify({ error: 'No YouTube channel found' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(null, {
          status: 302, headers: { 'Location': `${frontendUrl}/integrations?error=no_channel` }
        });
      }

      // In Datenbank speichern
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      await supabase.from('integrations').upsert({
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

      const clientId = Deno.env.get('YOUTUBE_CLIENT_ID');
      const redirectUri = `${supabaseUrl}/functions/v1/youtube-oauth`;

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

    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[youtube-oauth] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});