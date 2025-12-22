import React, { useState } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faCheck, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

// 엑셀 데이터 기준 - 작업자별 정확한 급여방식
const SALARY_MODEL_MAP: { [name: string]: string } = {
    // 일급제
    '1지병혁1': '일급제',
    '1홍석수': '일급제',
    '강건수1': '일급제',
    '강길원1': '일급제',
    '강재준': '일급제',
    '고대호': '일급제',
    '공윤배': '일급제',
    '권순범': '일급제',
    '기태연1': '일급제',
    '김군회': '일급제',
    '김대진1': '일급제',
    '김덕기': '일급제',
    '김동혁': '일급제',
    '김동현': '일급제',
    '김드미트리': '일급제',
    '김만선1': '일급제',
    '김민선1': '일급제',
    '김민재': '일급제',
    '김병호1': '일급제',
    '김봉수': '일급제',
    '김세흔': '일급제',
    '김순원1': '일급제',
    '김승희': '일급제',
    '김영대': '일급제',
    '김영춘': '일급제',
    '김용호': '일급제',
    '김윤성1': '일급제',
    '김인수1': '일급제',
    '김종수1': '일급제',
    '김준성1': '일급제',
    '김지현': '일급제',
    '김진민': '일급제',
    '김진성': '일급제',
    '김학수': '일급제',
    '김해용': '일급제',
    '김효동': '일급제',
    '나왕수1': '일급제',
    '남광현': '일급제',
    '남태승1': '일급제',
    '노은성1': '일급제',
    '노훈상': '일급제',
    '다비드1': '일급제',
    '묘칸1': '일급제',
    '박상국': '일급제',
    '박상훈1': '일급제',
    '박성준': '일급제',
    '박수민1': '일급제',
    '박승훈': '일급제',
    '박정훈': '일급제',
    '박제훈1': '일급제',
    '박현호1': '일급제',
    '방찬호': '일급제',
    '배준호1': '일급제',
    '백금태1': '일급제',
    '빈운영': '일급제',
    '서동균1': '일급제',
    '서동웅1': '일급제',
    '서명원': '일급제',
    '서민석1': '일급제',
    '서정필1': '일급제',
    '서지훈1': '일급제',
    '성인호1': '일급제',
    '송준영1': '일급제',
    '시리니1': '일급제',
    '신광식1': '일급제',
    '신광철': '일급제',
    '신승재': '일급제',
    '신영수': '일급제',
    '신지수': '일급제',
    '심대욱': '일급제',
    '심민형': '일급제',
    '압두바리1': '일급제',
    '에르베크1': '일급제',
    '오건혁1': '일급제',
    '온민주': '일급제',
    '유영훈1': '일급제',
    '유재훈1': '일급제',
    '유진수1': '일급제',
    '윤도균1': '일급제',
    '윤은성': '일급제',
    '이병진1': '일급제',
    '이영후1': '일급제',
    '이용기': '일급제',
    '이윤희': '일급제',
    '이재영1': '일급제',
    '이재혁': '일급제',
    '이창수1': '일급제',
    '이호섭1': '일급제',
    '이홍관1': '일급제',
    '임영식1': '일급제',
    '임종식1': '일급제',
    '임준수': '일급제',
    '임채호1': '일급제',
    '임효재': '일급제',
    '장문호1': '일급제',
    '장정욱1': '일급제',
    '장형규': '일급제',
    '전동현1': '일급제',
    '정광호': '일급제',
    '정성훈1': '일급제',
    '정승근1': '일급제',
    '정우섭1': '일급제',
    '정진호1': '일급제',
    '정찬희': '일급제',
    '조성현': '일급제',
    '조찬연': '일급제',
    '조찬형1': '일급제',
    '조한울1': '일급제',
    '조현욱1': '일급제',
    '조형1': '일급제',
    '주영욱1': '일급제',
    '지병목1': '일급제',
    '지승근1': '일급제',
    '진학빈': '일급제',
    '짐발1': '일급제',
    '채성우': '일급제',
    '최영석': '일급제',
    '최인': '일급제',
    '최일현': '일급제',
    '추명진': '일급제',
    '카발1': '일급제',
    '허지원1': '일급제',
    '황수근': '일급제',
    '황정윤1': '일급제',

    // 지원팀
    '강시훈': '지원팀',
    '강진석8': '지원팀',
    '고현진': '지원팀',
    '권형근': '지원팀',
    '김대민9': '지원팀',
    '김보리스9': '지원팀',
    '김석범8': '지원팀',
    '김석호9': '지원팀',
    '김성철9': '지원팀',
    '김순동9': '지원팀',
    '김영욱9': '지원팀',
    '김용준9': '지원팀',
    '김이삼9': '지원팀',
    '김재필9': '지원팀',
    '김재현9': '지원팀',
    '김정수9': '지원팀',
    '김태화9': '지원팀',
    '김효한9': '지원팀',
    '남재철': '지원팀',
    '류천룡8': '지원팀',
    '마명학9': '지원팀',
    '박대광9': '지원팀',
    '배광률9': '지원팀',
    '백승현9': '지원팀',
    '서민택9': '지원팀',
    '송현': '지원팀',
    '신현진9': '지원팀',
    '우진형9': '지원팀',
    '윤동현9': '지원팀',
    '이상철9': '지원팀',
    '이순재9': '지원팀',
    '이안드레이9': '지원팀',
    '이원형9': '지원팀',
    '이전수9': '지원팀',
    '이현수8': '지원팀',
    '정조훈': '지원팀',
    '정준혁': '지원팀',
    '정찬우9': '지원팀',
    '조경찬': '지원팀',
    '조관호': '지원팀',
    '조선환9': '지원팀',
    '조창현9': '지원팀',
    '최세르게이9': '지원팀',
    '최용호9': '지원팀',
    '큰블라디9': '지원팀',
    '현세르게이9': '지원팀',
    '현은철9': '지원팀',
    '황호연': '지원팀',
};

