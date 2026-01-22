export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
}

export interface Integration {
  id: string;
  user_id: string;
  platform: 'youtube' | 'instagram' | 'tiktok';
  platform_user_id?: string;
  channel_name?: string;
  channel_id?: string;
  profile_image_url?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  metadata: Record<string, any>;
  is_active: boolean;
  connected_at: string;
  last_synced_at?: string;
}

export interface Video {
  id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  duration?: number;
  width?: number;
  height?: number;
  mime_type?: string;
  r2_url?: string;
  r2_key?: string;
  thumbnail_url?: string;
  upload_status: 'uploading' | 'completed' | 'failed';
  metadata: Record<string, any>;
  uploaded_at: string;
  created_at: string;
}

export interface ScheduledPost {
  id: string;
  user_id: string;
  integration_id: string;
  video_id: string;
  platform: string;
  scheduled_time: string;
  status: 'pending' | 'processing' | 'posted' | 'failed' | 'cancelled';
  title: string;
  description?: string;
  tags?: string[];
  category?: string;
  privacy_status: 'public' | 'private' | 'unlisted';
  video_type: 'normal' | 'short';
  thumbnail_url?: string;
  made_for_kids: boolean;
  notify_subscribers: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PostHistory {
  id: string;
  user_id: string;
  scheduled_post_id?: string;
  integration_id?: string;
  video_id?: string;
  platform: string;
  platform_post_id?: string;
  platform_post_url?: string;
  title?: string;
  status: 'success' | 'failed';
  error_message?: string;
  posted_at: string;
  metadata: Record<string, any>;
}

export interface Draft {
  id: string;
  user_id: string;
  integration_id?: string;
  video_id?: string;
  platform?: string;
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  privacy_status: 'public' | 'private' | 'unlisted';
  video_type: 'normal' | 'short';
  thumbnail_url?: string;
  made_for_kids: boolean;
  notify_subscribers: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}
