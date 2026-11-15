import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Kontrak sistem ikon KaffePOS (lihat docs/design/ICON_NAMING_AUDIT.md):
 * hanya lucide-react, ukuran 16 / 20 / 24, strokeWidth bawaan (2), dan tanpa
 * glyph "AI generik" sebagai ikon fitur.
 */
const SRC = resolve(process.cwd(), 'src');
const ALLOWED_SIZES = new Set(['16', '20', '24']);
const BANNED_GLYPHS = ['Sparkles', 'Wand2', 'Brain', 'Zap', 'Rocket', 'Crown', 'Gem', 'Trophy', 'Medal', 'Flame'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'test') walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function lucideNames(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/import \{([^}]*)\} from 'lucide-react';/g)) {
    for (const raw of match[1].split(',')) {
      const item = raw.trim();
      if (!item || item.startsWith('type ')) continue;
      names.push(item.split(' as ').pop()!.trim());
    }
  }
  return names;
}

const files = walk(SRC).map((path) => ({ path: path.replace(`${SRC}/`, ''), source: readFileSync(path, 'utf8') }));

describe('sistem ikon', () => {
  it('hanya memakai lucide-react sebagai pustaka ikon', () => {
    const others = files.filter(({ source }) => /from '(react-icons|@heroicons|@phosphor-icons|@fortawesome)[^']*'/.test(source));
    expect(others.map((file) => file.path)).toEqual([]);
  });

  it('tidak mengimpor glyph hiasan yang dilarang', () => {
    const offenders: string[] = [];
    for (const { path, source } of files) {
      const names = lucideNames(source);
      for (const glyph of BANNED_GLYPHS) {
        if (names.includes(glyph)) offenders.push(`${path}: ${glyph}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('memakai ukuran 16, 20, atau 24 dan strokeWidth bawaan', () => {
    const offenders: string[] = [];
    for (const { path, source } of files) {
      if (!path.endsWith('.tsx')) continue;
      const names = lucideNames(source);
      if (names.length === 0) continue;
      const tag = new RegExp(`<(${names.join('|')})\\b([^<>]*?)/?>`, 'g');
      for (const match of source.matchAll(tag)) {
        const attrs = match[2];
        const size = attrs.match(/\bsize=\{(\d+(?:\.\d+)?)\}/);
        if (size && !ALLOWED_SIZES.has(size[1])) offenders.push(`${path}: <${match[1]} size={${size[1]}}>`);
        if (/\bstrokeWidth=/.test(attrs)) offenders.push(`${path}: <${match[1]}> memakai strokeWidth`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
