import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faWon, faSpinner, faCheck, faSave, faUsers
} from '@fortawesome/free-solid-svg-icons';
import { supportRateService } from '../../services/supportRateService';
import { siteService, type Site } from '../../services/siteService';
import { toast } from '../../utils/swal';

const SupportRateManagementPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sites, setSites] = useState<Site[]>([]);
    const [rates, setRates] = useState<Record<string, number>>({});
    const [editingRates, setEditingRates] = useState<Record<string, number>>({});
    const [bulkRate, setBulkRate] = useState<number>(0);

    // Load data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [sitesData, ratesData] = await Promise.all([
                    siteService.getSites(),
                    supportRateService.getAllSiteRates()
                ]);

                // Filter only 'Support' type sites (External Support Teams)
                const supportSites = sitesData.filter(s => s.siteType === '지원');
                setSites(supportSites);

                // Convert rates array to object
                const ratesMap: Record<string, number> = {};
                ratesData.forEach(r => {
                    ratesMap[r.siteId] = r.defaultRate || 0;
                });
                setRates(ratesMap);
                setEditingRates(ratesMap);
            } catch (error) {
                console.error('Failed to load data:', error);
                toast.error('데이터 로드 실패');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const reloadData = async () => {
        setLoading(true);
        try {
            const [sitesData, ratesData] = await Promise.all([
                siteService.getSites(),
                supportRateService.getAllSiteRates()
            ]);

            // Filter only 'Support' type sites (External Support Teams)
            const supportSites = sitesData.filter(s => s.siteType === '지원');
            setSites(supportSites);

            const ratesMap: Record<string, number> = {};
            ratesData.forEach(r => {
                ratesMap[r.siteId] = r.defaultRate || 0;
            });
            setRates(ratesMap);
            setEditingRates(ratesMap);
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('데이터 로드 실패');
        } finally {
            setLoading(false);
        }
    };

    const handleRateChange = (siteId: string, value: number) => {
        setEditingRates(prev => ({
            ...prev,
            [siteId]: value
        }));
    };

    const handleSaveSiteRate = async (site: Site) => {
        const siteId = site.id ?? '';
        if (!siteId) {
            toast.error('현장 ID가 없습니다.');
            return;
        }

        const newRate = editingRates[siteId] || 0;

        if (newRate === rates[siteId]) {
            toast.info('변경된 내용이 없습니다.');
            return;
        }

        setSaving(true);
        try {
            await supportRateService.saveSiteRate({
                siteId,
                siteName: site.name,
                defaultRate: newRate
            });
            setRates(prev => ({ ...prev, [siteId]: newRate }));
            toast.success(`${site.name} 단가가 저장되었습니다.`);
        } catch (error) {
            console.error('Failed to save rate:', error);
            toast.error('저장 실패');
        } finally {
            setSaving(false);
        }
    };

    const handleMigrateLegacyTeamRates = async () => {
        const confirmed = window.confirm('기존 팀 기준 지원단가를 현장 기준 단가로 이관하시겠습니까? (현장 책임팀 기준으로 적용됩니다.)');
        if (!confirmed) return;

        const overwriteExisting = window.confirm('이미 설정된 현장 단가도 덮어쓸까요?\n확인: 덮어쓰기\n취소: 기존 현장 단가 유지');

        setSaving(true);
        try {
            const res = await supportRateService.migrateTeamRatesToSiteRates({ overwriteExisting });
            await reloadData();
            toast.success(`이관 완료 (적용 ${res.migratedCount}개 / 스킵 ${res.skippedCount}개 / 팀단가없음 ${res.missingRateCount}개)`);
        } catch (error) {
            console.error('Failed to migrate legacy rates:', error);
            toast.error('이관 실패');
        } finally {
            setSaving(false);
        }
    };

    const handleBulkApply = async () => {
        if (!bulkRate || bulkRate <= 0) {
            toast.warning('일괄 적용할 단가를 입력해주세요.');
            return;
        }

        const confirmed = window.confirm(`모든 현장에 ${bulkRate.toLocaleString()}원을 일괄 적용하시겠습니까?`);
        if (!confirmed) return;

        setSaving(true);
        try {
            const siteIds = sites.map((s) => String(s.id ?? '')).filter(Boolean);
            const siteNameBySiteId: Record<string, string> = {};
            sites.forEach((s) => {
                const id = String(s.id ?? '').trim();
                if (!id) return;
                siteNameBySiteId[id] = s.name;
            });

            await supportRateService.applyBulkSiteRate(siteIds, bulkRate, siteNameBySiteId);
            await reloadData();
            toast.success('모든 현장에 단가가 적용되었습니다.');
        } catch (error) {
            console.error('Failed to apply bulk rate:', error);
            toast.error('일괄 적용 실패');
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ko-KR').format(amount);
    };

    const isChanged = (siteId: string) => {
        return (editingRates[siteId] || 0) !== (rates[siteId] || 0);
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faWon} className="text-green-600" />
                            지원비 단가 관리
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            현장별 지원비 단가(원/공수)를 설정합니다.
                        </p>
                    </div>

                    {/* Bulk Apply */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleMigrateLegacyTeamRates}
                            disabled={saving || loading}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-sm font-medium flex items-center gap-2"
                        >
                            {saving ? (
                                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                            ) : (
                                <FontAwesomeIcon icon={faSave} />
                            )}
                            팀 단가 이관
                        </button>

                        <div className="flex items-center gap-3 bg-slate-100 rounded-xl px-4 py-2">
                            <span className="text-sm text-slate-600 font-medium">일괄 적용:</span>
                            <input
                                type="number"
                                value={bulkRate || ''}
                                onChange={(e) => setBulkRate(Number(e.target.value))}
                                placeholder="단가 입력"
                                className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-right text-sm"
                            />
                            <span className="text-sm text-slate-500">원</span>
                            <button
                                onClick={handleBulkApply}
                                disabled={saving || !bulkRate}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                            >
                                {saving ? (
                                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                ) : (
                                    <FontAwesomeIcon icon={faSave} />
                                )}
                                전체 적용
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <FontAwesomeIcon icon={faSpinner} className="text-4xl text-indigo-600 animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {sites.map(site => {
                            const siteId = site.id ?? '';
                            const currentRate = siteId ? (rates[siteId] || 0) : 0;
                            const editingRate = siteId ? (editingRates[siteId] || 0) : 0;
                            const changed = siteId ? isChanged(siteId) : false;

                            return (
                                <div
                                    key={siteId || site.name}
                                    className={`bg-white rounded-xl border-2 p-4 transition-all ${changed
                                        ? 'border-amber-400 shadow-amber-100 shadow-lg'
                                        : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    {/* Team Header */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                            <FontAwesomeIcon icon={faUsers} className="text-indigo-600 text-sm" />
                                        </div>
                                        <span className="font-bold text-slate-800 truncate flex-1">
                                            {site.name}
                                        </span>
                                    </div>

                                    {/* Rate Input */}
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={editingRate || ''}
                                            disabled={!siteId}
                                            onChange={(e) => handleRateChange(siteId, Number(e.target.value))}
                                            placeholder="0"
                                            className={`w-full px-3 py-2 border rounded-lg text-right text-lg font-bold transition-colors ${changed
                                                ? 'border-amber-400 bg-amber-50'
                                                : 'border-slate-200 bg-slate-50'
                                                }`}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                            원
                                        </span>
                                    </div>

                                    {/* Current Value */}
                                    {currentRate > 0 && !changed && (
                                        <div className="mt-2 text-xs text-slate-500 text-center">
                                            현재: {formatCurrency(currentRate)}원
                                        </div>
                                    )}

                                    {/* Save Button (only show when changed) */}
                                    {changed && (
                                        <button
                                            onClick={() => handleSaveSiteRate(site)}
                                            disabled={saving}
                                            className="w-full mt-3 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                        >
                                            {saving ? (
                                                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                            ) : (
                                                <FontAwesomeIcon icon={faCheck} />
                                            )}
                                            저장
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between text-sm text-slate-600">
                <span>총 {sites.length}개 현장</span>
                <span>
                    단가 설정됨: {Object.values(rates).filter(r => r > 0).length}개
                </span>
            </div>
        </div>
    );
};

export default SupportRateManagementPage;
