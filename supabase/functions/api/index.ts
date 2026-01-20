import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  action?: string;
  [key: string]: any;
}

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const apiKey = authHeader.replace('Bearer ', '');

    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('user_id, is_active')
      .eq('key', apiKey)
      .maybeSingle();

    if (apiKeyError || !apiKeyData || !apiKeyData.is_active) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API key' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userId = apiKeyData.user_id;
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key', apiKey);

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    if (req.method === 'GET') {
      if (path === 'integrations') {
        const { data, error } = await supabase
          .from('integrations')
          .select('id, platform, channel_name, channel_id, is_active, connected_at')
          .eq('user_id', userId)
          .eq('is_active', true);

        if (error) throw error;

        return new Response(
          JSON.stringify({ integrations: data }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (path === 'videos') {
        const { data, error } = await supabase
          .from('videos')
          .select('id, file_name, file_size, duration, thumbnail_url, upload_status, uploaded_at')
          .eq('user_id', userId)
          .eq('upload_status', 'completed');

        if (error) throw error;

        return new Response(
          JSON.stringify({ videos: data }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (path === 'scheduled') {
        const { data, error } = await supabase
          .from('scheduled_posts')
          .select('id, title, scheduled_time, status, platform, created_at')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('scheduled_time', { ascending: true });

        if (error) throw error;

        return new Response(
          JSON.stringify({ scheduled_posts: data }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (req.method === 'POST' && path === 'schedule') {
      const body: RequestBody = await req.json();

      const { data: integration, error: intError } = await supabase
        .from('integrations')
        .select('platform')
        .eq('id', body.integration_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (intError || !integration) {
        throw new Error('Integration not found or access denied');
      }

      const { data, error } = await supabase
        .from('scheduled_posts')
        .insert({
          user_id: userId,
          integration_id: body.integration_id,
          video_id: body.video_id,
          platform: integration.platform,
          scheduled_time: body.scheduled_time,
          status: 'pending',
          title: body.title,
          description: body.description || null,
          tags: body.tags || [],
          category: body.category || null,
          privacy_status: body.privacy_status || 'public',
          video_type: body.video_type || 'normal',
          made_for_kids: body.made_for_kids || false,
          notify_subscribers: body.notify_subscribers !== false,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, post: data }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201,
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid endpoint or method' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
