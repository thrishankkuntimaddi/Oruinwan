import React from "react";
import { Users, Megaphone, Calendar, CheckCircle2 } from "lucide-react";
import { Avatar, Panel, Section, Chip } from "../../components/ui/page";
import "./messagingUi.css";

export default function BroadcastChatWindow({ broadcast }) {
    if (!broadcast) return null;
    const recipients = broadcast.recipients || [];
    const count = recipients.length;

    return (
        <div className="mx-bc">
            <header className="mx-bc-head">
                <span className="mx-bc-mark" aria-hidden="true"><Megaphone size={16} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <h2 className="mx-bc-title">{broadcast.name}</h2>
                    <div className="mx-bc-sub">
                        <Calendar size={12} aria-hidden="true" />
                        {new Date().toLocaleDateString()}
                        <span aria-hidden="true">·</span>
                        {count} {count === 1 ? "recipient" : "recipients"}
                    </div>
                </div>
            </header>

            <div className="mx-bc-body">
                <div className="mx-bc-inner">
                    <Panel
                        title="Broadcast message"
                        icon={Megaphone}
                        flush
                        action={<Chip tone="success"><CheckCircle2 size={11} /> Sent</Chip>}
                    >
                        <div className="mx-bc-message">{broadcast.lastMessage}</div>
                    </Panel>

                    <Section title={`Recipients (${count})`} lead="Each person got this as a direct message.">
                        <div className="mx-bc-people">
                            {recipients.map((u, i) => (
                                <div key={u._id || u.id || i} className="mx-bc-person">
                                    <Avatar name={u.username} src={u.profilePicture} size="sm" />
                                    <span>{u.username}</span>
                                </div>
                            ))}
                        </div>
                        {count === 0 && (
                            <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>
                                <Users size={14} aria-hidden="true" /> No recipients on this broadcast.
                            </p>
                        )}
                    </Section>
                </div>
            </div>
        </div>
    );
}
