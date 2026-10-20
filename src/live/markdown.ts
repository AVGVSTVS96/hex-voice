// hex's markdown as blocks: paragraphs, headings, lists, quotes, fenced code, and Discord's small
// grey lines (`-# `). What's inside a block (bold, code, links) is left for the screen to style.
export type Block =
  | { kind: 'text'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'list'; items: { mark: string; text: string }[] }
  | { kind: 'quote'; text: string }
  | { kind: 'small'; text: string };

const ITEM = /^\s*([-*•]|\d+[.)])\s+/;

export function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('```')) {
      const code: string[] = [];
      while (++i < lines.length && !lines[i]!.startsWith('```')) code.push(lines[i]!);
      blocks.push({ kind: 'code', text: code.join('\n') });
    } else if (!line.trim()) {
      continue;
    } else if (line.startsWith('-# ')) {
      blocks.push({ kind: 'small', text: line.slice(3) });
    } else if (/^#{1,6}\s/.test(line)) {
      blocks.push({ kind: 'heading', text: line.replace(/^#+\s+/, '') });
    } else if (line.startsWith('>')) {
      const quote = [line];
      while (lines[i + 1]?.startsWith('>')) quote.push(lines[++i]!);
      blocks.push({
        kind: 'quote',
        text: quote.map((said) => said.replace(/^>\s?/, '')).join('\n'),
      });
    } else if (ITEM.test(line)) {
      const items: { mark: string; text: string }[] = [];
      for (; i < lines.length && ITEM.test(lines[i]!); i++) {
        const mark = lines[i]!.match(ITEM)![1]!;
        items.push({ mark: /\d/.test(mark) ? mark : '•', text: lines[i]!.replace(ITEM, '') });
      }
      i--;
      blocks.push({ kind: 'list', items });
    } else {
      const paragraph = [line];
      while (i + 1 < lines.length && startsParagraph(lines[i + 1]!)) paragraph.push(lines[++i]!);
      blocks.push({ kind: 'text', text: paragraph.join('\n') });
    }
  }
  return blocks;
}

const startsParagraph = (line: string) =>
  !!line.trim() &&
  !line.startsWith('```') &&
  !line.startsWith('>') &&
  !line.startsWith('-# ') &&
  !/^#{1,6}\s/.test(line) &&
  !ITEM.test(line);

// A message as one run of words for a preview: its paragraphs, headings, quotes and list items
// joined, its code left out. Bold, code and links inside stay for the screen to style.
export function plainOf(text: string) {
  return blocksOf(text)
    .map((block) =>
      block.kind === 'code'
        ? ''
        : block.kind === 'list'
          ? block.items.map((item) => item.text).join(' · ')
          : block.text.replace(/\n/g, ' '),
    )
    .filter(Boolean)
    .join(' ');
}