const SalaryModelUpdater: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<{ name: string; before: string; after: string }[]>([]);
    const [error, setError] = useState<string | null>(null);

    const dailyCount = Object.values(SALARY_MODEL_MAP).filter(v => v === '일급제').length;
    const supportCount = Object.values(SALARY_MODEL_MAP).filter(v => v === '지원팀').length;

    const handleUpdate = async () => {
        setLoading(true);
        setResults([]);
        setError(null);

        try {
            const workersRef = collection(db, 'workers');
            const snapshot = await getDocs(workersRef);
            const batch = writeBatch(db);
            const updateResults: { name: string; before: string; after: string }[] = [];

            snapshot.docs.forEach((workerDoc) => {
                const worker = workerDoc.data();
                const name = worker.name;
                const currentModel = worker.salaryModel || '';

                // 이 작업자의 올바른 급여방식 확인
                const correctModel = SALARY_MODEL_MAP[name];

                if (correctModel && currentModel !== correctModel) {
                    // 올바른 급여방식으로 변경
                    batch.update(doc(db, 'workers', workerDoc.id), { salaryModel: correctModel });
                    updateResults.push({ name, before: currentModel || '(없음)', after: correctModel });
                }
            });

            if (updateResults.length > 0) {
                await batch.commit();
            }

            setResults(updateResults);
        } catch (err) {
            console.error('Error updating salary models:', err);
            setError('급여방식 업데이트 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h1 className="text-xl font-bold text-slate-800 mb-4">급여방식 복구 (엑셀 데이터 기준)</h1>
                <p className="text-sm text-slate-500 mb-6">
                    엑셀 데이터를 기준으로 작업자의 급여방식(salaryModel)을 복구합니다.
                </p>

                <div className="mb-6 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 className="font-bold text-blue-800 mb-2">일급제 ({dailyCount}명)</h3>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h3 className="font-bold text-purple-800 mb-2">지원팀 ({supportCount}명)</h3>
                    </div>
                </div>

                <button
                    onClick={handleUpdate}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                >
                    <FontAwesomeIcon icon={faSync} spin={loading} />
                    {loading ? '복구 중...' : '급여방식 복구 실행'}
                </button>

                {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        {error}
                    </div>
                )}

                {results.length > 0 && (
                    <div className="mt-6">
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <FontAwesomeIcon icon={faCheck} className="text-green-600" />
                            복구 완료 ({results.length}명)
                        </h3>
                        <div className="overflow-auto max-h-64 border border-slate-200 rounded-lg">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left">이름</th>
                                        <th className="px-4 py-2 text-left">변경 전</th>
                                        <th className="px-4 py-2 text-left">변경 후</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {results.map((r, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-4 py-2 font-medium">{r.name}</td>
                                            <td className="px-4 py-2 text-red-600">{r.before}</td>
                                            <td className="px-4 py-2 text-green-600">{r.after}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {results.length === 0 && !loading && !error && (
                    <p className="mt-4 text-sm text-slate-500">
                        복구 버튼을 클릭하면 변경 내역이 여기에 표시됩니다.
                    </p>
                )}
            </div>
        </div>
    );
};

export default SalaryModelUpdater;
