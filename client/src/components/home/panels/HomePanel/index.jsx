import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, X } from 'lucide-react';
import ConfirmationModal from "../../../modals/ConfirmationModal";
import { useContacts } from "../../../../contexts/ContactsContext";

// Import sub-components
import WorkspaceHeader from "./WorkspaceHeader";
import SectionHeader from "./SectionHeader";
import ListItem from "./ListItem";
import WorkspaceModals from "./WorkspaceModals";
import WorkspaceSettingsModal from "./WorkspaceSettingsModal";
import DeleteWorkspaceModal from "./DeleteWorkspaceModal";
import { CreateChannelModal, NewDMModal } from "./ChannelDMModals";

const HomePanel = ({ title }) => {
    const navigate = useNavigate();

    const { allItems: items, deleteItem, addItem, toggleFavorite } = useContacts();

    const [expanded, setExpanded] = useState({
        favorites: true,
        channels: true,
        dms: true,
    });

    const [workspaceName, setWorkspaceName] = useState(title || localStorage.getItem("currentWorkspace") || "Chttrix");

    // Update workspace name when title prop changes
    React.useEffect(() => {
        if (title) {
            setWorkspaceName(title);
        }
    }, [title]);

    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [activeSettingsTab, setActiveSettingsTab] = useState("General");
    const [newName, setNewName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showSelectionDeleteConfirm, setShowSelectionDeleteConfirm] = useState(false);
    const [deleteVerification, setDeleteVerification] = useState("");
    const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
    const [showNewDMModal, setShowNewDMModal] = useState(false);

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    // Channel Creation State
    const [newChannelData, setNewChannelData] = useState({ name: "", description: "", isPrivate: false });
    const [createStep, setCreateStep] = useState(1);
    const [selectedChannelMembers, setSelectedChannelMembers] = useState([]);

    const MOCK_USERS = [
        { id: 'u1', name: 'Sarah Connor', status: 'online' },
        { id: 'u2', name: 'John Doe', status: 'away' },
        { id: 'u3', name: 'Alice Smith', status: 'online' },
        { id: 'u4', name: 'Mike Ross', status: 'offline' },
        { id: 'u5', name: 'Rachel Zane', status: 'busy' },
        { id: 'u6', name: 'Harvey Specter', status: 'online' },
        { id: 'u7', name: 'Donna Paulsen', status: 'online' },
    ];

    const handleStartDM = (user) => {
        const existingDM = items.find(i => i.type === 'dm' && i.label === user.name);
        if (existingDM) {
            navigate(`/dm/${existingDM.id}`);
        } else {
            const dmId = user.name.toLowerCase().replace(/\s+/g, '-');
            const newDM = {
                id: dmId,
                type: 'dm',
                label: user.name,
                path: `/dm/${dmId}`,
                isFavorite: false
            };
            addItem(newDM);
            navigate(`/dm/${dmId}`);
        }
        setShowNewDMModal(false);
    };

    const toggle = (section) => {
        setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    const handleRename = () => {
        if (newName.trim()) {
            setWorkspaceName(newName);
            setShowRenameModal(false);
            setNewName("");
        }
    };

    const handleInvite = () => {
        if (inviteEmail.trim()) {
            alert(`Invitation sent to ${inviteEmail}`);
            setShowInviteModal(false);
            setInviteEmail("");
        }
    };

    const handleDeleteSelected = () => {
        selectedItems.forEach(id => deleteItem(id));
        setSelectedItems(new Set());
        setIsSelectionMode(false);
        setShowSelectionDeleteConfirm(false);
    };

    const favorites = items.filter(i => i.isFavorite);
    const channels = items.filter(i => !i.isFavorite && i.type === 'channel');
    const dms = items.filter(i => !i.isFavorite && i.type === 'dm');

    return (
        <div className="flex flex-col h-full bg-gray-50 relative">
            {/* Workspace Header with Dropdown */}
            <WorkspaceHeader
                workspaceName={workspaceName}
                showWorkspaceMenu={showWorkspaceMenu}
                setShowWorkspaceMenu={setShowWorkspaceMenu}
                isSelectionMode={isSelectionMode}
                setIsSelectionMode={setIsSelectionMode}
                setShowNewDMModal={setShowNewDMModal}
                setShowInviteModal={setShowInviteModal}
                setShowSettingsModal={setShowSettingsModal}
                setShowRenameModal={setShowRenameModal}
                setNewName={setNewName}
            />

            {/* Divider */}
            <div className="border-t border-gray-200 mx-4 mt-2 mb-2"></div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">

                {/* Selection Mode Header */}
                {isSelectionMode && (
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between sticky top-0 z-10">
                        <span className="text-sm font-bold text-blue-900">{selectedItems.size} selected</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowSelectionDeleteConfirm(true)}
                                disabled={selectedItems.size === 0}
                                className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete Selected"
                            >
                                <Trash2 size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    setIsSelectionMode(false);
                                    setSelectedItems(new Set());
                                }}
                                className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg"
                                title="Cancel"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Favorites */}
                {favorites.length > 0 && (
                    <>
                        <SectionHeader label="Favorites" isOpen={expanded.favorites} onClick={() => toggle("favorites")} />
                        {expanded.favorites && (
                            <div className="space-y-0.5">
                                {favorites.map(item => (
                                    <ListItem
                                        key={item.id}
                                        item={item}
                                        isSelectionMode={isSelectionMode}
                                        selectedItems={selectedItems}
                                        setSelectedItems={setSelectedItems}
                                        toggleFavorite={toggleFavorite}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* Channels */}
                <SectionHeader
                    label="Channels"
                    isOpen={expanded.channels}
                    onClick={() => toggle("channels")}
                    onAdd={() => setShowCreateChannelModal(true)}
                />
                {expanded.channels && (
                    <div className="space-y-0.5">
                        {channels.map(item => (
                            <ListItem
                                key={item.id}
                                item={item}
                                isSelectionMode={isSelectionMode}
                                selectedItems={selectedItems}
                                setSelectedItems={setSelectedItems}
                                toggleFavorite={toggleFavorite}
                            />
                        ))}
                    </div>
                )}

                {/* Direct Messages */}
                <SectionHeader
                    label="Direct Messages"
                    isOpen={expanded.dms}
                    onClick={() => toggle("dms")}
                    onAdd={() => setShowNewDMModal(true)}
                />
                {expanded.dms && (
                    <div className="space-y-0.5">
                        {dms.map(item => (
                            <ListItem
                                key={item.id}
                                item={item}
                                isSelectionMode={isSelectionMode}
                                selectedItems={selectedItems}
                                setSelectedItems={setSelectedItems}
                                toggleFavorite={toggleFavorite}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Confirmation Modal for Selection Delete */}
            <ConfirmationModal
                isOpen={showSelectionDeleteConfirm}
                onClose={() => setShowSelectionDeleteConfirm(false)}
                onConfirm={handleDeleteSelected}
                title="Delete Selected Items?"
                message={`Are you sure you want to delete ${selectedItems.size} selected item(s)? This action cannot be undone.`}
                confirmText="Delete Items"
            />

            {/* Workspace Modals (Rename & Invite) */}
            <WorkspaceModals
                showRenameModal={showRenameModal}
                setShowRenameModal={setShowRenameModal}
                newName={newName}
                setNewName={setNewName}
                handleRename={handleRename}
                showInviteModal={showInviteModal}
                setShowInviteModal={setShowInviteModal}
                inviteEmail={inviteEmail}
                setInviteEmail={setInviteEmail}
                handleInvite={handleInvite}
                workspaceName={workspaceName}
            />

            {/* Workspace Settings Modal */}
            <WorkspaceSettingsModal
                showSettingsModal={showSettingsModal}
                setShowSettingsModal={setShowSettingsModal}
                activeSettingsTab={activeSettingsTab}
                setActiveSettingsTab={setActiveSettingsTab}
                workspaceName={workspaceName}
                setShowDeleteConfirm={setShowDeleteConfirm}
            />

            {/* Delete Confirmation Modal */}
            <DeleteWorkspaceModal
                showDeleteConfirm={showDeleteConfirm}
                setShowDeleteConfirm={setShowDeleteConfirm}
                workspaceName={workspaceName}
                deleteVerification={deleteVerification}
                setDeleteVerification={setDeleteVerification}
                setShowSettingsModal={setShowSettingsModal}
            />

            {/* Create Channel Modal */}
            <CreateChannelModal
                showCreateChannelModal={showCreateChannelModal}
                setShowCreateChannelModal={setShowCreateChannelModal}
                newChannelData={newChannelData}
                setNewChannelData={setNewChannelData}
                createStep={createStep}
                setCreateStep={setCreateStep}
                selectedChannelMembers={selectedChannelMembers}
                setSelectedChannelMembers={setSelectedChannelMembers}
                MOCK_USERS={MOCK_USERS}
                addItem={addItem}
            />

            {/* New DM Modal */}
            <NewDMModal
                showNewDMModal={showNewDMModal}
                setShowNewDMModal={setShowNewDMModal}
                MOCK_USERS={MOCK_USERS}
                handleStartDM={handleStartDM}
            />
        </div>
    );
};

export default HomePanel;
