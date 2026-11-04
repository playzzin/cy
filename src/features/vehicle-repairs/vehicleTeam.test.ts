import type { Vehicle } from '../../types/vehicle';
import type { Team } from '../../services/teamService';
import type { Worker } from '../../services/manpowerService';
import type { OfficeStaff } from '../../services/officeStaffService';
import { resolveRepairTeam, resolveRepairVehicle } from './vehicleTeam';

const vehicle = { id: 'vehicle', licensePlate: '123하 4567', currentAssigneeType: 'TEAM', currentAssigneeId: 'old-team',
  currentAssigneeName: '이전 팀명', billingTargetType: 'TEAM', billingTargetName: '별도 청구팀' } as Vehicle;
const teams = [{ id: 'team', legacyId: 'old-team', name: '배정팀', color: '#ffd400', iconKey: 'fa-truck-front', icon: 'fa-users' }] as Team[];
const workers = [{ id: 'driver', legacyId: 'old-driver', name: '기사', teamId: 'old-team' }] as Worker[];
const office = [{ id: 'office-staff', name: '담당자' }] as OfficeStaff[];
const find = (options: Vehicle[], plate = '123하-4567') => resolveRepairVehicle(plate, options, teams, workers, office);

test('배정 차량의 팀 또는 운전자 소속팀을 현재 팀 명부에서 가져온다', () => {
  const expected = { vehicleId: 'vehicle', teamId: 'team', teamName: '배정팀', teamColor: '#ffd400', teamIcon: 'fa-truck-front' };
  expect(find([vehicle])).toEqual(expected);
  expect(find([{ ...vehicle, currentAssigneeType: 'WORKER', currentAssigneeId: 'old-driver' }])).toEqual(expected);
  expect(find([{ ...vehicle, currentAssigneeType: 'WORKER', currentAssigneeId: 'office-staff' }]).teamName).toBe('사무실');
});

test('일부 번호, 중복 차량, 미배정 차량 및 소속 미확인 운전자의 팀을 추정하지 않는다', () => {
  expect(find([vehicle], '4567').vehicleId).toBe('');
  expect(find([vehicle, { ...vehicle, id: 'duplicate' }])).toEqual({ vehicleId: '', teamId: '', teamName: '', teamColor: '', teamIcon: '' });
  expect(find([{ ...vehicle, currentAssigneeType: null }]).teamName).toBe('');
  expect(find([{ ...vehicle, currentAssigneeType: 'WORKER', currentAssigneeId: 'unknown', currentAssigneeName: '기사' }]).teamName).toBe('');
});

test('기존 icon 필드와 ID가 없는 기록을 지원하고 다른 팀의 표시 정보를 빌리지 않는다', () => {
  const legacy = { ...teams[0], iconKey: undefined, icon: 'faHelmetSafety' };
  expect(resolveRepairTeam({ teamName: legacy.name }, [legacy])).toMatchObject({ teamColor: '#ffd400', teamIcon: 'faHelmetSafety' });
  expect(resolveRepairTeam({ teamName: legacy.name }, [legacy, { ...legacy, id: 'other' }]).teamIcon).toBe('');
  const snapshot = { teamId: 'deleted', teamName: legacy.name, teamColor: '#112233', teamIcon: 'fa-wrench' };
  expect(resolveRepairTeam(snapshot, [legacy])).toEqual(snapshot);
  const officeTeam = { ...legacy, id: 'real-office-id', name: '사무실', icon: 'fa-building' };
  expect(resolveRepairTeam({ teamId: '__office__' }, [officeTeam])).toMatchObject({ teamId: 'real-office-id', teamIcon: 'fa-building' });
});

test('운전자 소속 필드가 비어 있으면 작업자 ID가 한 팀의 구성원 명단에 있을 때만 연결한다', () => {
  const assigned = { ...vehicle, currentAssigneeType: 'WORKER' as const, currentAssigneeId: 'old-driver' };
  const roster = [{ ...teams[0], memberIds: ['driver'] }];
  const drivers = [{ ...workers[0], teamId: '' }];
  expect(resolveRepairVehicle(vehicle.licensePlate, [assigned], roster, drivers, []).teamName).toBe('배정팀');
  expect(resolveRepairVehicle(vehicle.licensePlate, [assigned], [...roster, { ...roster[0], id: 'other' }], drivers, []).teamName).toBe('');
});
