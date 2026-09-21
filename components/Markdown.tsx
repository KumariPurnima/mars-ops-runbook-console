'use client';

/** Tiny markdown renderer — bold, code, lists, headings — enough for feed + postmortem. */
export function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\n+/);
  return (
    <div className="space-y-2.5 text-base leading-relaxed text-secondary">
      {blocks.map((block, i) => {
        if (block.startsWith('## ')) {
          return (
            <h3 key={i} className="text-lg font-semibold text-primary pt-1">
              {inline(block.slice(3))}
            </h3>
          );
        }
        if (block.startsWith('# ')) {
          return (
            <h2 key={i} className="text-xl font-semibold text-primary pt-1">
              {inline(block.slice(2))}
            </h2>
          );
        }
        if (/^[-*] /.test(block) || block.includes('\n- ') || block.includes('\n* ')) {
          const items = block.split('\n').filter((l) => /^[-*] /.test(l));
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {items.map((l, j) => (
                <li key={j}>{inline(l.replace(/^[-*] /, ''))}</li>
              ))}
            </ul>
          );
        }
        if (block.startsWith('```')) {
          const body = block.replace(/^```[a-z]*\n?/, '').replace(/```$/, '');
          return (
            <pre key={i} className="mono bg-code border border-edge rounded-md px-3 py-2 overflow-x-auto text-secondary">
              {body}
            </pre>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}

function inline(s: string) {
  const parts = s.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`')) {
      return (
        <code key={i} className="mono text-blue bg-code/80 px-1 rounded">
          {p.slice(1, -1)}
        </code>
      );
    }
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} className="text-primary font-semibold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
