import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faAddressCard,
    faBell,
    faBuilding,
    faCalendarCheck,
    faCheck,
    faCircleNotch,
    faClockRotateLeft,
    faEnvelope,
    faLink,
    faMagnifyingGlass,
    faPhone,
    faPlus,
    faSave,
    faTriangleExclamation,
    faUser,
} from '@fortawesome/free-solid-svg-icons';
import { useMasterData } from '../../contexts/MasterDataContext';
import { partnerRecognitionService } from '../../services/partnerRecognitionService';
import type {
    BusinessCardImage,
    BusinessContact,
    BusinessContactFollowUp,
    BusinessContactHistory,
    ContactHistoryType,
} from '../../types/partnerRecognition';
import PartnerMenuTopNav from '../../components/common/PartnerMenuTopNav';

const HISTORY_TYPES: Array<{ value: ContactHistoryType; label: string }> = [
    { value: 'call', label: '통화' },
    { value: 'meeting', label: '미팅' },
    { value: 'quote', label: '견적' },
    { value: 'contract', label: '계약' },
    { value: 'claim', label: '클레임' },
    { value: 'memo', label: '메모' },
    { value: 'other', label: '기타' },
];

type QuickFilter = 'all' | 'withCard' | 'needsInfo' | 'duplicates';

type ContactFormState = {
    companyId: string;
    companyName: string;
    name: string;
    department: string;
    position: string;
    mobile: string;
    phone: string;
    email: string;
    memo: string;
    tagsText: string;
};

const emptyContactForm: ContactFormState = {
    companyId: '',
    companyName: '',
    name: '',
    department: '',
    position: '',
    mobile: '',
    phone: '',
    email: '',
    memo: '',
    tagsText: '',
};

const today = () => new Date().toISOString().slice(0, 10);

const normalize = (value: unknown): string =>
    String(value || '').toLowerCase().replace(/\s+/g, '');

const toContactForm = (contact: BusinessContact | null): ContactFormState => ({
    companyId: contact?.companyId || '',
    companyName: contact?.companyName || '',
    name: contact?.name || '',
    department: contact?.department || '',
    position: contact?.position || '',
    mobile: contact?.mobile || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    memo: contact?.memo || '',
    tagsText: (contact?.tags || []).join(', '),
});

const timestampToDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate();
    }
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
        const seconds = Number((value as { seconds?: number }).seconds || 0);
        return seconds ? new Date(seconds * 1000) : null;
    }
    return null;
};

const formatShortDate = (value: unknown): string => {
    const date = timestampToDate(value);
    if (!date) return '-';
    return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
};

const getContactSubtitle = (contact: BusinessContact): string =>
    [contact.department, contact.position].filter(Boolean).join(' · ') || '직무 정보 없음';

const hasMissingContactInfo = (contact: BusinessContact): boolean =>
    !contact.mobile && !contact.phone && !contact.email;

const getSourceLabel = (source: BusinessContact['source']): string => {
    if (source === 'photo_recognition') return '명함인식';
    if (source === 'manual') return '수기등록';
    return '이관';
};

const listVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.045 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 12, scale: 0.985 },
    visible: { opacity: 1, y: 0, scale: 1 },
};

