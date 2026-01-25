import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { S3Client } from 'https://esm.sh/@aws-sdk/client-s3@3.616.0';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3.616.0';
import { PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.616.0';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // [generate-r2-signed-url] Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[generate-r2-signed-url] Authorization header missing');
      return new Response(JSON.stringify({ error: 'Authorization header missing' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[generate-r2-signed-url] Invalid or expired token:', authError?.message);
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { fileName, contentType } = await req.json();

    if (!fileName || !contentType) {
      console.error('[generate-r2-signed-url] Missing fileName or contentType');
      return new Response(JSON.stringify({ error: 'Missing fileName or contentType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
    const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!;
    const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
    const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME')!;

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      console.error('[generate-r2-signed-url] Missing R2 environment variables');
      throw new Error('Missing R2 environment variables');
    }

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const r2Key = `${user.id}/${crypto.randomUUID()}-${fileName}`; // Unique key for R2
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL valid for 1 hour

    console.log(`[generate-r2-signed-url] Signed URL generated for key: ${r2Key}`);
    return new Response(
      JSON.stringify({ signedUrl, r2Key }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[generate-r2-signed-url] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});