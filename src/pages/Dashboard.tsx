import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ApiKey, Integration, ScheduledPost } from '../types';
import { Copy, RefreshCw, Check, Link as LinkIcon, Calendar, History } from 'lucide-react';
import Layout from '../components/Layout';

export default function Dashboard() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [stats, setStats] = useState({
    integrations: 0,
    scheduled: 0,
    posted: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [apiKeyRes, integrationsRes, scheduledRes, historyRes] = await Promise.all([
        supabase.from('api_keys').select('*').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
        supabase.from('integrations').select('id').eq('user_id', user.id).eq('is_active', true),
        supabase.from('scheduled_posts').select('id').eq('user_id', user.id).eq('status', 'pending'),
        supabase.from('post_history').select('id').eq('user_id', user.id),
      ]);

      if (apiKeyRes.data) {
        setApiKey(apiKeyRes.data);
      }

      setStats({
        integrations: integrationsRes.data?.length || 0,
        scheduled: scheduledRes.data?.length || 0,
        posted: historyRes.data?.length || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const regenerateApiKey = async () => {
    if (!user || !confirm('Are you sure you want to regenerate your API key? The old key will stop working.')) {
      return;
    }

    setRegenerating(true);
    try {
      if (apiKey) {
        await supabase.from('api_keys').update({ is_active: false }).eq('id', apiKey.id);
      }

      const newKey = 'mp_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          user_id: user.id,
          key: newKey,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      setApiKey(data);
    } catch (error) {
      console.error('Error regenerating API key:', error);
      alert('Failed to regenerate API key');
    } finally {
      setRegenerating(false);
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard</h1>
          <p className="text-slate-600">Welcome back! Here's your overview.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <LinkIcon className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-slate-900">{stats.integrations}</span>
            </div>
            <h3 className="text-slate-600 font-medium">Connected Accounts</h3>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-3xl font-bold text-slate-900">{stats.scheduled}</span>
            </div>
            <h3 className="text-slate-600 font-medium">Scheduled Posts</h3>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <History className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-3xl font-bold text-slate-900">{stats.posted}</span>
            </div>
            <h3 className="text-slate-600 font-medium">Posted Videos</h3>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Your API Key</h2>
          <p className="text-slate-600 mb-4">
            Use this key to access the ManyPost API programmatically.
          </p>

          {apiKey ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={apiKey.key}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <button
                onClick={regenerateApiKey}
                disabled={regenerating}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                {regenerating ? 'Regenerating...' : 'Regenerate API Key'}
              </button>
            </div>
          ) : (
            <p className="text-slate-500">No API key found. Please contact support.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
