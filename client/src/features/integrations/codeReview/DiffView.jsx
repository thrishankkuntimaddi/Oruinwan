import React, { memo, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileCode2, FileMinus2, FilePen, FilePlus2, FileSymlink, Copy, Check } from 'lucide-react';
import { parsePatch, groupHunks } from './diffParse';
import { Highlighter, createElement, isKnownLanguage, DARK_THEME, LIGHT_THEME } from './highlight';
import { languageForFile } from '../prRefs';
import { DiffCounts } from '../ui';

export const FIRST_ROWS = 300;       // rows rendered before "Show more"
export const MORE_ROWS = 600;        // rows added per "Show more"
const HIGHLIGHT_LIMIT = 2500;        // bigger files render as plain text

const STATUS = {
    added: { Icon: FilePlus2, label: 'Added' },
    removed: { Icon: FileMinus2, label: 'Deleted' },
    modified: { Icon: FilePen, label: 'Modified' },
    renamed: { Icon: FileSymlink, label: 'Renamed' },
    copied: { Icon: FileSymlink, label: 'Copied' },
    changed: { Icon: FilePen, label: 'Changed' },
};
export function FileStatusIcon({ status, size = 13 }) {
    const s = STATUS[status] || STATUS.modified;
    const Icon = s.Icon;
    return <Icon size={size} className="oi-file-status" data-status={status || 'modified'} aria-label={s.label} role="img" />;
}

const noPre = ({ children }) => <>{children}</>;

/** Syntax-highlighted code rows. `rows` are diff rows (or {kind:'ctx'} for full files). */
const CodeRows = memo(function CodeRows({ rows, language, dark, plainOnly }) {
    const code = rows.map((r) => r.text).join('\n');
    const renderRow = (r, i, content) => (
        <div key={i} className="oi-dl" data-kind={r.kind}>
            <span className="oi-dl-no" aria-hidden="true">{r.oldNo ?? ''}</span>
            <span className="oi-dl-no" aria-hidden="true">{r.newNo ?? ''}</span>
            <span className="oi-dl-mark" aria-hidden="true">{r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ''}</span>
            <span className="oi-dl-code">
                {r.kind === 'add' && <span className="oi-sr">Added: </span>}
                {r.kind === 'del' && <span className="oi-sr">Removed: </span>}
                {content}
            </span>
        </div>
    );
    if (plainOnly || !isKnownLanguage(language)) {
        return rows.map((r, i) => renderRow(r, i, r.text || ' '));
    }
    return (
        <Highlighter
            language={language}
            style={dark ? DARK_THEME : LIGHT_THEME}
            PreTag={noPre}
            CodeTag={noPre}
            wrapLines
            renderer={({ rows: hl, stylesheet, useInlineStyles }) => rows.map((r, i) => renderRow(
                r, i,
                hl[i] && r.text ? createElement({ node: hl[i], stylesheet, useInlineStyles, key: `h${i}` }) : (r.text || ' '),
            ))}
        >
            {code}
        </Highlighter>
    );
});

/** One file of a pull request: header + unified diff (collapsible, capped). */
export const DiffFile = memo(function DiffFile({ file, collapsed, onToggle, onViewFile, dark, id }) {
    const rows = useMemo(() => parsePatch(file.patch), [file.patch]);
    const [limit, setLimit] = useState(FIRST_ROWS);
    const [copied, setCopied] = useState(false);
    const language = languageForFile(file.filename, file.language);
    const plainOnly = rows.length > HIGHLIGHT_LIMIT;
    const previous = file.previousFilename || file.previous_filename || null;

    const visible = useMemo(() => {
        const cut = rows.slice(0, limit);
        return groupHunks(cut);
    }, [rows, limit]);
    const hidden = Math.max(0, rows.length - limit);

    const copyPath = async () => {
        try { await navigator.clipboard.writeText(file.filename); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* blocked */ }
    };

    return (
        <section className="oi-diff-file" id={id} data-collapsed={collapsed ? 'true' : undefined} aria-label={file.filename}>
            <header className="oi-diff-head">
                <button type="button" className="oi-diff-toggle" onClick={onToggle} aria-expanded={!collapsed} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${file.filename}`}>
                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <FileStatusIcon status={file.status} />
                <span className="oi-diff-name" title={previous ? `${previous} → ${file.filename}` : file.filename}>
                    {previous && <span className="oi-muted">{previous} → </span>}
                    {file.filename}
                </span>
                <button type="button" className="gl-icon-btn oi-tiny-btn" onClick={copyPath} aria-label="Copy file path" title="Copy path">
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <DiffCounts additions={file.additions} deletions={file.deletions} />
                {onViewFile && (
                    <button type="button" className="gl-btn gl-btn--sm gl-btn--ghost oi-viewfile" onClick={() => onViewFile(file)} title="View the whole file">
                        <FileCode2 size={12} aria-hidden="true" /> <span>View file</span>
                    </button>
                )}
            </header>
            {!collapsed && (
                <div className="oi-diff-body" role="group" aria-label={`Changes in ${file.filename}`}>
                    {!rows.length ? (
                        <p className="oi-diff-empty">
                            {file.status === 'renamed' && !file.changes ? 'File renamed without changes.'
                                : file.status === 'removed' ? 'File deleted.'
                                    : 'No diff to show here (binary or very large file).'}
                            {onViewFile && file.status !== 'removed' && <> <button type="button" className="oi-link-btn" onClick={() => onViewFile(file)}>View the file</button></>}
                        </p>
                    ) : (
                        <>
                            {visible.map((g, gi) => (
                                <div key={gi} className="oi-hunk">
                                    {g.header && (
                                        <div className="oi-dl oi-dl--hunk" data-kind="hunk">
                                            <span className="oi-dl-hunk">{g.header.text}</span>
                                        </div>
                                    )}
                                    {g.rows.length > 0 && <CodeRows rows={g.rows} language={language} dark={dark} plainOnly={plainOnly} />}
                                </div>
                            ))}
                            {file.truncated && hidden === 0 && (
                                <p className="oi-diff-empty">GitHub shortened this diff.{onViewFile && <> <button type="button" className="oi-link-btn" onClick={() => onViewFile(file)}>View the whole file</button></>}</p>
                            )}
                            {hidden > 0 && (
                                <div className="oi-diff-more">
                                    <button type="button" className="gl-btn gl-btn--sm" onClick={() => setLimit((l) => l + MORE_ROWS)}>
                                        Show {Math.min(hidden, MORE_ROWS)} more lines
                                    </button>
                                    <span className="oi-muted">{hidden} hidden</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </section>
    );
});

/** A whole file with line numbers (the "View file" view). */
export function FullFile({ path, text, dark, language: hint }) {
    const [limit, setLimit] = useState(2000);
    const lines = useMemo(() => String(text || '').replace(/\r\n/g, '\n').split('\n'), [text]);
    const rows = useMemo(() => lines.slice(0, limit).map((t, i) => ({ kind: 'ctx', text: t, oldNo: null, newNo: i + 1 })), [lines, limit]);
    const language = languageForFile(path, hint);
    return (
        <div className="oi-diff-body oi-fullfile" role="group" aria-label={path}>
            <CodeRows rows={rows} language={language} dark={dark} plainOnly={rows.length > HIGHLIGHT_LIMIT} />
            {lines.length > limit && (
                <div className="oi-diff-more">
                    <button type="button" className="gl-btn gl-btn--sm" onClick={() => setLimit((l) => l + 3000)}>Show more</button>
                    <span className="oi-muted">{lines.length - limit} more lines</span>
                </div>
            )}
        </div>
    );
}
