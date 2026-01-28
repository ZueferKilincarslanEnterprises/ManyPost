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
    console.log("[sync-video-stats] Starting sync process...");
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Holen aller erfolgreichen YouTube Posts der letzten 30 Tage (oder alle)
    const { data: posts, error: postsError } = await supabase
      .from('post_history')
      .select('id, user_id, platform_post_id, platform')
      .eq('platform', 'youtube')
      .eq('status', 'success');

    if (postsError) throw postsError;
    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ message: 'No posts to sync' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[sync-video-stats] Found ${posts.length} posts to check.`);

    // YouTube API erlaubt Batch-Abfragen (bis zu 50 IDs pro Request)
    // Wir gruppieren hier nach User, um deren API-Keys/Tokens zu nutzen (oder wir nutzen einen zentralen Server-Key)
    // Für dieses Beispiel nutzen wir den Server-Key für öffentliche Stats (einfacher)
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_CLIENT_SECRET'); // In der Realität braucht man einen API Key oder nutzt Access Tokens

    const results = [];
    
    // Wir verarbeiten die Posts
    for (const post of posts) {
      try {
        // Hier simulieren wir den YouTube API Call (videos.list mit part=statistics)
        // In Produktion: fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${post.platform_post_id}&key=${API_KEY}`)
        
        // Wir brauchen ein Access Token für den User (aus integrations Tabelle)
        const { data: integration } = await supabase
          .from('integrations')
          .select('access_token')
          .eq('user_id', post.user_id)
          .eq('platform', 'youtube')
          .single();

        if (!integration?.access_token) continue;

        const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${post.platform_post_id}`, {
          headers: { 'Authorization': `Bearer ${integration.access_token}` }
        });
        
        const ytData = await ytRes.json();
        const stats = ytData.items?.[0]?.statistics;

        if (stats) {
          const { error: insertError } = await supabase.from('video_stats').insert({
            user_id: post.user_id,
            post_history_id: post.id,
            platform_post_id: post.platform_post_id,
            view_count: parseInt(stats.viewCount || '0'),
            like_count: parseInt(stats.likeCount || '0'),
            comment_count: parseInt(stats.commentCount || '0')
          });

          if (insertError) console.error(`[sync-video-stats] DB Insert Error for ${post.id}:`, insertError);
          results.push({ id: post.id, status: 'synced', views: stats.viewCount });
        }
      } catch (err) {
        console.error(`[sync-video-stats] Error syncing post ${post.id}:`, err);
      }
    }

    return new Response(JSON.stringify({ success: true, synced: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sync-video-stats] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});