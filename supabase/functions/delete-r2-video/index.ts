import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { S3Client } from "npm:@aws-sdk/client-s3@3.616.0";
import { DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3.616.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // [delete-r2-video] Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // [delete-r2-video] Authenticate user using the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[delete-r2-video] Invalid authorization header');
      return new Response(JSON.stringify({ error: 'Invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // [delete-r2-video] Verify the user's token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[delete-r2-video] Invalid user token:', authError?.message);
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // [delete-r2-video] Parse request body
    const { r2Key, videoId } = await req.json();

    if (!r2Key || !videoId) {
      console.error('[delete-r2-video] Missing r2Key or videoId');
      return new Response(JSON.stringify({ error: 'Missing r2Key or videoId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // [delete-r2-video] Verify that the video belongs to the user
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('user_id')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (videoError || !video) {
      console.error('[delete-r2-video] Video not found or access denied:', videoError?.message);
      return new Response(JSON.stringify({ error: 'Video not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // [delete-r2-video] Get R2 environment variables
    const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
    const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME')!;

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      console.error('[delete-r2-video] Missing R2 environment variables');
      return new Response(JSON.stringify({ error: 'Missing R2 environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // [delete-r2-video] Initialize S3 client for R2
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    // [delete-r2-video] Delete the object from R2
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
    });

    await s3Client.send(command);
    console.log(`[delete-r2-video] Successfully deleted object with key: ${r2Key}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    // [delete-r2-video] Log any unexpected errors
    console.error('[delete-r2-video] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});