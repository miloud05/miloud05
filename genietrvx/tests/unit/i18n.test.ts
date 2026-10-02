import { describe, expect, it } from "vitest";
import { dictionaries, normalizeLang, translate } from "@/lib/i18n";
import { ENUMS } from "@/lib/schemas";

function keys(obj: unknown, prefix = ""): string[] {
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

describe("i18n", () => {
  it("le dictionnaire arabe couvre toutes les clés françaises", () => {
    expect(keys(dictionaries.ar).sort()).toEqual(keys(dictionaries.fr).sort());
  });

  it("traduit chaque valeur d'énumération dans les deux langues", () => {
    for (const lang of ["fr", "ar"] as const) {
      for (const [enumKey, values] of Object.entries(ENUMS)) {
        for (const v of values) {
          const key = `enums.${enumKey}.${v}`;
          expect(translate(lang, key), key).not.toBe(key);
        }
      }
    }
  });

  it("interpole les variables et retombe sur la clé inconnue", () => {
    expect(translate("fr", "common.results", { count: 3 })).toBe("3 résultat(s)");
    expect(translate("ar", "common.results", { count: 3 })).toBe("3 نتيجة");
    expect(translate("fr", "nope.key")).toBe("nope.key");
    expect(normalizeLang("ar")).toBe("ar");
    expect(normalizeLang("xx")).toBe("fr");
  });
});
