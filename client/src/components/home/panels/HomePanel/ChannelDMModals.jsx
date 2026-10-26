import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CreateChannelModal from '../../../../features/messaging/CreateChannelModal';
import NewMessageDialog from '../../../../features/messaging/recipients/NewMessageDialog';

/** "New message" in the Home sidebar: the shared dialog (features/messaging/recipients). */
const NewDMModal = ({ workspaceId: wsProp, showNewDMModal, setShowNewDMModal, handleStartDM, currentUserId }) => {
    const navigate = useNavigate();
    const params = useParams();
    const workspaceId = wsProp || params.workspaceId;
    const close = () => setShowNewDMModal(false);
    return (
        <NewMessageDialog
            open={!!showNewDMModal}
            onClose={close}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            onStartDM={handleStartDM}
            onStartedGroup={(dm) => { close(); navigate(`/workspace/${workspaceId}/home/dm/${dm.id}`); }}
        />
    );
};

export { CreateChannelModal, NewDMModal };
