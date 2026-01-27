import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ScheduledPost, Integration, Video as VideoType } from '../types';
import { Clock, X, Play, AlertCircle, Youtube, Edit } from 'lucide-react';
import Layout from '../components/Layout';

interface ScheduledPostWithDetails extends ScheduledPost {
  integration?: Integration;
  video?: VideoType;
}

export default function ScheduledPosts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<ScheduledPostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'failed'>('all');

  useEffect(() => {
    loadPosts();
  }, [user]);

  const loadPosts = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_posts')
        .select(`
          *,
          integration:integrations(*),
          video:videos(*)
        `)
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing', 'failed'])
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const cancelPost = async (id: string) => {
    if (!confirm('Geplanten Post wirklich abbrechen?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('scheduled_posts')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      loadPosts();
    } catch (error) {
      console.error('Error cancelling post:', error);
      alert('Fehler beim Abbrechen');
    }
  };

  const editPost = (post: ScheduledPostWithDetails) => {
    navigate('/schedule', { state: { scheduledPost: post } });
  };

  const postNow = async (id: string) => {
    if (!confirm('Diesen Post jetzt sofort veröffentlichen?')) {
      return;
    }

    setLoading(true);
    try {
      // 1. Status in DB setzen
      const { error: updateError } = await supabase
        .from('scheduled_posts')
        .update({
          status: 'processing',
          scheduled_time: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // 2. Edge Function sofort triggern
      const token = await supabase.auth.getSession().then(({ data }) => data.session?.access_token);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-publisher`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scheduled_post_id: id }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Fehler beim Aufruf der Publisher-Funktion');
      }

      alert('Post wird jetzt veröffentlicht! Prüfe in Kürze die Post History.');
      loadPosts();
    } catch (error) {
      console.error('Error posting now:', error);
      alert(`Fehler beim Veröffentlichen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-blue-100 text-blue-700',
      processing: 'bg-yellow-100 text-yellow-700',
      failed: 'bg-red-100 text-red-700',
    };
    return styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700';
  };

  const getTimeUntil = (scheduledTime: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledTime);
    const diff = scheduled.getTime() - now.getTime();

    if (diff < 0) return 'Abgelaufen';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `in ${days}d ${hours}h`;
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  };

  const filteredPosts = filter === 'all'
    ? posts
    : posts.filter(p => p.status === filter);

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Geplante Posts</h1>
            <p className="text-slate-600">Verwalte deine anstehenden Veröffentlichungen</p>
          </div>
          <div className="flex gap-2">
            {['all', 'pending', 'processing', 'failed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Keine geplanten Posts</h3>
            <p className="text-slate-600">Du hast aktuell keine Posts in der Warteschlange.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <div key={post.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-48 h-27 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Youtube className="w-12 h-12 text-slate-400" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">
                          {post.title}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {post.integration?.channel_name} • {post.platform}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(post.status)}`}>
                        {post.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          {new Date(post.scheduled_time).toLocaleString()} ({getTimeUntil(post.scheduled_time)})
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => postNow(post.id)}
                        disabled={post.status === 'processing'}
                        className="flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
                      >
                        <Play className="w-4 h-4" />
                        Jetzt posten
                      </button>
                      <button
                        onClick={() => editPost(post)}
                        disabled={post.status === 'processing'}
                        className="flex items-center gap-1 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition disabled:opacity-50"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => cancelPost(post.id)}
                        disabled={post.status === 'processing'}
                        className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Abbrechen
                      </button>
                    </div>
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