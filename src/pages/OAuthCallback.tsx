import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        if (!user) {
          setStatus('error');
          setMessage('Not authenticated');
          return;
        }

        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(error === 'access_denied' ? 'Authorization denied' : 'OAuth error');
          return;
        }

        if (!code || state !== user.id) {
          setStatus('error');
          setMessage('Invalid callback');
          return;
        }

        const token = await supabase.auth.getSession().then(({ data }) => data.session?.access_token);
        if (!token) throw new Error('No authentication token');

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-oauth?action=callback&code=${code}&state=${state}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const result = await response.json();

        if (!response.ok || result.error) {
          setStatus('error');
          setMessage(result.error || 'Failed to connect');
          return;
        }

        setStatus('success');
        setMessage(`Connected to ${result.channel.name}`);

        setTimeout(() => {
          navigate('/integrations');
        }, 2000);
      } catch (err: any) {
        console.error('Callback error:', err);
        setStatus('error');
        setMessage(err.message || 'Failed to process callback');
      }
    };

    handleCallback();
  }, [user, searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Connecting YouTube</h2>
              <p className="text-slate-600">Please wait...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Success!</h2>
              <p className="text-slate-600">{message}</p>
              <p className="text-sm text-slate-500 mt-4">Redirecting...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Connection Failed</h2>
              <p className="text-red-600 mb-6">{message}</p>
              <button
                onClick={() => navigate('/integrations')}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
              >
                Back to Integrations
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
