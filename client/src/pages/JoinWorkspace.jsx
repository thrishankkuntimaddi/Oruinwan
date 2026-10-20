import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import * as Icons from "lucide-react";
import api from '@services/api';
import logger from '../utils/logger';
import AuthShell from '../components/public/AuthShell';
import { AuthMark, AuthHead, AuthStatus, AuthLoading } from '../components/public/AuthParts';

const { AlertCircle, ArrowRight, Users, Shield, Rocket, Hash, UserRound } = Icons;

const workspaceIcon = (iconName) => {
    if (!iconName) return Rocket;
    return Icons[iconName.charAt(0).toUpperCase() + iconName.slice(1)] || Hash;
};

const JoinWorkspace = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const token = searchParams.get('token');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [workspaceDetails, setWorkspaceDetails] = useState(null);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        if (!token) {
            setError("This invitation link is incomplete. Open it again from the email or message you received.");
            setLoading(false);
            return;
        }

        const fetchDetails = async () => {
            try {
                const response = await api.get(`/api/workspaces/invite/${token}`);
                setWorkspaceDetails(response.data);
                setLoading(false);
            } catch (err) {
                setError(err.response?.data?.message || err.message || "We couldn’t load this invitation.");
                setLoading(false);
            }
        };

        fetchDetails();
    }, [token]);

    const goToSignIn = (signup) => {
        localStorage.setItem('pendingInvite', token);
        navigate(signup ? '/login?mode=signup' : '/login');
    };

    const handleJoin = async () => {
        if (!user) {
            goToSignIn(false);
            return;
        }

        setJoining(true);
        try {
            const response = await api.post('/api/workspaces/join', { token });
            const data = response.data;

            localStorage.setItem('currentWorkspace', data.workspace.id);
            localStorage.removeItem('pendingInvite');

            navigate(`/workspace/${data.workspace.id}/home`, {
                state: {
                    message: `Successfully joined ${data.workspace.name}!`
                }
            });
        } catch (err) {
            logger.error('Join workspace error:', err);
            setError(err.response?.data?.message || err.message || "We couldn’t add you to this workspace.");
            setJoining(false);
        }
    };

    if (loading) return <AuthLoading title="Join workspace" label="Checking your invitation…" />;

    if (error) {
        return (
            <AuthShell title="Invitation">
                <AuthStatus
                    icon={AlertCircle}
                    tone="bad"
                    title="This invitation can’t be used"
                    lead={error}
                    actions={<>
                        <p className="orw-hint">Invitation links can expire or be used up. Ask the person who invited you to send a new one.</p>
                        <button type="button" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block"
                            onClick={() => navigate(user ? '/workspaces' : '/login')}>
                            {user ? 'Go to your workspaces' : 'Sign in'} <ArrowRight size={15} />
                        </button>
                        <Link to="/" className="orw-link">Back to home</Link>
                    </>}
                />
            </AuthShell>
        );
    }

    if (!workspaceDetails) return null;

    const name = workspaceDetails.workspaceName;
    const role = workspaceDetails.role || 'member';
    const WsIcon = workspaceIcon(workspaceDetails.workspaceIcon);

    return (
        <AuthShell
            title={`Join ${name}`}
            aside={<>
                <h1 className="orw-auth__title">You’re invited to<br /><span className="orw-gloss-text">{name}.</span></h1>
                <p className="orw-auth__lead">Join to see its channels, message the team and pick up where everyone else is.</p>
            </>}
        >
            <AuthMark icon={WsIcon} />
            <AuthHead eyebrow="Workspace invitation" title={`Join ${name}`}>
                <strong>{workspaceDetails.invitedBy}</strong> invited you to join as {role === 'admin' ? 'an' : 'a'} {role}.
            </AuthHead>

            {workspaceDetails.workspaceDescription && (
                <p className="orw-callout" style={{ marginTop: 0 }}>{workspaceDetails.workspaceDescription}</p>
            )}

            <dl className="orw-auth-facts">
                <div>
                    <dt><Users size={12} aria-hidden="true" /> Members</dt>
                    <dd>{workspaceDetails.memberCount ?? '—'}</dd>
                </div>
                <div>
                    <dt><Shield size={12} aria-hidden="true" /> Your role</dt>
                    <dd>{role}</dd>
                </div>
            </dl>

            <div className="orw-auth-actions">
                <button type="button" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block"
                    onClick={handleJoin} disabled={joining} aria-busy={joining}>
                    {joining ? 'Joining…' : <>{user ? `Join ${name}` : 'Sign in to join'} <ArrowRight size={15} /></>}
                </button>
                {user ? (
                    <p className="orw-hint" style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <UserRound size={12} aria-hidden="true" /> Joining as {user.email || user.username}
                    </p>
                ) : (
                    <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block" onClick={() => goToSignIn(true)}>
                        New here? Create an account
                    </button>
                )}
            </div>

            <p className="orw-auth__note">
                <button type="button" className="orw-link" onClick={() => navigate(user ? '/workspaces' : '/')} disabled={joining}>
                    Not now
                </button>
            </p>
        </AuthShell>
    );
};

export default JoinWorkspace;
