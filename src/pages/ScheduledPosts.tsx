import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ScheduledPost, Integration, Video as VideoType } from '../types';
import { Clock, X, Play, AlertCircle, Youtube, Loader2 } from 'lucide-react';
import Layout from '../components/Layout';

interface ScheduledPostWithDetails extends ScheduledPost {
  integration?: Integration;
  video?: VideoType;
}

export default function ScheduledPosts() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ScheduledPostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
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
        .select(`*, integration:integrations(*), video:videos(*)`)
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
    if (!confirm('Are you sure you want to cancel this scheduled post?')) return;
    try {
      const { error } = await supabase.from('scheduled_posts').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      loadPosts();
    } catch (error) {
      console.error('Error cancelling post:', error);
    }
  };

  const postNow = async (id: string) => {
    if (!confirm('Are you sure you want to post this immediately?')) return;
    
    setProcessingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-publisher', {
        body: { scheduled_post_id: id }
      });

      if (error || data?.error) {
        throw new Error(data?.error || 'Publishing failed');
      }

      alert('Successfully published to YouTube!');
      loadPosts();
    } catch (error: any) {
      console.error('Error posting now:', error);
      alert('Failed to publish: ' + error.message);
      loadPosts(); // Refresh to see error status
    } finally {
      setProcessingId(null);
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

  const filteredPosts = filter === 'all' ? posts : posts.filter(p => p.status === filter);

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Scheduled Posts</h1>
            <p className="text-slate-600">Manage your upcoming scheduled posts</p>
          </div>
          <div className="flex gap-2">
            {['all', 'pending', 'processing', 'failed'].map((f) => (
              <button key={f} onClick={() => setFilter(f as any)} className={`px-4 py-2 rounded-lg font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'}`}>
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
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No scheduled posts</h3>
            <p className="text-slate-600">You don't have any posts scheduled yet</p>
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
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">{post.title}</h3>
                        <p className="text-sm text-slate-500">{post.integration?.channel_name} • {post.platform}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(post.status)}`}>
                        {post.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(post.scheduled_time).toLocaleString()}</span>
                      </div>
                      <span className="px-2 py-1 bg-slate-100 rounded">{post.privacy_status}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => postNow(post.id)}
                        disabled={post.status === 'processing' || processingId === post.id}
                        className="flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
                      >
                        {processingId === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        {processingId === post.id ? 'Publishing...' : 'Post Now'}
                      </button>
                      <button onClick={() => cancelPost(post.id)} className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition">
                        <X className="w-4 h-4" /> Cancel
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