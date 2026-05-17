import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { manpowerService, Worker } from '../../services/manpowerService';
import { userService } from '../../services/userService';
import { companyService, Company } from '../../services/companyService';
import { accountLinkService } from '../../services/accountLinkService';
import { officeStaffService } from '../../services/officeStaffService';
import { positionService, Position } from '../../services/positionService';
import {
    AccountType,
    ACCOUNT_TYPE_LABELS,
    resolveAccountTypeFromCompanyType,
} from '../../types/accountLink';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faCheckCircle,
    faExclamationTriangle,
    faHardHat,
    faIdBadge,
    faSearch,
    faSpinner,
    faUserPlus,
    faUsersGear,
} from '@fortawesome/free-solid-svg-icons';

interface ProfileSetupProps {
    onComplete: () => void;
}

type CompanyJoinType = '협력사' | '건설사' | '임대사';
type WorkerStep = 'auto-check' | 'auto-confirm' | 'manual-search' | 'create-new';

const ACCOUNT_OPTIONS: Array<{
    type: AccountType;
    title: string;
    description: string;
    icon: typeof faHardHat;
}> = [
    { type: 'worker', title: '작업자', description: '본인 작업자 DB와 연결합니다.', icon: faHardHat },
    { type: 'office', title: '사무실', description: '내부 사무실 담당자로 가입 요청합니다.', icon: faIdBadge },
    { type: 'partner_company', title: '협력사', description: '협력사 회사 계정으로 연결 요청합니다.', icon: faUsersGear },
    { type: 'construction_company', title: '건설사', description: '건설사/시공사 담당자로 연결 요청합니다.', icon: faBuilding },
    { type: 'rental_company', title: '임대사', description: '자재/장비 임대사 계정으로 연결 요청합니다.', icon: faBuilding },
];

