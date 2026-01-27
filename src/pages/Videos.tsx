import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Video as VideoType } from '../types';
import { Upload, Trash2, AlertCircle, Play } from 'lucide-react';
import Layout from '../components/Layout';

export default function Videos() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const videoRefs = useRef<{[key: string]: HTMLVideoElement | null}>({});

  useEffect(() => {
    loadVideos();
  }, [user]);

  const loadVideos = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateThumbnail = (videoId: string) => {
    const video = videoRefs.current[videoId];
    if (!video) return;

    // Create canvas to capture frame
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg');
    }
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      // 1. Get a signed URL from the Edge Function
      const token = await supabase.auth.getSession().then(({ data }) => data.session?.access_token);
      if (!token) throw new Error('No authentication token');

      const signedUrlResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-r2-signed-url`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
          }),
        }
      );

      if (!signedUrlResponse.ok) {
        const errorData = await signedUrlResponse.json();
        throw new Error(errorData.error || 'Failed to get signed URL for R2 upload');
      }

      const { signedUrl, r2Key } = await signedUrlResponse.json();

      // 2. Upload the file directly to R2 using the signed URL
      const r2UploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!r2UploadResponse.ok) {
        throw new Error('Failed to upload video to Cloudflare R2');
      }

      // Construct the public R2 URL
      const R2_ACCOUNT_ID = import.meta.env.VITE_R2_ACCOUNT_ID;
      const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;
      const r2PublicUrl = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${R2_BUCKET_NAME}/${r2Key}`;

      // 3. Insert metadata into Supabase, including R2 details
      const { data, error } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          r2_url: r2PublicUrl, // Store the public URL
          r2_key: r2Key,       // Store the R2 key for future reference/deletion
          upload_status: 'completed',
          uploaded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      loadVideos();
      alert('Video erfolgreich hochgeladen!');
    } catch (error) {
      console.error('Fehler beim Hochladen des Videos:', error);
      alert(`Fehler beim Hochladen des Videos: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setUploading(false);
    }
  };

  const deleteVideo = async (id: string, r2Key: string) => {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    try {
      // 1. Delete the video from Cloudflare R2
      const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      
      const r2DeleteResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-r2-video`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            r2Key: r2Key,
          }),
        }
      );

      if (!r2DeleteResponse.ok) {
        const errorData = await r2DeleteResponse.json();
        console.error('Error deleting from R2:', errorData.error);
        throw new Error('Failed to delete video from storage');
      }

      // 2. Delete the video metadata from Supabase
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadVideos();
      alert('Video erfolgreich gelöscht!');
    } catch (error) {
      console.error('Error deleting video:', error);
      alert(`Fehler beim Löschen des Videos: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Videos</h1>
            <p className="text-slate-600">Upload and manage your video library</p>
          </div>
          <label className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition cursor-pointer">
            <Upload className="w-5 h-5" />
            {uploading ? 'Uploading...' : 'Upload Video'}
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No videos uploaded</h3>
            <p className="text-slate-600 mb-6">Upload your first video to start scheduling posts</p>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition cursor-pointer">
              <Upload className="w-5 h-5" />
              Upload Video
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div key={video.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="relative aspect-video bg-slate-900 flex items-center justify-center">
                  {video.r2_url ? (
                    <>
                      <video
                        ref={(el) => (videoRefs.current[video.id] = el)}
                        src={video.r2_url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Play className="w-12 h-12 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                      <AlertCircle className="w-12 h-12 text-slate-400" />
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 mb-2 truncate" title={video.file_name}>
                    {video.file_name}
                  </h3>

                  <div className="space-y-1 text-sm text-slate-600 mb-4">
                    <div>Size: {formatFileSize(video.file_size)}</div>
                    {video.duration && <div>Duration: {formatDuration(video.duration)}</div>}
                    <div>Uploaded: {new Date(video.uploaded_at).toLocaleDateString()}</div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      video.upload_status === 'completed' ? 'bg-green-100 text-green-700' :
                      video.upload_status === 'uploading' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {video.upload_status}
                    </span>
                    <button
                      onClick={() => deleteVideo(video.id, video.r2_key || '')}
                      className="text-slate-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}