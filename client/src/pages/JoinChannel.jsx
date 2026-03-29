import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@services/api';

export default function JoinChannel() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('');
    const [channelData, setChannelData] = useState(null);

    useEffect(() => {
        const joinChannel = async () => {
            const channelId = searchParams.get('channel');
            const workspaceId = searchParams.get('workspace');

            if (!channelId || !workspaceId) {
                setStatus('error');
                setMessage('Invalid channel link');
                return;
            }

            try {
                const res = await api.post(`/api/channels/${channelId}/join-via-link`);
                setStatus('success');
                setMessage(res.data.message);
                setChannelData(res.data.channel);

                setTimeout(() => {
                    navigate(`/workspace/${workspaceId}/home/channel/${channelId}`);
                }, 2000);
            } catch (err) {
                setStatus('error');
                setMessage(err.response?.data?.message || 'Failed to join channel');
            }
        };

        joinChannel();
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white rounded-xl p-8 shadow-lg max-w-md w-full">
                {status === 'loading' && (
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Joining channel...</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Success!</h2>
                        <p className="text-gray-600 mb-4">{message}</p>
                        <p className="text-sm text-gray-500">Redirecting to #{channelData?.name}...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Join</h2>
                        <p className="text-gray-600 mb-4">{message}</p>
                        <button
                            onClick={() => navigate('/workspace')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Go to Workspaces
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
