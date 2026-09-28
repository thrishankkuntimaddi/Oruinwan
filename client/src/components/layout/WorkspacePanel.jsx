import React from 'react';
import '../../styles/gloss.css';

/**
 * The frame every workspace side panel uses (Home, Channels, Messages, Notes,
 * Huddles, Files, Knowledge, Tasks…), so they all share one width (set by
 * MainLayout through --ws-panel-w), one header height and one look.
 *
 *   <WorkspacePanel
 *       icon={Hash}                      // shown in the accent mark (optional)
 *       title="Channels"                 // string or node
 *       subtitle="E2E Workspace"         // optional second line
 *       titleButtonProps={{ onClick }}   // makes the title a button (e.g. workspace menu)
 *       actions={<>…gl-icon-btn…</>}     // right side of the header
 *       tools={<>search, tabs…</>}       // bar under the header (optional)
 *       footer={…}                       // pinned to the bottom (optional)
 *       headerExtra={…}                  // absolutely positioned menus anchored to the header
 *   >
 *       list…
 *   </WorkspacePanel>
 */
export default function WorkspacePanel({
    icon: Icon, title, subtitle, titleAfter, titleButtonProps, actions, tools, footer, headerExtra,
    children, bodyClassName = '', bodyProps, className = '', ...rest
}) {
    const titleContent = (
        <>
            <span>{title}</span>
            {titleAfter}
        </>
    );
    return (
        <aside className={`gl-panel ${className}`} {...rest}>
            <div className="gl-panel-head">
                {Icon && <span className="gl-panel-mark" aria-hidden="true"><Icon size={14} /></span>}
                <div className="gl-panel-titles">
                    {titleButtonProps
                        ? <button type="button" className="gl-panel-title" {...titleButtonProps}>{titleContent}</button>
                        : <h2 className="gl-panel-title">{titleContent}</h2>}
                    {subtitle && <div className="gl-panel-sub">{subtitle}</div>}
                </div>
                {actions && <div className="gl-panel-actions">{actions}</div>}
                {headerExtra}
            </div>
            {tools && <div className="gl-panel-tools">{tools}</div>}
            <div className={`gl-panel-body ${bodyClassName}`} {...bodyProps}>{children}</div>
            {footer && <div className="gl-panel-foot">{footer}</div>}
        </aside>
    );
}

/** Small uppercase heading inside a panel list, with optional trailing actions. */
export function PanelSection({ label, icon: Icon, action, children }) {
    return (
        <div>
            <div className="gl-section-label">
                {Icon && <Icon size={11} />}
                <span style={{ flex: 1 }}>{label}</span>
                {action}
            </div>
            {children}
        </div>
    );
}

/** Empty state for panels and pages. */
export function PanelEmpty({ icon: Icon, title, text, action }) {
    return (
        <div className="gl-empty">
            {Icon && <span className="gl-empty-mark" aria-hidden="true"><Icon size={18} /></span>}
            {title && <p className="gl-empty-title">{title}</p>}
            {text && <p className="gl-empty-text">{text}</p>}
            {action && <div style={{ marginTop: 8 }}>{action}</div>}
        </div>
    );
}
