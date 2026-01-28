import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Video as VideoType } from '../types';
import { Upload, Trash2, AlertCircle, Play, Loader2 } from 'lucide-react';
import Layout from '../components/Layout';

export default function Videos() {
  const { user, session } = useAuth();
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !session) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-r2-signed-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ fileName: file.name, contentType: file.type })
        }
      );

      const signData = await response.json();
      if (signData.error || !signData.signedUrl) throw new Error(signData.error || 'Failed to get upload URL');

      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signData.signedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => xhr.status === 200 ? resolve(true) : reject(new Error('Upload failed'));
        xhr.onerror = () => reject(new Error('Network error'));
      });

      xhr.send(file);
      await uploadPromise;

      const publicUrl = signData.signedUrl.split('?')[0];

      const { error: dbError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          r2_url: publicUrl,
          r2_key: signData.r2Key,
          upload_status: 'completed',
          uploaded_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;
      
      loadVideos();
    } catch (error: any) {
      console.error('Error uploading video:', error);
      alert('Failed to upload video: ' + error.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteVideo = async (video: VideoType) => {
    if (!confirm('Are you sure you want to delete this video?')) return;
    try {
      if (video.r2_key && session) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-r2-video`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ r2Key: video.r2_key, videoId: video.id })
          }
        );
      }
      const { error } = await supabase.from('videos').delete().eq('id', video.id);
      if (error) throw error;
      loadVideos();
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const handleMouseEnter = (id: string) => {
    const video = videoRefs.current[id];
    if (video) video.play().catch(() => {});
  };

  const handleMouseLeave = (id: string) => {
    const video = videoRefs.current[id];
    if (video) {
      video.pause();
      video.currentTime = 0.1;
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Videos</h1>
            <p className="text-slate-600">Upload and manage your video library</p>
          </div>
          <label className={`flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {uploading ? `Uploading ${uploadProgress}%...` : 'Upload Video'}
            <input type="file" accept="video/*" onChange={handleFileSelect} disabled={uploading} className="hidden" />
          </label>
        </div>

        {uploading && (
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-700">Uploading file...</span>
              <span className="text-sm font-bold text-blue-700">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

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
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div 
                key={video.id} 
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group"
                onMouseEnter={() => handleMouseEnter(video.id)}
                onMouseLeave={() => handleMouseLeave(video.id)}
              >
                <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                  {video.r2_url ? (
                    <>
                      <video
                        ref={(el) => (videoRefs.current[video.id] = el)}
                        src={`${video.r2_url}#t=0.1`}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 flex items-center justify-center transition-all">
                        <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                      <AlertCircle className="w-12 h-12 text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 mb-2 truncate" title={video.file_name}>{video.file_name}</h3>
                  <div className="space-y-1 text-sm text-slate-600 mb-4">
                    <div>Size: {formatFileSize(video.file_size)}</div>
                    <div>Uploaded: {new Date(video.uploaded_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className={`text-xs px-2 py-1 rounded-full ${video.upload_status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {video.upload_status}
                    </span>
                    <button onClick={() => deleteVideo(video)} className="text-slate-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
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