const companyTypeByAccountType = (accountType: AccountType): CompanyJoinType => {
    if (accountType === 'construction_company') return '건설사';
    if (accountType === 'rental_company') return '임대사';
    return '협력사';
};

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onComplete }) => {
    const { currentUser } = useAuth();
    const [selectedType, setSelectedType] = useState<AccountType | null>(null);
    const [workerStep, setWorkerStep] = useState<WorkerStep>('auto-check');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [foundWorker, setFoundWorker] = useState<Worker | null>(null);
    const [positions, setPositions] = useState<Position[]>([]);

    const [searchName, setSearchName] = useState('');
    const [searchIdNumber, setSearchIdNumber] = useState('');
    const [newWorkerData, setNewWorkerData] = useState({
        name: '',
        idNumber: '',
        contact: '',
        address: ''
    });

    const [officeData, setOfficeData] = useState({
        displayName: currentUser?.displayName || '',
        idNumber: '',
        address: '',
        department: '',
        position: '',
        phoneNumber: '',
        employmentType: '정규직',
        salaryModel: '월급제',
        unitPrice: '',
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        memo: '',
    });

    const [companyType, setCompanyType] = useState<CompanyJoinType>('협력사');
    const [companySearch, setCompanySearch] = useState('');
    const [companyBusinessNumber, setCompanyBusinessNumber] = useState('');
    const [companyResults, setCompanyResults] = useState<Company[]>([]);
    const [newCompanyData, setNewCompanyData] = useState({
        name: '',
        businessNumber: '',
        ceoName: '',
        phone: '',
        email: '',
        address: '',
        memo: '',
    });

    const isCompanyType = selectedType === 'partner_company' || selectedType === 'construction_company' || selectedType === 'rental_company';

    const typeTitle = useMemo(() => selectedType ? ACCOUNT_TYPE_LABELS[selectedType] : '', [selectedType]);
    const positionOptions = useMemo(() => {
        const names = Array.from(new Set(positions.map((position) => String(position.name ?? '').trim()).filter(Boolean)));
        const currentPosition = String(officeData.position ?? '').trim();
        if (currentPosition && !names.includes(currentPosition)) return [currentPosition, ...names];
        return names;
    }, [officeData.position, positions]);

    const resetMessages = () => {
        setError(null);
        setInfo(null);
    };

    const selectType = (type: AccountType) => {
        resetMessages();
        setSelectedType(type);
        if (type === 'worker') {
            setWorkerStep('auto-check');
        }
        if (type === 'partner_company' || type === 'construction_company' || type === 'rental_company') {
            setCompanyType(companyTypeByAccountType(type));
            setCompanyResults([]);
        }
    };

    const checkAutoMatch = useCallback(async () => {
        if (selectedType !== 'worker') return;
        if (!currentUser?.email) {
            setWorkerStep('manual-search');
            return;
        }

        setLoading(true);
        try {
            const worker = await manpowerService.getWorkerByEmail(currentUser.email);
            if (worker && !worker.uid) {
                setFoundWorker(worker);
                setWorkerStep('auto-confirm');
            } else {
                setWorkerStep('manual-search');
            }
        } catch (err) {
            console.error(err);
            setWorkerStep('manual-search');
        } finally {
            setLoading(false);
        }
    }, [currentUser, selectedType]);

    useEffect(() => {
        if (selectedType === 'worker' && workerStep === 'auto-check') {
            void checkAutoMatch();
        }
    }, [checkAutoMatch, selectedType, workerStep]);

    useEffect(() => {
        if (selectedType !== 'office') return;

        let isMounted = true;
        positionService.getPositions(true)
            .then((rows) => {
                if (isMounted) setPositions(rows);
            })
            .catch((err) => {
                console.error(err);
                if (isMounted) setPositions([]);
            });

        return () => {
            isMounted = false;
        };
    }, [selectedType]);

    const handleAutoLink = async () => {
        if (!foundWorker?.id || !currentUser?.uid) return;

        setLoading(true);
        resetMessages();
        try {
            await userService.linkUserToWorker(currentUser.uid, foundWorker.id, currentUser.email || 'system');
            onComplete();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleManualSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        resetMessages();
        setLoading(true);

        try {
            const worker = await manpowerService.findWorkerForLinking(searchName, searchIdNumber);
            if (!worker) {
                setError('일치하는 작업자 정보를 찾을 수 없습니다.');
                return;
            }
            if (worker.uid) {
                setError('이미 다른 계정에 연결된 작업자입니다.');
                return;
            }
            if (window.confirm(`${worker.name}님으로 연결하시겠습니까?`)) {
                await userService.linkUserToWorker(currentUser!.uid, worker.id!, currentUser?.email || 'system');
                onComplete();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNewWorker = async (e: React.FormEvent) => {
        e.preventDefault();
        resetMessages();

        if (!newWorkerData.name || !newWorkerData.idNumber) {
            setError('이름과 주민번호는 필수입니다.');
            return;
        }

        setLoading(true);
        try {
            const workerId = await manpowerService.addWorker({
                ...newWorkerData,
                email: currentUser?.email || '',
                uid: currentUser?.uid,
                teamType: '미배정',
                status: '미배정',
                unitPrice: 0
            });
            if (currentUser?.uid) {
                await userService.linkUserToWorker(currentUser.uid, workerId, currentUser.email || 'system');
            }
            onComplete();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOfficeRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.uid) return;
        resetMessages();

        if (!officeData.displayName || !officeData.position) {
            setError('이름과 직책은 필수입니다.');
            return;
        }

        setLoading(true);
        try {
            const existingStaff = currentUser.email
                ? await officeStaffService.getOfficeStaffByEmail(currentUser.email)
                : null;

            if (existingStaff?.uid && existingStaff.uid !== currentUser.uid) {
                setError('이미 다른 계정에 연동된 사무실 직원 정보입니다.');
                return;
            }

            const unitPrice = Number(String(officeData.unitPrice || '').replace(/,/g, '')) || 0;
            const officeStaffId = existingStaff?.id || await officeStaffService.addOfficeStaff({
                name: officeData.displayName,
                idNumber: officeData.idNumber,
                address: officeData.address,
                contact: officeData.phoneNumber,
                email: currentUser.email || '',
                department: officeData.department,
                role: officeData.position,
                employmentType: officeData.employmentType,
                salaryModel: officeData.salaryModel,
                payType: officeData.salaryModel,
                unitPrice,
                bankName: officeData.bankName,
                accountNumber: officeData.accountNumber,
                accountHolder: officeData.accountHolder,
                status: '재직',
                memo: officeData.memo,
            });

            if (existingStaff?.id) {
                await officeStaffService.updateOfficeStaff(existingStaff.id, {
                    name: officeData.displayName,
                    idNumber: officeData.idNumber,
                    address: officeData.address,
                    contact: officeData.phoneNumber,
                    department: officeData.department,
                    role: officeData.position,
                    employmentType: officeData.employmentType,
                    salaryModel: officeData.salaryModel,
                    payType: officeData.salaryModel,
                    unitPrice,
                    bankName: officeData.bankName,
                    accountNumber: officeData.accountNumber,
                    accountHolder: officeData.accountHolder,
                    status: existingStaff.status === '퇴사' ? '퇴사' : '재직',
                    memo: officeData.memo,
                });
            }

            const linkId = await accountLinkService.requestOfficeLink({
                uid: currentUser.uid,
                userEmail: currentUser.email,
                userDisplayName: officeData.displayName,
                officeStaffId,
                staffName: officeData.displayName,
                idNumber: officeData.idNumber,
                address: officeData.address,
                department: officeData.department,
                position: officeData.position,
                phoneNumber: officeData.phoneNumber,
                employmentType: officeData.employmentType,
                salaryModel: officeData.salaryModel,
                unitPrice,
                bankName: officeData.bankName,
                accountNumber: officeData.accountNumber,
                accountHolder: officeData.accountHolder,
                memo: officeData.memo,
            });
            await userService.updateUserProfile(currentUser.uid, {
                displayName: officeData.displayName,
                department: officeData.department,
                position: officeData.position,
                phoneNumber: officeData.phoneNumber,
                accountType: 'office',
                status: 'pending',
                primaryLinkId: linkId,
            });
            setInfo('사무실 계정 승인 요청이 접수되었습니다. 관리자가 승인하면 정상 권한이 적용됩니다.');
            onComplete();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCompanySearch = async (e: React.FormEvent) => {
        e.preventDefault();
        resetMessages();
        setLoading(true);

        try {
            const keyword = companySearch.trim() || companyBusinessNumber.trim();
            const rows = keyword ? await companyService.searchCompanies(keyword) : await companyService.getCompaniesByType(companyType);
            const normalizedBusinessNumber = companyBusinessNumber.replace(/\D/g, '');
            const filtered = rows.filter((company) => {
                const typeMatches = companyType === '건설사'
                    ? company.type === '건설사' || company.type === '시공사'
                    : company.type === companyType;
                const businessMatches = !normalizedBusinessNumber
                    || String(company.businessNumber || '').replace(/\D/g, '') === normalizedBusinessNumber;
                return typeMatches && businessMatches;
            });
            setCompanyResults(filtered);
            if (filtered.length === 0) {
                setInfo('일치하는 회사가 없습니다. 아래 신규 회사 연결 요청을 작성해 주세요.');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const requestExistingCompanyLink = async (company: Company) => {
        if (!currentUser?.uid || !company.id) return;
        resetMessages();
        setLoading(true);
        try {
            const linkId = await accountLinkService.requestCompanyLink({
                uid: currentUser.uid,
                userEmail: currentUser.email,
                userDisplayName: currentUser.displayName,
                companyId: company.id,
                companyName: company.name,
                companyType: company.type || companyType,
                relationRole: 'staff',
            });
            await userService.updateUserProfile(currentUser.uid, {
                accountType: resolveAccountTypeFromCompanyType(company.type || companyType),
                status: 'pending',
                primaryLinkId: linkId,
            });
            setInfo(`${company.name} 연결 승인 요청이 접수되었습니다.`);
            onComplete();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleNewCompanyRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.uid) return;
        resetMessages();

        if (!newCompanyData.name || !newCompanyData.businessNumber) {
            setError('회사명과 사업자번호는 필수입니다.');
            return;
        }

        setLoading(true);
        try {
            const linkId = await accountLinkService.requestNewCompanyLink({
                uid: currentUser.uid,
                userEmail: currentUser.email,
                userDisplayName: currentUser.displayName,
                companyType,
                relationRole: 'staff',
                requestedEntity: {
                    ...newCompanyData,
                    memo: newCompanyData.memo,
                },
            });
            await userService.updateUserProfile(currentUser.uid, {
                accountType: resolveAccountTypeFromCompanyType(companyType),
                status: 'pending',
                primaryLinkId: linkId,
            });
            setInfo('신규 회사 연결 승인 요청이 접수되었습니다.');
            onComplete();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderTypeSelection = () => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ACCOUNT_OPTIONS.map((option) => (
                <button
                    key={option.type}
                    type="button"
                    onClick={() => selectType(option.type)}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-brand-400 hover:bg-brand-50"
                >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <FontAwesomeIcon icon={option.icon} />
                    </span>
                    <span>
                        <span className="block font-bold text-slate-800">{option.title}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-slate-500">{option.description}</span>
                    </span>
                </button>
            ))}
        </div>
    );

    const renderWorkerSetup = () => (
        <div>
            {loading && workerStep === 'auto-check' && (
                <div className="py-10 text-center text-sm font-semibold text-slate-500">
                    <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                    이메일로 기존 작업자 정보를 확인 중입니다...
                </div>
            )}

            {workerStep === 'auto-confirm' && foundWorker && (
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl text-brand-600">
                        <FontAwesomeIcon icon={faCheckCircle} />
                    </div>
                    <h3 className="mb-2 text-lg font-bold">기존 작업자 프로필을 찾았습니다.</h3>
                    <div className="mb-6 rounded-lg bg-slate-50 p-4 text-left">
                        <p><span className="inline-block w-20 font-bold text-slate-500">이름:</span> {foundWorker.name}</p>
                        <p><span className="inline-block w-20 font-bold text-slate-500">이메일:</span> {foundWorker.email}</p>
                        <p><span className="inline-block w-20 font-bold text-slate-500">팀:</span> {foundWorker.teamName || '-'}</p>
                    </div>
                    <button onClick={handleAutoLink} disabled={loading} className="mb-3 w-full rounded-lg bg-brand-600 py-3 font-bold text-white hover:bg-brand-700 disabled:opacity-60">
                        {loading ? '연결 중...' : '이 프로필 사용하기'}
                    </button>
                    <button onClick={() => setWorkerStep('manual-search')} className="text-sm text-slate-500 hover:underline">
                        아니요, 직접 찾겠습니다.
                    </button>
                </div>
            )}

            {workerStep === 'manual-search' && (
                <div className="space-y-6">
                    <form onSubmit={handleManualSearch} className="space-y-3">
                        <h3 className="flex items-center gap-2 font-bold text-slate-700"><FontAwesomeIcon icon={faSearch} className="text-brand-500" />기존 작업자 찾기</h3>
                        <input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="이름" required className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:ring-2 focus:ring-brand-500" />
                        <input value={searchIdNumber} onChange={(e) => setSearchIdNumber(e.target.value)} placeholder="주민등록번호 (예: 900101-1234567)" required className="w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:ring-2 focus:ring-brand-500" />
                        <button type="submit" disabled={loading} className="w-full rounded-lg bg-slate-800 py-2.5 font-bold text-white hover:bg-slate-900 disabled:opacity-60">
                            {loading ? '검색 중...' : '검색 및 연결'}
                        </button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                        <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-slate-500">또는</span></div>
                    </div>

                    <button onClick={() => setWorkerStep('create-new')} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-3 font-bold text-slate-600 transition hover:border-brand-500 hover:text-brand-600">
                        <FontAwesomeIcon icon={faUserPlus} />
                        신규 작업자 프로필 생성
                    </button>
                </div>
            )}

            {workerStep === 'create-new' && (
                <form onSubmit={handleCreateNewWorker} className="space-y-3">
                    <h3 className="flex items-center gap-2 font-bold text-slate-700"><FontAwesomeIcon icon={faUserPlus} className="text-brand-500" />신규 작업자 프로필 생성</h3>
                    <input value={newWorkerData.name} onChange={(e) => setNewWorkerData({ ...newWorkerData, name: e.target.value })} placeholder="이름 *" required className="w-full rounded-lg border border-slate-300 p-2.5" />
                    <input value={newWorkerData.idNumber} onChange={(e) => setNewWorkerData({ ...newWorkerData, idNumber: e.target.value })} placeholder="주민등록번호 *" required className="w-full rounded-lg border border-slate-300 p-2.5" />
                    <input value={newWorkerData.contact} onChange={(e) => setNewWorkerData({ ...newWorkerData, contact: e.target.value })} placeholder="연락처" className="w-full rounded-lg border border-slate-300 p-2.5" />
                    <input value={newWorkerData.address} onChange={(e) => setNewWorkerData({ ...newWorkerData, address: e.target.value })} placeholder="주소" className="w-full rounded-lg border border-slate-300 p-2.5" />
                    <div className="flex gap-3 pt-3">
                        <button type="button" onClick={() => setWorkerStep('manual-search')} className="flex-1 rounded-lg bg-slate-100 py-2.5 font-bold text-slate-600 hover:bg-slate-200">취소</button>
                        <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-brand-600 py-2.5 font-bold text-white hover:bg-brand-700 disabled:opacity-60">{loading ? '생성 중...' : '생성 완료'}</button>
                    </div>
                </form>
            )}
        </div>
    );

    const renderOfficeSetup = () => (
        <form onSubmit={handleOfficeRequest} className="space-y-3">
            <input value={officeData.displayName} onChange={(e) => setOfficeData({ ...officeData, displayName: e.target.value })} placeholder="이름 *" required className="w-full rounded-lg border border-slate-300 p-2.5" />
            <input value={officeData.idNumber} onChange={(e) => setOfficeData({ ...officeData, idNumber: e.target.value })} placeholder="주민번호" className="w-full rounded-lg border border-slate-300 p-2.5" />
            <input value={officeData.department} onChange={(e) => setOfficeData({ ...officeData, department: e.target.value })} placeholder="부서" className="w-full rounded-lg border border-slate-300 p-2.5" />
            <select value={officeData.position} onChange={(e) => setOfficeData({ ...officeData, position: e.target.value })} required className="w-full rounded-lg border border-slate-300 p-2.5">
                <option value="">직책 선택 *</option>
                {positionOptions.map((position) => (
                    <option key={position} value={position}>{position}</option>
                ))}
            </select>
            <input value={officeData.phoneNumber} onChange={(e) => setOfficeData({ ...officeData, phoneNumber: e.target.value })} placeholder="연락처" className="w-full rounded-lg border border-slate-300 p-2.5" />
            <input value={officeData.address} onChange={(e) => setOfficeData({ ...officeData, address: e.target.value })} placeholder="주소" className="w-full rounded-lg border border-slate-300 p-2.5" />
            <select value={officeData.employmentType} onChange={(e) => setOfficeData({ ...officeData, employmentType: e.target.value })} className="w-full rounded-lg border border-slate-300 p-2.5">
                <option value="정규직">정규직</option>
                <option value="프리랜서">프리랜서</option>
                <option value="기타">기타</option>
            </select>
            <select value={officeData.salaryModel} onChange={(e) => setOfficeData({ ...officeData, salaryModel: e.target.value })} className="w-full rounded-lg border border-slate-300 p-2.5">
                <option value="월급제">월급제</option>
                <option value="일급제">일급제</option>
                <option value="고정급">고정급</option>
                <option value="기타">기타</option>
            </select>
            <input value={officeData.unitPrice} onChange={(e) => setOfficeData({ ...officeData, unitPrice: e.target.value })} placeholder="급여/단가" type="number" className="w-full rounded-lg border border-slate-300 p-2.5" />
            <input value={officeData.bankName} onChange={(e) => setOfficeData({ ...officeData, bankName: e.target.value })} placeholder="은행" className="w-full rounded-lg border border-slate-300 p-2.5" />
            <input value={officeData.accountNumber} onChange={(e) => setOfficeData({ ...officeData, accountNumber: e.target.value })} placeholder="계좌번호" className="w-full rounded-lg border border-slate-300 p-2.5" />
            <input value={officeData.accountHolder} onChange={(e) => setOfficeData({ ...officeData, accountHolder: e.target.value })} placeholder="예금주" className="w-full rounded-lg border border-slate-300 p-2.5" />
            <textarea value={officeData.memo} onChange={(e) => setOfficeData({ ...officeData, memo: e.target.value })} placeholder="요청 메모" rows={3} className="w-full rounded-lg border border-slate-300 p-2.5" />
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-brand-600 py-3 font-bold text-white hover:bg-brand-700 disabled:opacity-60">
                {loading ? '요청 중...' : '사무실 계정 승인 요청'}
            </button>
        </form>
    );

    const renderCompanySetup = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-2">
                {(['협력사', '건설사', '임대사'] as CompanyJoinType[]).map((type) => (
                    <button
                        type="button"
                        key={type}
                        onClick={() => setCompanyType(type)}
                        className={`rounded-lg border px-3 py-2 text-sm font-bold ${companyType === type ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'}`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            <form onSubmit={handleCompanySearch} className="space-y-3">
                <h3 className="flex items-center gap-2 font-bold text-slate-700"><FontAwesomeIcon icon={faSearch} className="text-brand-500" />기존 회사 찾기</h3>
                <input value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} placeholder="회사명 또는 코드" className="w-full rounded-lg border border-slate-300 p-2.5" />
                <input value={companyBusinessNumber} onChange={(e) => setCompanyBusinessNumber(e.target.value)} placeholder="사업자번호" className="w-full rounded-lg border border-slate-300 p-2.5" />
                <button type="submit" disabled={loading} className="w-full rounded-lg bg-slate-800 py-2.5 font-bold text-white hover:bg-slate-900 disabled:opacity-60">
                    {loading ? '검색 중...' : '회사 검색'}
                </button>
            </form>

            {companyResults.length > 0 && (
                <div className="space-y-2">
                    {companyResults.map((company) => (
                        <button
                            key={company.id}
                            type="button"
                            onClick={() => requestExistingCompanyLink(company)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-brand-400 hover:bg-brand-50"
                        >
                            <div className="font-bold text-slate-800">{company.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{company.type} · {company.businessNumber || '사업자번호 없음'} · {company.phone || '연락처 없음'}</div>
                        </button>
                    ))}
                </div>
            )}

            <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-slate-500">검색 결과가 없으면</span></div>
            </div>

            <form onSubmit={handleNewCompanyRequest} className="space-y-3">
                <h3 className="font-bold text-slate-700">신규 회사 연결 요청</h3>
                <input value={newCompanyData.name} onChange={(e) => setNewCompanyData({ ...newCompanyData, name: e.target.value })} placeholder="회사명 *" required className="w-full rounded-lg border border-slate-300 p-2.5" />
                <input value={newCompanyData.businessNumber} onChange={(e) => setNewCompanyData({ ...newCompanyData, businessNumber: e.target.value })} placeholder="사업자번호 *" required className="w-full rounded-lg border border-slate-300 p-2.5" />
                <input value={newCompanyData.ceoName} onChange={(e) => setNewCompanyData({ ...newCompanyData, ceoName: e.target.value })} placeholder="대표자명" className="w-full rounded-lg border border-slate-300 p-2.5" />
                <input value={newCompanyData.phone} onChange={(e) => setNewCompanyData({ ...newCompanyData, phone: e.target.value })} placeholder="연락처" className="w-full rounded-lg border border-slate-300 p-2.5" />
                <input value={newCompanyData.email} onChange={(e) => setNewCompanyData({ ...newCompanyData, email: e.target.value })} placeholder="이메일" className="w-full rounded-lg border border-slate-300 p-2.5" />
                <input value={newCompanyData.address} onChange={(e) => setNewCompanyData({ ...newCompanyData, address: e.target.value })} placeholder="주소" className="w-full rounded-lg border border-slate-300 p-2.5" />
                <textarea value={newCompanyData.memo} onChange={(e) => setNewCompanyData({ ...newCompanyData, memo: e.target.value })} placeholder="요청 메모" rows={3} className="w-full rounded-lg border border-slate-300 p-2.5" />
                <button type="submit" disabled={loading} className="w-full rounded-lg bg-brand-600 py-3 font-bold text-white hover:bg-brand-700 disabled:opacity-60">
                    {loading ? '요청 중...' : '신규 회사 승인 요청'}
                </button>
            </form>
        </div>
    );

    return (
        <div className="mx-auto my-10 max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 bg-slate-50 p-6 text-center">
                <h2 className="text-xl font-bold text-slate-800">계정 유형 설정</h2>
                <p className="mt-1 text-sm text-slate-500">
                    {selectedType ? `${typeTitle} 계정으로 연결 정보를 설정합니다.` : '서비스 이용을 위해 가입 유형을 선택해 주세요.'}
                </p>
            </div>

            <div className="p-6">
                {error && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        {error}
                    </div>
                )}
                {info && (
                    <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-700">
                        {info}
                    </div>
                )}

                {!selectedType && renderTypeSelection()}
                {selectedType === 'worker' && renderWorkerSetup()}
                {selectedType === 'office' && renderOfficeSetup()}
                {isCompanyType && renderCompanySetup()}

                {selectedType && (
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedType(null);
                            resetMessages();
                        }}
                        className="mt-5 text-sm font-semibold text-slate-500 hover:text-slate-700"
                    >
                        유형 다시 선택
                    </button>
                )}
            </div>
        </div>
    );
};

export default ProfileSetup;
