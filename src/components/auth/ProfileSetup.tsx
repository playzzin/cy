import React, { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    accountLinkService,
    AccountLinkCompanyCandidate,
    AccountLinkWorkerCandidate,
} from '../../services/accountLinkService';
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
    faUserPlus,
    faUsersGear,
} from '@fortawesome/free-solid-svg-icons';

interface ProfileSetupProps {
    onComplete: () => void;
}

type CompanyJoinType = '협력사' | '건설사' | '임대사';
type WorkerStep = 'manual-search' | 'confirm' | 'create-new';

const ACCOUNT_OPTIONS: Array<{
    type: AccountType;
    title: string;
    description: string;
    icon: typeof faHardHat;
}> = [
    { type: 'worker', title: '작업자', description: '본인 전화번호로 작업자 DB를 찾습니다.', icon: faHardHat },
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
    const [workerStep, setWorkerStep] = useState<WorkerStep>('manual-search');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [foundWorker, setFoundWorker] = useState<AccountLinkWorkerCandidate | null>(null);

    const [workerPhone, setWorkerPhone] = useState('');
    const [newWorkerData, setNewWorkerData] = useState({
        name: '',
        contact: '',
        address: ''
    });

    const [officeData, setOfficeData] = useState({
        displayName: currentUser?.displayName || '',
        address: '',
        department: '',
        position: '',
        phoneNumber: '',
        employmentType: '정규직',
        salaryModel: '월급제',
        unitPrice: '',
        memo: '',
    });

    const [companyType, setCompanyType] = useState<CompanyJoinType>('협력사');
    const [companySearch, setCompanySearch] = useState('');
    const [companyBusinessNumber, setCompanyBusinessNumber] = useState('');
    const [companyResults, setCompanyResults] = useState<AccountLinkCompanyCandidate[]>([]);
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

    const resetMessages = () => {
        setError(null);
        setInfo(null);
    };

    const selectType = (type: AccountType) => {
        resetMessages();
        setSelectedType(type);
        if (type === 'worker') {
            setWorkerStep('manual-search');
            setFoundWorker(null);
        }
        if (type === 'partner_company' || type === 'construction_company' || type === 'rental_company') {
            setCompanyType(companyTypeByAccountType(type));
            setCompanyResults([]);
        }
    };

    const handleAutoLink = async () => {
        if (!foundWorker?.id) return;

        setLoading(true);
        resetMessages();
        try {
            await accountLinkService.requestWorkerLink({
                entityId: foundWorker.id,
                name: foundWorker.name,
                identityPhone: workerPhone,
            });
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
            if (!workerPhone.trim()) {
                setError('본인 휴대전화번호를 입력해 주세요.');
                return;
            }
            const worker = await accountLinkService.getMyWorkerCandidate({
                phone: workerPhone,
            });
            if (!worker) {
                setError('입력한 정보와 일치하는 기존 작업자를 찾을 수 없습니다.');
                return;
            }
            setFoundWorker(worker);
            setWorkerStep('confirm');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNewWorker = async (e: React.FormEvent) => {
        e.preventDefault();
        resetMessages();

        if (!newWorkerData.name) {
            setError('이름은 필수입니다.');
            return;
        }

        setLoading(true);
        try {
            await accountLinkService.requestWorkerLink({
                name: newWorkerData.name,
                phone: newWorkerData.contact,
                address: newWorkerData.address,
            });
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
            const unitPrice = Number(String(officeData.unitPrice || '').replace(/,/g, '')) || 0;
            await accountLinkService.requestOfficeLink({
                uid: currentUser.uid,
                userEmail: currentUser.email,
                userDisplayName: officeData.displayName,
                staffName: officeData.displayName,
                address: officeData.address,
                department: officeData.department,
                position: officeData.position,
                phoneNumber: officeData.phoneNumber,
                employmentType: officeData.employmentType,
                salaryModel: officeData.salaryModel,
                unitPrice,
                memo: officeData.memo,
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
            const filtered = await accountLinkService.searchCompanies({
                accountType: resolveAccountTypeFromCompanyType(companyType),
                searchTerm: companySearch,
                businessNumber: companyBusinessNumber,
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

    const requestExistingCompanyLink = async (company: AccountLinkCompanyCandidate) => {
        if (!currentUser?.uid || !company.id) return;
        resetMessages();
        setLoading(true);
        try {
            await accountLinkService.requestCompanyLink({
                uid: currentUser.uid,
                userEmail: currentUser.email,
                userDisplayName: currentUser.displayName,
                companyId: company.id,
                companyName: company.name,
                companyType: company.type || companyType,
                relationRole: 'staff',
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
            await accountLinkService.requestNewCompanyLink({
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
            {workerStep === 'confirm' && foundWorker && (
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl text-brand-600">
                        <FontAwesomeIcon icon={faCheckCircle} />
                    </div>
                    <h3 className="mb-2 text-lg font-bold">기존 작업자 프로필을 찾았습니다.</h3>
                    <div className="mb-6 rounded-lg bg-slate-50 p-4 text-left">
                        <p><span className="inline-block w-20 font-bold text-slate-500">이름:</span> {foundWorker.name}</p>
                        <p><span className="inline-block w-20 font-bold text-slate-500">팀:</span> {foundWorker.teamName || '-'}</p>
                    </div>
                    <button onClick={handleAutoLink} disabled={loading} className="mb-3 w-full rounded-lg bg-brand-600 py-3 font-bold text-white hover:bg-brand-700 disabled:opacity-60">
                        {loading ? '요청 중...' : '이 프로필로 승인 요청'}
                    </button>
                    <button onClick={() => setWorkerStep('manual-search')} className="text-sm text-slate-500 hover:underline">
                        다른 작업자 찾기
                    </button>
                </div>
            )}

            {workerStep === 'manual-search' && (
                <div className="space-y-6">
                    <form onSubmit={handleManualSearch} className="space-y-3">
                        <h3 className="flex items-center gap-2 font-bold text-slate-700"><FontAwesomeIcon icon={faSearch} className="text-brand-500" />기존 작업자 찾기</h3>
                        <label className="block text-sm font-semibold text-slate-600">
                            본인 휴대전화번호
                            <input type="tel" autoComplete="tel" value={workerPhone} onChange={(e) => setWorkerPhone(e.target.value)} placeholder="010-1234-5678" required className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 outline-none focus:ring-2 focus:ring-brand-500" />
                        </label>
                        <p className="text-xs leading-relaxed text-slate-500">입력한 정보는 기존 작업자 본인확인에만 사용되며 승인 요청 정보에는 저장되지 않습니다.</p>
                        <button type="submit" disabled={loading} className="w-full rounded-lg bg-slate-800 py-2.5 font-bold text-white hover:bg-slate-900 disabled:opacity-60">
                            {loading ? '찾는 중...' : '기존 작업자 찾기'}
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
                    <input value={newWorkerData.contact} onChange={(e) => setNewWorkerData({ ...newWorkerData, contact: e.target.value })} placeholder="연락처" className="w-full rounded-lg border border-slate-300 p-2.5" />
                    <input value={newWorkerData.address} onChange={(e) => setNewWorkerData({ ...newWorkerData, address: e.target.value })} placeholder="주소" className="w-full rounded-lg border border-slate-300 p-2.5" />
                    <div className="flex gap-3 pt-3">
                        <button type="button" onClick={() => setWorkerStep('manual-search')} className="flex-1 rounded-lg bg-slate-100 py-2.5 font-bold text-slate-600 hover:bg-slate-200">취소</button>
                        <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-brand-600 py-2.5 font-bold text-white hover:bg-brand-700 disabled:opacity-60">{loading ? '요청 중...' : '신규 작업자 승인 요청'}</button>
                    </div>
                </form>
            )}
        </div>
    );

    const renderOfficeSetup = () => (
        <form onSubmit={handleOfficeRequest} className="space-y-3">
            <input value={officeData.displayName} onChange={(e) => setOfficeData({ ...officeData, displayName: e.target.value })} placeholder="이름 *" required className="w-full rounded-lg border border-slate-300 p-2.5" />
            <input value={officeData.department} onChange={(e) => setOfficeData({ ...officeData, department: e.target.value })} placeholder="부서" className="w-full rounded-lg border border-slate-300 p-2.5" />
            <input value={officeData.position} onChange={(e) => setOfficeData({ ...officeData, position: e.target.value })} placeholder="직책 *" required className="w-full rounded-lg border border-slate-300 p-2.5" />
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
