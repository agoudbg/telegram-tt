import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import type { ApiOldLangPack, ApiOldLangString } from '../src/api/types';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'src');
const OUTPUT_PATH = path.join(SOURCE_DIR, 'assets', 'localization', 'shareLegacy.json');

const EXPORT_URLS = {
  macos: 'https://translations.telegram.org/en/macos/export',
  tdesktop: 'https://translations.telegram.org/en/tdesktop/export',
  ios: 'https://translations.telegram.org/en/ios/export',
  android: 'https://translations.telegram.org/en/android/export',
} as const;

const PLURAL_SUFFIXES: ReadonlyArray<[string, keyof Exclude<ApiOldLangString, string>]> = [
  ['_zero', 'zeroValue'],
  ['_one', 'oneValue'],
  ['_two', 'twoValue'],
  ['_few', 'fewValue'],
  ['_many', 'manyValue'],
  ['_other', 'otherValue'],
  ['_0', 'zeroValue'],
  ['_1', 'oneValue'],
  ['_2', 'twoValue'],
  ['_3_10', 'fewValue'],
  ['_any', 'otherValue'],
];

const HASH_PLURAL_SUFFIXES: Readonly<Record<string, keyof Exclude<ApiOldLangString, string>>> = {
  zero: 'zeroValue',
  one: 'oneValue',
  two: 'twoValue',
  few: 'fewValue',
  many: 'manyValue',
  other: 'otherValue',
};

const APPLE_STRING_REGEX = /^"((?:\\.|[^"])*)"\s*=\s*"((?:\\.|[^"])*)";/gm;
const ANDROID_STRING_REGEX = /<string\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g;

async function main() {
  const usedLiterals = collectSourceLiterals(SOURCE_DIR);
  const packs = await Promise.all(Object.entries(EXPORT_URLS).map(async ([platform, url]) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${platform} language pack: HTTP ${response.status}`);
    return [platform, await response.text()] as const;
  }));

  const merged: ApiOldLangPack = {};
  packs.forEach(([platform, source]) => {
    const parsed = platform === 'android' ? parseAndroidStrings(source) : parseAppleStrings(source);
    Object.assign(merged, parsed);
  });

  const filtered = Object.fromEntries(
    Object.entries(merged)
      .filter(([key]) => usedLiterals.has(key))
      .sort(([left], [right]) => left.localeCompare(right)),
  ) satisfies ApiOldLangPack;

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(filtered, undefined, 2)}\n`);
  console.log(`Wrote ${Object.keys(filtered).length} Share legacy strings to ${OUTPUT_PATH}`);
}

function collectSourceLiterals(directory: string): Set<string> {
  const literals = new Set<string>();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceLiterals(fullPath).forEach((value) => literals.add(value));
      continue;
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;

    const source = fs.readFileSync(fullPath, 'utf8');
    const sourceFile = ts.createSourceFile(fullPath, source, ts.ScriptTarget.Latest, false);
    visitSource(sourceFile, literals);
  }
  return literals;
}

function visitSource(node: ts.Node, literals: Set<string>) {
  if (ts.isStringLiteralLike(node)) literals.add(node.text);
  ts.forEachChild(node, (child) => visitSource(child, literals));
}

function parseAndroidStrings(source: string): ApiOldLangPack {
  const pack: ApiOldLangPack = {};
  for (const match of source.matchAll(ANDROID_STRING_REGEX)) {
    const key = match[1];
    const value = decodeEscapes(decodeXml(match[2]));
    addString(pack, key, value);
  }
  return pack;
}

function parseAppleStrings(source: string): ApiOldLangPack {
  const pack: ApiOldLangPack = {};
  for (const match of source.matchAll(APPLE_STRING_REGEX)) {
    addString(pack, decodeEscapes(match[1]), decodeEscapes(match[2]));
  }
  return pack;
}

function addString(pack: ApiOldLangPack, rawKey: string, value: string) {
  const hashIndex = rawKey.lastIndexOf('#');
  if (hashIndex > 0) {
    const pluralProperty = HASH_PLURAL_SUFFIXES[rawKey.slice(hashIndex + 1)];
    if (pluralProperty !== undefined) {
      addPlural(pack, rawKey.slice(0, hashIndex), pluralProperty, value);
      return;
    }
  }

  const suffix = PLURAL_SUFFIXES.find(([candidate]) => rawKey.endsWith(candidate));
  if (suffix !== undefined) {
    addPlural(pack, rawKey.slice(0, -suffix[0].length), suffix[1], value);
    return;
  }

  if (!rawKey.endsWith('_countable')) pack[rawKey] = value;
}

function addPlural(
  pack: ApiOldLangPack,
  key: string,
  property: keyof Exclude<ApiOldLangString, string>,
  value: string,
) {
  const existing = pack[key];
  const plural = typeof existing === 'object' ? existing : {};
  plural[property] = value;
  pack[key] = plural;
}

function decodeEscapes(value: string): string {
  return value
    .replace(/\\U([0-9a-fA-F]{4})/g, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

await main();
