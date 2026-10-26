import { useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import NewMessageDialog from "./recipients/NewMessageDialog";

/**
 * "New message" on the Messages page: the same dialog as the Home sidebar
 * (recipients/NewMessageDialog). onStart(person) opens the 1:1 DM; a group opens its page.
 */
export default function NewDMModal({ onClose, onStart }) {
  const { user } = useContext(AuthContext);
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const myId = String(user?._id || user?.id || user?.sub || "");

  return (
    <NewMessageDialog
      open
      onClose={onClose}
      workspaceId={workspaceId}
      currentUserId={myId}
      onStartDM={onStart}
      onStartedGroup={(dm) => { onClose?.(); navigate(`/workspace/${workspaceId}/messages/dm/${dm.id}`); }}
    />
  );
}
