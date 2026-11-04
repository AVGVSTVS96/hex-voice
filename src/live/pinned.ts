// A thread's pinned status post, as the app draws it: its sections, each line marked by what the
// section says it is, commands set apart to copy, links kept, and Done folded away.
export type PinMark = 'done' | 'working' | 'needs' | 'failed' | 'idle';
export type PinLine =
  | { kind: 'item'; text: string; mark: PinMark; url?: string }
  | { kind: 'code'; text: string }
  | { kind: 'text'; text: string; url?: string };
export type PinSection = { title: string; mark: PinMark; folded: boolean; lines: PinLine[] };

const BULLET = /^\s*(?:[-*•·◦▪]|\d+[.)])\s+/;
const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/;
const URL = /https?:\/\/[^\s)]+[^\s).,;:!?'"]/;
// A heading's own emoji: the section's mark already says what it is.
const EMOJI = /^(\p{Extended_Pictographic}\uFE0F?\s*)+/u;
const TITLES =
  /^(done|running|working|in progress|pending|waiting on you|blocked on you|your call|known|known problems|next|later|live|links)\b[^:]{0,30}:\s*(.+)$/i;
const EMOJI_MARKS: [RegExp, PinMark][] = [
  [/^(✅|☑️|✔️)\s*/u, 'done'],
  [/^(❌|⚠️|🔴|🛑)\s*/u, 'failed'],
  [/^(🔄|⏳|🏃|🟡)\s*/u, 'working'],
  [/^(❓|👉|🟢)\s*/u, 'needs'],
];

export function pinSections(text: string): PinSection[] {
  const sections: PinSection[] = [];
  let current: PinSection = { title: '', mark: 'idle', folded: false, lines: [] };
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (/^\s*```/.test(raw)) {
      const code: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]!); i++) code.push(lines[i]!);
      current.lines.push({ kind: 'code', text: code.join('\n') });
      continue;
    }
    const line = raw.trim();
    if (!line) continue;
    const inline = plain(line).match(TITLES);
    const heading = inline ? inline[0].slice(0, inline[0].indexOf(':')).trim() : headingOf(line);
    if (heading) {
      if (current.title || current.lines.length) sections.push(current);
      const mark = sectionMark(heading);
      current = {
        title: heading,
        mark,
        folded: mark === 'done',
        lines: inline ? [item(inline[2]!, mark)] : [],
      };
      continue;
    }
    if (BULLET.test(line)) current.lines.push(item(line.replace(BULLET, ''), current.mark));
    else current.lines.push({ kind: 'text', ...linked(line) });
  }
  if (current.title || current.lines.length) sections.push(current);
  return sections;
}

// A short line that names what follows: bold on its own, or ending in a colon, or a known title.
function headingOf(line: string) {
  const bold = line.match(/^\*\*([^*]+)\*\*:?$/);
  if (bold) return bold[1]!.replace(EMOJI, '').replace(/:$/, '').trim();
  const bare = plain(line);
  if (bare.length <= 60 && bare.endsWith(':') && !BULLET.test(line))
    return bare.slice(0, -1).replace(EMOJI, '').trim();
  return undefined;
}

function sectionMark(title: string): PinMark {
  if (/\b(done|shipped|finished|live)\b/i.test(title)) return 'done';
  if (/\b(running|working|in progress|underway)\b/i.test(title)) return 'working';
  if (/\b(waiting on you|your call|needs you|blocked on you|for you|to decide)\b/i.test(title))
    return 'needs';
  if (/\b(known|problem|broken|fail|blocked|stuck)\b/i.test(title)) return 'failed';
  return 'idle';
}

function item(text: string, mark: PinMark): PinLine {
  let own = mark;
  let rest = text;
  for (const [emoji, emojiMark] of EMOJI_MARKS) {
    if (!emoji.test(rest)) continue;
    own = emojiMark;
    rest = rest.replace(emoji, '');
    break;
  }
  return { kind: 'item', ...linked(rest), mark: own };
}

// A line's link: a markdown link shows its label, and the line opens its url, or a bare url's.
function linked(text: string): { text: string; url?: string } {
  const link = text.match(LINK);
  const url = link?.[2] ?? text.match(URL)?.[0];
  return { text: plain(link ? text.replace(LINK, '$1') : text), ...(url && { url }) };
}

function plain(text: string) {
  return text
    .replace(/\*\*|__/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^📌\s*/u, '')
    .trim();
}
