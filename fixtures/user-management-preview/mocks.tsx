import React from 'react';
// Synthetic, in-memory records only; this module replaces all network services.
const users: any[] = [
    { uid: 'active', displayName: '가상 관리자', email: 'admin@example.test', role: 'user', position: '일반', status: 'active', linkedWorkerIds: ['w1'] },
    { uid: 'pending', displayName: '가상 신청자', email: 'requester@example.test', role: 'user', position: '', status: 'pending', requestedAccountType: 'worker' },
    { uid: 'office', displayName: '가상 사무직', email: 'office@example.test', role: 'user', position: '', status: 'pending', requestedAccountType: 'office' },
];
const workers: any[] = [
    { id: 'w1', name: '가상 관리자', role: '일반', teamName: '지원팀', uid: 'active' },
    { id: 'w2', name: '가상 신청자', role: '일반', teamName: '시공팀', email: 'requester@example.test', contact: '010-0000-1234' },
    { id: 'w3', name: '가상 신청자', role: '일반', teamName: '다른팀', uid: 'different-user' },
];
const staff: any[] = [{ id: 'o1', name: '가상 사무직', email: 'office@example.test', department: '관리부', role: '사무실직원' }];
const links: any[] = [{ id: 'r1', uid: 'pending', accountType: 'worker', entityType: 'worker', entityId: 'new_pending', entityName: '가상 신청자', entitySubType: '작업자', relationRole: 'staff', status: 'pending', requestedEntity: { name: '가상 신청자', phone: '010-0000-1234' } }];
const calls: any[] = []; (window as any).__qaCalls = calls;
const copy = (value: any) => JSON.parse(JSON.stringify(value));
export const useAuth = () => ({ currentUser: { uid: 'admin', email: 'test-admin@example.test' } });
export const isDevAdminSessionEnabled = () => false;
export const userService = { getAllUsers: async () => copy(users), linkUserToOfficeStaff: async (uid: string, id: string) => { calls.push(['office', uid, id]); Object.assign(staff[0], { uid }); Object.assign(users.find(user => user.uid === uid), { status: 'active', linkedOfficeStaffIds: [id], position: '사무실직원' }); } };
export const manpowerService = { getWorkers: async () => copy(workers) };
export const officeStaffService = { getOfficeStaff: async () => copy(staff) };
export const companyService = { getCompanies: async () => [] };
export const positionService = { getPositions: async () => [{ id: 'p1', name: '일반', systemRole: '일반' }, { id: 'p2', name: '총괄', systemRole: '매니저' }, { id: 'p3', name: '사무실직원', systemRole: '일반' }] };
const menuListeners: any[] = [];
let extras: any = {};
export const userMenuPositionService = { subscribe: (cb: any) => { menuListeners.push(cb); cb(extras); return () => {}; }, refresh: async () => menuListeners.forEach(cb => cb(extras)) };
export const menuServiceV11 = { subscribe: () => () => {} };
export const userAccessClaimsService = {};
export const permissionAuditService = { log: async () => {} };
export const accountLinkService = {
    getAllLinks: async () => copy(links),
    updateUserAccess: async (data: any) => { calls.push(['access', data]); Object.assign(users.find(user => user.uid === data.uid), data); extras = { ...extras, [data.uid]: data.additionalPositions }; },
    approveMatchedLink: async (id: string, targetId: string) => {
        calls.push(['match', id, targetId]);
        const link = links.find(row => row.id === id); const target = workers.find(row => row.id === targetId);
        Object.assign(link, { status: 'active', entityId: targetId, entityName: target.name }); target.uid = link.uid;
        Object.assign(users.find(user => user.uid === link.uid), { status: 'active', linkedWorkerIds: [targetId], position: target.role });
    },
    unlinkConnection: async (data: any) => { calls.push(['unlink', data]); Object.assign(users.find(user => user.uid === data.uid), { linkedWorkerIds: [], status: 'pending', position: '' }); delete workers.find(row => row.id === data.entityId).uid; },
};
export default function PositionStub() { return <p>직책별 설정</p>; }
