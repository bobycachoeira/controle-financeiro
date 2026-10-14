import { db } from "@/db/schema";
import { toPlain, updateLocal } from "@/db/repositories";

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
  const household = await db.households.get(householdId);
  if (!household) return;
  await updateLocal(
    "households",
    toPlain({
      ...household,
      settings: { ...(household.settings ?? {}), [key]: value },
    }),
  );
}
