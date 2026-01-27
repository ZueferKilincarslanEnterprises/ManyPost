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
    throw new Error('Failed to refresh access token: ' + JSON.stringify(data));
  }

  return data.access_token;
}

async function uploadToYouTube(
  accessToken: string,
  videoUrl: string,
  metadata: VideoMetadata
): Promise<{ videoId: string; videoUrl: string }> {
  console.log("[youtube-publisher] Fetching video from R2...");
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) throw new Error("Could not download video from R2");
  
  const videoBlob = await videoResponse.blob();
  console.log(`[youtube-publisher] Video size: ${videoBlob.size} bytes`);

  const uploadUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';

  console.log("[youtube-publisher] Initiating resumable upload...");
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

  if (!initResponse.ok) {
    const err = await initResponse.json();
    throw new Error('YouTube Init Error: ' + JSON.stringify(err));
  }

  const uploadLocation = initResponse.headers.get('Location');
  if (!uploadLocation) {
    throw new Error('Failed to get upload location');
  }

  console.log("[youtube-publisher] Uploading video data...");
  const uploadResponse = await fetch(uploadLocation, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/*',
    },
    body: videoBlob,
  });

  const result = await uploadResponse.json();

  if (!result.id) {
    throw new Error('YouTube Upload Error: ' + JSON.stringify(result));
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

  let scheduledPostId = null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    scheduledPostId = body.scheduled_post_id;

    if (!scheduledPostId) {
      throw new Error('Missing scheduled_post_id');
    }

    console.log(`[youtube-publisher] Processing post ID: ${scheduledPostId}`);

    const { data: post, error: postError } = await supabase
      .from('scheduled_posts')
      .select(`
        *,
        integration:integrations(*),
        video:videos(*)
      `)
      .eq('id', scheduledPostId)
      .maybeSingle();

    if (postError || !post) {
      throw new Error('Scheduled post not found');
    }

    // Set status to processing
    await supabase
      .from('scheduled_posts')
      .update({ status: 'processing' })
      .eq('id', scheduledPostId);

    const clientId = Deno.env.get('YOUTUBE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET')!;

    let accessToken = post.integration.access_token;

    // Refresh token if needed
    const tokenExpiry = post.integration.token_expires_at ? new Date(post.integration.token_expires_at) : new Date(0);
    if (tokenExpiry < new Date()) {
      console.log("[youtube-publisher] Refreshing access token...");
      accessToken = await refreshAccessToken(
        post.integration.refresh_token,
        clientId,
        clientSecret
      );

      await supabase
        .from('integrations')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + 3500000).toISOString(),
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

    console.log(`[youtube-publisher] Successfully posted! Video ID: ${result.videoId}`);

    await supabase
      .from('scheduled_posts')
      .update({ status: 'posted' })
      .eq('id', scheduled_post_id);

    await supabase
      .from('post_history')
      .insert({
        user_id: post.user_id,
        scheduled_post_id: scheduledPostId,
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
    console.error('[youtube-publisher] Error:', error);

    if (scheduledPostId) {
      await supabase
        .from('scheduled_posts')
        .update({ status: 'failed' })
        .eq('id', scheduledPostId);

      const { data: post } = await supabase
        .from('scheduled_posts')
        .select('user_id, integration_id, video_id, platform, title')
        .eq('id', scheduledPostId)
        .maybeSingle();

      if (post) {
        await supabase
          .from('post_history')
          .insert({
            user_id: post.user_id,
            scheduled_post_id: scheduledPostId,
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