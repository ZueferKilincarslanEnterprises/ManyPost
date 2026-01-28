import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Video as VideoType } from '../types';
import { Upload, Trash2, AlertCircle, Play, Loader2, Video as VideoIcon } from 'lucide-react';
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
      // 1. Signierte URL für das Video anfragen
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-r2-signed-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ fileName: file.name, contentType: file.type })
      });

      const signData = await response.json();
      if (signData.error) throw new Error(signData.error);

      // 2. Video hochladen (Nur eine Datei!)
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signData.signedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => xhr.status === 200 ? resolve(true) : reject();
        xhr.onerror = reject;
      });

      xhr.send(file);
      await uploadPromise;

      const videoUrl = signData.signedUrl.split('?')[0];

      // 3. In Datenbank speichern (thumbnail_url zeigt auf das Video mit Zeitstempel)
      const { error: dbError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          r2_url: videoUrl,
          r2_key: signData.r2Key,
          thumbnail_url: `${videoUrl}#t=1.5`, // Trick: Zeige Sekunde 1.5 als Vorschaubild
          upload_status: 'completed',
          uploaded_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;
      loadVideos();
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Upload fehlgeschlagen: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteVideo = async (video: VideoType) => {
    if (!confirm('Video löschen?')) return;
    try {
      if (video.r2_key && session) {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-r2-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ r2Key: video.r2_key, videoId: video.id })
        });
      }
      await supabase.from('videos').delete().eq('id', video.id);
      loadVideos();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Videos</h1>
            <p className="text-slate-600">Verwalte deine Bibliothek (Direkt-Streaming von Cloudflare)</p>
          </div>
          <label className={`flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {uploading ? `Upload (${uploadProgress}%)...` : 'Video hochladen'}
            <input type="file" accept="video/*" onChange={handleFileSelect} disabled={uploading} className="hidden" />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <VideoIcon className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Keine Videos gefunden</h3>
            <p className="text-slate-600">Lade dein erstes Video direkt zu Cloudflare hoch.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {videos.map((video) => (
              <div 
                key={video.id} 
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition"
                onMouseEnter={() => videoRefs.current[video.id]?.play()}
                onMouseLeave={() => {
                  const v = videoRefs.current[video.id];
                  if (v) {
                    v.pause();
                    v.currentTime = 1.5;
                  }
                }}
              >
                <div className="relative aspect-video bg-black">
                  <video
                    ref={(el) => (videoRefs.current[video.id] = el)}
                    src={`${video.r2_url}#t=1.5`}
                    className="w-full h-full object-contain"
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 pointer-events-none">
                    <Play className="w-12 h-12 text-white" />
                  </div>
                </div>
                
                <div className="p-5">
                  <h3 className="font-bold text-slate-900 mb-4 truncate">{video.file_name}</h3>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="text-xs text-slate-500">
                      {(video.file_size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    <button 
                      onClick={() => deleteVideo(video)} 
                      className="p-2 text-slate-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-5 h-5" />
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