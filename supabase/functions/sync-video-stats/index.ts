import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Failed to refresh access token: ' + JSON.stringify(data));
  }
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientId = Deno.env.get('YOUTUBE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET')!;

    console.log("[sync-video-stats] Starte Synchronisierung...");

    // 1. Alle erfolgreichen YouTube Posts abrufen
    const { data: posts, error: postsError } = await supabase
      .from('post_history')
      .select('id, user_id, platform_post_id, platform, integration_id')
      .eq('platform', 'youtube')
      .eq('status', 'success');

    if (postsError) throw postsError;
    
    if (!posts || posts.length === 0) {
      console.log("[sync-video-stats] Keine Posts zum Synchronisieren gefunden.");
      return new Response(JSON.stringify({ message: 'No posts to sync' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    let successCount = 0;
    for (const post of posts) {
      try {
        // Integration über die ID aus dem Post laden
        const { data: integration } = await supabase
          .from('integrations')
          .select('*')
          .eq('id', post.integration_id)
          .single();

        if (!integration) {
          console.warn(`[sync-video-stats] Keine Integration für ID ${post.integration_id} gefunden.`);
          continue;
        }

        let accessToken = integration.access_token;
        const expiry = integration.token_expires_at ? new Date(integration.token_expires_at) : new Date(0);

        // Token erneuern falls abgelaufen (oder bald abläuft)
        if (expiry < new Date(Date.now() + 60000)) {
          console.log(`[sync-video-stats] Erneuere Token für Integration ${integration.id}...`);
          try {
            accessToken = await refreshAccessToken(integration.refresh_token, clientId, clientSecret);
            await supabase.from('integrations').update({
              access_token: accessToken,
              token_expires_at: new Date(Date.now() + 3500000).toISOString(),
            }).eq('id', integration.id);
          } catch (refreshErr) {
            console.error(`[sync-video-stats] Token-Refresh fehlgeschlagen für ${integration.id}:`, refreshErr);
            continue;
          }
        }

        // YouTube API Call
        const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${post.platform_post_id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const ytData = await ytRes.json();
        const stats = ytData.items?.[0]?.statistics;

        if (stats) {
          const { error: insertErr } = await supabase.from('video_stats').insert({
            user_id: post.user_id,
            post_history_id: post.id,
            platform_post_id: post.platform_post_id,
            view_count: parseInt(stats.viewCount || '0'),
            like_count: parseInt(stats.likeCount || '0'),
            comment_count: parseInt(stats.commentCount || '0')
          });

          if (insertErr) throw insertErr;
          successCount++;
        } else {
          console.warn(`[sync-video-stats] Keine Statistiken für Video ${post.platform_post_id} (evtl. gelöscht?)`);
        }
      } catch (err) {
        console.error(`[sync-video-stats] Fehler bei Post ${post.id}:`, err);
      }
    }

    console.log(`[sync-video-stats] Synchronisierung abgeschlossen. ${successCount} neue Datensätze.`);

    return new Response(JSON.stringify({ success: true, synced: successCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[sync-video-stats] Kritischer Fehler:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});