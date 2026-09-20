export const MEAL_DRAFT_TTL_MS = 15 * 60 * 1000;
export function isFreshMealDraft(draft: { updatedAt?: number } | null | undefined, now = Date.now()) {
  return !!draft && typeof draft.updatedAt === 'number' && Number.isFinite(draft.updatedAt) && draft.updatedAt <= now && now - draft.updatedAt < MEAL_DRAFT_TTL_MS;
}
