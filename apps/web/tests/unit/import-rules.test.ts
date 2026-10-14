import { describe, expect, it } from "vitest";
import { db, type LocalHousehold } from "@/db/schema";
import { matchImportRule, parseImportRules } from "@/lib/import-rules";
import { loadHouseholdSetting, saveHouseholdSetting } from "@/lib/household-settings";

describe("regras de importação", () => {
  it("parseia somente regras válidas", () => {
    const parsed = parseImportRules([
      { pattern: "ifood", category: "c1" },
      { pattern: "", category: "c2" },
      { pattern: "x" },
      null,
    ]);
    expect(parsed).toEqual([{ pattern: "ifood", category: "c1" }]);
    expect(parseImportRules(undefined)).toEqual([]);
  });

  it("casa a primeira regra que aparece na descrição", () => {
    const rules = [
      { pattern: "uber", category: "transporte" },
      { pattern: "ifood", category: "alimentacao" },
    ];
    expect(matchImportRule("UBER *TRIP 123", rules)?.category).toBe("transporte");
    expect(matchImportRule("Ifood pedido 99", rules)?.category).toBe("alimentacao");
    expect(matchImportRule("Padaria da esquina", rules)).toBeNull();
  });

  it("guarda e lê configurações da família", async () => {
    await db.households.clear();
    await db.households.put({
      id: "h1",
      name: "Casa",
      sync_id: "s-h1",
      settings: {},
      updated_by: null,
      deleted_at: null,
    } as LocalHousehold);

    expect(await loadHouseholdSetting("h1", "import_rules", [])).toEqual([]);
    await saveHouseholdSetting("h1", "import_rules", [{ pattern: "ifood", category: "c1" }]);
    expect(await loadHouseholdSetting("h1", "import_rules", [])).toEqual([
      { pattern: "ifood", category: "c1" },
    ]);
  });
});
