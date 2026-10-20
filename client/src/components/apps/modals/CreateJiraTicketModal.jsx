import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { TicketCheck } from "lucide-react";
import { Dialog, Btn, Field, SelectBox } from "../../ui/page";
import { useToast } from "../../../contexts/ToastContext";
import { createJiraIssue, isConnected } from "../../../features/integrations/integrationsApi";
import "../../../pages/toolkit/toolkit.css";

const ISSUE_TYPES = ["Task", "Bug", "Story", "Epic"];

/**
 * Create a real Jira issue through the workspace's Jira integration, then put a link to it in the
 * message box. Project keys routed in Settings → Integrations are offered as suggestions.
 */
export default function CreateJiraTicketModal({ onClose, onInsertText }) {
  const { workspaceId } = useParams();
  const { showToast } = useToast();
  const [projectKey, setProjectKey] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [issueType, setIssueType] = useState("Task");
  const [projects, setProjects] = useState([]);
  const [connected, setConnected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workspaceId) { setConnected(false); return undefined; }
    let alive = true;
    isConnected('jira', workspaceId)
      .then(({ connected: c, config }) => {
        if (!alive) return;
        setConnected(c);
        const list = [...new Set((config?.routes || []).map((r) => r.project).filter((p) => p && p !== '*'))];
        setProjects(list);
        if (list.length) setProjectKey((cur) => cur || list[0]);
      })
      .catch(() => alive && setConnected(false));
    return () => { alive = false; };
  }, [workspaceId]);

  const key = projectKey.trim().toUpperCase();
  const valid = summary.trim() && /^[A-Z][A-Z0-9_]{0,19}$/.test(key);

  const handleCreate = async () => {
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      const res = await createJiraIssue({ workspaceId, projectKey: key, summary: summary.trim(), description, issueType });
      const issue = res?.issue || res || {};
      const k = issue.key || key;
      onInsertText?.(`Jira ${issueType.toLowerCase()} ${issue.url ? `[${k}](${issue.url})` : k}: **${issue.summary || summary.trim()}**`);
      showToast(`${k} created`, 'success');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not create the Jira issue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span className="tk-mark" data-size="sm"><TicketCheck size={15} /></span>New Jira issue</span>}
      lead="Creates the issue in Jira and adds a link to your message."
      onClose={onClose}
      busy={loading}
      footer={(
        <>
          <Btn variant="ghost" onClick={onClose} disabled={loading}>Cancel</Btn>
          <Btn variant="primary" onClick={handleCreate} loading={loading} disabled={!valid || connected === false}>Create issue</Btn>
        </>
      )}
    >
      {connected === false && (
        <div className="tk-notice">Jira isn’t connected to this workspace. An admin can connect it in Settings → Integrations.</div>
      )}
      {error && <div className="tk-notice" data-tone="danger" role="alert">{error}</div>}
      <div className="tk-fields">
        <Field label="Project key" hint="For example ORU" htmlFor="jira-project">
          <input id="jira-project" className="gl-input" list="jira-project-options" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} placeholder="KEY" />
          <datalist id="jira-project-options">{projects.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
        <Field label="Type">
          <SelectBox value={issueType} onChange={setIssueType} label="Issue type">
            {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </SelectBox>
        </Field>
      </div>
      <Field label="Summary" htmlFor="jira-summary">
        <input id="jira-summary" className="gl-input" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Update the login flow" />
      </Field>
      <Field label="Description" hint="Optional" htmlFor="jira-desc">
        <textarea id="jira-desc" className="gl-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details for whoever picks it up" />
      </Field>
    </Dialog>
  );
}
