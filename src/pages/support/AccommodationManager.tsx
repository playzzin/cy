import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faFileInvoiceDollar, faPlus, faChartPie, faMapMarkerAlt, faPhone, faUsers, faChevronRight, faBed, faWonSign, faExclamationTriangle, faBell } from '@fortawesome/free-solid-svg-icons';
import { accommodationService } from '../../services/accommodationService';
import { Accommodation } from '../../types/accommodation';
import AccommodationForm from '../../components/accommodation/AccommodationForm';
import UtilityLedger from '../../components/accommodation/UtilityLedger';
import AccommodationBillingManager from '../../components/accommodation/AccommodationBillingManager';
import AccommodationAssignmentManager from '../../components/accommodation/AccommodationAssignmentManager';
import { accommodationAssignmentService } from '../../services/accommodationAssignmentService';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { UserRole } from '../../types/roles';
import { AccommodationAssignment } from '../../types/accommodationAssignment';

const AccommodationManager: React.FC = () => {
    const { currentUser } = useAuth();
    const [canUseAccommodationManager, setCanUseAccommodationManager] = useState<boolean | null>(null);
    const [activeTab, setActiveTab] = useState<'status' | 'ledger' | 'billing' | 'assignments'>('status');
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
    const [assignments, setAssignments] = useState<AccommodationAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<Accommodation | undefined>(undefined);

    useEffect(() => {
        let isCancelled = false;

        const resolveAccess = async () => {
            if (!currentUser) {
                if (!isCancelled) setCanUseAccommodationManager(false);
                return;
            }

            try {
                const user = await userService.getUser(currentUser.uid);
                const role = user?.role;
                const isAdminRole = role === 'admin' || role === UserRole.ADMIN;
                if (!isCancelled) setCanUseAccommodationManager(isAdminRole);
            } catch {
                if (!isCancelled) setCanUseAccommodationManager(false);
            }
        };

        resolveAccess();
        return () => {
            isCancelled = true;
        };
    }, [currentUser]);

    useEffect(() => {
        if (canUseAccommodationManager !== true) return;
        loadData();
    }, [canUseAccommodationManager]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [accommodationList, assignmentList] = await Promise.all([
                accommodationService.getAccommodations(),
                accommodationAssignmentService.getAllAssignments()
            ]);

            // Sort accommodations by name naturally
            accommodationList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

            setAccommodations(accommodationList);
            setAssignments(assignmentList);
        } catch (error) {
            console.error("Failed to load accommodations", error);
        } finally {
            setLoading(false);
        }
    };

    const activeAssignmentsByAccommodationId = useMemo(() => {
        const map = new Map<string, AccommodationAssignment[]>();
        assignments.forEach((a) => {
            if (!a.accommodationId) return;
            const isActive = (a.status ?? 'active') === 'active' && !a.endDate;
            if (!isActive) return;
            const list = map.get(a.accommodationId) ?? [];
            list.push(a);
            map.set(a.accommodationId, list);
        });
        return map;
    }, [assignments]);

    const buildBillingTargetLabel = (items: AccommodationAssignment[]): string => {
        if (items.length === 0) return '-';

        const hasTeam = items.some((a) => a.source === 'team');
        const hasWorker = items.some((a) => a.source === 'worker');

        if (hasTeam && hasWorker) return '혼합';
        if (hasTeam) return '팀';
        if (hasWorker) return '개인';
        return '-';
    };

    const handleAddClick = () => {
        setEditingItem(undefined);
        setShowForm(true);
    };

    const handleEditClick = (item: Accommodation) => {
        setEditingItem(item);
        setShowForm(true);
    };

    const handleFormSubmit = async (data: Omit<Accommodation, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            if (editingItem) {
                await accommodationService.updateAccommodation(editingItem.id, data);
            } else {
                await accommodationService.addAccommodation(data);
            }
            setShowForm(false);
            loadData();
        } catch (error) {
            console.error("Failed to save", error);
            alert("저장 중 오류가 발생했습니다.");
        }
    };

    const handleSeedAllAccommodations = async () => {
        const ok = window.confirm('전체 37개 숙소 데이터를 일괄 등록할까요? (이미 있으면 건너뜁니다)');
        if (!ok) return;

        setSeeding(true);
        try {
            const existingNameSet = new Set(accommodations.map((a) => a.name));

            const fullSeeds: Array<Omit<Accommodation, 'id' | 'createdAt' | 'updatedAt'>> = [
                { name: '초지동 726-4 305호', address: '초지로 116', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-05-20', deposit: 0, monthlyRent: 0, paymentDay: 20, landlordName: '서원석', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '선불' },
                { name: '이동 712-2 503호', address: '광덕1로 341', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-01-30', deposit: 20000000, monthlyRent: 1530000, paymentDay: 20, landlordName: '엄순애', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1422-6 501호', address: '초당로 16-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-03-20', deposit: 5000000, monthlyRent: 650000, paymentDay: 30, landlordName: '김황원', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'variable' }, memo: '수도개별' },
                { name: '사동 1392-12 201호', address: '초당로 41', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-05-03', deposit: 5000000, monthlyRent: 420000, paymentDay: 20, landlordName: '이재천', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '1인거주' },
                { name: '사동 1408-14 202호', address: '장화3안길 9', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-07-13', deposit: 5000000, monthlyRent: 580000, paymentDay: 3, landlordName: '문지연', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1415-2 203호', address: '장화로 7', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-01-11', deposit: 5000000, monthlyRent: 580000, paymentDay: 13, landlordName: '이성현', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1403 102호', address: '장화1길 54', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2023-10-31', deposit: 5000000, monthlyRent: 430000, paymentDay: 11, landlordName: '이송재', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1431-1 202호', address: '항가울로 17', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-04-01', deposit: 5000000, monthlyRent: 500000, paymentDay: 31, landlordName: '왕경식', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1431-4 402호', address: '항가울로 13', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-12-20', deposit: 5000000, monthlyRent: 450000, paymentDay: 1, landlordName: '이상옥', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1416-1 202호', address: '평안로1안길 4', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-07-22', deposit: 5000000, monthlyRent: 530000, paymentDay: 20, landlordName: '강재인', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1424-1 202호', address: '항가울로 31-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-10-25', deposit: 5000000, monthlyRent: 500000, paymentDay: 22, landlordName: '최기호', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1421-3 202호', address: '장화3길 6', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-04-08', deposit: 5000000, monthlyRent: 545000, paymentDay: 25, landlordName: '최기호', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1421-3 303호', address: '장화3길 6', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-10-28', deposit: 5000000, monthlyRent: 545000, paymentDay: 8, landlordName: '최기호', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1426-3 301호', address: '항호1길 40-10', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-08-20', deposit: 5000000, monthlyRent: 540000, paymentDay: 28, landlordName: '이현재', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable', fixedMaintenance: 40000 }, memo: '' },
                { name: '와동 730-5 202호', address: '와개길 53-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-03-02', deposit: 5000000, monthlyRent: 450000, paymentDay: 20, landlordName: '박점쇠', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable', fixedMaintenance: 30000 }, memo: '' },
                { name: '와동 730-5 103호', address: '와개길 53-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-01-29', deposit: 5000000, monthlyRent: 450000, paymentDay: 2, landlordName: '박점쇠', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '1인거주' },
                { name: '와동 729-5 401호', address: '와개길 62', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-11-26', deposit: 5000000, monthlyRent: 480000, paymentDay: 29, landlordName: '정숙영', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '와동 729-5 203호', address: '와개길 62', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-06-01', deposit: 5000000, monthlyRent: 480000, paymentDay: 26, landlordName: '정숙영', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '와동 729-5 204호', address: '와개길 62', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2023-08-31', deposit: 5000000, monthlyRent: 480000, paymentDay: 1, landlordName: '정숙영', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '3인거주' },
                { name: '사동 1428-14 202호', address: '항호1길 26-5', type: 'Apartment', status: 'active', contract: { startDate: '2023-08-31', endDate: '', deposit: 5000000, monthlyRent: 450000, paymentDay: 1, landlordName: '김종국', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'fixed', maintenance: 'fixed', fixedInternet: 25000, fixedMaintenance: 50000 }, memo: '' },
                { name: '사동 1393-3 201호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '2024-04-27', endDate: '2026-04-27', deposit: 3000000, monthlyRent: 500000, paymentDay: 28, landlordName: '유현주', landlordContact: '농협 352-1436-374583', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'fixed', maintenance: 'fixed', fixedInternet: 25000, fixedMaintenance: 50000 }, memo: '수도개별' },
                { name: '사동 1407-31 201호', address: '장화로 22-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-07-31', deposit: 5000000, monthlyRent: 430000, paymentDay: 31, landlordName: '김숙향', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1407-22 202호', address: '장화2길 37-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2024-11-01', deposit: 5000000, monthlyRent: 530000, paymentDay: 1, landlordName: '김순자', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable', fixedMaintenance: 30000 }, memo: '2명거주 관리비10,000추가' },
                { name: '사동 1421-4 202호', address: '장화3길 6-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2025-05-31', deposit: 5000000, monthlyRent: 400000, paymentDay: 31, landlordName: '이선옥', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '' },
                { name: '사동 1383-10 402호', address: '항호2길 12-10', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-01-04', deposit: 10000000, monthlyRent: 530000, paymentDay: 4, landlordName: '임진우', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '' },
                { name: '사동 1415-2 401호', address: '장화로 7', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2024-03-31', deposit: 10000000, monthlyRent: 830000, paymentDay: 31, landlordName: '문지연', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '' },
                { name: '사동 1407-1 103호', address: '장화3길 28', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2024-12-01', deposit: 5000000, monthlyRent: 480000, paymentDay: 1, landlordName: '양재순', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '' },
                { name: '사동 1394-5 303호', address: '초당5길 22', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-02-04', deposit: 5000000, monthlyRent: 458000, paymentDay: 4, landlordName: '박옥자', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1393-3 203호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-11-20', deposit: 3000000, monthlyRent: 500000, paymentDay: 20, landlordName: '유현주', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '수도개별' },
                { name: '사동 1376-6 303호', address: '항가울로 56', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-11-10', deposit: 5000000, monthlyRent: 450000, paymentDay: 10, landlordName: '이은영', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1386-3 302호', address: '항가울로 48', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-07-22', deposit: 5000000, monthlyRent: 500000, paymentDay: 22, landlordName: '장철수', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1393-3 303호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-06-30', deposit: 3000000, monthlyRent: 520000, paymentDay: 5, landlordName: '유현주', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'included' }, memo: '관리비포함(47만원)' },
                { name: '사동 1393-3 103호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-11-04', deposit: 3000000, monthlyRent: 520000, paymentDay: 30, landlordName: '유현주', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1421-4 402호', address: '장화3길 6-1', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2023-10-30', deposit: 10000000, monthlyRent: 800000, paymentDay: 30, landlordName: '이선옥', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'included' }, memo: '3인포함' },
                { name: '사동 1421-3 304호', address: '장화3길 6', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2026-08-04', deposit: 2000000, monthlyRent: 330000, paymentDay: 4, landlordName: '최기호', landlordContact: '', isReported: true }, costProfile: { electricity: 'variable', gas: 'variable', water: 'included', internet: 'variable', maintenance: 'included' }, memo: '' },
                { name: '사동 1393-3 101호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2025-09-30', deposit: 3000000, monthlyRent: 500000, paymentDay: 1, landlordName: '유현주', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '수도개별' },
                { name: '사동 1393-3 301호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-07-06', deposit: 2000000, monthlyRent: 520000, paymentDay: 7, landlordName: '유현주', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '수도개별' },
                { name: '사동 1393-3 402호', address: '초당4길 18', type: 'Apartment', status: 'active', contract: { startDate: '', endDate: '2027-10-14', deposit: 15000000, monthlyRent: 900000, paymentDay: 15, landlordName: '유현주', landlordContact: '', isReported: false }, costProfile: { electricity: 'variable', gas: 'variable', water: 'variable', internet: 'variable', maintenance: 'variable' }, memo: '수도개별' }
            ];

            const toCreate = fullSeeds.filter((s) => !existingNameSet.has(s.name));

            for (const item of toCreate) {
                await accommodationService.addAccommodation(item);
            }

            await loadData();

            if (toCreate.length === 0) {
                alert('모든 숙소가 이미 등록되어 있습니다.');
            } else {
                alert(`${toCreate.length}건 등록 완료!`);
            }
        } catch (e) {
            console.error(e);
            alert('등록에 실패했습니다.');
        } finally {
            setSeeding(false);
        }
    };

    if (canUseAccommodationManager === null) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
            </div>
        );
    }

    if (canUseAccommodationManager === false) {
        return (
            <div className="p-10 max-w-4xl mx-auto min-h-screen flex items-center justify-center">
                <div className="bg-white rounded-2xl border border-red-100 shadow-xl p-8 text-center max-w-lg">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                        <FontAwesomeIcon icon={faUsers} size="2x" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">접근 권한 없음</h2>
                    <p className="text-slate-500">관리자(admin) 계정만 숙소 관리를 사용할 수 있습니다.</p>
                </div>
            </div>
        );
    }

    // Stats Logic
    const totalCount = accommodations.length;
    const occupiedCount = accommodations.filter(a => a.status === 'active').reduce((acc, _) => acc + 1, 0); // safe count
    const vacantCount = accommodations.filter(a => a.status === 'inactive').reduce((acc, _) => acc + 1, 0);
    const totalRent = accommodations
        .filter(a => a.status === 'active')
        .reduce((sum, a) => sum + (a.contract.monthlyRent || 0), 0);

    // Calculate Alerts (Rent Due Soon)
    const today = new Date();
    const currentDay = today.getDate();
    const upcomingRentAccommodations = accommodations.filter(a => {
        if (a.status !== 'active' || !a.contract.rentPayDate) return false;

        // Logical "Due Soon": if payDate is within next 3 days or today
        // Simple logic: if abs(payDate - currentDay) <= 3
        // Note: Edge case of month transition is ignored for simplicity as per requirement, but can be robust.
        // Let's stick to "Current month's pay day is approaching or passed recently"

        const payDay = a.contract.rentPayDate;
        // Check if Pay Day is "Close" (e.g. today, tomorrow, or 2 days ago overdue)
        // Or if today is greater than payDay (Overdue for this month?) - assuming user clears it?
        // Actually, without a "Payment Record" check, we just alert if the *Day* is near.

        const diff = payDay - currentDay;
        // e.g. Day 20. Today 18. Diff 2. (Upcoming)
        // Day 20. Today 21. Diff -1. (Passed/Overdue?)

        return diff >= 0 && diff <= 3;
    });

    // Calculate Occupancy Rate
    const occupancyRate = totalCount > 0 ? Math.round((occupiedCount / totalCount) * 100) : 0;

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 xl:p-10">
            <div className="max-w-[1800px] mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <FontAwesomeIcon icon={faBuilding} className="text-lg" />
                            </span>
                            숙소 관리 통합 콘솔
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium ml-14">
                            부동산 계약 현황, 월별 공과금 정산, 청구 관리 및 작업자 배정을 통합 관리합니다.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleSeedAllAccommodations}
                            disabled={seeding}
                            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-sm flex items-center gap-2
                                ${seeding ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
                            `}
                        >
                            {seeding ? <div className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full"></div> : <FontAwesomeIcon icon={faPlus} />}
                            샘플 데이터 생성
                        </button>
                        <button
                            onClick={handleAddClick}
                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 hover:-translate-y-0.5 flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            신규 숙소 등록
                        </button>
                    </div>
                </div>

                {/* Modern Navigation Tabs */}
                <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex">
                    {[
                        { id: 'status', label: '숙소 현황판', icon: faChartPie },
                        { id: 'assignments', label: '배정(입/퇴실)', icon: faUsers },
                        { id: 'ledger', label: '월별 공과금 대장', icon: faFileInvoiceDollar },
                        { id: 'billing', label: '청구 관리', icon: faPhone },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2.5
                                ${activeTab === tab.id
                                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }
                            `}
                        >
                            <FontAwesomeIcon icon={tab.icon} className={activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="animate-fade-in-up">
                    {activeTab === 'status' ? (
                        <div className="space-y-8">
                            {/* Alerts Section (if any) */}
                            {upcomingRentAccommodations.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4 shadow-sm animate-fade-in-down">
                                    <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                                        <FontAwesomeIcon icon={faBell} className="animate-swing" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-amber-800 text-sm mb-1">곧 월세 납부일인 숙소가 있습니다!</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {upcomingRentAccommodations.map(acc => (
                                                <span key={acc.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-xs font-bold text-amber-700 shadow-sm">
                                                    <FontAwesomeIcon icon={faBuilding} className="text-amber-400" />
                                                    {acc.name} (매월 {acc.contract.rentPayDate}일)
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Summary Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-slate-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">총 관리 숙소</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-3xl font-extrabold text-slate-800">{totalCount}</h3>
                                            <span className="text-sm font-bold text-slate-400">호</span>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 w-fit px-2 py-1 rounded-lg">
                                            <FontAwesomeIcon icon={faBuilding} className="text-slate-400" /> 전체 등록된 숙소
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10">
                                        <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-wider mb-2">계약 중 (입실)</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-3xl font-extrabold text-slate-800">{occupiedCount}</h3>
                                            <span className="text-sm font-bold text-slate-400">호</span>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
                                            <FontAwesomeIcon icon={faChartPie} /> 가동률 {occupancyRate}%
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10">
                                        <p className="text-xs font-bold text-indigo-600/70 uppercase tracking-wider mb-2">총 월세 지출액</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-3xl font-extrabold text-slate-800">{totalRent.toLocaleString()}</h3>
                                            <span className="text-sm font-bold text-slate-400">원</span>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-indigo-700 bg-indigo-50 w-fit px-2 py-1 rounded-lg">
                                            <FontAwesomeIcon icon={faWonSign} /> 매월 고정 지출
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-orange-100 shadow-[0_4px_20px_-4px_rgba(249,115,22,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 w-32 h-32 bg-orange-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                                    <div className="relative z-10">
                                        <p className="text-xs font-bold text-orange-600/70 uppercase tracking-wider mb-2">공실 (계약 종료)</p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-3xl font-extrabold text-slate-800">{vacantCount}</h3>
                                            <span className="text-sm font-bold text-slate-400">호</span>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-orange-700 bg-orange-50 w-fit px-2 py-1 rounded-lg">
                                            <FontAwesomeIcon icon={faBed} /> 비어있는 숙소
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cards Grid */}
                            {loading ? (
                                <div className="h-64 flex items-center justify-center text-slate-400">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : accommodations.length === 0 ? (
                                <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-20 text-center">
                                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                                        <FontAwesomeIcon icon={faBuilding} className="text-4xl" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-700 mb-2">등록된 숙소가 없습니다</h3>
                                    <p className="text-slate-400 mb-6">새로운 숙소를 등록하여 관리를 시작해보세요.</p>
                                    <button
                                        onClick={handleAddClick}
                                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition"
                                    >
                                        숙소 등록하기
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {accommodations.map(acc => (
                                        (() => {
                                            const activeList = activeAssignmentsByAccommodationId.get(acc.id) ?? [];
                                            const checkedInCount = activeList.length;
                                            const billingTargetLabel = buildBillingTargetLabel(activeList);
                                            const isExpired = acc.status === 'inactive';

                                            return (
                                                <div
                                                    key={acc.id}
                                                    onClick={() => handleEditClick(acc)}
                                                    className={`group bg-white rounded-2xl p-6 border transition-all cursor-pointer relative overflow-hidden
                                                        ${isExpired
                                                            ? 'border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                                                            : 'border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-50/50 hover:-translate-y-1'
                                                        }
                                                    `}
                                                >
                                                    {/* Status Badge */}
                                                    <div className="flex justify-between items-start mb-4">
                                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5
                                                            ${acc.status === 'active'
                                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                                : 'bg-slate-100 text-slate-500 border border-slate-200'}
                                                        `}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${acc.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                                            {acc.status === 'active' ? '계약중' : '계약종료'}
                                                        </span>
                                                        <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-indigo-50 flex items-center justify-center text-slate-300 group-hover:text-indigo-500 transition-colors">
                                                            <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                                                        </div>
                                                    </div>

                                                    <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-indigo-700 transition-colors truncate pr-4">
                                                        {acc.name}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                                                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-slate-300" />
                                                        <span className="truncate">{acc.address}</span>
                                                    </div>

                                                    <div className="space-y-3 pt-4 border-t border-slate-50">
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-slate-400 font-medium text-xs">월세</span>
                                                            <span className="font-bold text-slate-700">{acc.contract.monthlyRent.toLocaleString()}원</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-slate-400 font-medium text-xs">현재 입실</span>
                                                            <span className={`font-bold ${checkedInCount > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                                {checkedInCount}명
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-slate-400 font-medium text-xs">청구 대상</span>
                                                            <span className="font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                                                {billingTargetLabel}
                                                            </span>
                                                        </div>
                                                        {acc.contract.rentPayDate && (
                                                            <div className="flex justify-between items-center text-sm">
                                                                <span className="text-slate-400 font-medium text-xs">월세일</span>
                                                                <span className={`font-bold text-xs px-2 py-0.5 rounded ${Math.abs(acc.contract.rentPayDate - new Date().getDate()) <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>
                                                                    매월 {acc.contract.rentPayDate}일
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {acc.contract.endDate && (
                                                        <div className={`mt-4 pt-3 border-t border-dashed text-xs text-center font-medium
                                                            ${new Date(acc.contract.endDate) < new Date() ? 'text-rose-500 bg-rose-50 rounded-lg py-1.5' : 'text-slate-400'}
                                                        `}>
                                                            계약만료: {acc.contract.endDate}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'ledger' ? (
                        <UtilityLedger />
                    ) : activeTab === 'billing' ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[600px]">
                            <AccommodationBillingManager />
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[600px]">
                            <AccommodationAssignmentManager />
                        </div>
                    )}
                </div>
            </div>

            {showForm && (
                <AccommodationForm
                    initialData={editingItem}
                    onSubmit={handleFormSubmit}
                    onCancel={() => setShowForm(false)}
                />
            )}
        </div>
    );
};

export default AccommodationManager;
