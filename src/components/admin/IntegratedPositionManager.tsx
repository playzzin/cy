import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDown,
  faArrowUp,
  faBroom,
  faBuilding,
  faCheck,
  faChevronDown,
  faCircleInfo,
  faListCheck,
  faPalette,
  faPen,
  faPlus,
  faRotateLeft,
  faSearch,
  faSitemap,
  faSpinner,
  faTrash,
  faUser,
  faUserTag,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { findBusinessPartnerPositionDefinition } from '../../constants/businessPartnerPositions';
import { resolveIcon } from '../../constants/iconMap';
import { manpowerService, type Worker } from '../../services/manpowerService';
import { officeStaffService, type OfficeStaff } from '../../services/officeStaffService';
import { positionService, type Position } from '../../services/positionService';
import { userMenuPositionService, type UserMenuPositionMap } from '../../services/userMenuPositionService';
import { userService, type UserData } from '../../services/userService';
import { ACCOUNT_TYPE_LABELS } from '../../types/accountLink';
import { UserRole } from '../../types/roles';
import IconPicker from '../../pages/admin/menu/components/IconPicker';

const COLOR_OPTIONS = [
  { id: 'red', label: 'Red', hex: '#ef4444' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'yellow', label: 'Yellow', hex: '#eab308' },
  { id: 'green', label: 'Green', hex: '#10b981' },
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { id: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
  { id: 'gray', label: 'Gray', hex: '#64748b' },
  { id: 'slate', label: 'Slate', hex: '#334155' },
];

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; tone: string }> = [
  { value: UserRole.ADMIN, label: '관리자', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: UserRole.MANAGER, label: '매니저', tone: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: UserRole.GENERAL, label: '일반', tone: 'bg-slate-50 text-slate-700 border-slate-200' },
];

const DEFAULT_POSITION_APPEARANCE: Partial<Record<UserRole, { color: string; icon: string }>> = {
  [UserRole.ADMIN]: { color: 'purple', icon: 'faCrown' },
  [UserRole.MANAGER]: { color: 'indigo', icon: 'faUserTie' },
  [UserRole.GENERAL]: { color: 'slate', icon: 'faUserTag' },
};

const getDefaultPositionAppearance = (role: UserRole) => (
  DEFAULT_POSITION_APPEARANCE[role] || DEFAULT_POSITION_APPEARANCE[UserRole.GENERAL]!
);

interface IntegratedPositionManagerProps {
  positions: Position[];
  users: UserData[];
  workers: Worker[];
  officeStaffRows: OfficeStaff[];
  userPositionMap: UserMenuPositionMap;
  onChanged: () => Promise<void> | void;
}

type PersonnelRow =
  | { type: 'worker'; id: string; uid?: string; name: string; subText: string; role: string }
  | { type: 'office'; id: string; uid?: string; name: string; subText: string; role: string };

type PositionUserAssignment = {
  user: UserData;
  isBasePosition: boolean;
  isAdditionalPosition: boolean;
};

type PositionPersonnelAssignment = PersonnelRow & {
  linkedUser?: UserData;
  isPrimaryPositionSynced: boolean;
};

type PositionPersonnelGroups = {
  workers: PositionPersonnelAssignment[];
  office: PositionPersonnelAssignment[];
};

const normalize = (value: unknown): string => String(value || '').trim();

const getPositionKey = (position: Position): string => String(position.id || position.name);

const getColorOption = (colorId?: string) =>
  COLOR_OPTIONS.find((color) => color.id === colorId) || COLOR_OPTIONS.find((color) => color.id === 'gray')!;

const getRoleLabel = (role?: UserRole): string =>
  ROLE_OPTIONS.find((option) => option.value === role)?.label || '일반';

const getAccountTypeLabel = (accountType?: UserData['accountType']): string =>
  accountType ? ACCOUNT_TYPE_LABELS[accountType] : '미연결 계정';

