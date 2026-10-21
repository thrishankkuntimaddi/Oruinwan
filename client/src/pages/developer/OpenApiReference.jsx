import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, KeyRound } from 'lucide-react';
import api from '@services/api';
import { Panel, Chip, Btn, LoadingState, ErrorState, useAsync } from '../../components/ui/page';

/**
 * A small in-house renderer for the public API's OpenAPI 3 document
 * (GET /api/public/v1/openapi.json): operations grouped by tag, parameters,
 * request bodies and responses with their schemas, and a curl example each.
 */

export const SPEC_PATH = '/api/public/v1/openapi.json';
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/** Follow a local "#/components/…" reference. */
export function resolveRef(spec, schema) {
  let s = schema;
  for (let i = 0; s && s.$ref && i < 10; i += 1) {
    const parts = s.$ref.replace(/^#\//, '').split('/');
    s = parts.reduce((o, k) => (o ? o[k] : undefined), spec);
  }
  return s || {};
}

/** Short type label: "string (date-time)", "array of Task", "enum: a | b". */
export function typeLabel(spec, schema) {
  if (!schema) return 'any';
  if (schema.$ref) return schema.$ref.split('/').pop();
  const s = schema;
  if (s.type === 'array') return `array of ${typeLabel(spec, s.items)}`;
  let t = s.type || (s.properties ? 'object' : 'any');
  if (s.format) t += ` (${s.format})`;
  if (s.nullable) t += ' | null';
  return t;
}

/** Operations grouped by their first tag, in spec order. */
export function groupOperations(spec) {
  const groups = new Map();
  (spec.tags || []).forEach((t) => groups.set(t.name, { tag: t, ops: [] }));
  Object.entries(spec.paths || {}).forEach(([path, item]) => {
    METHODS.forEach((method) => {
      const op = item[method];
      if (!op) return;
      const name = (op.tags && op.tags[0]) || 'Other';
      if (!groups.has(name)) groups.set(name, { tag: { name }, ops: [] });
      groups.get(name).ops.push({ path, method, op });
    });
  });
  return [...groups.values()].filter((g) => g.ops.length);
}

function SchemaTable({ spec, schema, depth = 0 }) {
  const s = resolveRef(spec, schema);
  if (s.type === 'array') {
    return (
      <div>
        <p className="cd-hint" style={{ margin: '4px 0' }}>Array of {typeLabel(spec, s.items)}</p>
        {depth < 3 && <SchemaTable spec={spec} schema={s.items} depth={depth + 1} />}
      </div>
    );
  }
  const props = s.properties || {};
  const keys = Object.keys(props);
  if (!keys.length) return <p className="cd-hint" style={{ margin: '4px 0' }}>{typeLabel(spec, s)}</p>;
  const required = new Set(s.required || []);
  return (
    <table className="dp-docs-table" data-testid="schema-table">
      <thead><tr><th>Field</th><th>Type</th><th>Notes</th></tr></thead>
      <tbody>
        {keys.map((k) => {
          const p = props[k];
          const r = resolveRef(spec, p);
          const notes = [
            required.has(k) ? 'required' : null,
            r.enum ? `one of ${r.enum.join(', ')}` : null,
            r.maxLength ? `max ${r.maxLength} chars` : null,
            r.default !== undefined ? `default ${JSON.stringify(r.default)}` : null,
            r.description || null,
          ].filter(Boolean).join(' · ');
          return (
            <tr key={k}>
              <td><code>{k}</code></td>
              <td>{typeLabel(spec, p)}</td>
              <td>{notes || '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function jsonSchemaOf(content) {
  return content && content['application/json'] ? content['application/json'].schema : null;
}

function curlFor({ method, path, op }, baseUrl) {
  const lines = [`curl${method === 'get' ? '' : ` -X ${method.toUpperCase()}`} "${baseUrl}${path}"`, '  -H "X-Api-Key: $ORUINWAN_API_KEY"'];
  if (op.requestBody) lines.push('  -H "Content-Type: application/json"', "  -d '{ \"title\": \"Example\" }'");
  return lines.join(' \\\n');
}

function Operation({ spec, entry, baseUrl }) {
  const { method, path, op } = entry;
  const [open, setOpen] = useState(false);
  const scope = op['x-scope'];
  const bodySchema = op.requestBody ? jsonSchemaOf(op.requestBody.content) : null;
  return (
    <div className="dp-endpoint" data-testid="openapi-operation" style={{ display: 'block' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className={`dp-method dp-method-${method}`}>{method.toUpperCase()}</span>
        <code className="dp-endpoint-path">{path}</code>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>{op.summary}</span>
        {scope ? <Chip title="Required key scope">{scope}</Chip> : <Chip>any key</Chip>}
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {op.description && <p>{op.description}</p>}
          {op.parameters?.length > 0 && (
            <>
              <h4>Parameters</h4>
              <table className="dp-docs-table">
                <thead><tr><th>Name</th><th>In</th><th>Type</th><th>Notes</th></tr></thead>
                <tbody>
                  {op.parameters.map((p) => (
                    <tr key={`${p.in}:${p.name}`}>
                      <td><code>{p.name}</code></td>
                      <td>{p.in}</td>
                      <td>{typeLabel(spec, p.schema)}</td>
                      <td>{[p.required ? 'required' : null, p.schema?.enum ? `one of ${p.schema.enum.join(', ')}` : null, p.description].filter(Boolean).join(' · ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {bodySchema && (
            <>
              <h4>Request body (JSON)</h4>
              <SchemaTable spec={spec} schema={bodySchema} />
            </>
          )}
          <h4>Responses</h4>
          {Object.entries(op.responses || {}).map(([code, r]) => {
            const schema = jsonSchemaOf(r.content);
            const isOk = /^2/.test(code);
            return (
              <div key={code} style={{ marginBottom: 8 }}>
                <p style={{ margin: '4px 0' }}><Chip tone={isOk ? 'success' : 'warning'}>{code}</Chip> {r.description}</p>
                {isOk && schema && <SchemaTable spec={spec} schema={schema} />}
              </div>
            );
          })}
          <h4>Example</h4>
          <pre><code>{curlFor(entry, baseUrl)}</code></pre>
        </div>
      )}
    </div>
  );
}

export default function OpenApiReference() {
  const { data: spec, loading, error, reload } = useAsync(() => api.get(SPEC_PATH).then((r) => r.data), []);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const apiBase = (api.defaults && api.defaults.baseURL) || origin;
  const groups = useMemo(() => (spec ? groupOperations(spec) : []), [spec]);

  if (loading) return <LoadingState label="Loading the API reference…" />;
  if (error) return <Panel><ErrorState title="Couldn’t load the API reference" message={error} onRetry={reload} /></Panel>;
  if (!spec) return null;

  const serverPath = spec.servers?.[0]?.url || '/api/public/v1';
  const baseUrl = /^https?:/.test(serverPath) ? serverPath : `${String(apiBase).replace(/\/+$/, '')}${serverPath}`;
  const scheme = Object.values(spec.components?.securitySchemes || {})[0];

  return (
    <div data-testid="openapi-reference">
      <p>{spec.info?.description}</p>
      <table className="dp-docs-table">
        <tbody>
          <tr><td>Base URL</td><td><code>{baseUrl}</code></td></tr>
          <tr><td>Version</td><td>{spec.info?.version} (OpenAPI {spec.openapi})</td></tr>
          {scheme && <tr><td><KeyRound size={12} /> Auth</td><td>Header <code>{scheme.name}</code>. {scheme.description}</td></tr>}
        </tbody>
      </table>
      <div style={{ margin: '8px 0 16px' }}>
        <Btn size="sm" variant="ghost" icon={Download} onClick={() => window.open(`${String(apiBase).replace(/\/+$/, '')}${SPEC_PATH}`, '_blank', 'noopener')}>
          openapi.json
        </Btn>
      </div>
      {groups.map(({ tag, ops }) => (
        <section key={tag.name} style={{ marginBottom: 16 }}>
          <h4>{tag.name}</h4>
          {tag.description && <p className="dp-endpoint-params">{tag.description}</p>}
          {ops.map((entry) => <Operation key={`${entry.method} ${entry.path}`} spec={spec} entry={entry} baseUrl={baseUrl} />)}
        </section>
      ))}
    </div>
  );
}
