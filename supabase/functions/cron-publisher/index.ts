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
    console.log("[cron-publisher] Checking for due posts...");
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();

    // Find all pending posts that should have been posted by now
    const { data: duePosts, error: queryError } = await supabase
      .from('scheduled_posts')
      .select('id')
      .eq('status', 'pending')
      .lte('scheduled_time', now);

    if (queryError) throw queryError;

    console.log(`[cron-publisher] Found ${duePosts?.length || 0} due posts.`);

    const results = [];
    for (const post of duePosts || []) {
      try {
        // Trigger the publisher for each post
        // We use the internal URL for function-to-function communication
        const publisherUrl = `${supabaseUrl}/functions/v1/youtube-publisher`;
        
        const response = await fetch(publisherUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scheduled_post_id: post.id }),
        });

        const result = await response.json();
        results.push({ post_id: post.id, success: response.ok, result });
      } catch (error) {
        console.error(`[cron-publisher] Error processing post ${post.id}:`, error);
        results.push({ post_id: post.id, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[cron-publisher] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});