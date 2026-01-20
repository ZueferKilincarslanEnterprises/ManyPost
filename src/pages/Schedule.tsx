import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Integration, Video as VideoType } from '../types';
import { Calendar, AlertCircle } from 'lucide-react';
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
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

      const { error } = await supabase.from('scheduled_posts').insert({
        user_id: user.id,
        integration_id: formData.integration_id,
        video_id: formData.video_id,
        platform: integration.platform,
        scheduled_time: formData.scheduled_time,
        status: 'pending',
        title: formData.title,
        description: formData.description,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
        category: formData.category,
        privacy_status: formData.privacy_status,
        video_type: formData.video_type,
        made_for_kids: formData.made_for_kids,
        notify_subscribers: formData.notify_subscribers,
      });

      if (error) throw error;

      alert('Post scheduled successfully!');
      navigate('/scheduled');
    } catch (error) {
      console.error('Error scheduling post:', error);
      alert('Failed to schedule post');
    } finally {
      setSubmitting(false);
    }
  };

  const saveDraft = async () => {
    if (!user) return;

    try {
      const integration = integrations.find(i => i.id === formData.integration_id);

      const { error } = await supabase.from('drafts').insert({
        user_id: user.id,
        integration_id: formData.integration_id || null,
        video_id: formData.video_id || null,
        platform: integration?.platform || null,
        title: formData.title || null,
        description: formData.description || null,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
        category: formData.category,
        privacy_status: formData.privacy_status,
        video_type: formData.video_type,
        made_for_kids: formData.made_for_kids,
        notify_subscribers: formData.notify_subscribers,
      });

      if (error) throw error;
      alert('Draft saved successfully!');
      navigate('/drafts');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save draft');
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

  if (integrations.length === 0 || videos.length === 0) {
    return (
      <Layout>
        <div className="p-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Unable to Schedule Post</h3>
            <p className="text-slate-600 mb-6">
              {integrations.length === 0 && 'You need to connect at least one social media account. '}
              {videos.length === 0 && 'You need to upload at least one video. '}
            </p>
            <div className="flex gap-3 justify-center">
              {integrations.length === 0 && (
                <button
                  onClick={() => navigate('/integrations')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                >
                  Connect Account
                </button>
              )}
              {videos.length === 0 && (
                <button
                  onClick={() => navigate('/videos')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                >
                  Upload Video
                </button>
              )}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Schedule Post</h1>
          <p className="text-slate-600">Create a new scheduled post for your social media</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Account
              </label>
              <select
                required
                value={formData.integration_id}
                onChange={(e) => setFormData({ ...formData, integration_id: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose an account...</option>
                {integrations.map((integration) => (
                  <option key={integration.id} value={integration.id}>
                    {integration.platform.toUpperCase()} - {integration.channel_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Video
              </label>
              <select
                required
                value={formData.video_id}
                onChange={(e) => setFormData({ ...formData, video_id: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a video...</option>
                {videos.map((video) => (
                  <option key={video.id} value={video.id}>
                    {video.file_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Schedule Date & Time
              </label>
              <input
                type="datetime-local"
                required
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter video title"
              />
              <p className="text-sm text-slate-500 mt-1">{formData.title.length}/100 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter video description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tags (comma-separated)
              </label>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {YOUTUBE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Privacy
                </label>
                <select
                  value={formData.privacy_status}
                  onChange={(e) => setFormData({ ...formData, privacy_status: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Video Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="normal"
                    checked={formData.video_type === 'normal'}
                    onChange={(e) => setFormData({ ...formData, video_type: e.target.value })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span>Normal Video</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="short"
                    checked={formData.video_type === 'short'}
                    onChange={(e) => setFormData({ ...formData, video_type: e.target.value })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span>YouTube Short</span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.made_for_kids}
                  onChange={(e) => setFormData({ ...formData, made_for_kids: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-slate-700">Made for kids</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.notify_subscribers}
                  onChange={(e) => setFormData({ ...formData, notify_subscribers: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-slate-700">Notify subscribers</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                <Calendar className="w-5 h-5" />
                {submitting ? 'Scheduling...' : 'Schedule Post'}
              </button>
              <button
                type="button"
                onClick={saveDraft}
                className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition"
              >
                Save Draft
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
