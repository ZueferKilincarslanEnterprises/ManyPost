import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Integration, Video as VideoType, Draft, ScheduledPost } from '../types';
import { Calendar, AlertCircle, Save } from 'lucide-react';
import Layout from '../components/Layout';

const YOUTUBE_CATEGORIES = [
  { id: '1', name: 'Film & Animation' },
  { id: '2', name: 'Autos & Vehicles' },
  { id: '10', name: 'Music' },
  { id: '15', name: 'Pets & Animals' },
  { id: '17', name: 'Sports' },
  { id: '19', name: 'Travel & Events' },
  { id: '20', name: 'Gaming' },
  { id: '22', name: 'People & Blogs' },
  { id: '23', name: 'Comedy' },
  { id: '24', name: 'Entertainment' },
  { id: '25', name: 'News & Politics' },
  { id: '26', name: 'Howto & Style' },
  { id: '27', name: 'Education' },
  { id: '28', name: 'Science & Technology' },
];

export default function Schedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    integration_id: '',
    video_id: '',
    scheduled_time: '',
    title: '',
    description: '',
    tags: '',
    category: '28',
    privacy_status: 'public',
    video_type: 'normal',
    made_for_kids: false,
    notify_subscribers: true,
  });

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    const draft = location.state?.draft as Draft;
    const scheduledPost = location.state?.scheduledPost as ScheduledPost;

    if (draft || scheduledPost) {
      const source = draft || scheduledPost;
      if (scheduledPost) setEditingId(scheduledPost.id);

      // Zeit konvertieren für das datetime-local input
      let localTime = '';
      const timeToConvert = scheduledPost ? scheduledPost.scheduled_time : draft?.metadata?.scheduled_time;
      
      if (timeToConvert) {
        const date = new Date(timeToConvert);
        localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      }

      setFormData({
        integration_id: source.integration_id || '',
        video_id: source.video_id || '',
        scheduled_time: localTime,
        title: source.title || '',
        description: source.description || '',
        tags: Array.isArray(source.tags) ? source.tags.join(', ') : '',
        category: source.category || '28',
        privacy_status: source.privacy_status || 'public',
        video_type: (source.video_type as any) || 'normal',
        made_for_kids: !!source.made_for_kids,
        notify_subscribers: !!source.notify_subscribers,
      });
    }
  }, [location.state]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [integrationsRes, videosRes] = await Promise.all([
        supabase.from('integrations').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('videos').select('*').eq('user_id', user.id).eq('upload_status', 'completed'),
      ]);
      setIntegrations(integrationsRes.data || []);
      setVideos(videosRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      const integration = integrations.find(i => i.id === formData.integration_id);
      if (!integration) throw new Error('Integration not found');

      const scheduledIso = new Date(formData.scheduled_time).toISOString();

      const postData = {
        user_id: user.id,
        integration_id: formData.integration_id,
        video_id: formData.video_id,
        platform: integration.platform,
        scheduled_time: scheduledIso,
        status: 'pending',
        title: formData.title,
        description: formData.description,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
        category: formData.category,
        privacy_status: formData.privacy_status,
        video_type: formData.video_type,
        made_for_kids: formData.made_for_kids,
        notify_subscribers: formData.notify_subscribers,
      };

      if (editingId) {
        const { error } = await supabase
          .from('scheduled_posts')
          .update(postData)
          .eq('id', editingId);
        if (error) throw error;
        alert('Post erfolgreich aktualisiert!');
      } else {
        const { error } = await supabase.from('scheduled_posts').insert(postData);
        if (error) throw error;
        alert('Post erfolgreich geplant!');
      }

      if (location.state?.draft?.id) {
        await supabase.from('drafts').delete().eq('id', location.state.draft.id);
      }

      navigate('/scheduled');
    } catch (error) {
      console.error('Error scheduling post:', error);
      alert('Fehler beim Speichern des Posts');
    } finally {
      setSubmitting(false);
    }
  };

  const saveDraft = async () => {
    if (!user) return;
    try {
      const integration = integrations.find(i => i.id === formData.integration_id);
      const scheduledIso = formData.scheduled_time ? new Date(formData.scheduled_time).toISOString() : null;

      const draftData = {
        user_id: user.id,
        integration_id: formData.integration_id || null,
        video_id: formData.video_id || null,
        platform: integration?.platform || null,
        title: formData.title || null,
        description: formData.description || null,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
        category: formData.category,
        privacy_status: formData.privacy_status as any,
        video_type: formData.video_type as any,
        made_for_kids: formData.made_for_kids,
        notify_subscribers: formData.notify_subscribers,
        metadata: { scheduled_time: scheduledIso }
      };

      if (location.state?.draft?.id) {
        const { error } = await supabase
          .from('drafts')
          .update(draftData)
          .eq('id', location.state.draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('drafts').insert(draftData);
        if (error) throw error;
      }

      alert('Entwurf gespeichert!');
      navigate('/drafts');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Fehler beim Speichern des Entwurfs');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {editingId ? 'Post bearbeiten' : 'Post planen'}
          </h1>
          <p className="text-slate-600">
            {editingId ? 'Ändere die Details deines geplanten Posts' : 'Erstelle einen neuen geplanten Post'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ... Gleiches Formular wie zuvor, aber mit dynamischem Button-Text ... */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Account auswählen</label>
              <select
                required
                value={formData.integration_id}
                onChange={(e) => setFormData({ ...formData, integration_id: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Wähle einen Account...</option>
                {integrations.map((integration) => (
                  <option key={integration.id} value={integration.id}>
                    {integration.platform.toUpperCase()} - {integration.channel_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Video auswählen</label>
              <select
                required
                value={formData.video_id}
                onChange={(e) => setFormData({ ...formData, video_id: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Wähle ein Video...</option>
                {videos.map((video) => (
                  <option key={video.id} value={video.id}>{video.file_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Datum & Uhrzeit</label>
              <input
                type="datetime-local"
                required
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Titel <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                maxLength={100}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Video Titel"
              />
              <p className="text-sm text-slate-500 mt-1">{formData.title.length}/100 Zeichen</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Beschreibung</label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Video Beschreibung"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tags (mit Komma getrennt)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="tag1, tag2, tag3"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Kategorie</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {YOUTUBE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sichtbarkeit</label>
                <select
                  value={formData.privacy_status}
                  onChange={(e) => setFormData({ ...formData, privacy_status: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="public">Öffentlich</option>
                  <option value="unlisted">Nicht gelistet</option>
                  <option value="private">Privat</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {editingId ? <Save className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                {submitting ? 'Wird gespeichert...' : editingId ? 'Änderungen speichern' : 'Post planen'}
              </button>
              {!editingId && (
                <button
                  type="button"
                  onClick={saveDraft}
                  className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition"
                >
                  Entwurf speichern
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}