import { fr, type Dict } from "./fr";
import { ar } from "./ar";

export type Lang = "fr" | "ar";
export const LANGS: Lang[] = ["fr", "ar"];
export const LANG_COOKIE = "gtx_lang";
export const dictionaries: Record<Lang, Dict> = { fr, ar };

export function normalizeLang(value: string | undefined | null): Lang {
  return value === "ar" ? "ar" : "fr";
}

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

export type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const raw = lookup(dictionaries[lang], key) ?? lookup(dictionaries.fr, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}
