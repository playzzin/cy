export const SUPPORT_TEAM_ORDER_STORAGE_KEY = 'support:team-order:v1';

export type SupportTeamOrderItem = {
  id?: unknown;
  legacyId?: unknown;
  name?: unknown;
};

export const getSupportTeamOrderId = (team: SupportTeamOrderItem): string =>
  String(team.id ?? team.legacyId ?? team.name ?? '').trim();

export const normalizeSupportTeamOrder = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];

  return Array.from(new Set(
    values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
  ));
};

export const applySupportTeamOrder = <T extends SupportTeamOrderItem>(
  teams: T[],
  preferredOrder: string[]
): T[] => {
  if (preferredOrder.length === 0) return teams;

  const rankById = new Map(preferredOrder.map((id, index) => [id, index]));
  return teams
    .map((team, sourceIndex) => ({
      team,
      sourceIndex,
      rank: rankById.get(getSupportTeamOrderId(team))
    }))
    .sort((left, right) => {
      const leftRank = left.rank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = right.rank ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || left.sourceIndex - right.sourceIndex;
    })
    .map(({ team }) => team);
};

export const mergeVisibleSupportTeamOrder = (
  currentOrder: string[],
  visibleOrder: string[]
): string[] => {
  const normalizedCurrent = normalizeSupportTeamOrder(currentOrder);
  const normalizedVisible = normalizeSupportTeamOrder(visibleOrder);
  if (normalizedVisible.length === 0) return normalizedCurrent;

  const visibleIds = new Set(normalizedVisible);
  const result: string[] = [];
  let visibleIndex = 0;

  normalizedCurrent.forEach((id) => {
    if (visibleIds.has(id)) {
      const nextVisibleId = normalizedVisible[visibleIndex];
      visibleIndex += 1;
      if (nextVisibleId) result.push(nextVisibleId);
      return;
    }
    result.push(id);
  });

  while (visibleIndex < normalizedVisible.length) {
    result.push(normalizedVisible[visibleIndex]);
    visibleIndex += 1;
  }

  return normalizeSupportTeamOrder(result);
};

export const readSupportTeamOrder = (): string[] => {
  if (typeof window === 'undefined') return [];

  try {
    return normalizeSupportTeamOrder(JSON.parse(
      window.localStorage.getItem(SUPPORT_TEAM_ORDER_STORAGE_KEY) ?? '[]'
    ));
  } catch {
    return [];
  }
};

export const saveSupportTeamOrder = (teamIds: string[]): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      SUPPORT_TEAM_ORDER_STORAGE_KEY,
      JSON.stringify(normalizeSupportTeamOrder(teamIds))
    );
  } catch {
    // localStorage가 제한된 환경에서도 현재 화면의 순서 변경은 유지한다.
  }
};

export const clearSupportTeamOrder = (): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(SUPPORT_TEAM_ORDER_STORAGE_KEY);
  } catch {
    // localStorage가 제한된 환경에서는 현재 화면만 기본 순서로 되돌린다.
  }
};
