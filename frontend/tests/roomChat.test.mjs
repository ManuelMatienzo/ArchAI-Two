import assert from 'node:assert/strict';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const outdir = 'node_modules/.cache/chat-tests';
await mkdir(outdir, { recursive: true });
await build({
  entryPoints: ['src/components/collaboration/ChatMarkdown.tsx', 'src/services/roomChat.ts'],
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  outdir,
  outExtension: { '.js': '.mjs' },
  define: { 'import.meta.env': '{}' },
});
const load = (path) => import(pathToFileURL(`${process.cwd()}/${outdir}/${path}.mjs`).href);
const { ChatMarkdown } = await load('components/collaboration/ChatMarkdown');
const { mentionsArchAI, mergeMessages } = await load('services/roomChat');

for (const text of ['@ArchAI ayuda', 'Hola, @aRcHaI: revisa esto', '(@ARCHAI)'])
  assert.equal(mentionsArchAI(text), true);
for (const text of ['correo@archai', '@archaiOtraPersona', 'ñ@ArchAI', 'un mensaje sin IA'])
  assert.equal(mentionsArchAI(text), false);
const original = [
  { id: 'a', sequence: 1, text: 'Primero' },
  { id: 'b', sequence: 2, status: 'thinking' },
];
assert.deepEqual(
  mergeMessages(original, [
    { id: 'b', sequence: 2, status: 'sent' },
    { id: 'c', sequence: 3 },
  ]).map((m) => m.id),
  ['a', 'b', 'c']
);
assert.equal(original[1].status, 'thinking', 'La recepción no modifica la caché anterior');
const html = renderToStaticMarkup(
  React.createElement(ChatMarkdown, {
    text: '<script>alert(1)</script>\n\n[Enlace](javascript:alert(1))\n\n![externa](https://example.invalid/tracker)\n\n[Documentación](https://example.com)\n\n```java\nString nombre = "<img onerror=alert(1)>";\n```',
  })
);
assert.doesNotMatch(html, /<script|<img|href="javascript:/i);
assert.match(html, /&lt;img/);
assert.match(html, /rel="noopener noreferrer"/);
assert.match(html, /Copiar código/);
assert.match(html, /hljs-/);
console.log(
  'Chat: menciones exactas, recepción sin duplicados, Markdown seguro, código escapado y enlaces protegidos.'
);
