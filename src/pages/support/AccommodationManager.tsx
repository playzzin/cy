import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faFileInvoiceDollar, faPlus, faChartPie, faMapMarkerAlt, faPhone, faUsers } from '@fortawesome/free-solid-svg-icons';
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

    const handleSeedTwoAccommodations = async () => {
        const ok = window.confirm('김동혁팀 숙소 2건을 등록할까요? (이미 있으면 건너뜁니다)');
        if (!ok) return;

        setSeeding(true);
        try {
            const existingNameSet = new Set(accommodations.map((a) => a.name));

            const seeds: Array<Omit<Accommodation, 'id' | 'createdAt' | 'updatedAt'>> = [
                {
                    name: '사동 1428-14 202호',
                    address: '항하1길 26-5',
                    type: 'Apartment',
                    status: 'active',
                    currentOccupantName: '김동혁팀',
                    contract: {
                        startDate: '2023-08-31',
                        endDate: '',
                        deposit: 5000000,
                        monthlyRent: 450000,
                        paymentDay: 1,
                        landlordName: '김종국',
                        landlordContact: '',
                        isReported: true
                    },
                    costProfile: {
                        electricity: 'variable',
                        gas: 'variable',
                        water: 'included',
                        internet: 'fixed',
                        maintenance: 'fixed',
                        fixedInternet: 2500,
                        fixedMaintenance: 50000
                    },
                    memo: ''
                },
                {
                    name: '사동 1393-3 201호',
                    address: '초당4길 18',
                    type: 'Apartment',
                    status: 'active',
                    currentOccupantName: '김동혁팀',
                    contract: {
                        startDate: '2026-04-27',
                        endDate: '',
                        deposit: 3000000,
                        monthlyRent: 500000,
                        paymentDay: 28,
                        landlordName: '유현주',
                        landlordContact: '',
                        isReported: true
                    },
                    costProfile: {
                        electricity: 'variable',
                        gas: 'variable',
                        water: 'variable',
                        internet: 'fixed',
                        maintenance: 'fixed',
                        fixedInternet: 2500,
                        fixedMaintenance: 50000
                    },
                    memo: ''
                }
            ];

            const toCreate = seeds.filter((s) => !existingNameSet.has(s.name));

            for (const item of toCreate) {
                await accommodationService.addAccommodation(item);
            }

            await loadData();

            if (toCreate.length === 0) {
                alert('이미 등록되어 있습니다.');
            } else {
                alert(`${toCreate.length}건 등록 완료`);
            }
        } catch (e) {
            console.error(e);
            alert('등록에 실패했습니다.');
        } finally {
            setSeeding(false);
        }
    };

    const handleSeedAllAccommodations = async () => {
        const ok = window.confirm('전체 37개 숙소 데이터를 일괄 등록할까요? (이미 있으면 건너뜁니다)');
        if (!ok) return;

        setSeeding(true);
        try {
            const existingNameSet = new Set(accommodations.map((a) => a.name));

            const allSeeds: Array<Omit<Accommodation, 'id' | 'createdAt' | 'updatedAt'>> = [
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

            const toCreate = allSeeds.filter((s) => !existingNameSet.has(s.name));

            for (const item of toCreate) {
                await accommodationService.addAccommodation(item);
            }

            await loadData();

            if (toCreate.length === 0) {
                alert('모든 숙소가 이미 등록되어 있습니다.');
            } else {
                alert(`${toCreate.length}건 등록 완료! (전체 ${allSeeds.length}건 중)`);
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
            <div className="p-6 max-w-[1600px] mx-auto bg-slate-50 min-h-screen">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-700">
                    권한을 확인하는 중입니다...
                </div>
            </div>
        );
    }

    if (canUseAccommodationManager === false) {
        return (
            <div className="p-6 max-w-[1600px] mx-auto bg-slate-50 min-h-screen">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-700">
                    관리자(admin) 계정만 숙소 관리를 사용할 수 있습니다.
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faBuilding} className="text-indigo-600" />
                        숙소 관리
                    </h1>
                    <p className="text-slate-500 mt-1">계약 현황 및 월별 공과금 정산 관리</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleAddClick}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        숙소 등록
                    </button>
                    <button
                        onClick={handleSeedAllAccommodations}
                        disabled={seeding}
                        className={`px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm
                            ${seeding ? 'bg-green-300 text-white cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}
                        `}
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        {seeding ? '등록 중...' : '전체 숙소 일괄등록'}
                    </button>
                    <button
                        onClick={handleSeedTwoAccommodations}
                        disabled={seeding}
                        className={`px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm
                            ${seeding ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-slate-700 text-white hover:bg-slate-800'}
                        `}
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        {seeding ? '등록 중...' : '샘플 2건'}
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-slate-200 p-1 rounded-lg w-fit mb-6">
                <button
                    onClick={() => setActiveTab('status')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === 'status' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <FontAwesomeIcon icon={faChartPie} className="mr-2" />
                    숙소 현황판
                </button>
                <button
                    onClick={() => setActiveTab('ledger')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === 'ledger' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <FontAwesomeIcon icon={faFileInvoiceDollar} className="mr-2" />
                    월별 공과금 대장
                </button>
                <button
                    onClick={() => setActiveTab('billing')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === 'billing' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <FontAwesomeIcon icon={faPhone} className="mr-2" />
                    청구 관리
                </button>
                <button
                    onClick={() => setActiveTab('assignments')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === 'assignments' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <FontAwesomeIcon icon={faUsers} className="mr-2" />
                    배정(입/퇴실)
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm min-h-[600px] p-6">
                {activeTab === 'status' ? (
                    <div className="space-y-6">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">총 관리 숙소</p>
                                    <p className="text-2xl font-bold text-slate-800">{accommodations.length}호</p>
                                </div>
                                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                                    <FontAwesomeIcon icon={faBuilding} />
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">계약 중 (입실)</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {accommodations.filter(a => a.status === 'active').length}호
                                    </p>
                                </div>
                                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                                    <FontAwesomeIcon icon={faChartPie} />
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">예상 월세 지출</p>
                                    <p className="text-2xl font-bold text-indigo-600">
                                        {accommodations
                                            .filter(a => a.status === 'active')
                                            .reduce((sum, a) => sum + (a.contract.monthlyRent || 0), 0)
                                            .toLocaleString()}원
                                    </p>
                                </div>
                                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                                    <FontAwesomeIcon icon={faFileInvoiceDollar} />
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">공실 (계약 종료)</p>
                                    <p className="text-2xl font-bold text-orange-600">
                                        {accommodations.filter(a => a.status === 'inactive').length}호
                                    </p>
                                </div>
                                <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-600">
                                    <FontAwesomeIcon icon={faChartPie} />
                                </div>
                            </div>
                        </div>

                        {accommodations.length === 0 ? (
                            <div className="text-center py-20 text-slate-400">
                                <FontAwesomeIcon icon={faBuilding} className="text-6xl mb-4 text-slate-200" />
                                <p>등록된 숙소가 없습니다. 우측 상단의 '숙소 등록' 버튼을 눌러주세요.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {accommodations.map(acc => (
                                    (() => {
                                        const activeList = activeAssignmentsByAccommodationId.get(acc.id) ?? [];
                                        const checkedInCount = activeList.length;
                                        const billingTargetLabel = buildBillingTargetLabel(activeList);

                                        return (
                                            <div
                                                key={acc.id}
                                                onClick={() => handleEditClick(acc)}
                                                className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition cursor-pointer group"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition">
                                                        {acc.name}
                                                    </h3>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${acc.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        {acc.status === 'active' ? '계약중' : '종료'}
                                                    </span>
                                                </div>

                                                <div className="space-y-2 text-sm text-slate-600">
                                                    <div className="flex items-center gap-2">
                                                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-slate-400 w-4" />
                                                        <span className="truncate">{acc.address}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs bg-slate-100 px-1.5 rounded">월세</span>
                                                        <span className="font-bold text-slate-800">{acc.contract.monthlyRent.toLocaleString()}원</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs bg-slate-100 px-1.5 rounded">입실</span>
                                                        <span className="font-bold text-slate-800">{checkedInCount}명</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs bg-slate-100 px-1.5 rounded">청구대상</span>
                                                        <span className="font-bold text-slate-800">{billingTargetLabel}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
                                                        <span className="">만료: {acc.contract.endDate || '미정'}</span>
                                                    </div>
                                                </div>
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
                    <AccommodationBillingManager />
                ) : (
                    <AccommodationAssignmentManager />
                )}
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
