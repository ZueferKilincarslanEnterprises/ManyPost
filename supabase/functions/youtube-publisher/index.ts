import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@3.616.0";

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
  videoType: 'normal' | 'short';
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

async function downloadFromR2(r2Key: string): Promise<Blob> {
  const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
  const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
  const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
  const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME')!;

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
  });

  const response = await s3Client.send(command);
  if (!response.Body) throw new Error("Empty response body from R2");

  const bytes = await response.Body.transformToByteArray();
  return new Blob([bytes]);
}

async function uploadToYouTube(
  accessToken: string,
  r2Key: string,
  metadata: VideoMetadata
): Promise<{ videoId: string; videoUrl: string }> {
  console.log(`[youtube-publisher] Downloading video from R2...`);
  const videoBlob = await downloadFromR2(r2Key);

  // If it's a short, ensure #Shorts is in the title (YouTube best practice)
  let title = metadata.title;
  if (metadata.videoType === 'short' && !title.toLowerCase().includes('#shorts')) {
    title = title.length > 92 ? title.substring(0, 92) + ' #Shorts' : title + ' #Shorts';
  }

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
        title: title,
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
  if (!uploadLocation) throw new Error('Failed to get upload location');

  console.log("[youtube-publisher] Uploading video data to YouTube...");
  const uploadResponse = await fetch(uploadLocation, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/*' },
    body: videoBlob,
  });

  const result = await uploadResponse.json();
  if (!result.id) throw new Error('YouTube Upload Error: ' + JSON.stringify(result));

  return {
    videoId: result.id,
    videoUrl: `https://www.youtube.com/watch?v=${result.id}`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let scheduledPostId = null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    scheduledPostId = body.scheduled_post_id;
    if (!scheduledPostId) throw new Error('Missing scheduled_post_id');

    console.log(`[youtube-publisher] Processing post ID: ${scheduledPostId}`);

    const { data: post, error: postError } = await supabase
      .from('scheduled_posts')
      .select(`*, integration:integrations(*), video:videos(*)`)
      .eq('id', scheduledPostId)
      .maybeSingle();

    if (postError || !post) throw new Error('Scheduled post not found');
    if (!post.video?.r2_key) throw new Error('Video R2 key not found');

    await supabase.from('scheduled_posts').update({ status: 'processing' }).eq('id', scheduledPostId);

    const clientId = Deno.env.get('YOUTUBE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET')!;

    let accessToken = post.integration.access_token;
    const tokenExpiry = post.integration.token_expires_at ? new Date(post.integration.token_expires_at) : new Date(0);
    
    if (tokenExpiry < new Date(Date.now() + 60000)) {
      console.log("[youtube-publisher] Refreshing access token...");
      accessToken = await refreshAccessToken(post.integration.refresh_token, clientId, clientSecret);
      await supabase.from('integrations').update({
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + 3500000).toISOString(),
      }).eq('id', post.integration.id);
    }

    const result = await uploadToYouTube(accessToken, post.video.r2_key, {
      title: post.title,
      description: post.description,
      tags: post.tags,
      categoryId: post.category,
      privacyStatus: post.privacy_status,
      madeForKids: post.made_for_kids,
      notifySubscribers: post.notify_subscribers,
      videoType: post.video_type,
    });

    console.log(`[youtube-publisher] Successfully posted! Video ID: ${result.videoId}`);

    await supabase.from('scheduled_posts').update({ status: 'posted' }).eq('id', scheduledPostId);
    await supabase.from('post_history').insert({
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

    return new Response(JSON.stringify({ success: true, videoId: result.videoId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[youtube-publisher] Error:', error);
    if (scheduledPostId) {
      await supabase.from('scheduled_posts').update({ status: 'failed' }).eq('id', scheduledPostId);
      // History record for failure...
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});