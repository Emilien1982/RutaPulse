// Restricted XML reader for GPX files (ADR 0019, section 9). One pass, no
// tree. It refuses any DOCTYPE or ENTITY declaration, so no entity can ever
// be declared (no external entity, no "billion laughs"). It never reads an
// address and never touches the network.

export class XmlError extends Error {}

export type XmlVisitor = {
  /** `path` holds the local names from the root to the opened element. */
  open(path: readonly string[], attributes: string): void;
  /** `text` is only filled for the names listed in `textOf`. */
  close(path: readonly string[], text: string): void;
};

const FORBIDDEN_DECLARATION = /<!(?:DOCTYPE|ENTITY)/i;
const START_TAG =
  /<([^\s/>!?]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/y;
const END_TAG = /<\/([^\s>]+)\s*>/y;
const ATTRIBUTE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const ENTITY = /&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;
const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function localName(name: string): string {
  const colon = name.indexOf(':');
  return colon < 0 ? name : name.slice(colon + 1);
}

/** The 5 predefined entities and numeric references. Others stay as is. */
export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(ENTITY, (whole, body: string) => {
    if (body[0] !== '#') return NAMED[body];
    const code =
      body[1] === 'x'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
      ? String.fromCodePoint(code)
      : whole;
  });
}

/** Attributes of a start tag, as name -> decoded value. */
export function readAttributes(raw: string): Map<string, string> {
  const result = new Map<string, string>();
  ATTRIBUTE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE.exec(raw)) !== null) {
    result.set(localName(match[1]), decodeEntities(match[2] ?? match[3]));
  }
  return result;
}

/** Walks the document. Throws `XmlError` when it is not well-formed. */
export function scanXml(
  input: string,
  visitor: XmlVisitor,
  textOf: ReadonlySet<string>,
): void {
  if (FORBIDDEN_DECLARATION.test(input)) throw new XmlError('declaration');
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const stack: string[] = []; // qualified names, to match closing tags
  const path: string[] = []; // local names
  const buffers: string[] = []; // collected text, one per open element
  let rootClosed = false;
  let rootSeen = false;
  let pos = 0;

  const addText = (chunk: string, raw: boolean): void => {
    if (stack.length === 0) {
      if (chunk.trim() !== '') throw new XmlError('text outside root');
      return;
    }
    if (textOf.has(path[path.length - 1])) {
      buffers[buffers.length - 1] += raw ? chunk : decodeEntities(chunk);
    }
  };

  while (pos < text.length) {
    const lt = text.indexOf('<', pos);
    if (lt < 0) {
      addText(text.slice(pos), false);
      break;
    }
    if (lt > pos) addText(text.slice(pos, lt), false);
    pos = lt;
    const next = text.charCodeAt(pos + 1);
    if (next === 0x3f /* ? */) {
      const end = text.indexOf('?>', pos + 2);
      if (end < 0) throw new XmlError('unclosed instruction');
      pos = end + 2;
    } else if (text.startsWith('<!--', pos)) {
      const end = text.indexOf('-->', pos + 4);
      if (end < 0) throw new XmlError('unclosed comment');
      pos = end + 3;
    } else if (text.startsWith('<![CDATA[', pos)) {
      const end = text.indexOf(']]>', pos + 9);
      if (end < 0) throw new XmlError('unclosed CDATA');
      addText(text.slice(pos + 9, end), true);
      pos = end + 3;
    } else if (next === 0x2f /* / */) {
      END_TAG.lastIndex = pos;
      const match = END_TAG.exec(text);
      if (!match || stack.pop() !== match[1]) throw new XmlError('bad end tag');
      const collected = buffers.pop() ?? '';
      visitor.close(path, collected);
      path.pop();
      if (stack.length === 0) rootClosed = true;
      pos = END_TAG.lastIndex;
    } else {
      START_TAG.lastIndex = pos;
      const match = START_TAG.exec(text);
      if (!match || rootClosed) throw new XmlError('bad start tag');
      const name = localName(match[1]);
      if (stack.length === 0) {
        if (name !== 'gpx') throw new XmlError('root is not gpx');
        rootSeen = true;
      }
      stack.push(match[1]);
      path.push(name);
      buffers.push('');
      visitor.open(path, match[2]);
      pos = START_TAG.lastIndex;
      if (match[3] === '/') {
        stack.pop();
        visitor.close(path, buffers.pop() ?? '');
        path.pop();
        if (stack.length === 0) rootClosed = true;
      }
    }
  }
  if (!rootSeen || stack.length > 0) throw new XmlError('unclosed element');
}
