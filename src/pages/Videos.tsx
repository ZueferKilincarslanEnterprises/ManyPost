import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Video as VideoType } from '../types';
import { Upload, Trash2, AlertCircle, Play, Loader2, Image as ImageIcon } from 'lucide-react';
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

  const extractThumbnail = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        // Springe zu Sekunde 1 für ein besseres Vorschaubild
        video.currentTime = 1;
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(video.src);
          if (blob) resolve(blob);
          else reject(new Error('Thumbnail generation failed'));
        }, 'image/jpeg', 0.8);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Could not load video for thumbnail'));
      };
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !session) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // 1. Thumbnail generieren
      console.log('Generating thumbnail...');
      const thumbnailBlob = await extractThumbnail(file).catch(err => {
        console.warn('Thumbnail generation failed, continuing without it:', err);
        return null;
      });

      // 2. Signierte URLs für beides anfragen
      const requests = [
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-r2-signed-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ fileName: file.name, contentType: file.type })
        }).then(r => r.json())
      ];

      if (thumbnailBlob) {
        requests.push(
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-r2-signed-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ fileName: `${file.name.split('.')[0]}.jpg`, contentType: 'image/jpeg' })
          }).then(r => r.json())
        );
      }

      const [videoSign, thumbSign] = await Promise.all(requests);
      
      if (videoSign.error) throw new Error(videoSign.error);

      // 3. Video hochladen
      const videoXhr = new XMLHttpRequest();
      videoXhr.open('PUT', videoSign.signedUrl, true);
      videoXhr.setRequestHeader('Content-Type', file.type);
      videoXhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      
      const videoUpload = new Promise((resolve, reject) => {
        videoXhr.onload = () => videoXhr.status === 200 ? resolve(true) : reject();
        videoXhr.onerror = reject;
      });
      videoXhr.send(file);
      await videoUpload;

      // 4. Thumbnail hochladen (falls vorhanden)
      let thumbUrl = null;
      if (thumbnailBlob && thumbSign && !thumbSign.error) {
        await fetch(thumbSign.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: thumbnailBlob
        });
        thumbUrl = thumbSign.signedUrl.split('?')[0];
      }

      const videoUrl = videoSign.signedUrl.split('?')[0];

      // 5. In Datenbank speichern
      const { error: dbError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          r2_url: videoUrl,
          r2_key: videoSign.r2Key,
          thumbnail_url: thumbUrl,
          upload_status: 'completed',
          uploaded_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;
      loadVideos();
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteVideo = async (video: VideoType) => {
    if (!confirm('Video endgültig löschen?')) return;
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Videos</h1>
            <p className="text-slate-600">Lade Videos hoch und verwalte deine Bibliothek</p>
          </div>
          <label className={`flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {uploading ? `Lädt hoch (${uploadProgress}%)...` : 'Video hochladen'}
            <input type="file" accept="video/*" onChange={handleFileSelect} disabled={uploading} className="hidden" />
          </label>
        </div>

        {uploading && (
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-xl animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-700">Video wird verarbeitet...</span>
              <span className="text-sm font-bold text-blue-700">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Deine Bibliothek ist leer</h3>
            <p className="text-slate-600">Lade ein Video hoch, um mit dem Planen zu beginnen.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {videos.map((video) => (
              <div 
                key={video.id} 
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition"
                onMouseEnter={() => videoRefs.current[video.id]?.play().catch(() => {})}
                onMouseLeave={() => {
                  if (videoRefs.current[video.id]) {
                    videoRefs.current[video.id]!.pause();
                    videoRefs.current[video.id]!.currentTime = 1;
                  }
                }}
              >
                <div className="relative aspect-video bg-slate-900">
                  {video.thumbnail_url ? (
                    <img 
                      src={video.thumbnail_url} 
                      className="w-full h-full object-cover group-hover:opacity-0 transition-opacity duration-300" 
                      alt="Thumbnail"
                    />
                  ) : null}
                  
                  <video
                    ref={(el) => (videoRefs.current[video.id] = el)}
                    src={`${video.r2_url}#t=1`}
                    className={`absolute inset-0 w-full h-full object-cover ${video.thumbnail_url ? 'opacity-0 group-hover:opacity-100' : ''} transition-opacity duration-300`}
                    muted
                    playsInline
                    preload="metadata"
                  />
                  
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <Play className="w-12 h-12 text-white drop-shadow-lg" />
                  </div>
                </div>
                
                <div className="p-5">
                  <h3 className="font-bold text-slate-900 mb-1 truncate" title={video.file_name}>{video.file_name}</h3>
                  <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
                    <span>{formatFileSize(video.file_size)}</span>
                    <span>•</span>
                    <span>{new Date(video.uploaded_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Bereit
                    </span>
                    <button 
                      onClick={() => deleteVideo(video)} 
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
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