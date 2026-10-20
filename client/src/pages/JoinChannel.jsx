import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '@services/api';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import AuthShell from '../components/public/AuthShell';
import { AuthStatus, AuthProgress } from '../components/public/AuthParts';

const ASIDE = (
    <>
        <h1 className="orw-auth__title">Jump right<br /><span className="orw-gloss-text">into the chat.</span></h1>
        <p className="orw-auth__lead">Channel links add you to the conversation and open it, so you can catch up on what you missed.</p>
    </>
);

const INCOMPLETE = 'This channel link is incomplete. Ask for the link again and open it in full.';

export default function JoinChannel() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('');
    const [channelData, setChannelData] = useState(null);
    const [target, setTarget] = useState(null);

    useEffect(() => {
        const joinChannel = async () => {
            const channelId = searchParams.get('channel');
            const workspaceId = searchParams.get('workspace');

            if (!channelId || !workspaceId) {
                setStatus('error');
                setMessage(INCOMPLETE);
                return;
            }

            try {
                const res = await api.post(`/api/channels/${channelId}/join-via-link`);
                setStatus('success');
                setMessage(res.data.message);
                setChannelData(res.data.channel);
                setTarget(`/workspace/${workspaceId}/home/channel/${channelId}`);

                setTimeout(() => {
                    navigate(`/workspace/${workspaceId}/home/channel/${channelId}`);
                }, 2000);
            } catch (err) {
                setStatus('error');
                setMessage(err.response?.data?.message || 'We couldn’t add you to this channel.');
            }
        };

        joinChannel();
    }, [searchParams, navigate]);

    return (
        <AuthShell title="Join channel" aside={ASIDE}>
            {status === 'loading' && (
                <AuthStatus icon={Loader2} spin title="Joining the channel…" lead="Adding you to the channel. This takes a moment." />
            )}

            {status === 'success' && (
                <AuthStatus
                    icon={CheckCircle2}
                    tone="good"
                    title={`You’re in #${channelData?.name || 'channel'}`}
                    lead={<>{message ? `${message.replace(/[.!\s]+$/, '')}. ` : ''}Opening the channel for you…</>}
                    actions={<>
                        <AuthProgress ms={2000} label="Opening the channel" />
                        {target && <Link to={target} className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block">Open channel now <ArrowRight size={15} /></Link>}
                    </>}
                />
            )}

            {status === 'error' && (
                <AuthStatus
                    icon={AlertCircle}
                    tone="bad"
                    title="We couldn’t add you"
                    lead={message}
                    actions={<>
                        {message !== INCOMPLETE && <p className="orw-hint">The channel may be private, or the link may have been turned off. Ask a channel member to add you.</p>}
                        <button type="button" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" onClick={() => navigate('/workspaces')}>
                            Go to your workspaces <ArrowRight size={15} />
                        </button>
                    </>}
                />
            )}
        </AuthShell>
    );
}
