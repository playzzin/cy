/**
 * 세금계산서 발행 페이지
 * 
 * 바로빌 API를 통해 전자세금계산서를 발행합니다.
 * Firestore 연동: 거래처(협력사/건설사), 현장 자동 연동
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileInvoiceDollar,
    faPaperPlane,
    faBuilding,
    faUser,
    faCalendarAlt,
    faWon,
    faPlus,
    faTrash,
    faSpinner,
    faCheckCircle,
    faExclamationCircle,
    faList,
    faMapMarkerAlt
} from '@fortawesome/free-solid-svg-icons';
import {
    issueTaxInvoice,
    getTaxInvoiceList,
    TaxInvoiceRequest,
    TaxInvoiceItem,
    TaxInvoiceListItem,
    calculateTax,
    formatDateForTaxInvoice
} from '../../services/barobillService';
import { companyService, Company } from '../../services/companyService';
import { siteService, Site } from '../../services/siteService';
import { taxInvoiceFirestoreService } from '../../services/taxInvoiceFirestoreService';

// 빈 품목 템플릿
const emptyItem: TaxInvoiceItem = {
    serialNum: 1,
    itemName: '',
    qty: 1,
    unitCost: 0,
    supplyCost: 0,
    tax: 0,
};

const TaxInvoicePage: React.FC = () => {
    // 탭 상태
    const [activeTab, setActiveTab] = useState<'issue' | 'history'>('issue');
    const location = useLocation();

    // 발행 폼 상태
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    // 공급자 정보 (자사 정보 - 보통 고정)
    const [invoicer, setInvoicer] = useState({
        corpNum: '',
        corpName: '청연건설',
        ceoName: '',
        addr: '',
        bizType: '건설업',
        bizClass: '건축',
        email: '',
    });

    // 공급받는자 정보
    const [invoicee, setInvoicee] = useState({
        corpNum: '',
        corpName: '',
        ceoName: '',
        addr: '',
        bizType: '',
        bizClass: '',
        email: '',
    });

    // 세금계산서 정보
    const [writeDate, setWriteDate] = useState(new Date().toISOString().split('T')[0]);
    const [purposeType, setPurposeType] = useState<'영수' | '청구'>('영수');
    const [remark, setRemark] = useState('');

    // 품목 목록
    const [items, setItems] = useState<TaxInvoiceItem[]>([{ ...emptyItem }]);

    // Firestore 데이터
    const [companies, setCompanies] = useState<Company[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedSiteId, setSelectedSiteId] = useState('');

    // 발행 이력
    const [history, setHistory] = useState<TaxInvoiceListItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // 합계 계산
    const supplyCostTotal = items.reduce((sum, item) => sum + item.supplyCost, 0);
    const taxTotal = items.reduce((sum, item) => sum + item.tax, 0);
    const totalAmount = supplyCostTotal + taxTotal;

    // Firestore 데이터 로드
    useEffect(() => {
        const loadData = async () => {
            try {
                // 협력사 + 건설사 로드
                const allCompanies = await companyService.getActiveCompanies();
                const filteredCompanies = allCompanies.filter(
                    c => c.type === '협력사' || c.type === '건설사'
                );
                setCompanies(filteredCompanies);

                // 현장 로드
                const allSites = await siteService.getSites();
                setSites(allSites.filter(s => s.status === 'active'));
            } catch (error) {
                console.error('데이터 로드 실패:', error);
            }
        };
        loadData();
    }, []);

    // 발행 이력 로드
    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab]);

    // 거래처 선택 시 자동 채움
    const handleCompanySelect = useCallback((companyId: string) => {
        setSelectedCompanyId(companyId);
        if (!companyId) {
            setInvoicee({ corpNum: '', corpName: '', ceoName: '', addr: '', bizType: '', bizClass: '', email: '' });
            return;
        }
        const company = companies.find(c => c.id === companyId);
        if (company) {
            setInvoicee({
                corpNum: company.businessNumber || '',
                corpName: company.name || '',
                ceoName: company.ceoName || '',
                addr: company.address || '',
                bizType: '',
                bizClass: '',
                email: company.email || '',
            });
        }
    }, [companies]);

    // Draft 페이지에서 넘어온 프리필 데이터 처리
    useEffect(() => {
        if (location.state && location.state.prefillData) {
            const { companyId, companyName, ceoName, businessNumber, amount, itemName } = location.state.prefillData;

            if (companyId) {
                // 등록된 거래처인 경우
                handleCompanySelect(companyId);
            } else {
                // 수기/미등록 거래처인 경우
                setSelectedCompanyId('');
                setInvoicee(prev => ({
                    ...prev,
                    corpName: companyName || '',
                    corpNum: businessNumber || '',
                    ceoName: ceoName || '',
                }));
            }

            // 품목 및 금액 설정
            if (itemName || amount) {
                const supplyCost = amount || 0;
                const tax = Math.floor(supplyCost * 0.1);

                setItems([{
                    ...emptyItem,
                    itemName: itemName || '기성 청구',
                    supplyCost: supplyCost,
                    tax: tax,
                    qty: 1,
                    unitCost: supplyCost
                }]);
            }
        }
    }, [handleCompanySelect, location.state]);

    // 현장 선택
    const handleSiteSelect = (siteId: string) => {
        setSelectedSiteId(siteId);
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const list = await getTaxInvoiceList();
            setHistory(list);
        } catch (error) {
            console.error('이력 로드 실패:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    // 품목 추가
    const addItem = () => {
        setItems([
            ...items,
            { ...emptyItem, serialNum: items.length + 1 },
        ]);
    };

    // 품목 삭제
    const removeItem = (index: number) => {
        if (items.length === 1) return;
        const newItems = items.filter((_, i) => i !== index);
        // 일련번호 재정렬
        newItems.forEach((item, i) => {
            item.serialNum = i + 1;
        });
        setItems(newItems);
    };

    // 품목 수정
    const updateItem = (index: number, field: keyof TaxInvoiceItem, value: string | number) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        if (field === 'unitCost' || field === 'qty') {
            item[field] = Number(value);
            item.supplyCost = item.qty * item.unitCost;
            item.tax = calculateTax(item.supplyCost);
        } else if (field === 'supplyCost') {
            item.supplyCost = Number(value);
            item.tax = calculateTax(item.supplyCost);
        } else {
            (item as Record<string, unknown>)[field] = value;
        }

        newItems[index] = item;
        setItems(newItems);
    };

    // 세금계산서 발행
    const handleSubmit = async () => {
        // 유효성 검사
        if (!invoicer.corpNum || !invoicee.corpNum) {
            setResult({ success: false, message: '사업자번호를 입력해주세요.' });
            return;
        }

        if (items.length === 0 || items.every(item => !item.itemName)) {
            setResult({ success: false, message: '품목을 최소 1개 이상 입력해주세요.' });
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const request: TaxInvoiceRequest = {
                invoicerCorpNum: invoicer.corpNum.replace(/-/g, ''),
                invoicerCorpName: invoicer.corpName,
                invoicerCEOName: invoicer.ceoName,
                invoicerAddr: invoicer.addr,
                invoicerBizType: invoicer.bizType,
                invoicerBizClass: invoicer.bizClass,
                invoicerEmail: invoicer.email,

                invoiceeCorpNum: invoicee.corpNum.replace(/-/g, ''),
                invoiceeCorpName: invoicee.corpName,
                invoiceeCEOName: invoicee.ceoName,
                invoiceeAddr: invoicee.addr,
                invoiceeBizType: invoicee.bizType,
                invoiceeBizClass: invoicee.bizClass,
                invoiceeEmail: invoicee.email,

                writeDate: formatDateForTaxInvoice(new Date(writeDate)),
                supplyCostTotal,
                taxTotal,
                totalAmount,

                items: items.filter(item => item.itemName),

                remark,
                purposeType,
            };

            const response = await issueTaxInvoice(request);
            setResult(response);

            if (response.success) {
                // Firestore에 저장
                try {
                    const selectedSite = sites.find(s => s.id === selectedSiteId);
                    await taxInvoiceFirestoreService.addTaxInvoice({
                        invoiceNum: response.invoiceNum || `INV-${Date.now()}`,
                        invoiceDate: writeDate,
                        type: 'sales',
                        status: 'issued',
                        invoicerCorpNum: invoicer.corpNum.replace(/-/g, ''),
                        invoicerCorpName: invoicer.corpName,
                        invoicerCeoName: invoicer.ceoName,
                        invoicerAddr: invoicer.addr,
                        invoiceeCorpNum: invoicee.corpNum.replace(/-/g, ''),
                        invoiceeCorpName: invoicee.corpName,
                        invoiceeCeoName: invoicee.ceoName,
                        invoiceeAddr: invoicee.addr,
                        invoiceeCompanyId: selectedCompanyId || undefined,
                        supplyAmount: supplyCostTotal,
                        taxAmount: taxTotal,
                        totalAmount,
                        itemName: items[0]?.itemName || '',
                        itemCount: items.filter(i => i.itemName).length,
                        siteId: selectedSiteId || undefined,
                        siteName: selectedSite?.name,
                        barobillSendKey: response.sendKey,
                        memo: remark,
                        source: 'barobill', // 바로빌 API 연동
                    });
                } catch (saveError) {
                    console.error('Firestore 저장 실패:', saveError);
                }

                // 폼 초기화
                setSelectedCompanyId('');
                setSelectedSiteId('');
                setInvoicee({
                    corpNum: '',
                    corpName: '',
                    ceoName: '',
                    addr: '',
                    bizType: '',
                    bizClass: '',
                    email: '',
                });
                setItems([{ ...emptyItem }]);
                setRemark('');
            }
        } catch (error) {
            setResult({
                success: false,
                message: error instanceof Error ? error.message : '발행 중 오류가 발생했습니다.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // 금액 포맷
    const formatMoney = (value: number) => {
        return new Intl.NumberFormat('ko-KR').format(value);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 mb-6 text-white">
                    <div className="flex items-center gap-3">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-3xl" />
                        <div>
                            <h1 className="text-2xl font-bold">전자세금계산서</h1>
                            <p className="text-blue-100">바로빌 API 연동</p>
                        </div>
                    </div>
                </div>

                {/* 탭 */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('issue')}
                        className={`px-6 py-3 rounded-lg font-medium transition-all ${activeTab === 'issue'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                        세금계산서 발행
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-3 rounded-lg font-medium transition-all ${activeTab === 'history'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <FontAwesomeIcon icon={faList} className="mr-2" />
                        발행 이력
                    </button>
                </div>

                {/* 발행 탭 */}
                {activeTab === 'issue' && (
                    <div className="space-y-6">
                        {/* 결과 메시지 */}
                        {result && (
                            <div className={`p-4 rounded-lg flex items-center gap-3 ${result.success
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                                }`}>
                                <FontAwesomeIcon
                                    icon={result.success ? faCheckCircle : faExclamationCircle}
                                    className="text-xl"
                                />
                                <span>{result.message}</span>
                            </div>
                        )}

                        {/* 공급자 / 공급받는자 정보 */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* 공급자 (자사) */}
                            <div className="bg-white rounded-xl shadow-sm border p-6">
                                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faBuilding} className="text-blue-500" />
                                    공급자 (자사)
                                </h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            사업자번호 *
                                        </label>
                                        <input
                                            type="text"
                                            value={invoicer.corpNum}
                                            onChange={(e) => setInvoicer({ ...invoicer, corpNum: e.target.value })}
                                            placeholder="000-00-00000"
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            상호 *
                                        </label>
                                        <input
                                            type="text"
                                            value={invoicer.corpName}
                                            onChange={(e) => setInvoicer({ ...invoicer, corpName: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            대표자명 *
                                        </label>
                                        <input
                                            type="text"
                                            value={invoicer.ceoName}
                                            onChange={(e) => setInvoicer({ ...invoicer, ceoName: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            이메일
                                        </label>
                                        <input
                                            type="email"
                                            value={invoicer.email}
                                            onChange={(e) => setInvoicer({ ...invoicer, email: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 공급받는자 (거래처) */}
                            <div className="bg-white rounded-xl shadow-sm border p-6">
                                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faUser} className="text-green-500" />
                                    공급받는자 (거래처)
                                </h2>
                                {/* 거래처 선택 드롭다운 */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        거래처 선택 (협력사/건설사)
                                    </label>
                                    <select
                                        value={selectedCompanyId}
                                        onChange={(e) => handleCompanySelect(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 bg-green-50"
                                    >
                                        <option value="">직접 입력</option>
                                        {companies.map(company => (
                                            <option key={company.id} value={company.id}>
                                                [{company.type}] {company.name} ({company.businessNumber})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            사업자번호 *
                                        </label>
                                        <input
                                            type="text"
                                            value={invoicee.corpNum}
                                            onChange={(e) => setInvoicee({ ...invoicee, corpNum: e.target.value })}
                                            placeholder="000-00-00000"
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            상호 *
                                        </label>
                                        <input
                                            type="text"
                                            value={invoicee.corpName}
                                            onChange={(e) => setInvoicee({ ...invoicee, corpName: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            대표자명 *
                                        </label>
                                        <input
                                            type="text"
                                            value={invoicee.ceoName}
                                            onChange={(e) => setInvoicee({ ...invoicee, ceoName: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            이메일
                                        </label>
                                        <input
                                            type="email"
                                            value={invoicee.email}
                                            onChange={(e) => setInvoicee({ ...invoicee, email: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 발행 정보 */}
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <FontAwesomeIcon icon={faCalendarAlt} className="text-purple-500" />
                                발행 정보
                            </h2>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        작성일자 *
                                    </label>
                                    <input
                                        type="date"
                                        value={writeDate}
                                        onChange={(e) => setWriteDate(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-1 text-orange-500" />
                                        현장 선택
                                    </label>
                                    <select
                                        value={selectedSiteId}
                                        onChange={(e) => handleSiteSelect(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 bg-orange-50"
                                    >
                                        <option value="">선택 안함</option>
                                        {sites.map(site => (
                                            <option key={site.id} value={site.id}>
                                                {site.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        영수/청구
                                    </label>
                                    <select
                                        value={purposeType}
                                        onChange={(e) => setPurposeType(e.target.value as '영수' | '청구')}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="영수">영수</option>
                                        <option value="청구">청구</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        비고
                                    </label>
                                    <input
                                        type="text"
                                        value={remark}
                                        onChange={(e) => setRemark(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 품목 목록 */}
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <FontAwesomeIcon icon={faWon} className="text-yellow-500" />
                                    품목
                                </h2>
                                <button
                                    onClick={addItem}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                                    품목 추가
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">No</th>
                                            <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">품명 *</th>
                                            <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">규격</th>
                                            <th className="px-3 py-2 text-right text-sm font-medium text-gray-600">수량</th>
                                            <th className="px-3 py-2 text-right text-sm font-medium text-gray-600">단가</th>
                                            <th className="px-3 py-2 text-right text-sm font-medium text-gray-600">공급가액</th>
                                            <th className="px-3 py-2 text-right text-sm font-medium text-gray-600">세액</th>
                                            <th className="px-3 py-2 text-center text-sm font-medium text-gray-600">삭제</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, index) => (
                                            <tr key={index} className="border-t">
                                                <td className="px-3 py-2 text-sm text-gray-600">{item.serialNum}</td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="text"
                                                        value={item.itemName}
                                                        onChange={(e) => updateItem(index, 'itemName', e.target.value)}
                                                        className="w-full px-2 py-1 border rounded"
                                                        placeholder="품명 입력"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="text"
                                                        value={item.spec || ''}
                                                        onChange={(e) => updateItem(index, 'spec', e.target.value)}
                                                        className="w-full px-2 py-1 border rounded"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        value={item.qty}
                                                        onChange={(e) => updateItem(index, 'qty', e.target.value)}
                                                        className="w-20 px-2 py-1 border rounded text-right"
                                                        min="1"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        value={item.unitCost}
                                                        onChange={(e) => updateItem(index, 'unitCost', e.target.value)}
                                                        className="w-28 px-2 py-1 border rounded text-right"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium">
                                                    {formatMoney(item.supplyCost)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-600">
                                                    {formatMoney(item.tax)}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        onClick={() => removeItem(index)}
                                                        className="text-red-500 hover:text-red-700"
                                                        disabled={items.length === 1}
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 font-semibold">
                                        <tr>
                                            <td colSpan={5} className="px-3 py-3 text-right">합계</td>
                                            <td className="px-3 py-3 text-right text-blue-600">
                                                ₩{formatMoney(supplyCostTotal)}
                                            </td>
                                            <td className="px-3 py-3 text-right text-blue-600">
                                                ₩{formatMoney(taxTotal)}
                                            </td>
                                            <td></td>
                                        </tr>
                                        <tr className="text-lg">
                                            <td colSpan={5} className="px-3 py-3 text-right">총 금액</td>
                                            <td colSpan={2} className="px-3 py-3 text-right text-blue-700">
                                                ₩{formatMoney(totalAmount)}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* 발행 버튼 */}
                        <div className="flex justify-center">
                            <button
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                                        발행 중...
                                    </>
                                ) : (
                                    <>
                                        <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                                        세금계산서 발행
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* 이력 탭 */}
                {activeTab === 'history' && (
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h2 className="text-lg font-semibold mb-4">발행 이력</h2>

                        {historyLoading ? (
                            <div className="text-center py-12">
                                <FontAwesomeIcon icon={faSpinner} className="text-4xl text-blue-500 animate-spin" />
                                <p className="mt-4 text-gray-500">로딩 중...</p>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                발행된 세금계산서가 없습니다.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">발행일</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">공급자</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">공급받는자</th>
                                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">금액</th>
                                            <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">상태</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((invoice) => (
                                            <tr key={invoice.id} className="border-t hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm">
                                                    {invoice.issuedAt
                                                        ? new Date(invoice.issuedAt.seconds * 1000).toLocaleDateString('ko-KR')
                                                        : '-'
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-sm">{invoice.invoicerCorpName}</td>
                                                <td className="px-4 py-3 text-sm">{invoice.invoiceeCorpName}</td>
                                                <td className="px-4 py-3 text-sm text-right font-medium">
                                                    ₩{formatMoney(invoice.totalAmount)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${invoice.status === 'issued'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {invoice.status === 'issued' ? '발행완료' : invoice.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaxInvoicePage;
