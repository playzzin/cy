import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { HomepageRequestType, homepageRequestService } from '../../services/homepageRequestService';

const HomepageRequestCreatePage: React.FC = () => {
    const navigate = useNavigate();

    const [type, setType] = useState<HomepageRequestType>('build');
    const [description, setDescription] = useState<string>('');

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();

        if (!description.trim()) {
            setError('요청 내용 설명은 필수입니다.');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const baseTitle =
                type === 'build' ? '홈페이지 제작 의뢰' : '홈페이지 수정 의뢰';

            const id = await homepageRequestService.createRequest({
                title: baseTitle,
                type,
                clientName: '내부 등록',
                description: description.trim()
            });

            navigate(`/homepage/requests/${id}`);
        } catch (e) {
            setError('요청을 생성하는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/homepage/requests')}
                        className="mr-1 inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg">
                            <FontAwesomeIcon icon={faPaperPlane} className="text-indigo-600 text-xl" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">새 홈페이지 요청 등록</h1>
                            <p className="text-xs text-slate-500">
                                홈페이지 제작/수정 의뢰 정보를 입력하고 진행 관리 플로우를 시작합니다.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-4 py-4">
                    {error && (
                        <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">
                            {error}
                        </div>
                    )}

                    <form
                        onSubmit={(e) => {
                            void handleSubmit(e);
                        }}
                        className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
                    >
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">요청 유형 *</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value as HomepageRequestType)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                                >
                                    <option value="build">제작 의뢰</option>
                                    <option value="modify">수정 의뢰</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">요청 내용 설명 *</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="필요한 내용만 간단히 적어주세요. (예: 어떤 페이지를 만들거나 수정해야 하는지)"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => navigate('/homepage/requests')}
                                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-50"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <FontAwesomeIcon icon={faPaperPlane} />
                                {loading ? '등록 중...' : '요청 등록'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default HomepageRequestCreatePage;