const replacePositionName = (values: string[], oldName: string, newName: string): string[] =>
  Array.from(new Set(values.map((value) => (normalize(value) === oldName ? newName : normalize(value))).filter(Boolean)));

const IntegratedPositionManager: React.FC<IntegratedPositionManagerProps> = ({
  positions,
  users,
  workers,
  officeStaffRows,
  userPositionMap,
  onChanged,
}) => {
  const navigate = useNavigate();
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.GENERAL);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState('');
  const [assignmentSavingId, setAssignmentSavingId] = useState('');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [iconPickerTarget, setIconPickerTarget] = useState<string | null>(null);
  const [expandedPositionKey, setExpandedPositionKey] = useState<string | null>(null);

  const orderedPositions = useMemo(
    () => [...positions].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)),
    [positions],
  );

  const positionNames = useMemo(
    () => new Set(orderedPositions.map((position) => normalize(position.name)).filter(Boolean)),
    [orderedPositions],
  );

  const usageByPosition = useMemo(() => {
    const map = new Map<string, { users: number; extras: number; workers: number; office: number; total: number }>();
    orderedPositions.forEach((position) => {
      const name = normalize(position.name);
      const baseUsers = users.filter((user) => normalize(user.position) === name).length;
      const extraUsers = users.filter((user) => (userPositionMap[user.uid] || []).map(normalize).includes(name)).length;
      const workerCount = workers.filter((worker) => normalize(worker.role) === name).length;
      const officeCount = officeStaffRows.filter((staff) => normalize(staff.role) === name).length;
      map.set(name, {
        users: baseUsers,
        extras: extraUsers,
        workers: workerCount,
        office: officeCount,
        total: baseUsers + extraUsers + workerCount + officeCount,
      });
    });
    return map;
  }, [officeStaffRows, orderedPositions, userPositionMap, users, workers]);

  const usersByPosition = useMemo(() => {
    const assignments = new Map<string, PositionUserAssignment[]>();
    orderedPositions.forEach((position) => {
      const name = normalize(position.name);
      if (name) assignments.set(name, []);
    });

    users.forEach((user) => {
      const basePosition = normalize(user.position);
      const additionalPositions = new Set((userPositionMap[user.uid] || []).map(normalize).filter(Boolean));

      const baseAssignments = assignments.get(basePosition);
      if (baseAssignments) {
        baseAssignments.push({
          user,
          isBasePosition: true,
          isAdditionalPosition: additionalPositions.has(basePosition),
        });
      }

      additionalPositions.forEach((positionName) => {
        if (positionName === basePosition) return;
        const positionAssignments = assignments.get(positionName);
        if (positionAssignments) {
          positionAssignments.push({ user, isBasePosition: false, isAdditionalPosition: true });
        }
      });
    });

    assignments.forEach((positionUsers) => {
      positionUsers.sort((a, b) => {
        const aLabel = a.user.displayName || a.user.email || a.user.uid;
        const bLabel = b.user.displayName || b.user.email || b.user.uid;
        return aLabel.localeCompare(bLabel, 'ko');
      });
    });

    return assignments;
  }, [orderedPositions, userPositionMap, users]);

  const usersByUid = useMemo(
    () => new Map(users.map((user) => [user.uid, user])),
    [users],
  );

  const linkedUserByWorkerId = useMemo(() => {
    const map = new Map<string, UserData>();
    users.forEach((user) => {
      (user.linkedWorkerIds || []).forEach((workerId) => {
        const key = normalize(workerId);
        if (key) map.set(key, user);
      });
    });
    workers.forEach((worker) => {
      const linkedUser = worker.uid ? usersByUid.get(String(worker.uid)) : undefined;
      if (!linkedUser) return;
      [worker.id, worker.legacyId].forEach((workerId) => {
        const key = normalize(workerId);
        if (key) map.set(key, linkedUser);
      });
    });
    return map;
  }, [users, usersByUid, workers]);

  const linkedUserByOfficeStaffId = useMemo(() => {
    const map = new Map<string, UserData>();
    users.forEach((user) => {
      (user.linkedOfficeStaffIds || []).forEach((staffId) => {
        const key = normalize(staffId);
        if (key) map.set(key, user);
      });
    });
    officeStaffRows.forEach((staff) => {
      const linkedUser = staff.uid ? usersByUid.get(String(staff.uid)) : undefined;
      if (!linkedUser) return;
      [staff.id, staff.legacyId].forEach((staffId) => {
        const key = normalize(staffId);
        if (key) map.set(key, linkedUser);
      });
    });
    return map;
  }, [officeStaffRows, users, usersByUid]);

  const personnelRows = useMemo<PersonnelRow[]>(() => {
    const workerRows: PersonnelRow[] = workers
      .filter((worker) => worker.id)
      .map((worker) => ({
        type: 'worker',
        id: String(worker.id),
        uid: worker.uid,
        name: normalize(worker.name) || '이름 없음',
        subText: normalize(worker.teamName || worker.idNumber || '작업자'),
        role: normalize(worker.role),
      }));
    const officeRows: PersonnelRow[] = officeStaffRows
      .filter((staff) => staff.id)
      .map((staff) => ({
        type: 'office',
        id: String(staff.id),
        uid: staff.uid,
        name: normalize(staff.name) || '이름 없음',
        subText: normalize(staff.department || staff.email || '내근직'),
        role: normalize(staff.role),
      }));
    return [...workerRows, ...officeRows];
  }, [officeStaffRows, workers]);

  const personnelByPosition = useMemo(() => {
    const groups = new Map<string, PositionPersonnelGroups>();
    orderedPositions.forEach((position) => {
      const name = normalize(position.name);
      if (name) groups.set(name, { workers: [], office: [] });
    });

    personnelRows.forEach((row) => {
      const linkedUser = (row.uid ? usersByUid.get(String(row.uid)) : undefined)
        || (row.type === 'worker'
          ? linkedUserByWorkerId.get(row.id)
          : linkedUserByOfficeStaffId.get(row.id));
      const assignment: PositionPersonnelAssignment = {
        ...row,
        linkedUser,
        isPrimaryPositionSynced: Boolean(linkedUser && normalize(linkedUser.position) === row.role),
      };
      const group = groups.get(row.role);
      if (group) {
        group[row.type === 'worker' ? 'workers' : 'office'].push(assignment);
      }
    });

    groups.forEach((group) => {
      group.workers.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      group.office.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    });

    return groups;
  }, [linkedUserByOfficeStaffId, linkedUserByWorkerId, orderedPositions, personnelRows, usersByUid]);

  const filteredPersonnelRows = useMemo(() => {
    const query = assignmentSearch.trim().toLowerCase();
    const rows = query
      ? personnelRows.filter((row) => `${row.name} ${row.subText} ${row.role}`.toLowerCase().includes(query))
      : personnelRows;
    return rows.slice(0, 24);
  }, [assignmentSearch, personnelRows]);

  const refresh = async () => {
    await onChanged();
  };

  const showToast = (title: string) => {
    void Swal.fire({
      icon: 'success',
      title,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1400,
    });
  };

  const handleAddPosition = async () => {
    const name = newName.trim();
    if (!name) {
      await Swal.fire('입력 필요', '추가할 직책명을 입력하세요.', 'warning');
      return;
    }
    if (positionNames.has(name)) {
      await Swal.fire('중복 직책', '이미 같은 이름의 직책이 있습니다.', 'warning');
      return;
    }

    setSavingId('new');
    try {
      const appearance = getDefaultPositionAppearance(newRole);
      const nextRank = orderedPositions.length > 0
        ? Math.max(...orderedPositions.map((position) => Number(position.rank || 0))) + 1
        : 1;
      await positionService.addPosition({
        name,
        color: appearance.color,
        icon: appearance.icon,
        iconKey: appearance.icon,
        rank: nextRank,
        systemRole: newRole,
        isDefault: false,
      });
      setNewName('');
      setNewRole(UserRole.GENERAL);
      await refresh();
      showToast('직책을 추가했습니다.');
    } catch (error) {
      console.error('[IntegratedPositionManager] add position failed:', error);
      await Swal.fire('오류', '직책 추가에 실패했습니다.', 'error');
    } finally {
      setSavingId('');
    }
  };

  const handleUpdatePosition = async (positionId: string, updates: Partial<Position>, label = '직책을 수정했습니다.') => {
    if (!positionId) return;
    setSavingId(positionId);
    try {
      await positionService.updatePosition(positionId, updates);
      await refresh();
      showToast(label);
    } catch (error) {
      console.error('[IntegratedPositionManager] update position failed:', error);
      await Swal.fire('오류', '직책 수정에 실패했습니다.', 'error');
    } finally {
      setSavingId('');
    }
  };

  const handleSavePositionName = async (position: Position) => {
    if (!position.id) return;
    const key = getPositionKey(position);
    const oldName = normalize(position.name);
    const nextName = normalize(nameDrafts[key] ?? position.name);
    if (!nextName || nextName === oldName) return;
    if (orderedPositions.some((item) => normalize(item.name) === nextName && item.id !== position.id)) {
      await Swal.fire('중복 직책', '이미 같은 이름의 직책이 있습니다.', 'warning');
      return;
    }

    setSavingId(position.id);
    try {
      await positionService.updatePositionNameWithSync(position.id, oldName, nextName);

      await Promise.all(users
        .filter((user) => normalize(user.position) === oldName)
        .map((user) => userService.updateUserProfile(user.uid, { position: nextName })));

      await Promise.all(Object.entries(userPositionMap).map(([uid, values]) => {
        const normalized = values.map(normalize);
        if (!normalized.includes(oldName)) return Promise.resolve();
        return userMenuPositionService.setPositions(uid, replacePositionName(normalized, oldName, nextName));
      }));

      await Promise.all(officeStaffRows
        .filter((staff) => staff.id && normalize(staff.role) === oldName)
        .map((staff) => officeStaffService.updateOfficeStaff(String(staff.id), { role: nextName })));

      setNameDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await refresh();
      showToast('직책명과 연결된 배정을 함께 변경했습니다.');
    } catch (error) {
      console.error('[IntegratedPositionManager] rename position failed:', error);
      await Swal.fire('오류', '직책명 변경에 실패했습니다.', 'error');
    } finally {
      setSavingId('');
    }
  };

  const handleDeletePosition = async (position: Position) => {
    if (!position.id) return;
    const name = normalize(position.name);
    const usage = usageByPosition.get(name);
    if (usage && usage.total > 0) {
      await Swal.fire(
        '삭제할 수 없습니다',
        `현재 ${usage.total}건의 사용자/인력 배정이 이 직책을 사용 중입니다. 배정을 먼저 다른 직책으로 변경하세요.`,
        'warning',
      );
      return;
    }

    const result = await Swal.fire({
      title: `'${name}' 삭제`,
      text: '이 직책을 삭제할까요?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '삭제',
      cancelButtonText: '취소',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;

    setSavingId(position.id);
    try {
      await positionService.deletePosition(position.id);
      await refresh();
      showToast('직책을 삭제했습니다.');
    } catch (error) {
      console.error('[IntegratedPositionManager] delete position failed:', error);
      await Swal.fire('오류', '직책 삭제에 실패했습니다.', 'error');
    } finally {
      setSavingId('');
    }
  };

  const handleMovePosition = async (position: Position, direction: -1 | 1) => {
    if (!position.id) return;
    const currentIndex = orderedPositions.findIndex((item) => item.id === position.id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedPositions.length) return;
    if (orderedPositions.some((item) => !item.id)) {
      await Swal.fire('순서 변경 불가', '저장된 직책만 순서를 변경할 수 있습니다.', 'warning');
      return;
    }

    const nextPositions = [...orderedPositions];
    const [moved] = nextPositions.splice(currentIndex, 1);
    nextPositions.splice(nextIndex, 0, moved);

    setSavingId(position.id);
    try {
      await positionService.updatePositionRanks(nextPositions.map((item, index) => ({
        id: item.id!,
        rank: index + 1,
      })));
      await refresh();
      showToast('직책 순서를 저장했습니다.');
    } catch (error) {
      console.error('[IntegratedPositionManager] reorder failed:', error);
      await Swal.fire('오류', '직책 순서 저장에 실패했습니다.', 'error');
    } finally {
      setSavingId('');
    }
  };

  const handleRestoreDefaults = async () => {
    const result = await Swal.fire({
      title: '기본 직책 복원',
      text: '기본 직책 구성을 다시 불러옵니다. 계속할까요?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '복원',
      cancelButtonText: '취소',
    });
    if (!result.isConfirmed) return;

    setSavingId('restore');
    try {
      await positionService.initializeDefaults();
      await refresh();
      showToast('기본 직책을 복원했습니다.');
    } catch (error) {
      console.error('[IntegratedPositionManager] restore defaults failed:', error);
      await Swal.fire('오류', '기본 직책 복원에 실패했습니다.', 'error');
    } finally {
      setSavingId('');
    }
  };

  const handleRemoveDuplicatePositions = async () => {
    const result = await Swal.fire({
      title: '중복 직책 정리',
      text: '같은 이름으로 중복 생성된 직책 문서를 정리합니다. 계속할까요?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '정리',
      cancelButtonText: '취소',
      confirmButtonColor: '#4f46e5',
    });
    if (!result.isConfirmed) return;

    setSavingId('dedupe');
    try {
      const cleanup = await positionService.removeDuplicates();
      await refresh();
      showToast(`중복 직책 ${cleanup.removed}건을 정리했습니다.`);
    } catch (error) {
      console.error('[IntegratedPositionManager] remove duplicate positions failed:', error);
      await Swal.fire('오류', '중복 직책 정리에 실패했습니다.', 'error');
    } finally {
      setSavingId('');
    }
  };

  const handleIconSelect = (iconName: string) => {
    if (iconPickerTarget) {
      void handleUpdatePosition(iconPickerTarget, { icon: iconName, iconKey: iconName }, '아이콘을 변경했습니다.');
    }
    setIconPickerTarget(null);
  };

  const handlePersonnelRoleChange = async (row: PersonnelRow, nextRole: string) => {
    if (!nextRole || row.role === nextRole) return;
    setAssignmentSavingId(`${row.type}:${row.id}`);
    try {
      if (row.type === 'worker') {
        await manpowerService.updateWorker(row.id, { role: nextRole });
      } else {
        await officeStaffService.updateOfficeStaff(row.id, { role: nextRole });
      }
      if (row.uid) {
        await userService.updateUserProfile(row.uid, { position: nextRole });
      }
      await refresh();
      showToast('직책 배정을 변경했습니다.');
    } catch (error) {
      console.error('[IntegratedPositionManager] personnel role change failed:', error);
      await Swal.fire('오류', '직책 배정 변경에 실패했습니다.', 'error');
    } finally {
      setAssignmentSavingId('');
    }
  };

  return (
    <section id="position-settings" className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <FontAwesomeIcon icon={faUserTag} className="text-indigo-500" />
              직책 색상/아이콘 통합 관리
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              직책 추가, 색상, 아이콘, 권한 그룹, 순서, 인력 배정을 이 화면에서 바로 관리합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin/role-menu')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <FontAwesomeIcon icon={faListCheck} />
              메뉴 권한
            </button>
            <button
              type="button"
              onClick={handleRestoreDefaults}
              disabled={savingId === 'restore'}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <FontAwesomeIcon icon={savingId === 'restore' ? faSpinner : faRotateLeft} spin={savingId === 'restore'} />
              기본 직책 복원
            </button>
            <button
              type="button"
              onClick={handleRemoveDuplicatePositions}
              disabled={savingId === 'dedupe'}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
            >
              <FontAwesomeIcon icon={savingId === 'dedupe' ? faSpinner : faBroom} spin={savingId === 'dedupe'} />
              중복 직책 정리
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-0">
        <div className="xl:col-span-8 border-b xl:border-b-0 xl:border-r border-slate-100 p-5 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <h3 className="font-extrabold text-slate-800">새 직책 등록</h3>
              <p className="mt-1 text-sm text-slate-500">직책명과 권한만 선택하세요. 색상과 아이콘은 권한에 맞춰 자동으로 적용됩니다.</p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleAddPosition();
                  }
                }}
                placeholder="예: 현장소장"
                aria-label="새 직책명"
                className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
              />
              <select
                value={newRole}
                onChange={(event) => setNewRole(event.target.value as UserRole)}
                aria-label="직책 권한"
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddPosition}
                disabled={savingId === 'new'}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <FontAwesomeIcon icon={savingId === 'new' ? faSpinner : faPlus} spin={savingId === 'new'} />
                등록
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
              <div className="text-xs font-extrabold text-emerald-800">인력 직책</div>
              <p className="mt-1 text-xs leading-5 text-emerald-700">작업자·사무실 직원의 직책이 기준이며, 연결 계정의 기본 직책과 비교합니다.</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5">
              <div className="text-xs font-extrabold text-sky-800">외부 계정 유형</div>
              <p className="mt-1 text-xs leading-5 text-sky-700">발주사·임대사·소개소는 회사 소속과 메뉴 권한을 위한 외부 계정 유형으로 표시합니다.</p>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5">
              <div className="text-xs font-extrabold text-indigo-800">추가 직책 권한</div>
              <p className="mt-1 text-xs leading-5 text-indigo-700">추가 직책은 메뉴 접근 확장용이며 작업자·사무실 인사 직책은 바꾸지 않습니다.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {orderedPositions.map((position, index) => {
              const key = getPositionKey(position);
              const draftName = nameDrafts[key] ?? position.name;
              const color = getColorOption(position.color);
              const usage = usageByPosition.get(normalize(position.name));
              const hasNameChange = normalize(draftName) !== normalize(position.name);
              const isSaving = savingId === position.id;
              const positionUsers = usersByPosition.get(normalize(position.name)) || [];
              const positionPersonnel = personnelByPosition.get(normalize(position.name)) || { workers: [], office: [] };
              const partnerPosition = findBusinessPartnerPositionDefinition(position.legacyId || position.id, position.name);
              const isExternalAccountPosition = Boolean(partnerPosition);
              const isUserListExpanded = expandedPositionKey === key;
              const accordionId = `position-users-${position.id || index}`;

              return (
                <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => position.id && handleMovePosition(position, -1)}
                        disabled={index === 0 || !position.id || Boolean(savingId)}
                        className="h-6 w-8 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                        title="위로 이동"
                      >
                        <FontAwesomeIcon icon={faArrowUp} className="text-xs" />
                      </button>
                      <button
                        type="button"
                        onClick={() => position.id && handleMovePosition(position, 1)}
                        disabled={index === orderedPositions.length - 1 || !position.id || Boolean(savingId)}
                        className="h-6 w-8 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                        title="아래로 이동"
                      >
                        <FontAwesomeIcon icon={faArrowDown} className="text-xs" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => position.id && setIconPickerTarget(position.id)}
                      disabled={!position.id}
                      className="h-12 w-12 shrink-0 rounded-lg text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-50"
                      style={{ backgroundColor: color.hex }}
                      title="아이콘 변경"
                    >
                      <FontAwesomeIcon icon={resolveIcon(position.icon || position.iconKey, faUser)} />
                    </button>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex gap-2">
                        <input
                          value={draftName}
                          onChange={(event) => setNameDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm font-extrabold text-slate-800 outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSavePositionName(position)}
                          disabled={!position.id || !hasNameChange || isSaving}
                          className="h-10 w-10 rounded-lg bg-slate-900 text-white disabled:bg-slate-200 disabled:text-slate-400"
                          title="직책명 저장"
                        >
                          <FontAwesomeIcon icon={isSaving ? faSpinner : faCheck} spin={isSaving} />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={position.systemRole || UserRole.GENERAL}
                          onChange={(event) => position.id && handleUpdatePosition(position.id, { systemRole: event.target.value as UserRole }, '시스템 권한을 변경했습니다.')}
                          disabled={!position.id || isSaving}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <span className={`inline-flex h-9 items-center rounded-lg px-2 text-xs font-bold ${isExternalAccountPosition ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {isExternalAccountPosition ? '외부 계정 유형' : '인력 직책'}
                        </span>
                        <span className="inline-flex h-9 items-center gap-1 rounded-lg bg-slate-50 px-2 text-xs font-bold text-slate-500">
                          <FontAwesomeIcon icon={faUsers} />
                          {(usage?.total || 0).toLocaleString()}건
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        <FontAwesomeIcon icon={faPalette} className="mr-1 text-xs text-slate-400" />
                        {COLOR_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => position.id && handleUpdatePosition(position.id, { color: option.id }, '색상을 변경했습니다.')}
                            disabled={!position.id || isSaving}
                            className={`h-5 w-5 rounded-full border ${position.color === option.id ? 'border-slate-900 ring-2 ring-slate-200' : 'border-white'} disabled:opacity-50`}
                            style={{ backgroundColor: option.hex }}
                            title={option.label}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => navigate('/admin/role-menu')}
                        className="h-8 w-8 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                        title="메뉴 권한 관리"
                      >
                        <FontAwesomeIcon icon={faSitemap} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePosition(position)}
                        disabled={!position.id || isSaving}
                        className="h-8 w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                        title="직책 삭제"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedPositionKey((current) => (current === key ? null : key))}
                    aria-expanded={isUserListExpanded}
                    aria-controls={accordionId}
                    className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-bold text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <span className="inline-flex items-center gap-2">
                      <FontAwesomeIcon icon={faUsers} className="text-indigo-500" />
                      연결 현황
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 shadow-sm">계정 {positionUsers.length}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 shadow-sm">작업자 {positionPersonnel.workers.length}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 shadow-sm">사무실 {positionPersonnel.office.length}</span>
                    </span>
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className={`text-xs transition-transform ${isUserListExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isUserListExpanded && (
                    <div id={accordionId} className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
                        <section className="p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-slate-700">사용자 계정</h4>
                            <span className="text-xs font-bold text-slate-400">{positionUsers.length}명</span>
                          </div>
                          {positionUsers.length === 0 ? (
                            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">배정된 사용자 계정이 없습니다.</div>
                          ) : (
                            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                              {positionUsers.map(({ user, isBasePosition, isAdditionalPosition }) => (
                                <li key={user.uid} className="flex items-center gap-3 px-3 py-2.5">
                                  {user.photoURL ? (
                                    <img
                                      src={user.photoURL}
                                      alt=""
                                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                      <FontAwesomeIcon icon={faUser} className="text-xs" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-extrabold text-slate-800">{user.displayName || '이름 없음'}</div>
                                    <div className="truncate text-xs text-slate-500">{user.email || user.uid}</div>
                                  </div>
                                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{getAccountTypeLabel(user.accountType)}</span>
                                    {isBasePosition && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">기본</span>}
                                    {isAdditionalPosition && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">추가</span>}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>

                        <section className="p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-slate-700">작업자 인력</h4>
                            <span className="text-xs font-bold text-slate-400">{positionPersonnel.workers.length}명</span>
                          </div>
                          {positionPersonnel.workers.length === 0 ? (
                            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">이 직책의 작업자가 없습니다.</div>
                          ) : (
                            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                              {positionPersonnel.workers.map(({ id, name, subText, linkedUser, isPrimaryPositionSynced }) => (
                                <li key={id} className="flex items-center gap-3 px-3 py-2.5">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                    <FontAwesomeIcon icon={faUser} className="text-xs" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-extrabold text-slate-800">{name}</div>
                                    <div className="truncate text-xs text-slate-500">{subText}</div>
                                    {linkedUser && <div className="truncate text-[11px] text-slate-400">연결 계정: {linkedUser.displayName || linkedUser.email || linkedUser.uid}</div>}
                                  </div>
                                  {linkedUser ? (
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${isPrimaryPositionSynced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                      {isPrimaryPositionSynced ? '직책 일치' : '직책 불일치'}
                                    </span>
                                  ) : (
                                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">계정 미연결</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>

                        <section className="p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-slate-700">사무실 직원</h4>
                            <span className="text-xs font-bold text-slate-400">{positionPersonnel.office.length}명</span>
                          </div>
                          {positionPersonnel.office.length === 0 ? (
                            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">이 직책의 사무실 직원이 없습니다.</div>
                          ) : (
                            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                              {positionPersonnel.office.map(({ id, name, subText, linkedUser, isPrimaryPositionSynced }) => (
                                <li key={id} className="flex items-center gap-3 px-3 py-2.5">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                                    <FontAwesomeIcon icon={faBuilding} className="text-xs" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-extrabold text-slate-800">{name}</div>
                                    <div className="truncate text-xs text-slate-500">{subText}</div>
                                    {linkedUser && <div className="truncate text-[11px] text-slate-400">연결 계정: {linkedUser.displayName || linkedUser.email || linkedUser.uid}</div>}
                                  </div>
                                  {linkedUser ? (
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${isPrimaryPositionSynced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                      {isPrimaryPositionSynced ? '직책 일치' : '직책 불일치'}
                                    </span>
                                  ) : (
                                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">계정 미연결</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="xl:col-span-4 p-5 space-y-4">
          <div>
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
              <FontAwesomeIcon icon={faPen} className="text-emerald-500" />
              인력 직책 빠른 배정
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              작업자와 내근직 직책을 즉시 변경하고 연결된 사용자 기본 직책도 함께 맞춥니다.
            </p>
          </div>

          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={assignmentSearch}
              onChange={(event) => setAssignmentSearch(event.target.value)}
              placeholder="이름, 부서, 직책 검색"
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
            {filteredPersonnelRows.map((row) => {
              const key = `${row.type}:${row.id}`;
              const color = getColorOption(orderedPositions.find((position) => position.name === row.role)?.color);
              const icon = orderedPositions.find((position) => position.name === row.role);
              const isSaving = assignmentSavingId === key;
              return (
                <div key={key} className="p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: color.hex }}
                    >
                      <FontAwesomeIcon icon={row.type === 'worker' ? resolveIcon(icon?.icon || icon?.iconKey, faUser) : faBuilding} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-extrabold text-slate-800">{row.name}</div>
                      <div className="truncate text-xs text-slate-500">{row.subText}</div>
                    </div>
                    {isSaving && <FontAwesomeIcon icon={faSpinner} spin className="text-slate-400" />}
                  </div>
                  <select
                    value={positionNames.has(row.role) ? row.role : ''}
                    onChange={(event) => handlePersonnelRoleChange(row, event.target.value)}
                    disabled={isSaving || orderedPositions.length === 0}
                    className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 disabled:opacity-60"
                  >
                    <option value="" disabled>직책 선택</option>
                    {orderedPositions.map((position) => (
                      <option key={getPositionKey(position)} value={position.name}>
                        {position.name} ({getRoleLabel(position.systemRole)})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            {filteredPersonnelRows.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">
                <FontAwesomeIcon icon={faCircleInfo} className="mb-2 text-xl" />
                <div>검색 결과가 없습니다.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <IconPicker
        isOpen={Boolean(iconPickerTarget)}
        onClose={() => setIconPickerTarget(null)}
        onSelect={handleIconSelect}
        currentIcon={orderedPositions.find((position) => position.id === iconPickerTarget)?.icon
          || orderedPositions.find((position) => position.id === iconPickerTarget)?.iconKey}
      />
    </section>
  );
};

export default IntegratedPositionManager;
