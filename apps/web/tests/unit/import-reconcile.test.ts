import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { db } from "@/db/schema";
import { createLocal } from "@/db/repositories";
import { useSessionStore } from "@/stores/session";
import { useImportStore } from "@/stores/import";
import type { LocalTransaction } from "@/db/schema";

function tx(
  id: string,
  account: string,
  amountCents: number,
  date: string,
  type: LocalTransaction["type"],
  description = "",
): LocalTransaction {
  return {
    id,
    household: "h1",
    sync_id: `s-${id}`,
    account,
    credit_card: null,
    amount_cents: amountCents,
    currency: "BRL",
    type,
    date,
    posting_date: null,
    attribution: "indefinido",
    payer_user: null,
    category: null,
    description,
    status: "pago",
    recurrence: null,
    installment: null,
    invoice: null,
    transfer: null,
    attachment: null,
    tags: [],
    note: "",
    origin: "manual",
    external_ref: null,
    updated_by: null,
    deleted_at: null,
  };
}

const CSV = "data;valor;descricao\n05/03/2024;-120,00;Energia";

describe("import reconciliation", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.transactions.clear();
    await db.outbox.clear();
    await db.accounts.clear();
    useSessionStore().setHousehold("h1");
  });

  it("casa um lançamento manual e sugere ignorar", async () => {
    await createLocal("transactions", tx("t1", "acc1", 12000, "2024-03-05", "despesa", "Energia"));
    const store = useImportStore();
    store.parse(CSV);
    await store.reconcile("acc1");
    expect(store.rows[0]?.match?.id).toBe("t1");
    expect(store.rows[0]?.decision).toBe("ignore");
  });

  it("importa quando o usuário escolhe importar mesmo assim", async () => {
    await createLocal("transactions", tx("t1", "acc1", 12000, "2024-03-05", "despesa", "Energia"));
    const store = useImportStore();
    store.parse(CSV);
    await store.reconcile("acc1");
    store.setDecision(store.rows[0]!.row.externalRef, "import");
    const result = await store.confirm("acc1", null);
    expect(result.created).toBe(1);
    expect(await db.transactions.count()).toBe(2);
  });

  it("vincula ao existente sem duplicar", async () => {
    await createLocal("transactions", tx("t1", "acc1", 12000, "2024-03-05", "despesa", "Energia"));
    const store = useImportStore();
    store.parse(CSV);
    await store.reconcile("acc1");
    store.setDecision(store.rows[0]!.row.externalRef, "link");
    const result = await store.confirm("acc1", null);
    expect(result.linked).toBe(1);
    expect(await db.transactions.count()).toBe(1);
    const linked = await db.transactions.get("t1");
    expect(linked?.external_ref).toBeTruthy();
  });

  it("não casa quando o valor difere", async () => {
    await createLocal("transactions", tx("t1", "acc1", 99900, "2024-03-05", "despesa", "Energia"));
    const store = useImportStore();
    store.parse(CSV);
    await store.reconcile("acc1");
    expect(store.rows[0]?.match).toBeNull();
    expect(store.rows[0]?.decision).toBe("import");
  });
});
