import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ApiKey, Integration, ScheduledPost } from '../types';
import { Copy, RefreshCw, Check, Link as LinkIcon, Calendar, History, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import Layout from '../components/Layout';

export default function Dashboard() {
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<{ [key: string]: boolean }>({});
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
      const [apiKeysRes, integrationsRes, scheduledRes, historyRes] = await Promise.all([
        supabase.from('api_keys').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('integrations').select('id').eq('user_id', user.id).eq('is_active', true),
        supabase.from('scheduled_posts').select('id').eq('user_id', user.id).eq('status', 'pending'),
        supabase.from('post_history').select('id').eq('user_id', user.id),
      ]);

      if (apiKeysRes.data) {
        setApiKeys(apiKeysRes.data);
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

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const createNewKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !keyName.trim()) return;

    setCreatingKey(true);
    try {
      const newKey = 'mp_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          user_id: user.id,
          key: newKey,
          name: keyName,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      setApiKeys([...apiKeys, data]);
      setKeyName('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating API key:', error);
      alert('Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  const deleteKey = async (keyId: string) => {
    if (!confirm('Delete this API key?')) return;

    try {
      await supabase.from('api_keys').update({ is_active: false }).eq('id', keyId);
      setApiKeys(apiKeys.filter(k => k.id !== keyId));
    } catch (error) {
      console.error('Error deleting API key:', error);
      alert('Failed to delete API key');
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">API Keys</h2>
              <p className="text-slate-600 text-sm mt-1">Manage your API keys for programmatic access.</p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Create Key
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={createNewKey} className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Key Name</label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g., Production, Testing"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creatingKey}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {creatingKey ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setKeyName('');
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {apiKeys.length > 0 ? (
            <div className="space-y-3">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-slate-900">{apiKey.name}</h3>
                      <p className="text-xs text-slate-500">
                        Created {new Date(apiKey.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteKey(apiKey.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type={visibleKeys[apiKey.id] ? 'text' : 'password'}
                      readOnly
                      value={apiKey.key}
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded font-mono text-xs"
                    />
                    <button
                      onClick={() => setVisibleKeys({ ...visibleKeys, [apiKey.id]: !visibleKeys[apiKey.id] })}
                      className="px-3 py-2 text-slate-600 hover:bg-slate-200 rounded transition"
                    >
                      {visibleKeys[apiKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(apiKey.key)}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition flex items-center gap-1"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No API keys yet. Create one to get started.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
