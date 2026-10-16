import { db, type LocalHousehold } from "@/db/schema";
import { toPlain, updateLocal } from "@/db/repositories";

/**
 * O registro da família chega pelo primeiro sync; em instalações novas pode
 * demorar um instante. Espera um pouco antes de desistir.
 */
export async function waitForHousehold(
  householdId: string,
  tries = 20,
): Promise<LocalHousehold | undefined> {
  let household = await db.households.get(householdId);
  for (let index = 0; index < tries && !household; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    household = await db.households.get(householdId);
  }
  return household;
}

export async function loadHouseholdSetting<T>(
  householdId: string,
  key: string,
  fallback: T,
): Promise<T> {
  const household = await db.households.get(householdId);
  const settings = (household?.settings ?? {}) as Record<string, unknown>;
  const value = settings[key];
  return value === undefined ? fallback : (value as T);
}

export async function saveHouseholdSetting(
  householdId: string,
  key: string,
  value: unknown,
): Promise<void> {
  const household = await waitForHousehold(householdId);
  if (!household) {
    throw new Error("A família ainda não sincronizou neste aparelho. Tente de novo em instantes.");
  }
  await updateLocal(
    "households",
    toPlain({
      ...household,
      settings: { ...(household.settings ?? {}), [key]: value },
    }),
  );
}
