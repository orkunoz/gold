export type HistoryActor = { employees?: { full_name: string | null } | null; changed_by_username?: string | null; changed_by_name?: string | null };

export function historyActorName(actor: HistoryActor, systemLabel: string) {
  return actor.employees?.full_name?.trim() || actor.changed_by_username?.trim() || actor.changed_by_name?.trim() || systemLabel;
}
