import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token || !email) {
      setStatus('error');
      setMessage('Missing token or email in the URL.');
      return;
    }

    async function verify() {
      setStatus('sending');
      try {
        const res = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/api/auth/verify-email?token=${encodeURIComponent(
            token
          )}&email=${encodeURIComponent(email)}`,
          { credentials: 'include' }
        );

        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setMessage(data.message || 'Verification failed');
          return;
        }

        setStatus('success');
        setMessage(data.message || 'Email verified successfully');
        setTimeout(() => navigate('/login'), 3000);

      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Network error');
      }
    }

    verify();
  }, [token, email, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">

        {/* Header Icon */}
        <div className="flex justify-center mb-6">
          <div className={`p-4 rounded-full ${status === 'success' ? 'bg-green-100 text-green-600' :
            status === 'error' ? 'bg-red-100 text-red-600' :
              'bg-blue-100 text-blue-600'
            }`}>
            {status === 'success' ? <CheckCircle size={48} /> :
              status === 'error' ? <XCircle size={48} /> :
                status === 'sending' ? <Loader2 size={48} className="animate-spin" /> :
                  <Mail size={48} />
            }
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {status === 'success' ? 'Email Verified!' :
            status === 'error' ? 'Verification Failed' :
              'Verifying Email'}
        </h2>

        <p className="text-gray-500 mb-8">
          {status === 'idle' && 'Preparing to verify your email address...'}
          {status === 'sending' && 'Please wait while we verify your email address...'}
          {status === 'success' && message}
          {status === 'error' && message}
        </p>

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4 overflow-hidden">
              <div className="bg-green-500 h-1.5 rounded-full animate-[progress_3s_ease-in-out_forwards]" style={{ width: '100%' }}></div>
            </div>
            <p className="text-sm text-gray-400">Redirecting to login automatically...</p>
            <button
              onClick={() => navigate('/login')}
              className="text-blue-600 font-semibold hover:underline text-sm"
            >
              Go to Login Now
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={() => window.location.reload()}
              className="text-blue-600 font-semibold hover:underline text-sm"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/login')}
              className="text-gray-500 hover:text-gray-700 hover:underline text-sm"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
