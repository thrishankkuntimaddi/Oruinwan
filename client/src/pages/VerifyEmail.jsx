// src/pages/VerifyEmail.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

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
          `${process.env.BACKEND_URL}/api/auth/verify-email?token=${encodeURIComponent(
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
        setTimeout(() => navigate('/login'), 2000);

      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Network error');
      }
    }

    verify();
  }, [token, email, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Email Verification</h2>

        {status === 'idle' && <p className="text-sm text-gray-600">Preparing verification...</p>}
        {status === 'sending' && <p className="text-sm text-gray-600">Verifying your email. Please wait...</p>}

        {status === 'success' && (
          <div>
            <p className="text-green-600 font-medium mb-2">{message}</p>
            <p className="text-sm text-gray-600">Redirecting to login...</p>
            <div className="mt-4">
              <button onClick={() => navigate('/login')} className="px-4 py-2 bg-blue-600 text-white rounded">
                Go to Login
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p className="text-red-600 font-medium mb-2">Verification failed</p>
            <p className="text-sm text-gray-600 mb-4">{message}</p>
            <div className="flex gap-2">
              <button onClick={() => navigate('/login')} className="px-4 py-2 bg-gray-200 rounded">
                Go to Login
              </button>
              <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded">
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
