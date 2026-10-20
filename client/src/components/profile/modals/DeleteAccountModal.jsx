import React from 'react';
import { Btn, Dialog, Field } from '../../ui/page';

const DeleteAccountModal = ({
    show,
    onClose,
    deleteConfirmText,
    setDeleteConfirmText,
    onDeleteAccount
}) => {
    const close = () => { onClose(); setDeleteConfirmText(""); };
    const ready = deleteConfirmText === "DELETE";

    return (
        <Dialog
            open={!!show}
            title="Delete your account?"
            lead="This is permanent and cannot be undone."
            onClose={close}
            size="sm"
            footer={(
                <>
                    <Btn variant="ghost" onClick={close}>Cancel</Btn>
                    <Btn variant="danger" onClick={onDeleteAccount} disabled={!ready}>Delete account</Btn>
                </>
            )}
        >
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                These will be deleted for good:
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, listStyle: 'disc' }}>
                    <li>Your messages and conversations</li>
                    <li>Your tasks and notes</li>
                    <li>Your personal workspace</li>
                    <li>Your profile</li>
                </ul>
            </div>
            <Field label="Type DELETE to confirm" htmlFor="pm-delete-confirm">
                <input
                    id="pm-delete-confirm"
                    className="gl-input"
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                    placeholder="DELETE"
                    autoComplete="off"
                    onKeyDown={(e) => { if (e.key === 'Enter' && ready) onDeleteAccount(); }}
                />
            </Field>
        </Dialog>
    );
};

export default DeleteAccountModal;
