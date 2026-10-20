import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { GitPullRequest } from "lucide-react";
import { Dialog, Btn, Field } from "../../ui/page";
import { useToast } from "../../../contexts/ToastContext";
import { createGithubIssue, isConnected } from "../../../features/integrations/integrationsApi";
import "../../../pages/toolkit/toolkit.css";

/**
 * Create a real GitHub issue through the workspace's GitHub integration, then put a link to it
 * in the message box. Repositories routed in Settings → Integrations are offered as suggestions.
 */
export default function CreateGitHubIssueModal({ onClose, onInsertText }) {
  const { workspaceId } = useParams();
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [repo, setRepo] = useState("");
  const [description, setDescription] = useState("");
  const [repos, setRepos] = useState([]);
  const [connected, setConnected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workspaceId) { setConnected(false); return undefined; }
    let alive = true;
    isConnected('github', workspaceId)
      .then(({ connected: c, config }) => {
        if (!alive) return;
        setConnected(c);
        const list = [...new Set((config?.routes || []).map((r) => r.repo).filter((r) => r && r !== '*'))];
        setRepos(list);
        if (list.length) setRepo((cur) => cur || list[0]);
      })
      .catch(() => alive && setConnected(false));
    return () => { alive = false; };
  }, [workspaceId]);

  const valid = title.trim() && /^[\w.-]+\/[\w.-]+$/.test(repo.trim());

  const handleCreate = async () => {
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      const res = await createGithubIssue({ workspaceId, repo: repo.trim(), title: title.trim(), body: description });
      const issue = res?.issue || res || {};
      const num = issue.number ? `#${issue.number}` : '';
      const link = issue.url || issue.html_url;
      onInsertText?.(`GitHub issue ${link ? `[${repo.trim()}${num}](${link})` : `${repo.trim()}${num}`}: **${issue.title || title.trim()}**`);
      showToast(`Issue ${repo.trim()}${num} created`, 'success');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not create the GitHub issue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span className="tk-mark" data-size="sm"><GitPullRequest size={15} /></span>New GitHub issue</span>}
      lead="Creates the issue on GitHub and adds a link to your message."
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
        <div className="tk-notice">GitHub isn’t connected to this workspace. An admin can connect it in Settings → Integrations.</div>
      )}
      {error && <div className="tk-notice" data-tone="danger" role="alert">{error}</div>}
      <Field label="Repository" hint={repos.length ? 'Routed repositories are suggested; any owner/name works.' : 'owner/name, for example acme/web'} htmlFor="gh-repo">
        <input id="gh-repo" className="gl-input" list="gh-repo-options" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/name" />
        <datalist id="gh-repo-options">{repos.map((r) => <option key={r} value={r} />)}</datalist>
      </Field>
      <Field label="Title" htmlFor="gh-title">
        <input id="gh-title" className="gl-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Login button does nothing on Safari" />
      </Field>
      <Field label="Description" hint="Optional" htmlFor="gh-body">
        <textarea id="gh-body" className="gl-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Steps, context, links" />
      </Field>
    </Dialog>
  );
}
