import { describe, expect, it } from "vitest";
import { parseNumber, parsePastedItems } from "@/lib/calc/paste";

describe("parsePastedItems", () => {
  it("lit les colonnes copiées depuis Excel (avec ou sans code)", () => {
    const items = parsePastedItems("1.1\tFouilles\tm3\t1 200,5\t650\n\nBéton\tm3\t10\t24000\n");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ code: "1.1", designation: "Fouilles", unit: "m3", quantity: 1200.5, unitPrice: 650 });
    expect(items[1]).toMatchObject({ code: "", designation: "Béton", unit: "m3", quantity: 10, unitPrice: 24000 });
    expect(items[0].id).not.toBe(items[1].id);
  });

  it("ignore les lignes sans désignation et les nombres invalides", () => {
    expect(parsePastedItems("\t\t\t\t")).toHaveLength(0);
    expect(parseNumber("abc")).toBe(0);
    expect(parseNumber("12 500,25")).toBe(12500.25);
  });
});
