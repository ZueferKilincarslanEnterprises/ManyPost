import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication Check
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: corsHeaders });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[sync-video-stats] Auth error:', authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    console.log(`[sync-video-stats] Starte Synchronisierung für User: ${user.id}`);

    // 1. YouTube Posts NUR für den authentifizierten User abrufen
    const { data: posts, error: postsError } = await supabase
      .from('post_history')
      .select('id, user_id, platform_post_id, platform')
      .eq('user_id', user.id) // Security: Nur eigene Posts syncen
      .eq('platform', 'youtube')
      .eq('status', 'success');

    if (postsError) throw postsError;
    
    if (!posts || posts.length === 0) {
      console.log("[sync-video-stats] Keine Posts zum Synchronisieren gefunden.");
      return new Response(JSON.stringify({ message: 'No posts to sync' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`[sync-video-stats] Verarbeite ${posts.length} Videos.`);

    let successCount = 0;
    for (const post of posts) {
      try {
        // Access Token für den User holen
        const { data: integration } = await supabase
          .from('integrations')
          .select('access_token, refresh_token')
          .eq('user_id', user.id)
          .eq('platform', 'youtube')
          .single();

        if (!integration?.access_token) {
          console.warn(`[sync-video-stats] Kein Token für Video ${post.platform_post_id} gefunden.`);
          continue;
        }

        // YouTube API Call
        const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${post.platform_post_id}`, {
          headers: { 'Authorization': `Bearer ${integration.access_token}` }
        });
        
        const ytData = await ytRes.json();
        const stats = ytData.items?.[0]?.statistics;

        if (stats) {
          await supabase.from('video_stats').insert({
            user_id: user.id,
            post_history_id: post.id,
            platform_post_id: post.platform_post_id,
            view_count: parseInt(stats.viewCount || '0'),
            like_count: parseInt(stats.likeCount || '0'),
            comment_count: parseInt(stats.commentCount || '0')
          });
          successCount++;
        }
      } catch (err) {
        console.error(`[sync-video-stats] Fehler bei Video ${post.platform_post_id}:`, err);
      }
    }

    console.log(`[sync-video-stats] Synchronisierung abgeschlossen. ${successCount} Einträge erstellt.`);

    return new Response(JSON.stringify({ success: true, synced: successCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sync-video-stats] Kritischer Fehler:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});