const BusinessCardContactsPage: React.FC = () => {
    const { companies } = useMasterData();
    const [contacts, setContacts] = useState<BusinessContact[]>([]);
    const [allCards, setAllCards] = useState<BusinessCardImage[]>([]);
    const [selectedContactId, setSelectedContactId] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<ContactFormState>(emptyContactForm);
    const [histories, setHistories] = useState<BusinessContactHistory[]>([]);
    const [followUps, setFollowUps] = useState<BusinessContactFollowUp[]>([]);
    const [historyForm, setHistoryForm] = useState({
        type: 'call' as ContactHistoryType,
        title: '',
        content: '',
        happenedAt: today(),
    });
    const [followUpForm, setFollowUpForm] = useState({
        title: '',
        dueDate: today(),
        memo: '',
    });

    useEffect(() => {
        setLoading(true);
        const unsubscribe = partnerRecognitionService.subscribeContacts((nextContacts) => {
            setContacts(nextContacts);
            setLoading(false);
            setSelectedContactId((prev) => prev || nextContacts[0]?.id || '');
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        const unsubscribe = partnerRecognitionService.subscribeCardImages(setAllCards);
        return unsubscribe;
    }, []);

    const cardsByContactId = useMemo(() => {
        const map = new Map<string, BusinessCardImage[]>();
        allCards.forEach((card) => {
            if (!card.contactId) return;
            const nextCards = map.get(card.contactId) || [];
            nextCards.push(card);
            map.set(card.contactId, nextCards);
        });
        return map;
    }, [allCards]);

    const selectedContact = useMemo(
        () => contacts.find((contact) => contact.id === selectedContactId) || null,
        [contacts, selectedContactId]
    );

    const selectedCards = selectedContact?.id ? cardsByContactId.get(selectedContact.id) || [] : [];

    useEffect(() => {
        setForm(toContactForm(selectedContact));
    }, [selectedContact]);

    useEffect(() => {
        let cancelled = false;
        const loadDetail = async () => {
            if (!selectedContact?.id) {
                setHistories([]);
                setFollowUps([]);
                return;
            }
            const [nextHistories, nextFollowUps] = await Promise.all([
                partnerRecognitionService.getContactHistories(selectedContact.id),
                partnerRecognitionService.getContactFollowUps(selectedContact.id),
            ]);
            if (!cancelled) {
                setHistories(nextHistories);
                setFollowUps(nextFollowUps);
            }
        };
        loadDetail().catch((error) => {
            console.error('Failed to load contact detail:', error);
            if (!cancelled) {
                setHistories([]);
                setFollowUps([]);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [selectedContact]);

    const duplicateGroups = useMemo(
        () => partnerRecognitionService.findDuplicateContacts(contacts),
        [contacts]
    );

    const duplicateContactIds = useMemo(() => {
        const ids = new Set<string>();
        duplicateGroups.forEach((group) => {
            group.contacts.forEach((contact) => {
                if (contact.id) ids.add(contact.id);
            });
        });
        return ids;
    }, [duplicateGroups]);

    const filteredContacts = useMemo(() => {
        const term = normalize(searchTerm);
        return contacts.filter((contact) => {
            const contactId = contact.id || '';
            const contactCards = contactId ? cardsByContactId.get(contactId) || [] : [];
            if (selectedCompanyId && contact.companyId !== selectedCompanyId) return false;
            if (quickFilter === 'withCard' && contactCards.length === 0) return false;
            if (quickFilter === 'needsInfo' && !hasMissingContactInfo(contact)) return false;
            if (quickFilter === 'duplicates' && !duplicateContactIds.has(contactId)) return false;
            if (!term) return true;
            const haystack = normalize([
                contact.name,
                contact.companyName,
                contact.department,
                contact.position,
                contact.mobile,
                contact.phone,
                contact.email,
                contact.memo,
                ...(contact.tags || []),
                contactCards.map((card) => card.extractedRawText || '').join(' '),
            ].join(' '));
            return haystack.includes(term);
        });
    }, [cardsByContactId, contacts, duplicateContactIds, quickFilter, searchTerm, selectedCompanyId]);

    const selectedDuplicateGroup = useMemo(
        () => duplicateGroups.find((group) => group.contacts.some((contact) => contact.id === selectedContactId)),
        [duplicateGroups, selectedContactId]
    );

    const metrics = useMemo(() => {
        const withCard = contacts.filter((contact) => contact.id && (cardsByContactId.get(contact.id) || []).length > 0).length;
        const needsInfo = contacts.filter(hasMissingContactInfo).length;
        return [
            { label: '전체 담당자', value: contacts.length, tone: 'slate' },
            { label: '명함 연결', value: withCard, tone: 'blue' },
            { label: '연락처 보강', value: needsInfo, tone: 'amber' },
            { label: '중복 의심', value: duplicateContactIds.size, tone: 'rose' },
        ];
    }, [cardsByContactId, contacts, duplicateContactIds.size]);

    const quickFilters: Array<{ value: QuickFilter; label: string; count: number }> = [
        { value: 'all', label: '전체', count: contacts.length },
        { value: 'withCard', label: '명함 있음', count: metrics[1].value },
        { value: 'needsInfo', label: '연락처 보강', count: metrics[2].value },
        { value: 'duplicates', label: '중복 의심', count: metrics[3].value },
    ];

    const openFollowUps = followUps.filter((item) => item.status === 'open');

    const handleCompanyChange = (companyId: string) => {
        const company = companies.find((item) => item.id === companyId);
        setForm((prev) => ({
            ...prev,
            companyId,
            companyName: company?.name || '',
        }));
    };

    const handleNewContact = () => {
        setSelectedContactId('');
        setForm(emptyContactForm);
        setHistories([]);
        setFollowUps([]);
    };

    const handleSaveContact = async () => {
        if (!form.companyId || !form.companyName) {
            alert('통합DB 회사를 선택해 주세요.');
            return;
        }
        setSaving(true);
        try {
            const id = await partnerRecognitionService.upsertContact({
                id: selectedContact?.id,
                companyId: form.companyId,
                companyName: form.companyName,
                name: form.name || '이름 미상',
                department: form.department,
                position: form.position,
                mobile: form.mobile,
                phone: form.phone,
                email: form.email,
                memo: form.memo,
                tags: form.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
                source: selectedContact?.source || 'manual',
            });
            setSelectedContactId(id);
            alert('담당자 정보가 저장되었습니다.');
        } catch (error) {
            console.error('Failed to save contact:', error);
            alert(error instanceof Error ? error.message : '담당자 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleAddHistory = async () => {
        if (!selectedContact?.id) return;
        if (!historyForm.title.trim() && !historyForm.content.trim()) {
            alert('히스토리 제목 또는 내용을 입력해 주세요.');
            return;
        }
        await partnerRecognitionService.addContactHistory({
            contactId: selectedContact.id,
            companyId: selectedContact.companyId,
            companyName: selectedContact.companyName,
            type: historyForm.type,
            title: historyForm.title || HISTORY_TYPES.find((item) => item.value === historyForm.type)?.label || '히스토리',
            content: historyForm.content,
            happenedAt: historyForm.happenedAt || today(),
        });
        setHistoryForm({ type: 'call', title: '', content: '', happenedAt: today() });
        setHistories(await partnerRecognitionService.getContactHistories(selectedContact.id));
    };

    const handleAddFollowUp = async () => {
        if (!selectedContact?.id) return;
        if (!followUpForm.title.trim()) {
            alert('후속일정 제목을 입력해 주세요.');
            return;
        }
        await partnerRecognitionService.addContactFollowUp({
            contactId: selectedContact.id,
            companyId: selectedContact.companyId,
            companyName: selectedContact.companyName,
            title: followUpForm.title,
            dueDate: followUpForm.dueDate || today(),
            memo: followUpForm.memo,
        });
        setFollowUpForm({ title: '', dueDate: today(), memo: '' });
        setFollowUps(await partnerRecognitionService.getContactFollowUps(selectedContact.id));
    };

    const handleDoneFollowUp = async (followUp: BusinessContactFollowUp) => {
        if (!followUp.id || !selectedContact?.id) return;
        await partnerRecognitionService.updateFollowUpStatus(followUp.id, followUp.status === 'done' ? 'open' : 'done');
        setFollowUps(await partnerRecognitionService.getContactFollowUps(selectedContact.id));
    };

    const handleMergeDuplicate = async (duplicateId: string) => {
        if (!selectedContact?.id || !duplicateId) return;
        const duplicate = contacts.find((contact) => contact.id === duplicateId);
        if (!window.confirm(`${duplicate?.name || '선택한 담당자'}를 현재 담당자(${selectedContact.name})로 병합할까요? 병합된 담당자 문서는 삭제됩니다.`)) {
            return;
        }
        setSaving(true);
        try {
            await partnerRecognitionService.mergeContacts(selectedContact.id, duplicateId);
            alert('중복 담당자를 병합했습니다.');
        } catch (error) {
            console.error('Failed to merge contacts:', error);
            alert(error instanceof Error ? error.message : '중복 병합에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleCopy = async (value: string | undefined, label: string) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            alert(`${label}을 복사했습니다.`);
        } catch {
            alert('복사에 실패했습니다. 브라우저 권한을 확인해 주세요.');
        }
    };

    return (
        <div className="min-h-screen bg-[#f4f6fa] p-4 text-slate-900 sm:p-6">
            <div className="mx-auto flex w-full max-w-none flex-col gap-4">
                <PartnerMenuTopNav className="rounded-lg" />

                <header className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="inline-flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700">
                                        <FontAwesomeIcon icon={faAddressCard} />
                                        Business Card Directory
                                    </div>
                                    <h1 className="mt-3 text-2xl font-black text-slate-950">명함 목록</h1>
                                    <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                                        명함 사진과 담당자 요약을 한 줄에서 비교하고, 연락처 보강·히스토리·후속일정을 바로 관리합니다.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Link
                                        to="/database/partner-photo-registration"
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-extrabold text-blue-700 transition hover:bg-blue-100"
                                    >
                                        <FontAwesomeIcon icon={faPlus} />
                                        명함 등록
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={handleNewContact}
                                        className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-slate-800"
                                    >
                                        <FontAwesomeIcon icon={faUser} />
                                        담당자 직접 추가
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-slate-200 bg-slate-950 p-5 text-white lg:border-l lg:border-t-0">
                            <div className="text-xs font-extrabold uppercase text-blue-200">오늘의 관리 포인트</div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                {metrics.map((metric) => (
                                    <MetricTile key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
                                ))}
                            </div>
                        </div>
                    </div>
                </header>

                <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
                    <main className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 p-4">
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                                <div className="relative">
                                    <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        placeholder="이름, 회사, 전화, 이메일, 메모, 명함 원문 검색"
                                        className="h-11 w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                                <select
                                    value={selectedCompanyId}
                                    onChange={(event) => setSelectedCompanyId(event.target.value)}
                                    className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="">전체 회사</option>
                                    {companies.map((company) => (
                                        <option key={company.id || company.name} value={company.id || ''}>{company.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                                {quickFilters.map((filter) => (
                                    <QuickFilterButton
                                        key={filter.value}
                                        label={filter.label}
                                        count={filter.count}
                                        active={quickFilter === filter.value}
                                        onClick={() => setQuickFilter(filter.value)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="min-h-[560px] p-4">
                            {loading ? (
                                <div className="flex min-h-[420px] items-center justify-center gap-2 text-sm font-bold text-slate-500">
                                    <FontAwesomeIcon icon={faCircleNotch} spin />
                                    명함 목록을 불러오는 중
                                </div>
                            ) : filteredContacts.length === 0 ? (
                                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center">
                                    <FontAwesomeIcon icon={faMagnifyingGlass} className="text-4xl text-slate-300" />
                                    <div className="mt-4 text-base font-extrabold text-slate-700">조건에 맞는 명함이 없습니다.</div>
                                    <div className="mt-1 text-sm font-semibold text-slate-500">검색어 또는 필터를 조정해 주세요.</div>
                                </div>
                            ) : (
                                <motion.div
                                    variants={listVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="grid grid-cols-1 gap-3"
                                >
                                    <AnimatePresence initial={false}>
                                        {filteredContacts.map((contact) => {
                                            const contactId = contact.id || '';
                                            const contactCards = contactId ? cardsByContactId.get(contactId) || [] : [];
                                            return (
                                                <BusinessCardListItem
                                                    key={contactId || `${contact.companyName}-${contact.name}`}
                                                    contact={contact}
                                                    cards={contactCards}
                                                    selected={contactId === selectedContactId}
                                                    duplicate={duplicateContactIds.has(contactId)}
                                                    needsInfo={hasMissingContactInfo(contact)}
                                                    onSelect={() => setSelectedContactId(contactId)}
                                                    onCopy={handleCopy}
                                                />
                                            );
                                        })}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </div>
                    </main>

                    <aside className="min-w-0">
                        <div className="sticky top-4 flex flex-col gap-4">
                            <AnimatePresence mode="wait">
                                <motion.section
                                    key={selectedContact?.id || 'new-contact'}
                                    initial={{ opacity: 0, x: 18 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 18 }}
                                    transition={{ duration: 0.18 }}
                                    className="rounded-lg border border-slate-200 bg-white shadow-sm"
                                >
                                    <div className="border-b border-slate-200 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-xs font-extrabold text-blue-600">선택 담당자</div>
                                                <h2 className="mt-1 truncate text-xl font-black text-slate-950">
                                                    {selectedContact?.name || form.name || '신규 담당자'}
                                                </h2>
                                                <p className="mt-1 truncate text-sm font-bold text-slate-500">
                                                    {selectedContact?.companyName || form.companyName || '통합DB 회사 선택 필요'}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSaveContact}
                                                disabled={saving}
                                                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-extrabold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {saving ? <FontAwesomeIcon icon={faCircleNotch} spin /> : <FontAwesomeIcon icon={faSave} />}
                                                저장
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-4">
                                        <div className="grid grid-cols-1 gap-3">
                                            <Field label="통합DB 회사">
                                                <select
                                                    value={form.companyId}
                                                    onChange={(event) => handleCompanyChange(event.target.value)}
                                                    className="form-field"
                                                >
                                                    <option value="">회사 선택</option>
                                                    {companies.map((company) => (
                                                        <option key={company.id || company.name} value={company.id || ''}>{company.name}</option>
                                                    ))}
                                                </select>
                                            </Field>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field label="이름">
                                                    <input className="form-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                                                </Field>
                                                <Field label="직책">
                                                    <input className="form-field" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} />
                                                </Field>
                                            </div>
                                            <Field label="부서">
                                                <input className="form-field" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
                                            </Field>
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                                <Field label="휴대폰">
                                                    <input className="form-field" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} />
                                                </Field>
                                                <Field label="대표/회사전화">
                                                    <input className="form-field" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                                                </Field>
                                            </div>
                                            <Field label="이메일">
                                                <input className="form-field" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                                            </Field>
                                            <Field label="태그">
                                                <input className="form-field" value={form.tagsText} onChange={(event) => setForm({ ...form, tagsText: event.target.value })} placeholder="쉼표로 구분" />
                                            </Field>
                                            <Field label="메모">
                                                <textarea className="form-field min-h-[78px]" value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} />
                                            </Field>
                                        </div>
                                    </div>
                                </motion.section>
                            </AnimatePresence>

                            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-900">
                                    <FontAwesomeIcon icon={faAddressCard} className="text-blue-600" />
                                    명함 이미지 ({selectedCards.length})
                                </h2>
                                {selectedCards.length === 0 ? (
                                    <EmptyText text="연결된 명함 이미지가 없습니다." />
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedCards.map((card) => (
                                            <motion.a
                                                key={card.id}
                                                href={card.downloadUrl || '#'}
                                                target="_blank"
                                                rel="noreferrer"
                                                whileHover={{ y: -2 }}
                                                className="group block overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                                            >
                                                {card.downloadUrl ? (
                                                    <img src={card.downloadUrl} alt="명함 이미지" className="h-28 w-full object-contain transition duration-300 group-hover:scale-[1.03]" />
                                                ) : (
                                                    <div className="flex h-28 items-center justify-center text-xs text-slate-400">
                                                        이미지 없음
                                                    </div>
                                                )}
                                            </motion.a>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-900">
                                    <FontAwesomeIcon icon={faClockRotateLeft} className="text-slate-500" />
                                    연락/미팅 히스토리
                                </h2>
                                {selectedContact ? (
                                    <>
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
                                                <select className="form-field" value={historyForm.type} onChange={(event) => setHistoryForm({ ...historyForm, type: event.target.value as ContactHistoryType })}>
                                                    {HISTORY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                                                </select>
                                                <input type="date" className="form-field" value={historyForm.happenedAt} onChange={(event) => setHistoryForm({ ...historyForm, happenedAt: event.target.value })} />
                                            </div>
                                            <input className="form-field" value={historyForm.title} onChange={(event) => setHistoryForm({ ...historyForm, title: event.target.value })} placeholder="제목" />
                                            <textarea className="form-field min-h-[70px]" value={historyForm.content} onChange={(event) => setHistoryForm({ ...historyForm, content: event.target.value })} placeholder="내용" />
                                            <button type="button" onClick={handleAddHistory} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800">
                                                <FontAwesomeIcon icon={faPlus} />
                                                히스토리 추가
                                            </button>
                                        </div>
                                        <div className="mt-4 max-h-72 space-y-2 overflow-auto pr-1">
                                            {histories.length === 0 ? (
                                                <EmptyText text="등록된 히스토리가 없습니다." />
                                            ) : histories.map((history) => (
                                                <div key={history.id} className="rounded-md border border-slate-100 bg-white p-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-extrabold text-slate-700">
                                                            {HISTORY_TYPES.find((item) => item.value === history.type)?.label || history.type}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-500">{history.happenedAt}</span>
                                                    </div>
                                                    <div className="mt-2 text-sm font-extrabold text-slate-900">{history.title}</div>
                                                    {history.content && <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-5 text-slate-600">{history.content}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <EmptyText text="담당자를 먼저 선택하거나 저장해 주세요." />
                                )}
                            </section>

                            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-900">
                                    <FontAwesomeIcon icon={faBell} className="text-amber-500" />
                                    후속일정 ({openFollowUps.length})
                                </h2>
                                {selectedContact ? (
                                    <>
                                        <div className="flex flex-col gap-2">
                                            <input className="form-field" value={followUpForm.title} onChange={(event) => setFollowUpForm({ ...followUpForm, title: event.target.value })} placeholder="예: 견적서 재송부" />
                                            <input type="date" className="form-field" value={followUpForm.dueDate} onChange={(event) => setFollowUpForm({ ...followUpForm, dueDate: event.target.value })} />
                                            <textarea className="form-field" value={followUpForm.memo} onChange={(event) => setFollowUpForm({ ...followUpForm, memo: event.target.value })} placeholder="메모" />
                                            <button type="button" onClick={handleAddFollowUp} className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-amber-600">
                                                <FontAwesomeIcon icon={faCalendarCheck} />
                                                일정 추가
                                            </button>
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            {followUps.length === 0 ? (
                                                <EmptyText text="등록된 후속일정이 없습니다." />
                                            ) : followUps.map((followUp) => (
                                                <button
                                                    key={followUp.id}
                                                    type="button"
                                                    onClick={() => handleDoneFollowUp(followUp)}
                                                    className={`block w-full rounded-md border p-3 text-left transition ${followUp.status === 'done' ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-white hover:border-amber-200 hover:bg-amber-50'}`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-sm font-extrabold text-slate-900">{followUp.title}</span>
                                                        <span className="shrink-0 text-xs font-bold text-slate-500">{followUp.dueDate}</span>
                                                    </div>
                                                    {followUp.memo && <div className="mt-1 text-xs font-semibold text-slate-500">{followUp.memo}</div>}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <EmptyText text="담당자를 먼저 선택하거나 저장해 주세요." />
                                )}
                            </section>

                            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-900">
                                    <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500" />
                                    중복 병합
                                </h2>
                                {!selectedDuplicateGroup ? (
                                    <EmptyText text="선택한 담당자와 중복 의심 항목이 없습니다." />
                                ) : (
                                    <div className="space-y-2">
                                        <div className="rounded-md bg-amber-50 p-2 text-xs font-bold text-amber-800">
                                            사유: {selectedDuplicateGroup.reason}
                                        </div>
                                        {selectedDuplicateGroup.contacts
                                            .filter((contact) => contact.id !== selectedContactId)
                                            .map((contact) => (
                                                <div key={contact.id} className="rounded-md border border-slate-100 p-3">
                                                    <div className="text-sm font-extrabold text-slate-900">{contact.name}</div>
                                                    <div className="mt-1 text-xs font-semibold text-slate-500">
                                                        {[contact.companyName, contact.mobile, contact.email].filter(Boolean).join(' / ')}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => contact.id && handleMergeDuplicate(contact.id)}
                                                        disabled={saving}
                                                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                                                    >
                                                        <FontAwesomeIcon icon={faLink} />
                                                        현재 담당자로 병합
                                                    </button>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    </aside>
                </section>
            </div>
            <style>{`
                .form-field {
                    width: 100%;
                    border-radius: 0.375rem;
                    border: 1px solid rgb(203 213 225);
                    background: white;
                    padding: 0.5rem 0.75rem;
                    font-size: 0.875rem;
                    font-weight: 600;
                    outline: none;
                    transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
                }
                .form-field:focus {
                    border-color: rgb(59 130 246);
                    box-shadow: 0 0 0 2px rgb(219 234 254);
                }
                .business-card-sheen {
                    position: relative;
                    overflow: hidden;
                }
                .business-card-sheen:after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    transform: translateX(-120%);
                    background: linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.45) 45%, transparent 70%);
                    transition: transform 650ms ease;
                }
                .business-card-row:hover .business-card-sheen:after {
                    transform: translateX(120%);
                }
            `}</style>
        </div>
    );
};

const BusinessCardListItem: React.FC<{
    contact: BusinessContact;
    cards: BusinessCardImage[];
    selected: boolean;
    duplicate: boolean;
    needsInfo: boolean;
    onSelect: () => void;
    onCopy: (value: string | undefined, label: string) => void;
}> = ({ contact, cards, selected, duplicate, needsInfo, onSelect, onCopy }) => {
    const primaryCard = cards[0];
    const subtitle = getContactSubtitle(contact);
    const tags = contact.tags || [];

    return (
        <motion.article
            layout
            variants={itemVariants}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            whileHover={{ y: -2 }}
            className={`business-card-row rounded-lg border bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}
        >
            <button type="button" onClick={onSelect} className="grid w-full grid-cols-1 gap-0 text-left lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="border-b border-slate-100 p-3 lg:border-b-0 lg:border-r">
                    <div className="business-card-sheen flex aspect-[1.62/1] items-center justify-center rounded-md border border-slate-200 bg-slate-50">
                        {primaryCard?.downloadUrl ? (
                            <img
                                src={primaryCard.downloadUrl}
                                alt={`${contact.name || '담당자'} 명함`}
                                className="h-full w-full object-contain"
                                loading="lazy"
                            />
                        ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                                <FontAwesomeIcon icon={faAddressCard} className="text-3xl" />
                                <span className="mt-2 text-xs font-extrabold">명함 이미지 없음</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>{cards.length > 0 ? `이미지 ${cards.length}장` : getSourceLabel(contact.source)}</span>
                        <span>등록 {formatShortDate(contact.createdAt)}</span>
                    </div>
                </div>

                <div className="min-w-0 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-lg font-black text-slate-950">
                                    {contact.name || '이름 미상'}
                                </h3>
                                {contact.position && (
                                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-extrabold text-slate-600">
                                        {contact.position}
                                    </span>
                                )}
                                {duplicate && <StatusPill tone="amber" label="중복 의심" />}
                                {needsInfo && <StatusPill tone="rose" label="연락처 보강" />}
                            </div>
                            <div className="mt-1 flex min-w-0 items-center gap-2 text-sm font-extrabold text-blue-700">
                                <FontAwesomeIcon icon={faBuilding} className="shrink-0" />
                                <span className="truncate">{contact.companyName || '회사 없음'}</span>
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {contact.mobile && <ContactAction icon={faPhone} label="휴대폰" value={contact.mobile} onCopy={() => onCopy(contact.mobile, '휴대폰')} />}
                            {contact.phone && <ContactAction icon={faPhone} label="전화" value={contact.phone} onCopy={() => onCopy(contact.phone, '전화번호')} />}
                            {contact.email && <ContactAction icon={faEnvelope} label="이메일" value={contact.email} onCopy={() => onCopy(contact.email, '이메일')} />}
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="min-w-0">
                            <div className="line-clamp-2 min-h-[40px] text-sm font-semibold leading-5 text-slate-600">
                                {contact.memo || primaryCard?.extractedRawText || '요약 메모가 없습니다. 우측 패널에서 담당자 메모와 히스토리를 보강하세요.'}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {tags.length === 0 ? (
                                    <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-bold text-slate-400">태그 없음</span>
                                ) : tags.slice(0, 5).map((tag) => (
                                    <span key={tag} className="rounded-md bg-blue-50 px-2 py-1 text-xs font-extrabold text-blue-700">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <MiniStat label="명함" value={`${cards.length}`} />
                                <MiniStat label="출처" value={getSourceLabel(contact.source)} />
                            </div>
                            <div className="mt-3 text-xs font-bold text-slate-500">
                                선택하면 오른쪽에서 편집, 히스토리, 후속일정을 관리합니다.
                            </div>
                        </div>
                    </div>
                </div>
            </button>
        </motion.article>
    );
};

const MetricTile: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => {
    const toneClass = tone === 'blue'
        ? 'bg-blue-500/15 text-blue-100'
        : tone === 'amber'
            ? 'bg-amber-500/15 text-amber-100'
            : tone === 'rose'
                ? 'bg-rose-500/15 text-rose-100'
                : 'bg-white/10 text-slate-100';
    return (
        <div className={`rounded-md px-3 py-2 ${toneClass}`}>
            <div className="text-xl font-black">{value.toLocaleString()}</div>
            <div className="mt-0.5 text-[11px] font-extrabold opacity-80">{label}</div>
        </div>
    );
};

const QuickFilterButton: React.FC<{
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}> = ({ label, count, active, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-extrabold transition ${active ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'}`}
    >
        <span>{label}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {count}
        </span>
    </button>
);

const StatusPill: React.FC<{ tone: 'amber' | 'rose'; label: string }> = ({ tone, label }) => (
    <span className={`rounded-md px-2 py-1 text-xs font-extrabold ${tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
        {label}
    </span>
);

const ContactAction: React.FC<{
    icon: any;
    label: string;
    value: string;
    onCopy: () => void;
}> = ({ icon, label, value, onCopy }) => (
    <span className="inline-flex max-w-full items-center overflow-hidden rounded-md border border-slate-200 bg-white text-xs font-bold text-slate-600">
        <span className="inline-flex items-center gap-1 px-2 py-1.5">
            <FontAwesomeIcon icon={icon} className="text-slate-400" />
            <span>{label}</span>
        </span>
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                onCopy();
            }}
            className="max-w-[150px] truncate border-l border-slate-200 px-2 py-1.5 text-blue-700 hover:bg-blue-50"
            title={`${value} 복사`}
        >
            {value}
        </button>
    </span>
);

const MiniStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <div className="truncate text-sm font-black text-slate-900">{value}</div>
        <div className="mt-0.5 text-[11px] font-bold text-slate-400">{label}</div>
    </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <label className="flex flex-col gap-1 text-sm font-bold text-slate-700">
        <span>{label}</span>
        {children}
    </label>
);

const EmptyText: React.FC<{ text: string }> = ({ text }) => (
    <div className="rounded-md bg-slate-50 p-4 text-center text-xs font-bold text-slate-400">
        {text}
    </div>
);

export default BusinessCardContactsPage;
