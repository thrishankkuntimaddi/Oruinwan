import React from 'react';
import { Lock, Unlock, AlertTriangle, Eraser, Trash2, Globe, Link } from 'lucide-react';

function SectionTitle({ children, danger = false }) {
    return (
        <div style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: danger ? 'var(--state-danger)' : 'var(--text-muted)',
            paddingBottom: '8px', marginBottom: '16px',
            borderBottom: `1px solid ${danger ? 'rgba(224,82,82,0.2)' : 'var(--border-subtle)'}`,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            display: 'flex', alignItems: 'center', gap: '6px',
        }}>
            {children}
        </div>
    );
}

function FieldRow({ label, description, children }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1 }}>
                <div style={{
                    fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif', marginBottom: '2px',
                }}>{label}</div>
                {description && (
                    <p style={{
                        fontSize: '12px', color: 'var(--text-muted)', margin: 0,
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif', lineHeight: 1.65,
                    }}>{description}</p>
                )}
            </div>
            {children}
        </div>
    );
}

function ActionBtn({ label, onClick, disabled, variant = 'default', icon }) {
    const [hovered, setHovered] = React.useState(false);
    const colors = {
        default: {
            bg: hovered ? 'var(--bg-hover)' : 'var(--bg-active)',
            color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: 'var(--border-default)',
        },
        danger: {
            bg: hovered ? 'rgba(224,82,82,0.1)' : 'transparent',
            color: 'var(--state-danger)',
            border: 'rgba(224,82,82,0.3)',
        },
        accent: {
            bg: hovered ? 'var(--accent-hover)' : 'var(--accent)',
            color: '#0c0c0c',
            border: 'transparent',
        },
    };
    const c = colors[variant];
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', fontSize: '12px', fontWeight: 500,
                backgroundColor: c.bg, color: c.color,
                border: `1px solid ${c.border}`, borderRadius: '2px',
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
                transition: 'background-color 150ms ease, color 150ms ease',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                whiteSpace: 'nowrap',
            }}
        >
            {icon}
            {label}
        </button>
    );
}

function StyledInput({ value, onChange, placeholder, disabled, width = 180 }) {
    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            style={{
                fontSize: '13px', padding: '5px 10px', width,
                border: '1px solid var(--border-default)', borderRadius: '2px',
                backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)',
                outline: 'none', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                transition: 'border-color 150ms ease',
                boxSizing: 'border-box',
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
        />
    );
}

