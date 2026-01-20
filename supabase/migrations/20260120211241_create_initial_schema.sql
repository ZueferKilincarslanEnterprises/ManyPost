/*
  # ManyPost Initial Schema

  1. New Tables
    - `users_profile`
      - `id` (uuid, references auth.users)
      - `email` (text)
      - `full_name` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `api_keys`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users_profile)
      - `key` (text, unique)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `last_used_at` (timestamptz)
    
    - `integrations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users_profile)
      - `platform` (text) - 'youtube', 'instagram', 'tiktok'
      - `platform_user_id` (text)
      - `channel_name` (text)
      - `channel_id` (text)
      - `profile_image_url` (text)
      - `access_token` (text, encrypted)
      - `refresh_token` (text, encrypted)
      - `token_expires_at` (timestamptz)
      - `metadata` (jsonb)
      - `is_active` (boolean)
      - `connected_at` (timestamptz)
      - `last_synced_at` (timestamptz)
    
    - `videos`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users_profile)
      - `file_name` (text)
      - `file_size` (bigint)
      - `duration` (integer) - in seconds
      - `width` (integer)
      - `height` (integer)
      - `mime_type` (text)
      - `r2_url` (text)
      - `r2_key` (text)
      - `thumbnail_url` (text)
      - `upload_status` (text) - 'uploading', 'completed', 'failed'
      - `metadata` (jsonb)
      - `uploaded_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `scheduled_posts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users_profile)
      - `integration_id` (uuid, references integrations)
      - `video_id` (uuid, references videos)
      - `platform` (text)
      - `scheduled_time` (timestamptz)
      - `status` (text) - 'pending', 'processing', 'posted', 'failed', 'cancelled'
      - `title` (text)
      - `description` (text)
      - `tags` (text[])
      - `category` (text)
      - `privacy_status` (text) - 'public', 'private', 'unlisted'
      - `video_type` (text) - 'normal', 'short'
      - `thumbnail_url` (text)
      - `made_for_kids` (boolean)
      - `notify_subscribers` (boolean)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `post_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users_profile)
      - `scheduled_post_id` (uuid, references scheduled_posts)
      - `integration_id` (uuid, references integrations)
      - `video_id` (uuid, references videos)
      - `platform` (text)
      - `platform_post_id` (text)
      - `platform_post_url` (text)
      - `title` (text)
      - `status` (text) - 'success', 'failed'
      - `error_message` (text)
      - `posted_at` (timestamptz)
      - `metadata` (jsonb)
    
    - `drafts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users_profile)
      - `integration_id` (uuid, references integrations)
      - `video_id` (uuid, references videos)
      - `platform` (text)
      - `title` (text)
      - `description` (text)
      - `tags` (text[])
      - `category` (text)
      - `privacy_status` (text)
      - `video_type` (text)
      - `thumbnail_url` (text)
      - `made_for_kids` (boolean)
      - `notify_subscribers` (boolean)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `webhooks`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users_profile)
      - `url` (text)
      - `events` (text[])
      - `secret` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
    
    - `webhook_logs`
      - `id` (uuid, primary key)
      - `webhook_id` (uuid, references webhooks)
      - `event_type` (text)
      - `payload` (jsonb)
      - `response_status` (integer)
      - `response_body` (text)
      - `attempt` (integer)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
*/

-- Create users_profile table
CREATE TABLE IF NOT EXISTS users_profile (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON users_profile FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users_profile FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users_profile FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  key text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own API keys"
  ON api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys"
  ON api_keys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON api_keys FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON api_keys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  platform text NOT NULL,
  platform_user_id text,
  channel_name text,
  channel_id text,
  profile_image_url text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  connected_at timestamptz DEFAULT now(),
  last_synced_at timestamptz
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own integrations"
  ON integrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON integrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON integrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON integrations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  duration integer,
  width integer,
  height integer,
  mime_type text,
  r2_url text,
  r2_key text,
  thumbnail_url text,
  upload_status text DEFAULT 'uploading',
  metadata jsonb DEFAULT '{}'::jsonb,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own videos"
  ON videos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own videos"
  ON videos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos"
  ON videos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos"
  ON videos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create scheduled_posts table
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  platform text NOT NULL,
  scheduled_time timestamptz NOT NULL,
  status text DEFAULT 'pending',
  title text NOT NULL,
  description text,
  tags text[],
  category text,
  privacy_status text DEFAULT 'public',
  video_type text DEFAULT 'normal',
  thumbnail_url text,
  made_for_kids boolean DEFAULT false,
  notify_subscribers boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scheduled posts"
  ON scheduled_posts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scheduled posts"
  ON scheduled_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled posts"
  ON scheduled_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled posts"
  ON scheduled_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create post_history table
CREATE TABLE IF NOT EXISTS post_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  scheduled_post_id uuid REFERENCES scheduled_posts(id) ON DELETE SET NULL,
  integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,
  video_id uuid REFERENCES videos(id) ON DELETE SET NULL,
  platform text NOT NULL,
  platform_post_id text,
  platform_post_url text,
  title text,
  status text NOT NULL,
  error_message text,
  posted_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE post_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own post history"
  ON post_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own post history"
  ON post_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create drafts table
CREATE TABLE IF NOT EXISTS drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,
  video_id uuid REFERENCES videos(id) ON DELETE SET NULL,
  platform text,
  title text,
  description text,
  tags text[],
  category text,
  privacy_status text DEFAULT 'public',
  video_type text DEFAULT 'normal',
  thumbnail_url text,
  made_for_kids boolean DEFAULT false,
  notify_subscribers boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own drafts"
  ON drafts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drafts"
  ON drafts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts"
  ON drafts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts"
  ON drafts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL,
  secret text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own webhooks"
  ON webhooks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own webhooks"
  ON webhooks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhooks"
  ON webhooks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own webhooks"
  ON webhooks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create webhook_logs table
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  attempt integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own webhook logs"
  ON webhook_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM webhooks
      WHERE webhooks.id = webhook_logs.webhook_id
      AND webhooks.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(platform);
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_upload_status ON videos(upload_status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_time ON scheduled_posts(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_post_history_user_id ON post_history(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);

-- Create function to automatically generate API key on user creation
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  key text;
BEGIN
  key := 'mp_' || encode(gen_random_bytes(32), 'hex');
  RETURN key;
END;
$$;

-- Create trigger to create user profile and API key on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO users_profile (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now());
  
  INSERT INTO api_keys (user_id, key, is_active, created_at)
  VALUES (NEW.id, generate_api_key(), true, now());
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();