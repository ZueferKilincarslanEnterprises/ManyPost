import { useEffect, useState, useRef } from 'react';
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
  const processing = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Verhindert doppelte Ausführung in React Strict Mode
      if (processing.current) return;
      
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (!user || !code) return;

      processing.current = true;

      try {
        if (error) {
          setStatus('error');
          setMessage(error === 'access_denied' ? 'Authorization denied' : 'OAuth error');
          return;
        }

        if (state !== user.id) {
          setStatus('error');
          setMessage('Invalid callback session (state mismatch)');
          return;
        }

        console.log("Processing YouTube OAuth callback...");

        // Die redirect_uri muss EXAKT die sein, die auch beim Login verwendet wurde
        const currentCallbackUrl = `${window.location.origin}/youtube-oauth`;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-oauth?action=callback&code=${code}&state=${state}&redirect_uri=${encodeURIComponent(currentCallbackUrl)}`,
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );

        const result = await response.json();
        
        if (!response.ok || result.error) {
          console.error("OAuth Error Result:", result);
          throw new Error(result.error || 'Connection failed');
        }

        setStatus('success');
        setMessage(`Successfully connected: ${result.channel.name}`);
        
        // Kurze Pause für die Erfolgsmeldung
        setTimeout(() => navigate('/integrations'), 2000);
      } catch (err: any) {
        console.error("Callback catch error:", err);
        setStatus('error');
        setMessage(err.message || 'Failed to process callback');
      }
    };

    if (user && searchParams.get('code')) {
      handleCallback();
    }
  }, [user, searchParams, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {status === 'loading' && (
          <div className="space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-xl font-bold text-slate-900">Finalizing Connection</h2>
            <p className="text-slate-600">Please wait while we link your YouTube account...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="space-y-4">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Success!</h2>
            <p className="text-slate-600">{message}</p>
            <p className="text-sm text-slate-400">Redirecting to integrations...</p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="space-y-4">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Connection Failed</h2>
            <p className="text-red-600">{message}</p>
            <div className="pt-4">
              <button 
                onClick={() => navigate('/integrations')} 
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
              >
                Back to Integrations
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}