export default function SettingsTab({
    channel,
    isDefaultChannel,
    isEditingName,
    editedName,
    onEditedNameChange,
    onStartEditName,
    onSaveName,
    onCancelEditName,
    isEditingDescription,
    editedDescription,
    onEditedDescriptionChange,
    onStartEditDescription,
    onSaveDescription,
    onCancelEditDescription,
    privacyVerification,
    onPrivacyVerificationChange,
    onTogglePrivacy,
    onTogglePublic,
    deleteVerification,
    onDeleteVerificationChange,
    onDeleteChannel,
    onClearMessages,
    loading
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* Channel Information */}
            <div>
                <SectionTitle>Channel Information</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Channel Name */}
                    <FieldRow
                        label="Channel Name"
                        description="This is how your channel appears to all members"
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isEditingName ? (
                                <>
                                    <StyledInput
                                        value={editedName}
                                        onChange={(e) => onEditedNameChange(e.target.value)}
                                        disabled={loading || isDefaultChannel}
                                    />
                                    <ActionBtn label="Save" onClick={onSaveName} disabled={loading || !editedName.trim()} variant="accent" />
                                    <ActionBtn label="Cancel" onClick={onCancelEditName} />
                                </>
                            ) : (
                                <>
                                    <span style={{
                                        fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)',
                                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                    }}>{channel.name}</span>
                                    {!isDefaultChannel && (
                                        <ActionBtn label="Edit" onClick={onStartEditName} />
                                    )}
                                </>
                            )}
                        </div>
                    </FieldRow>

                    {/* Channel Description */}
                    <FieldRow
                        label="Channel Description"
                        description="Help others understand what this channel is for"
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                            {isEditingDescription ? (
                                <>
                                    <textarea
                                        value={editedDescription}
                                        onChange={(e) => onEditedDescriptionChange(e.target.value)}
                                        rows={3}
                                        autoFocus
                                        disabled={loading}
                                        style={{
                                            fontSize: '13px', padding: '6px 10px', width: '240px',
                                            border: '1px solid var(--border-accent)', borderRadius: '2px',
                                            backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)',
                                            outline: 'none', resize: 'none',
                                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                            lineHeight: 1.5,
                                        }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <ActionBtn label="Save" onClick={onSaveDescription} disabled={loading} variant="accent" />
                                        <ActionBtn label="Cancel" onClick={onCancelEditDescription} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p style={{
                                        fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'right', margin: 0,
                                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                    }}>{channel.description || "No description"}</p>
                                    <ActionBtn
                                        label={channel.description ? "Edit" : "Add Description"}
                                        onClick={onStartEditDescription}
                                    />
                                </>
                            )}
                        </div>
                    </FieldRow>
                </div>
            </div>

            {/* Privacy Settings */}
            {!isDefaultChannel && (
                <div>
                    <SectionTitle>Privacy &amp; Visibility</SectionTitle>
                    <FieldRow
                        label={
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {channel.isPrivate ? <Lock size={13} /> : <Unlock size={13} />}
                                {channel.isPrivate ? "Private Channel" : "Public Channel"}
                            </span>
                        }
                        description={channel.isPrivate
                            ? "Only invited members can view and join this channel."
                            : "Anyone in the workspace can view and join this channel."}
                    >
                        {channel.isPrivate ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <StyledInput
                                    value={privacyVerification}
                                    onChange={(e) => onPrivacyVerificationChange(e.target.value)}
                                    placeholder={`Type "${channel.name}" to confirm`}
                                    width={200}
                                />
                                <ActionBtn
                                    label="Make Public"
                                    onClick={onTogglePrivacy}
                                    disabled={privacyVerification !== channel.name}
                                />
                            </div>
                        ) : (
                            <ActionBtn label="Make Private" onClick={onTogglePrivacy} />
                        )}
                    </FieldRow>
                </div>
            )}

            {/* Community Sharing */}
            {!isDefaultChannel && !channel.isPrivate && (
                <div>
                    <SectionTitle>
                        <Globe size={12} style={{ color: 'var(--accent)' }} />
                        Community Sharing
                    </SectionTitle>
                    <FieldRow
                        label="Share via Public Link"
                        description={channel.isPublic
                            ? "Anyone with the link can view this channel (read-only)."
                            : "Allow anyone with a link to view this channel externally."}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                            {channel.isPublic && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    fontSize: '11px', color: 'var(--accent)',
                                    padding: '2px 8px', border: '1px solid rgba(184,149,106,0.2)',
                                    borderRadius: '2px',
                                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                }}>
                                    <Link size={10} /> Publicly accessible
                                </div>
                            )}
                            <button
                                onClick={() => onTogglePublic?.(!channel.isPublic)}
                                disabled={loading}
                                style={{
                                    position: 'relative', width: '40px', height: '22px',
                                    backgroundColor: channel.isPublic ? 'var(--accent)' : 'var(--bg-active)',
                                    border: '1px solid var(--border-accent)',
                                    borderRadius: '2px', cursor: disabled ? 'not-allowed' : 'pointer',
                                    outline: 'none', transition: 'background-color 150ms ease',
                                    opacity: loading ? 0.5 : 1,
                                }}
                                role="switch"
                                aria-checked={channel.isPublic}
                                title={channel.isPublic ? "Disable public link" : "Enable public link"}
                            >
                                <span style={{
                                    position: 'absolute', top: '3px',
                                    left: channel.isPublic ? '20px' : '3px',
                                    width: '14px', height: '14px',
                                    backgroundColor: channel.isPublic ? '#0c0c0c' : 'var(--text-muted)',
                                    borderRadius: '1px',
                                    transition: 'left 150ms ease',
                                }} />
                            </button>
                        </div>
                    </FieldRow>
                </div>
            )}

            {/* Danger Zone */}
            {!isDefaultChannel && (
                <div>
                    <SectionTitle danger>
                        <AlertTriangle size={12} />
                        Danger Zone
                    </SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                        {/* Clear Messages */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px',
                            border: '1px solid rgba(224,82,82,0.2)',
                            borderRadius: '2px',
                            backgroundColor: 'rgba(224,82,82,0.04)',
                        }}>
                            <div>
                                <div style={{
                                    fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
                                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif', marginBottom: '2px',
                                }}>Clear All Messages</div>
                                <p style={{
                                    fontSize: '12px', color: 'var(--text-muted)', margin: 0,
                                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                }}>Permanently delete all message history in this channel.</p>
                            </div>
                            <ActionBtn
                                label="Clear History"
                                onClick={onClearMessages}
                                variant="danger"
                                icon={<Eraser size={12} />}
                            />
                        </div>

                        {/* Delete Channel */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px',
                            border: '1px solid rgba(224,82,82,0.2)',
                            borderRadius: '2px',
                            backgroundColor: 'rgba(224,82,82,0.04)',
                        }}>
                            <div>
                                <div style={{
                                    fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
                                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif', marginBottom: '2px',
                                }}>Delete Channel</div>
                                <p style={{
                                    fontSize: '12px', color: 'var(--text-muted)', margin: 0,
                                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                }}>Permanently delete this channel and all its data.</p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <StyledInput
                                    value={deleteVerification}
                                    onChange={(e) => onDeleteVerificationChange(e.target.value)}
                                    placeholder={`Type "${channel.name}" to confirm`}
                                    width={200}
                                />
                                <ActionBtn
                                    label="Delete Channel"
                                    onClick={onDeleteChannel}
                                    disabled={deleteVerification !== channel.name}
                                    variant="danger"
                                    icon={<Trash2 size={12} />}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
