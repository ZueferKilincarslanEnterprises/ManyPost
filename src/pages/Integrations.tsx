import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; // Link importieren
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Integration } from '../types';
import { Plus, Youtube, Instagram, Music, Trash2, AlertCircle, CheckCircle, BarChart3 } from 'lucide-react';
import Layout from '../components/Layout';

export default function Integrations() {
  const { user, session } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const channel = params.get('channel');

    if (success === 'youtube' && channel) {
      setSuccessMessage(`Successfully connected YouTube: ${channel}`);
      window.history.replaceState({}, '', '/integrations');
      setTimeout(() => setSuccessMessage(''), 5000);
    }

    loadIntegrations();
  }, [user]);

  const loadIntegrations = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .order('connected_at', { ascending: false });
      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const disconnectIntegration = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return;
    try {
      const { error } = await supabase.from('integrations').delete().eq('id', id);
      if (error) throw error;
      loadIntegrations();
    } catch (error) {
      console.error('Error disconnecting integration:', error);
    }
  };

  const connectYouTube = async () => {
    if (!user || !session) return;
    try {
      const callbackUrl = `${window.location.origin}/youtube-oauth`;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-oauth?action=init&redirect_uri=${encodeURIComponent(callbackUrl)}`,
        { 
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      window.location.href = data.authUrl;
    } catch (error) {
      alert(`Failed to connect YouTube: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube': return <Youtube className="w-6 h-6 text-red-600" />;
      case 'instagram': return <Instagram className="w-6 h-6 text-pink-600" />;
      case 'tiktok': return <Music className="w-6 h-6 text-slate-900" />;
      default: return null;
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Integrations</h1>
            <p className="text-slate-600">Connect your social media accounts</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
            Add Account
          </button>
        </div>

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : integrations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No accounts connected</h3>
            <p className="text-slate-600 mb-6">Connect your first account to start scheduling</p>
            <button onClick={() => setShowAddModal(true)} className="px-6 py-3 bg-blue-600 text-white rounded-lg">Add Account</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrations.map((integration) => (
              <div key={integration.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-slate-100 p-3 rounded-lg">{getPlatformIcon(integration.platform)}</div>
                  <button onClick={() => disconnectIntegration(integration.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-5 h-5" /></button>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{integration.channel_name}</h3>
                <p className="text-sm text-slate-500 mb-4">{integration.channel_id}</p>
                
                <div className="mb-4">
                  <Link 
                    to={`/analytics?integration_id=${integration.id}`}
                    className="flex items-center justify-center gap-2 w-full py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-lg transition text-sm font-medium"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Statistiken anzeigen
                  </Link>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">Connected {new Date(integration.connected_at).toLocaleDateString()}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${integration.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {integration.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Add Account</h2>
              <div className="space-y-3">
                <button
                  onClick={() => { setShowAddModal(false); connectYouTube(); }}
                  className="w-full flex items-center gap-4 p-4 border-2 border-slate-200 hover:border-blue-500 rounded-lg transition"
                >
                  <Youtube className="w-8 h-8 text-red-600" />
                  <div className="text-left">
                    <div className="font-semibold text-slate-900">YouTube</div>
                    <div className="text-sm text-slate-500">Connect your channel</div>
                  </div>
                </button>
              </div>
              <button onClick={() => setShowAddModal(false)} className="mt-6 w-full px-4 py-3 border border-slate-300 text-slate-700 rounded-lg">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}