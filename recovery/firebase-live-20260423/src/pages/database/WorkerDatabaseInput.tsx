import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTable, faPlus, faMinus, faSave, faCopy, faPaste, faUsers, faBuilding, faHardHat, faDatabase } from '@fortawesome/free-solid-svg-icons';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';

interface TableData {
    현장명: string;
    팀명: string;
    이름: string;
    공수: string;
    단가: string;
    담당팀: string;
}

const WorkerDatabaseInput: React.FC = () => {
    const [tableData, setTableData] = useState<TableData[]>([
        { 현장명: '', 팀명: '', 이름: '', 공수: '1.0', 단가: '', 담당팀: '' },
        { 현장명: '', 팀명: '', 이름: '', 공수: '1.0', 단가: '', 담당팀: '' },
        { 현장명: '', 팀명: '', 이름: '', 공수: '1.0', 단가: '', 담당팀: '' },
        { 현장명: '', 팀명: '', 이름: '', 공수: '1.0', 단가: '', 담당팀: '' },
        { 현장명: '', 팀명: '', 이름: '', 공수: '1.0', 단가: '', 담당팀: '' }
    ]);

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [workersData, teamsData, sitesData] = await Promise.all([
                manpowerService.getWorkers(),
                teamService.getTeams(),
                siteService.getSites()
            ]);
            setWorkers(workersData);
            setTeams(teamsData);
            setSites(sitesData);
        } catch (error) {
            console.error("Failed to fetch initial data", error);
        }
    };

    // 행 추가
    const addRow = () => {
        setTableData([...tableData, { 현장명: '', 팀명: '', 이름: '', 공수: '1.0', 단가: '', 담당팀: '' }]);
    };

    // 행 삭제
    const removeRow = (index: number) => {
        if (tableData.length > 1) {
            setTableData(tableData.filter((_, i) => i !== index));
        }
    };

    // 데이터 변경
    const handleCellChange = (rowIndex: number, field: keyof TableData, value: string) => {
        const newData = [...tableData];
        newData[rowIndex][field] = value;
        setTableData(newData);
    };

    // 테이블 데이터 복사
    const copyTableData = () => {
        const headers = ['현장명', '팀명', '이름', '공수', '단가', '담당팀'];
        const rows = tableData.map(row =>
            [row.현장명, row.팀명, row.이름, row.공수, row.단가, row.담당팀].join('\t')
        );

        const clipboardData = [headers.join('\t'), ...rows].join('\n');

        navigator.clipboard.writeText(clipboardData).then(() => {
            alert('테이블 데이터가 복사되었습니다. 엑셀에 붙여넣으세요.');
        });
    };

    // 테이블 데이터 붙여넣기
    const pasteTableData = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const lines = text.trim().split('\n');

            if (lines.length < 2) {
                alert('붙여넣을 데이터가 없습니다.');
                return;
            }

            const newData: TableData[] = [];

            // 첫 줄은 헤더이므로 건너뛰기
            for (let i = 1; i < lines.length; i++) {
                const columns = lines[i].split('\t');

                if (columns.length >= 6) {
                    newData.push({
                        현장명: columns[0] || '',
                        팀명: columns[1] || '',
                        이름: columns[2] || '',
                        공수: columns[3] || '1.0',
                        단가: columns[4] || '',
                        담당팀: columns[5] || ''
                    });
                }
            }

            if (newData.length > 0) {
                setTableData(newData);
                alert(`${newData.length}개의 행이 붙여넣기 되었습니다.`);
            }
        } catch (error) {
            alert('붙여넣기에 실패했습니다.');
        }
    };

    // 데이터 등록
    const handleRegister = async () => {
        const validData = tableData.filter(row => row.이름.trim() !== '');

        if (validData.length === 0) {
            alert('등록할 데이터가 없습니다.');
            return;
        }

        setLoading(true);
        try {
            // 1. 작업자 등록/업데이트
            for (const row of validData) {
                // 기존 작업자 찾기
                const existingWorker = workers.find(w => w.name === row.이름);

                if (existingWorker) {
                    // 기존 작업자 업데이트
                    await manpowerService.updateWorker(existingWorker.id!, {
                        name: row.이름,
                        role: '작업자',
                        status: 'active',
                        unitPrice: parseInt(row.단가) || 0,
                        teamType: '작업팀'
                    });
                } else {
                    // 새 작업자 등록
                    await manpowerService.addWorker({
                        name: row.이름,
                        idNumber: '', // 필수 필드지만 빈값으로 설정
                        role: '작업자',
                        status: 'active',
                        unitPrice: parseInt(row.단가) || 0,
                        teamType: '작업팀'
                    });
                }
            }

            // 2. 팀 등록/업데이트
            for (const row of validData) {
                if (row.팀명.trim() !== '') {
                    const existingTeam = teams.find(t => t.name === row.팀명);

                    if (!existingTeam) {
                        await teamService.addTeam({
                            name: row.팀명,
                            type: '작업팀',
                            leaderId: '', // 필수 필드지만 빈값으로 설정
                            leaderName: '미지정'
                        });
                    }
                }
            }

            // 3. 현장 등록/업데이트
            for (const row of validData) {
                if (row.현장명.trim() !== '') {
                    const existingSite = sites.find(s => s.name === row.현장명);

                    if (!existingSite) {
                        await siteService.addSite({
                            name: row.현장명,
                            code: 'AUTO', // 필수 필드
                            address: '미등록', // 필수 필드
                            status: 'active'
                        });
                    }
                }
            }

            alert(`${validData.length}건의 데이터가 등록되었습니다.`);

            // 데이터 다시 불러오기
            await fetchInitialData();

            // 테이블 초기화
            setTableData([
                { 현장명: '', 팀명: '', 이름: '', 공수: '1.0', 단가: '', 담당팀: '' },
                { 현장명: '', 팀명: '', 이름: '', 공수: '1.0', 단가: '', 담당팀: '' },
                { 현장명: '', 팀명: '', 이름: '', 공수: '1.0', 단가: '', 담당팀: '' },
                { 현장명: '', 팀명: '', 이름: '', 공수: '1.0', 단가: '', 담당팀: '' },
                { 현장명: '', 팀명: '', 이름: '', 공수: '1.0', 단가: '', 담당팀: '' }
            ]);

        } catch (error) {
            console.error("등록 실패:", error);
            alert("데이터 등록에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* 헤더 */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faDatabase} className="text-blue-600" />
                        작업자/현장/팀 데이터 등록
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        엑셀 데이터를 복사하거나 직접 입력하여 작업자, 현장, 팀 정보를 일괄 등록하세요
                    </p>
                </div>

                {/* 버튼 영역 */}
                <div className="px-6 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                            <button
                                onClick={copyTableData}
                                className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faCopy} />
                                데이터 복사
                            </button>
                            <button
                                onClick={pasteTableData}
                                className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faPaste} />
                                데이터 붙여넣기
                            </button>
                            <button
                                onClick={addRow}
                                className="px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                행 추가
                            </button>
                        </div>
                        <button
                            onClick={handleRegister}
                            disabled={loading}
                            className="px-4 py-2 bg-brand-600 text-white font-medium rounded-md hover:bg-brand-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            {loading ? '등록 중...' : '일괄 등록'}
                        </button>
                    </div>
                </div>

                {/* 테이블 */}
                <div className="p-6 overflow-auto">
                    <div className="min-w-full">
                        <table className="w-full border border-gray-300">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border-b border-r border-gray-300">현장명</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border-b border-r border-gray-300">팀명</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border-b border-r border-gray-300">이름</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border-b border-r border-gray-300">공수</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border-b border-r border-gray-300">단가</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 border-b border-r border-gray-300">담당팀</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-700 border-b border-gray-300">삭제</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-2 py-1 border-b border-r border-gray-300">
                                            <input
                                                type="text"
                                                value={row.현장명}
                                                onChange={(e) => handleCellChange(index, '현장명', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="현장명"
                                            />
                                        </td>
                                        <td className="px-2 py-1 border-b border-r border-gray-300">
                                            <input
                                                type="text"
                                                value={row.팀명}
                                                onChange={(e) => handleCellChange(index, '팀명', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="팀명"
                                            />
                                        </td>
                                        <td className="px-2 py-1 border-b border-r border-gray-300">
                                            <input
                                                type="text"
                                                value={row.이름}
                                                onChange={(e) => handleCellChange(index, '이름', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="이름"
                                            />
                                        </td>
                                        <td className="px-2 py-1 border-b border-r border-gray-300">
                                            <input
                                                type="text"
                                                value={row.공수}
                                                onChange={(e) => handleCellChange(index, '공수', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="1.0"
                                            />
                                        </td>
                                        <td className="px-2 py-1 border-b border-r border-gray-300">
                                            <input
                                                type="text"
                                                value={row.단가}
                                                onChange={(e) => handleCellChange(index, '단가', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="단가"
                                            />
                                        </td>
                                        <td className="px-2 py-1 border-b border-r border-gray-300">
                                            <input
                                                type="text"
                                                value={row.담당팀}
                                                onChange={(e) => handleCellChange(index, '담당팀', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="담당팀"
                                            />
                                        </td>
                                        <td className="px-2 py-1 border-b border-gray-300 text-center">
                                            <button
                                                onClick={() => removeRow(index)}
                                                disabled={tableData.length <= 1}
                                                className="w-6 h-6 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                                            >
                                                <FontAwesomeIcon icon={faMinus} className="text-xs" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 안내 */}
                <div className="px-6 py-4 bg-blue-50 border-t border-blue-200">
                    <div className="text-sm text-blue-800">
                        <p className="font-medium mb-2">사용 방법:</p>
                        <ol className="list-decimal list-inside space-y-1 text-blue-700">
                            <li>테이블에 직접 데이터 입력 또는 [데이터 붙여넣기]로 엑셀 데이터 가져오기</li>
                            <li>[데이터 복사]로 현재 테이블 데이터를 클립보드에 복사 (엑셀에 붙여넣기 가능)</li>
                            <li>[행 추가]로 입력 행 추가, [삭제] 버튼으로 개별 행 삭제</li>
                            <li>[일괄 등록]으로 작업자, 현장, 팀 정보를 데이터베이스에 저장</li>
                        </ol>
                        <div className="mt-3 p-2 bg-blue-100 rounded text-xs">
                            <p className="font-medium">등록되는 데이터:</p>
                            <ul className="list-disc list-inside mt-1">
                                <li>작업자 정보 (이름, 단가, 역할)</li>
                                <li>현장 정보 (현장명)</li>
                                <li>팀 정보 (팀명)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 현재 데이터 현황 */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faUsers} className="text-blue-600" />
                            <span className="text-gray-600">작업자:</span>
                            <span className="font-medium">{workers.length}명</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faHardHat} className="text-green-600" />
                            <span className="text-gray-600">팀:</span>
                            <span className="font-medium">{teams.length}개</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faBuilding} className="text-purple-600" />
                            <span className="text-gray-600">현장:</span>
                            <span className="font-medium">{sites.length}개</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkerDatabaseInput;
