// A thread's pinned status post, as the app draws it: its sections, each line marked by what the
// section says it is, commands set apart to copy, links kept, and Done folded away.
export type PinMark = 'done' | 'working' | 'needs' | 'failed' | 'idle';

export type PinLine =
  | { kind: 'item'; text: string; mark: PinMark; url?: string }
  | { kind: 'code'; text: string }
  | { kind: 'text'; text: string; url?: string };

export interface PinSection {
  title: string;
  mark: PinMark;
  folded: boolean;
  lines: PinLine[];
}

const BULLET = /^\s*(?:[-*•·◦▪]|\d+[.)])\s+/u;
const LINK = /\[(?<label>[^\]]+)\]\((?<url>https?:\/\/[^)\s]+)\)/u;

// A line bold from its title to its end, colon inside: bold the title alone.
const WHOLE_BOLD = /^(?<bold>\*\*|__)(?<title>[^:*_]{1,40}:)(?<rest>.*?)\k<bold>$/u;
const PIN = /^📌\s*/u;
const URL = /https?:\/\/[^\s)]+[^\s).,;:!?'"]/u;

// A heading's own emoji: the section's mark already says what it is.
const EMOJI = /^(?:\p{Extended_Pictographic}\uFE0F?\s*)+/u;

const TITLES =
  /^(?<title>(?:\*\*|__)?(?:done|running|working|in progress|pending|waiting on you|blocked on you|your call|known|known problems|next|later|live|links)\b[^:]{0,30}):(?:\*\*|__)?\s*(?<rest>.+)$/iu;

const EMOJI_MARKS: [RegExp, PinMark][] = [
  [/^(?:✅|☑️|✔️|✔|✓)\s*/u, 'done'],
  [/^(?:❌|⚠️|🔴|🛑)\s*/u, 'failed'],
  [/^(?:🔄|⏳|🏃|🟡)\s*/u, 'working'],
  [/^(?:❓|👉|🟢)\s*/u, 'needs'],
];

export const pinSections = (text: string): PinSection[] => {
  const sections: PinSection[] = [];
  let current: PinSection = { title: '', mark: 'idle', folded: false, lines: [] };
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];

    if (/^\s*```/u.test(raw)) {
      const code: string[] = [];

      for (i += 1; i < lines.length && !/^\s*```/u.test(lines[i]); i += 1) {
        code.push(lines[i]);
      }

      current.lines.push({ kind: 'code', text: code.join('\n') });
      continue;
    }

    const line = raw.trim().replace(PIN, '');

    if (!line) {
      continue;
    }

    const inline = TITLES.exec(line.replace(WHOLE_BOLD, '$<bold>$<title>$<bold>$<rest>'))?.groups;
    const heading = inline ? plain(inline.title) : headingOf(line);

    if (heading !== undefined && heading !== '') {
      if (current.title || current.lines.length) {
        sections.push(current);
      }

      const mark = sectionMark(heading);
      current = {
        title: heading,
        mark,
        folded: mark === 'done',
        lines: inline ? [item(inline.rest, mark)] : [],
      };
      continue;
    }

    if (BULLET.test(line)) {
      current.lines.push(item(line.replace(BULLET, ''), current.mark));
    } else {
      current.lines.push({ kind: 'text', ...linked(line) });
    }
  }

  if (current.title || current.lines.length) {
    sections.push(current);
  }

  return sections;
};

// A short line that names what follows: bold on its own, or ending in a colon, or a known title.
const headingOf = (line: string): string | undefined => {
  const bold = /^\*\*(?<title>[^*]+)\*\*:?$/u.exec(line)?.groups;

  if (bold) {
    return bold.title.replace(EMOJI, '').replace(/:$/u, '').trim();
  }

  const bare = plain(line);

  if (bare.length <= 60 && bare.endsWith(':') && !BULLET.test(line)) {
    return bare.slice(0, -1).replace(EMOJI, '').trim();
  }

  return undefined;
};

const sectionMark = (title: string): PinMark => {
  if (/\b(?:done|shipped|finished|live)\b/iu.test(title)) {
    return 'done';
  }

  if (/\b(?:running|working|in progress|underway)\b/iu.test(title)) {
    return 'working';
  }

  if (/\b(?:waiting on you|your call|needs you|blocked on you|for you|to decide)\b/iu.test(title)) {
    return 'needs';
  }

  if (/\b(?:known|problem|broken|fail|blocked|stuck)\b/iu.test(title)) {
    return 'failed';
  }

  return 'idle';
};

const item = (text: string, mark: PinMark): PinLine => {
  let own = mark;
  let rest = text;

  for (const [emoji, emojiMark] of EMOJI_MARKS) {
    if (!emoji.test(rest)) {
      continue;
    }

    own = emojiMark;
    rest = rest.replace(emoji, '');
    break;
  }

  return { kind: 'item', ...linked(rest), mark: own };
};

// A line's link: a markdown link shows its label, and the line opens its url, or a bare url's.
const linked = (text: string) => {
  const link = LINK.exec(text);
  const url = link?.groups?.url ?? URL.exec(text)?.[0];

  return {
    text: (link ? text.replace(LINK, '$<label>') : text).trim(),
    ...(url !== undefined && { url }),
  };
};

const plain = (text: string) => text.replaceAll(/\*\*|__/gu, '').trim();
