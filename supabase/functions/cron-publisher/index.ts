import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    const { data: duePosts, error: queryError } = await supabase
      .from('scheduled_posts')
      .select('id, scheduled_time')
      .eq('status', 'pending')
      .lte('scheduled_time', fiveMinutesFromNow.toISOString())
      .gte('scheduled_time', now.toISOString());

    if (queryError) {
      throw queryError;
    }

    const results = [];

    for (const post of duePosts || []) {
      try {
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

        results.push({
          post_id: post.id,
          success: response.ok,
          result: result,
        });
      } catch (error) {
        results.push({
          post_id: post.id,
          success: false,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Cron Publisher Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
