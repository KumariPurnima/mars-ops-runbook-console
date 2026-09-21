'use client';

import { useState, type ReactNode } from 'react';
import {
  triageManifest,
  runbookManifest,
  triagePrompt,
  runbookPrompt,
  triageSkill,
  runbookSkill,
} from '@/lib/manifests.generated';
import { Markdown } from './Markdown';

function resolve(text: string): string {
  if (typeof window === 'undefined') return text;
  return text
    .replaceAll('"${CONSOLE_HOST}"', window.location.host)
    .replaceAll('${CONSOLE_HOST}', window.location.host)
    .replaceAll('"${CONSOLE_URL}"', window.location.origin)
    .replaceAll('${CONSOLE_URL}', window.location.origin)
    .replaceAll('${INFERENCE_MODEL}', 'openai-gpt-4.1');
}

function denyRules(yaml: string): string[] {
  return yaml
    .split('\n')
    .filter((l) => l.includes('action: deny'))
    .map((l) => l.match(/command: "([^"]+)"/)?.[1] ?? '')
    .filter(Boolean);
}

function allowHosts(yaml: string): string[] {
  const start = yaml.indexOf('egress:');
  if (start === -1) return [];
  return yaml
    .slice(start)
    .split(/\n(?=\S)/)[0]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).replace(/"/g, ''));
}

function highlightYaml(text: string): ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (/^\s*#/.test(line)) {
      return (
        <div key={i} className="text-subtle">
          {line || ' '}
        </div>
      );
    }
    const kv = line.match(/^(\s*-?\s*)([A-Za-z0-9_.-]+)(:)(.*)$/);
    if (kv) {
      return (
        <div key={i}>
          <span className="text-secondary">{kv[1]}</span>
          <span className="text-blue">{kv[2]}</span>
          <span className="text-muted">{kv[3]}</span>
          <span className="text-secondary">{kv[4]}</span>
        </div>
      );
    }
    return (
      <div key={i} className="text-secondary">
        {line || ' '}
      </div>
    );
  });
}

type View =
  | { kind: 'manifest'; label: string; yaml: string }
  | { kind: 'prompt'; label: string; text: string }
  | { kind: 'skill'; label: string; skill: { name: string; description: string; body: string } };

export function AgentsTab() {
  const views: View[] = [
    { kind: 'manifest', label: 'triage.yaml', yaml: triageManifest },
    { kind: 'manifest', label: 'runbook.yaml', yaml: runbookManifest },
    { kind: 'skill', label: 'triage skill', skill: triageSkill },
    { kind: 'skill', label: 'runbook skill', skill: runbookSkill },
    { kind: 'prompt', label: 'triage prompt', text: triagePrompt },
    { kind: 'prompt', label: 'runbook prompt', text: runbookPrompt },
  ];
  const [idx, setIdx] = useState(0);
  const view = views[idx];
  const yaml = view.kind === 'manifest' ? resolve(view.yaml) : null;
  const denies = yaml ? denyRules(yaml) : denyRules(triageManifest + '\n' + runbookManifest);
  const hosts = yaml ? allowHosts(yaml) : allowHosts(triageManifest);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-lg border border-red/40 bg-red/5 p-3">
          <div className="text-sm font-semibold text-red pb-2">Denied by policy</div>
          <ul className="space-y-1 mono text-sm text-secondary">
            {denies.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-green/40 bg-green/5 p-3">
          <div className="text-sm font-semibold text-green pb-2">Allowlisted egress</div>
          <ul className="space-y-1 mono text-sm text-secondary">
            {(hosts.length ? hosts : ['inference.do-ai.run', 'api.digitalocean.com']).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-do-blue/40 bg-do-blue/5 p-3">
          <div className="text-sm font-semibold text-blue pb-2">Model layer</div>
          <p className="text-sm text-secondary leading-relaxed">
            Serverless Inference at <span className="mono text-primary">inference.do-ai.run</span> —
            one <span className="mono">fetch</span> in <span className="mono">lib/ai.ts</span>, no
            GPUs, no model servers.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-edge bg-panel overflow-hidden">
        <div className="px-3 py-2 border-b border-edge bg-raised flex flex-wrap gap-1">
          {views.map((v, i) => (
            <button
              key={v.label}
              onClick={() => setIdx(i)}
              className={`text-sm px-2.5 py-1 rounded transition ${
                idx === i ? 'bg-do-blue/20 text-primary font-medium' : 'text-muted hover:text-primary'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="p-3 max-h-[560px] overflow-auto">
          {view.kind === 'manifest' && yaml && (
            <pre className="mono text-sm leading-relaxed">{highlightYaml(yaml)}</pre>
          )}
          {view.kind === 'prompt' && (
            <pre className="mono text-sm text-secondary whitespace-pre-wrap">{view.text}</pre>
          )}
          {view.kind === 'skill' && (
            <div>
              <div className="text-lg font-semibold text-primary pb-1">{view.skill.name}</div>
              <p className="text-sm text-muted pb-3">{view.skill.description}</p>
              <Markdown text={view.skill.body} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
