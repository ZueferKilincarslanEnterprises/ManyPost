import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface VideoMetadata {
  title: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus: string;
  madeForKids: boolean;
  notifySubscribers: boolean;
}

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
    throw new Error('Failed to refresh access token');
  }

  return data.access_token;
}

async function uploadToYouTube(
  accessToken: string,
  videoUrl: string,
  metadata: VideoMetadata
): Promise<{ videoId: string; videoUrl: string }> {
  const videoResponse = await fetch(videoUrl);
  const videoBlob = await videoResponse.blob();

  const uploadUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';

  const initResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'video/*',
    },
    body: JSON.stringify({
      snippet: {
        title: metadata.title,
        description: metadata.description || '',
        tags: metadata.tags || [],
        categoryId: metadata.categoryId || '28',
      },
      status: {
        privacyStatus: metadata.privacyStatus,
        selfDeclaredMadeForKids: metadata.madeForKids,
        notifySubscribers: metadata.notifySubscribers,
      },
    }),
  });

  const uploadLocation = initResponse.headers.get('Location');
  if (!uploadLocation) {
    throw new Error('Failed to get upload location');
  }

  const uploadResponse = await fetch(uploadLocation, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/*',
    },
    body: videoBlob,
  });

  const result = await uploadResponse.json();

  if (!result.id) {
    throw new Error('Failed to upload video to YouTube');
  }

  return {
    videoId: result.id,
    videoUrl: `https://www.youtube.com/watch?v=${result.id}`,
  };
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

    const { scheduled_post_id } = await req.json();

    if (!scheduled_post_id) {
      throw new Error('Missing scheduled_post_id');
    }

    const { data: post, error: postError } = await supabase
      .from('scheduled_posts')
      .select(`
        *,
        integration:integrations(*),
        video:videos(*)
      `)
      .eq('id', scheduled_post_id)
      .maybeSingle();

    if (postError || !post) {
      throw new Error('Scheduled post not found');
    }

    await supabase
      .from('scheduled_posts')
      .update({ status: 'processing' })
      .eq('id', scheduled_post_id);

    const clientId = Deno.env.get('YOUTUBE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET')!;

    let accessToken = post.integration.access_token;

    const tokenExpiry = new Date(post.integration.token_expires_at);
    if (tokenExpiry < new Date()) {
      accessToken = await refreshAccessToken(
        post.integration.refresh_token,
        clientId,
        clientSecret
      );

      await supabase
        .from('integrations')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + 3600000).toISOString(),
        })
        .eq('id', post.integration.id);
    }

    const result = await uploadToYouTube(accessToken, post.video.r2_url, {
      title: post.title,
      description: post.description,
      tags: post.tags,
      categoryId: post.category,
      privacyStatus: post.privacy_status,
      madeForKids: post.made_for_kids,
      notifySubscribers: post.notify_subscribers,
    });

    await supabase
      .from('scheduled_posts')
      .update({ status: 'posted' })
      .eq('id', scheduled_post_id);

    await supabase
      .from('post_history')
      .insert({
        user_id: post.user_id,
        scheduled_post_id: scheduled_post_id,
        integration_id: post.integration_id,
        video_id: post.video_id,
        platform: post.platform,
        platform_post_id: result.videoId,
        platform_post_url: result.videoUrl,
        title: post.title,
        status: 'success',
        posted_at: new Date().toISOString(),
      });

    return new Response(
      JSON.stringify({
        success: true,
        videoId: result.videoId,
        videoUrl: result.videoUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('YouTube Publisher Error:', error);

    const { scheduled_post_id } = await req.json().catch(() => ({}));

    if (scheduled_post_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('scheduled_posts')
        .update({ status: 'failed' })
        .eq('id', scheduled_post_id);

      const { data: post } = await supabase
        .from('scheduled_posts')
        .select('user_id, integration_id, video_id, platform, title')
        .eq('id', scheduled_post_id)
        .maybeSingle();

      if (post) {
        await supabase
          .from('post_history')
          .insert({
            user_id: post.user_id,
            scheduled_post_id: scheduled_post_id,
            integration_id: post.integration_id,
            video_id: post.video_id,
            platform: post.platform,
            title: post.title,
            status: 'failed',
            error_message: error.message,
            posted_at: new Date().toISOString(),
          });
      }
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
