import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Users, CheckCircle, AlertCircle, Loader } from "lucide-react";

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
            setError("Invalid invitation link");
            setLoading(false);
            return;
        }

        // Fetch workspace details
        const fetchDetails = async () => {
            try {
                const response = await fetch(`/api/workspaces/invite/${token}`);

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || "Invalid invitation");
                }

                const data = await response.json();
                setWorkspaceDetails(data);
                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        fetchDetails();
    }, [token]);

    const handleJoin = async () => {
        if (!user) {
            // Redirect to login, then come back here
            localStorage.setItem('pendingInvite', token);
            navigate('/login');
            return;
        }

        setJoining(true);
        try {
            const accessToken = localStorage.getItem('accessToken');
            const response = await fetch('/api/workspaces/join', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Failed to join workspace");
            }

            const data = await response.json();

            // Store workspace ID and redirect to workspace home
            localStorage.setItem('currentWorkspace', data.workspace.id);
            localStorage.removeItem('pendingInvite');

            navigate(`/workspace/${data.workspace.id}/home`, {
                state: {
                    message: `Successfully joined ${data.workspace.name}!`
                }
            });
        } catch (err) {
            setError(err.message);
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading invitation...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Error</h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/workspaces')}
                        className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Go to Workspaces
                    </button>
                </div>
            </div>
        );
    }

    if (!workspaceDetails) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-lg w-full">
                {/* Workspace Icon */}
                <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg"
                    style={{ backgroundColor: workspaceDetails.workspaceColor || '#2563eb' }}
                >
                    <span className="text-4xl">{workspaceDetails.workspaceIcon || '🚀'}</span>
                </div>

                {/* Invitation Details */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">
                        Join {workspaceDetails.workspaceName}
                    </h1>
                    <p className="text-gray-600 mb-6">
                        {workspaceDetails.invitedBy} has invited you to collaborate
                    </p>
                    {workspaceDetails.workspaceDescription && (
                        <p className="text-sm text-gray-500 mb-4">
                            {workspaceDetails.workspaceDescription}
                        </p>
                    )}
                </div>

                {/* Workspace Stats */}
                <div className="bg-gray-50 rounded-xl p-6 mb-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="text-center">
                            <Users className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-gray-900">{workspaceDetails.memberCount}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Members</p>
                        </div>
                        <div className="text-center">
                            <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-gray-900 capitalize">{workspaceDetails.role}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Your Role</p>
                        </div>
                    </div>
                </div>

                {/* Auto-join Channels Notice */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-700">
                        <strong>Note:</strong> You'll automatically join #general and #announcements channels
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <button
                        onClick={handleJoin}
                        disabled={joining}
                        className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {joining ? (
                            <>
                                <Loader className="w-5 h-5 animate-spin" />
                                Joining...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                {user ? 'Join Workspace' : 'Sign In & Join'}
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => navigate('/workspaces')}
                        disabled={joining}
                        className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        Maybe Later
                    </button>
                </div>

                {!user && (
                    <p className="text-center text-sm text-gray-500 mt-6">
                        Don't have an account? You'll be able to create one after clicking join.
                    </p>
                )}
            </div>
        </div>
    );
};

export default JoinWorkspace;
