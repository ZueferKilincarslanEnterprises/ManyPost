import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TrendingUp, Users, ThumbsUp, RefreshCw, ChevronLeft } from 'lucide-react';
import Layout from '../components/Layout';

interface VideoStatSummary {
  post_id: string;
  title: string;
  platform_post_id: string;
  current_views: number;
  current_likes: number;
  current_comments: number;
  last_updated: string;
}

export default function Analytics() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState<VideoStatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [integrationName, setIntegrationName] = useState<string | null>(null);

  const integrationId = searchParams.get('integration_id');

  useEffect(() => {
    loadAnalytics();
    if (integrationId) {
      loadIntegrationInfo();
    } else {
      setIntegrationName(null);
    }
  }, [user, integrationId]);

  const loadIntegrationInfo = async () => {
    const { data } = await supabase
      .from('integrations')
      .select('channel_name')
      .eq('id', integrationId)
      .single();
    if (data) setIntegrationName(data.channel_name);
  };

  const loadAnalytics = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('post_history')
        .select(`
          id,
          title,
          platform_post_id,
          integration_id,
          posted_at,
          video_stats (
            view_count,
            like_count,
            comment_count,
            captured_at
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'success');

      if (integrationId) {
        query = query.eq('integration_id', integrationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedStats = (data || []).map(post => {
        const latest = post.video_stats && Array.isArray(post.video_stats) 
          ? [...post.video_stats].sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())[0]
          : null;

        return {
          post_id: post.id,
          title: post.title || 'Unbenanntes Video',
          platform_post_id: post.platform_post_id || '',
          current_views: latest?.view_count || 0,
          current_likes: latest?.like_count || 0,
          current_comments: latest?.comment_count || 0,
          last_updated: latest?.captured_at || post.posted_at
        };
      });

      setStats(formattedStats.sort((a, b) => b.current_views - a.current_views));
    } catch (error) {
      console.error('Fehler beim Laden der Analysen:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-video-stats');
      if (error) throw error;
      await loadAnalytics();
      alert('Statistiken wurden erfolgreich aktualisiert!');
    } catch (error: any) {
      alert('Fehler beim Synchronisieren: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const totalViews = stats.reduce((sum, s) => sum + s.current_views, 0);
  const totalLikes = stats.reduce((sum, s) => sum + s.current_likes, 0);

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2 text-blue-600">
              {integrationId && (
                <Link to="/integrations" className="hover:underline flex items-center gap-1 text-sm font-medium">
                  <ChevronLeft className="w-4 h-4" /> Zurück zu Kanälen
                </Link>
              )}
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              {integrationName ? `Analysen: ${integrationName}` : 'Gesamt-Analysen'}
            </h1>
            <p className="text-slate-600">
              {integrationName 
                ? `Performance-Daten für deinen Kanal ${integrationName}` 
                : 'Performance deiner veröffentlichten Videos über alle Kanäle'}
            </p>
          </div>
          <div className="flex gap-3">
            {integrationId && (
              <Link 
                to="/analytics" 
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
              >
                Alle Kanäle zeigen
              </Link>
            )}
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronisiere...' : 'Jetzt aktualisieren'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-slate-600 font-medium">Gesamt-Aufrufe</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900">{totalViews.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-pink-100 p-2 rounded-lg text-pink-600">
                <ThumbsUp className="w-5 h-5" />
              </div>
              <h3 className="text-slate-600 font-medium">Gesamt-Likes</h3>
            </div>
            <p className="text-3xl font-bold text-slate-900">{totalLikes.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-slate-600 font-medium">Beste Performance</h3>
            </div>
            <p className="text-lg font-bold text-slate-900 truncate">
              {stats[0]?.title || 'Keine Daten'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Video Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-sm font-medium uppercase">
                <tr>
                  <th className="px-6 py-4">Video Titel</th>
                  <th className="px-6 py-4">Aufrufe</th>
                  <th className="px-6 py-4">Likes</th>
                  <th className="px-6 py-4">Kommentare</th>
                  <th className="px-6 py-4">Zuletzt geprüft</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.map((video) => (
                  <tr key={video.post_id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{video.title}</div>
                      <div className="text-xs text-slate-500 font-mono">{video.platform_post_id}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-semibold">
                      {video.current_views.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {video.current_likes.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {video.current_comments.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(video.last_updated).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {stats.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Keine Statistiken für diesen Filter verfügbar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}