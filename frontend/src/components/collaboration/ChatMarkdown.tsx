import { ReactNode, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js/lib/core';
import java from 'highlight.js/lib/languages/java';
import typescript from 'highlight.js/lib/languages/typescript';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import { Copy, Check } from 'lucide-react';
hljs.registerLanguage('java', java);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', typescript);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);
function Code({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const copy = async () => {
    try {
      const element = children as { props?: { children?: unknown } };
      await navigator.clipboard.writeText(String(element?.props?.children || ''));
      setError(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(true);
    }
  };
  return (
    <div className="chat-code">
      <button type="button" aria-label="Copiar código" onClick={() => void copy()}>
        {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
      </button>
      {error && <small role="status">Puedes seleccionar el código para copiarlo manualmente.</small>}
      <pre>{children}</pre>
    </div>
  );
}
export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ alt }) => <span>{alt ? `[Imagen: ${alt}]` : '[Imagen]'}</span>,
          pre: ({ children }) => <Code>{children}</Code>,
          code: ({ children, className }) => {
            const language = className?.replace('language-', '');
            return language && hljs.getLanguage(language) ? (
              <code
                className={className}
                dangerouslySetInnerHTML={{
                  __html: hljs.highlight(String(children), { language, ignoreIllegals: true }).value,
                }}
              />
            ) : (
              <code className={className}>{children}</code>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
