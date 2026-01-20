import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PostHistory as PostHistoryType, Integration, Video as VideoType } from '../types';
import { CheckCircle, XCircle, AlertCircle, ExternalLink, Youtube } from 'lucide-react';
import Layout from '../components/Layout';

interface PostHistoryWithDetails extends PostHistoryType {
  integration?: Integration;
  video?: VideoType;
}

export default function PostHistory() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostHistoryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');

  useEffect(() => {
    loadHistory();
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('post_history')
        .select(`
          *,
          integration:integrations(*),
          video:videos(*)
        `)
        .eq('user_id', user.id)
        .order('posted_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading post history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = filter === 'all'
    ? posts
    : posts.filter(p => p.status === filter);

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Post History</h1>
            <p className="text-slate-600">View your published posts</p>
          </div>
          <div className="flex gap-2">
            {['all', 'success', 'failed'].map((f) => (
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
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No posts yet</h3>
            <p className="text-slate-600">Your published posts will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <div key={post.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    {post.video?.thumbnail_url ? (
                      <img
                        src={post.video.thumbnail_url}
                        alt={post.title || 'Video'}
                        className="w-48 h-27 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-48 h-27 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Youtube className="w-12 h-12 text-slate-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">
                          {post.title || 'Untitled'}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {post.integration?.channel_name} • {post.platform}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {post.status === 'success' ? (
                          <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <CheckCircle className="w-4 h-4" />
                            Success
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            <XCircle className="w-4 h-4" />
                            Failed
                          </span>
                        )}
                      </div>
                    </div>

                    {post.error_message && (
                      <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">{post.error_message}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                      <span>Posted {new Date(post.posted_at).toLocaleString()}</span>
                      {post.platform_post_id && (
                        <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                          ID: {post.platform_post_id}
                        </span>
                      )}
                    </div>

                    {post.platform_post_url && (
                      <a
                        href={post.platform_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View on {post.platform}
                      </a>
                    )}
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
