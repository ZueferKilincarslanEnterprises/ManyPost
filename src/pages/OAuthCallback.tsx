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
        if (!user) return;

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
          setMessage('Invalid callback session');
          return;
        }

        // Wir müssen die EXAKT GLEICHE redirect_uri senden wie beim Login
        const currentCallbackUrl = `${window.location.origin}/youtube-oauth`;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-oauth?action=callback&code=${code}&state=${state}&redirect_uri=${encodeURIComponent(currentCallbackUrl)}`,
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );

        const result = await response.json();
        if (!response.ok || result.error) throw new Error(result.error || 'Connection failed');

        setStatus('success');
        setMessage(`Connected to ${result.channel.name}`);
        setTimeout(() => navigate('/integrations'), 2000);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Failed to process callback');
      }
    };

    handleCallback();
  }, [user, searchParams, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {status === 'loading' && (
          <><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p>Connecting YouTube...</p></>
        )}
        {status === 'success' && (
          <><CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" /><h2 className="text-xl font-bold">Success!</h2><p>{message}</p></>
        )}
        {status === 'error' && (
          <><AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" /><h2 className="text-xl font-bold">Failed</h2><p className="text-red-600">{message}</p><button onClick={() => navigate('/integrations')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Back</button></>
        )}
      </div>
    </div>
  );
}