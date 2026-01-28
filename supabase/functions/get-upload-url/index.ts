import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.341.0"
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.341.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { fileName, fileType } = await req.json()
    const accountId = Deno.env.get('R2_ACCOUNT_ID')
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
    const bucketName = Deno.env.get('R2_BUCKET_NAME')

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('R2 configuration is missing')
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    const key = `${crypto.randomUUID()}-${fileName}`
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
    })

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 })
    const publicUrl = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`

    console.log(`[get-upload-url] Generated signed URL for: ${key}`)

    return new Response(
      JSON.stringify({ signedUrl, publicUrl, key }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(`[get-upload-url] Error:`, error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})