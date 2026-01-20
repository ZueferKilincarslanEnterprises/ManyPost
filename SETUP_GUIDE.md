# ManyPost Setup Guide

This guide will help you set up ManyPost from scratch, including all necessary configurations.

## Prerequisites

- Node.js 18 or higher
- Supabase account
- Google Cloud Console account
- Cloudflare account (for R2 storage)

## Step 1: Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Note your project URL and anon key
3. The database schema has been automatically created via migrations

## Step 2: YouTube API Setup

### Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3:
   - Go to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"

### Create OAuth Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Configure the OAuth consent screen:
   - User Type: External
   - App name: ManyPost
   - User support email: your email
   - Developer contact: your email
4. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: ManyPost
   - Authorized redirect URIs:
     - `https://YOUR_SUPABASE_URL/functions/v1/youtube-oauth?action=callback`
     - `http://localhost:3000/youtube-oauth?action=callback` (for development)
5. Copy the Client ID and Client Secret

### Add Scopes

In the OAuth consent screen configuration, add these scopes:
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube`
- `https://www.googleapis.com/auth/youtube.force-ssl`

## Step 3: Cloudflare R2 Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to R2 Object Storage
3. Create a new bucket: `manypost-videos`
4. Generate R2 API tokens:
   - Go to "Manage R2 API Tokens"
   - Create API token with read/write permissions
5. Note the Access Key ID and Secret Access Key

## Step 4: Configure Environment Variables

You'll need to configure these secrets in Supabase:

### For Edge Functions

The following environment variables are automatically available:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

You need to add these via Supabase CLI or Dashboard:

```bash
# YouTube OAuth
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret

# Cloudflare R2 (if using)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=manypost-videos
```

### Add Secrets via Supabase Dashboard

1. Go to your Supabase project
2. Navigate to "Edge Functions" in the sidebar
3. Click on the "Secrets" tab
4. Add each secret listed above

## Step 5: Deploy Edge Functions

The Edge Functions have already been deployed. To redeploy or update:

1. Make sure you have the Supabase CLI installed
2. Link your project: `supabase link --project-ref YOUR_PROJECT_REF`
3. Deploy functions: `supabase functions deploy`

## Step 6: Set Up Cron Job

To automatically publish scheduled posts, set up a cron job:

### Option 1: External Cron Service (Recommended)

Use a service like [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com):

1. Create a new cron job
2. URL: `https://YOUR_SUPABASE_URL/functions/v1/cron-publisher`
3. Method: POST
4. Schedule: Every 1 minute (*/1 * * * *)
5. Add header: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

### Option 2: Supabase pg_cron

Enable and configure pg_cron in your Supabase database:

```sql
SELECT cron.schedule(
  'publish-scheduled-posts',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_SUPABASE_URL/functions/v1/cron-publisher',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

## Step 7: Test the Setup

### Test Authentication

1. Sign up for a new account at `/signup`
2. Verify you're redirected to the dashboard
3. Check that an API key was automatically generated

### Test YouTube Integration

1. Go to `/integrations`
2. Click "Add Account" > "YouTube"
3. Complete the OAuth flow
4. Verify your channel appears in the integrations list

### Test Video Upload

1. Go to `/videos`
2. Upload a test video
3. Verify it appears in the library

### Test Scheduling

1. Go to `/schedule`
2. Create a test post scheduled 5 minutes in the future
3. Wait for the cron job to process it
4. Check the post history to verify it was published

### Test API

```bash
# Get your API key from the dashboard, then:
curl -X GET https://YOUR_SUPABASE_URL/functions/v1/api/integrations \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Troubleshooting

### YouTube OAuth Not Working

- Verify redirect URIs are correctly configured
- Check that YouTube API is enabled
- Ensure OAuth consent screen is published
- Verify client ID and secret are correct in Supabase secrets

### Videos Not Uploading

- Check R2 credentials are correct
- Verify R2 bucket exists and is accessible
- Check browser console for errors
- Ensure CORS is configured on R2 bucket

### Scheduled Posts Not Publishing

- Verify cron job is running
- Check Edge Function logs in Supabase dashboard
- Ensure service role key is correct
- Verify YouTube tokens haven't expired

### API Not Working

- Verify API key is active in database
- Check Authorization header format
- Review Edge Function logs for errors
- Ensure RLS policies are correctly configured

## Security Checklist

- [ ] OAuth client secret is kept confidential
- [ ] Service role key is not exposed in frontend
- [ ] API keys are stored securely
- [ ] RLS policies are enabled on all tables
- [ ] HTTPS is enforced for all endpoints
- [ ] Rate limiting is configured
- [ ] Regular backups are scheduled

## Performance Optimization

### Database Indexes

The following indexes are automatically created:
- User ID indexes on all user-related tables
- Scheduled time index for efficient cron queries
- Status indexes for filtering

### Caching

Consider implementing caching for:
- User profiles
- Integration lists
- Video lists

### CDN

For production, use a CDN for:
- Static assets
- Video thumbnails
- Frontend build files

## Monitoring

Set up monitoring for:
- Edge Function errors
- Failed post publishing attempts
- API rate limit hits
- Database query performance
- Storage usage

## Support

If you encounter issues:
1. Check the troubleshooting section
2. Review Supabase Edge Function logs
3. Check browser console for frontend errors
4. Verify all environment variables are set
5. Create an issue on GitHub with detailed error information

## Next Steps

Once setup is complete:
1. Customize the branding and colors
2. Add your logo
3. Configure email templates in Supabase Auth
4. Set up analytics tracking
5. Create user documentation
6. Plan your launch strategy
