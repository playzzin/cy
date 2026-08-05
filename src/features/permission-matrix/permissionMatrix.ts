import type { MenuItem, SiteDataType } from '../../types/menu';

export interface PermissionMatrixRole {
  id: string;
  label: string;
  color?: string;
}

export interface PermissionMatrixOptions {
  selectedSite?: string;
  includeHidden?: boolean;
}

export interface PermissionMatrixRow {
  id: string;
  siteKey: string;
  siteName: string;
  label: string;
  menuPath: string;
  route: string;
  depth: number;
  hidden: boolean;
  roles: string[];
  allowedRoleIds: string[];
  allowedRoleLabels: string;
  restrictedRoleCount: number;
  accessByRole: Record<string, boolean>;
  mode: 'global' | 'restricted';
}

export interface PermissionMatrixRoleSummary {
  roleId: string;
  roleLabel: string;
  allowedCount: number;
  restrictedCount: number;
  coverageRate: number;
}

export interface PermissionMatrixResult {
  rows: PermissionMatrixRow[];
  roleSummaries: PermissionMatrixRoleSummary[];
  globalCount: number;
  restrictedCount: number;
  hiddenCount: number;
}

const normalizeRoles = (roles?: string[]): string[] => (
  Array.from(new Set((roles || []).map((role) => String(role).trim()).filter(Boolean)))
);

const isMenuItem = (value: string | MenuItem): value is MenuItem => (
  typeof value === 'object' && value !== null && typeof value.text === 'string'
);

const getMenuItemId = (siteKey: string, item: MenuItem, menuPath: string, indexPath: string): string => {
  const stableKey = item.id || item.path || menuPath || indexPath;
  return `${siteKey}:${stableKey}`;
};

const flattenItems = (
  siteKey: string,
  siteName: string,
  items: MenuItem[],
  options: Required<PermissionMatrixOptions>,
  parents: string[] = [],
  depth = 0,
  indexPrefix = ''
): Omit<PermissionMatrixRow, 'accessByRole' | 'allowedRoleIds' | 'allowedRoleLabels' | 'restrictedRoleCount'>[] => {
  const rows: Omit<PermissionMatrixRow, 'accessByRole' | 'allowedRoleIds' | 'allowedRoleLabels' | 'restrictedRoleCount'>[] = [];

  items.forEach((item, index) => {
    const menuPathParts = [...parents, item.text].filter(Boolean);
    const menuPath = menuPathParts.join(' > ');
    const indexPath = `${indexPrefix}${index}`;
    const roles = normalizeRoles(item.roles);
    const hidden = Boolean(item.hide);
    const subItems = (item.sub || []).filter(isMenuItem);

    if (!hidden || options.includeHidden) {
      rows.push({
        id: getMenuItemId(siteKey, item, menuPath, indexPath),
        siteKey,
        siteName,
        label: item.text,
        menuPath,
        route: item.path || item.action || '',
        depth,
        hidden,
        roles,
        mode: roles.length > 0 ? 'restricted' : 'global',
      });
    }

    if (subItems.length > 0) {
      rows.push(...flattenItems(
        siteKey,
        siteName,
        subItems,
        options,
        menuPathParts,
        depth + 1,
        `${indexPath}.`
      ));
    }
  });

  return rows;
};

export const flattenMenuPermissions = (
  menuData: SiteDataType | null | undefined,
  options: PermissionMatrixOptions = {}
): Omit<PermissionMatrixRow, 'accessByRole' | 'allowedRoleIds' | 'allowedRoleLabels' | 'restrictedRoleCount'>[] => {
  if (!menuData) return [];

  const normalizedOptions: Required<PermissionMatrixOptions> = {
    selectedSite: options.selectedSite || '',
    includeHidden: options.includeHidden ?? false,
  };

  return Object.entries(menuData)
    .filter(([siteKey]) => !normalizedOptions.selectedSite || siteKey === normalizedOptions.selectedSite)
    .sort(([, left], [, right]) => (left.order ?? 0) - (right.order ?? 0))
    .flatMap(([siteKey, site]) => flattenItems(
      siteKey,
      site.name || siteKey,
      site.menu || [],
      normalizedOptions
    ));
};

export const buildPermissionMatrix = (
  menuData: SiteDataType | null | undefined,
  roles: PermissionMatrixRole[],
  options: PermissionMatrixOptions = {}
): PermissionMatrixResult => {
  const normalizedRoles = roles.map((role) => ({
    ...role,
    id: String(role.id).trim(),
    label: String(role.label || role.id).trim(),
  })).filter((role) => role.id);

  const roleLabelById = new Map(normalizedRoles.map((role) => [role.id, role.label]));

  const rows = flattenMenuPermissions(menuData, options).map((row) => {
    const accessByRole = normalizedRoles.reduce<Record<string, boolean>>((acc, role) => {
      acc[role.id] = row.mode === 'global' || row.roles.includes(role.id);
      return acc;
    }, {});
    const allowedRoleIds = normalizedRoles
      .filter((role) => accessByRole[role.id])
      .map((role) => role.id);

    return {
      ...row,
      accessByRole,
      allowedRoleIds,
      allowedRoleLabels: row.mode === 'global'
        ? '전체 공개'
        : allowedRoleIds.map((roleId) => roleLabelById.get(roleId) || roleId).join(', '),
      restrictedRoleCount: normalizedRoles.length - allowedRoleIds.length,
    };
  });

  const totalRows = rows.length || 1;
  const roleSummaries = normalizedRoles.map((role) => {
    const allowedCount = rows.filter((row) => row.accessByRole[role.id]).length;
    return {
      roleId: role.id,
      roleLabel: role.label,
      allowedCount,
      restrictedCount: rows.length - allowedCount,
      coverageRate: Math.round((allowedCount / totalRows) * 100),
    };
  });

  return {
    rows,
    roleSummaries,
    globalCount: rows.filter((row) => row.mode === 'global').length,
    restrictedCount: rows.filter((row) => row.mode === 'restricted').length,
    hiddenCount: rows.filter((row) => row.hidden).length,
  };
};
