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

    // 1. CALLBACK / TOKEN EXCHANGE
    if (code && state) {
      const usedRedirectUri = frontendRedirectUri || `${supabaseUrl}/functions/v1/youtube-oauth`;
      
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
        return new Response(JSON.stringify({ 
          error: tokens.error_description || tokens.error || 'Failed to exchange code'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const channelData = await channelResponse.json();
      const channel = channelData.items?.[0];

      if (!channel) {
        throw new Error('No YouTube channel found for this account.');
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      
      const { error: dbError } = await supabase.from('integrations').upsert({
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
        connected_at: new Date().toISOString(),
      }, { 
        onConflict: 'user_id,platform,platform_user_id' 
      });

      if (dbError) throw dbError;

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

    throw new Error('Invalid request action');
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});