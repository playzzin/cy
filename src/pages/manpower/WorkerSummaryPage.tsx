import React, { useEffect, useState, useMemo } from 'react';
import styled from 'styled-components';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faSearch, faCheckSquare, faSquare, faFilter, faIdCard, faImage, faDownload } from '@fortawesome/free-solid-svg-icons';
import { toast } from '../../utils/swal';
import Swal from 'sweetalert2';
import { storage } from '../../config/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';


const PageContainer = styled.div`
    display: flex;
    height: 100vh;
    background-color: #f8f9fa;
    overflow: hidden;
`;

const Sidebar = styled.div`
    width: 350px;
    background: white;
    border-right: 1px solid #e9ecef;
    display: flex;
    flex-direction: column;
    height: 100%;
    z-index: 10;
    box-shadow: 2px 0 5px rgba(0,0,0,0.05);
`;

const SidebarHeader = styled.div`
    padding: 20px;
    border-bottom: 1px solid #e9ecef;
    background: #fff;
`;

const Title = styled.h2`
    font-size: 18px;
    font-weight: 700;
    color: #343a40;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 10px;
`;

const SearchBox = styled.div`
    position: relative;
    margin-bottom: 15px;
    
    input {
        width: 100%;
        padding: 10px 15px 10px 40px;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        font-size: 14px;
        transition: all 0.2s;

        &:focus {
            outline: none;
            border-color: #4dabf7;
            box-shadow: 0 0 0 3px rgba(77, 171, 247, 0.1);
        }
    }

    svg {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: #adb5bd;
    }
`;

const TeamFilter = styled.select`
    width: 100%;
    padding: 10px;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    font-size: 14px;
    color: #495057;
    background-color: white;
    cursor: pointer;

    &:focus {
        outline: none;
        border-color: #4dabf7;
    }
`;

const WorkerList = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 10px;

    &::-webkit-scrollbar {
        width: 6px;
    }
    &::-webkit-scrollbar-thumb {
        background-color: #dee2e6;
        border-radius: 3px;
    }
`;

const WorkerItem = styled.div<{ $selected: boolean }>`
    display: flex;
    align-items: center;
    padding: 12px 15px;
    margin-bottom: 8px;
    background: ${props => props.$selected ? '#e7f5ff' : 'white'};
    border: 1px solid ${props => props.$selected ? '#74c0fc' : '#e9ecef'};
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        background: ${props => props.$selected ? '#e7f5ff' : '#f8f9fa'};
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
`;

const Checkbox = styled.div<{ $checked: boolean }>`
    width: 20px;
    height: 20px;
    border: 2px solid ${props => props.$checked ? '#339af0' : '#adb5bd'};
    border-radius: 4px;
    margin-right: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${props => props.$checked ? '#339af0' : 'white'};
    color: white;
    font-size: 12px;
    transition: all 0.2s;
`;

const WorkerInfo = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const WorkerName = styled.span`
    font-weight: 600;
    color: #343a40;
    font-size: 15px;
`;

const WorkerDetail = styled.span`
    font-size: 12px;
    color: #868e96;
`;

const MainContent = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 30px;
    overflow-y: auto;
`;

const SummaryCard = styled.div`
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 800px;
    border: 1px solid #e9ecef;
`;

const CardHeader = styled.div`
    padding: 20px 25px;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
    border-radius: 12px 12px 0 0;
`;

const HeaderTitle = styled.h3`
    font-size: 18px;
    font-weight: 700;
    color: #343a40;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 10px;

    span {
        background: #e7f5ff;
        color: #1c7ed6;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 13px;
    }
`;

const ActionButtons = styled.div`
    display: flex;
    gap: 10px;
`;

const ActionButton = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: #339af0;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;

    &:hover {
        background: #228be6;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(51, 154, 240, 0.2);
    }

    &:active {
        transform: translateY(0);
    }
    
    &.secondary {
        background: #fff;
        color: #339af0;
        border: 1px solid #339af0;
        
        &:hover {
            background: #e7f5ff;
        }
    }
`;

const LoadingOverlay = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    font-size: 16px;
    color: #868e96;
    gap: 10px;
`;

const SelectAllBar = styled.div`
    padding: 10px 15px;
    background: #f1f3f5;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    align-items: center;
    font-size: 13px;
    color: #495057;
    cursor: pointer;
    user-select: none;

    &:hover {
        background: #e9ecef;
    }
`;

// Helper to copy HTML to clipboard
const copyHtmlToClipboard = async (html: string) => {
    try {
        const item = new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([html], { type: 'text/plain' }), // Fallback (though plain html source isn't great)
        });
        await navigator.clipboard.write([item]);
        return true;
    } catch (err) {
        console.error('Failed to copy HTML:', err);
        return false;
    }
};

const WorkerSummaryPage: React.FC = () => {
    const summaryRef = React.useRef<HTMLTableElement>(null);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedTeam, setSelectedTeam] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());
    const [showIdCards, setShowIdCards] = useState(true);

    // Store resolved image download URLs
    const [idCardUrls, setIdCardUrls] = useState<Record<string, string>>({});

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [allWorkers, allTeams] = await Promise.all([
                    manpowerService.getWorkers(),
                    teamService.getTeams()
                ]);

                // Active workers only
                const activeWorkers = allWorkers.filter(w => w.status !== '퇴사' && w.status !== 'inactive' && w.status !== '출입금지');

                setWorkers(activeWorkers);
                setTeams(allTeams);

                // Default select first team if available
                if (allTeams.length > 0) {
                    // setSelectedTeam(allTeams[0].id || '');
                }
            } catch (error) {
                console.error("Failed to load data:", error);
                toast.error("데이터를 불러오는데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Filter Logic
    const filteredWorkers = useMemo(() => {
        let result = workers;

        if (selectedTeam) {
            const targetTeam = teams.find(t => t.id === selectedTeam);
            const targetTeamName = targetTeam?.name;

            result = result.filter(w =>
                w.teamId === selectedTeam ||
                (targetTeamName && w.teamName === targetTeamName)
            );
        }

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(w =>
                w.name.toLowerCase().includes(lowerQuery) ||
                (w.idNumber && w.idNumber.includes(searchQuery))
            );
        }

        return result;
    }, [workers, selectedTeam, searchQuery, teams]);

    // Fetch ID Card Images
    useEffect(() => {
        const fetchImages = async () => {
            const urlMap: Record<string, string> = {};
            // Filter workers who have a file name saved
            const workersWithId = workers.filter(w => w.fileNameSaved);

            await Promise.all(workersWithId.map(async (w) => {
                if (!w.fileNameSaved) return;
                try {
                    // Check if we already have it to avoid re-fetching (simple optimization)
                    if (idCardUrls[w.id!]) return;

                    const storageRef = ref(storage, w.fileNameSaved);
                    const url = await getDownloadURL(storageRef);
                    urlMap[w.id!] = url;
                } catch (error) {
                    // If file doesn't exist or permission denied
                    console.warn(`Failed to fetch ID card for ${w.name}:`, error);
                }
            }));

            if (Object.keys(urlMap).length > 0) {
                setIdCardUrls(prev => ({ ...prev, ...urlMap }));
            }
        };

        if (workers.length > 0) {
            fetchImages();
        }
    }, [workers]);

    // Handle Selection
    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedWorkerIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedWorkerIds(newSet);
    };

    const toggleSelectAll = () => {
        const currentIds = filteredWorkers.map(w => w.id!);
        const allSelected = currentIds.every(id => selectedWorkerIds.has(id));

        const newSet = new Set(selectedWorkerIds);
        if (allSelected) {
            currentIds.forEach(id => newSet.delete(id));
        } else {
            currentIds.forEach(id => newSet.add(id));
        }
        setSelectedWorkerIds(newSet);
    };

    // Generate Summary Text based on selected workers
    const summaryText = useMemo(() => {
        if (selectedWorkerIds.size === 0) return '작업자를 선택하면 요약 정보가 여기에 표시됩니다.';

        const selected = workers.filter(w => selectedWorkerIds.has(w.id!));

        // Format: 
        // [팀명] 작업자명 (주민번호앞자리) - 연락처 / 주소 / 혈액형

        return selected.map(w => {
            const team = w.teamName ? `[${w.teamName}] ` : '';
            const idNum = w.idNumber || '주민번호 없음';
            const contact = w.contact || '연락처 없음';
            const address = w.address || '주소 없음';
            const bloodType = w.bloodType ? ` / ${w.bloodType}형` : '';
            return `${team}${w.name} (${idNum}) / ${contact} / ${address}${bloodType}`;
        }).join('\n');

    }, [selectedWorkerIds, workers]);

    const handleCopyImage = async () => {
        if (selectedWorkerIds.size === 0) {
            toast.warning('선택된 작업자가 없습니다.');
            return;
        }

        if (!summaryRef.current) return;

        try {
            toast.info('이미지 생성 중...');
            const canvas = await html2canvas(summaryRef.current, {
                useCORS: true,
                allowTaint: true,
                background: '#ffffff',
                scale: 2 // Hight quality
            } as any);

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    toast.error('이미지 변환 실패');
                    return;
                }
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                toast.success('이미지가 클립보드에 복사되었습니다.');
            });

        } catch (error) {
            console.error('Image Copy Error:', error);
            toast.error('이미지 복사에 실패했습니다.');
        }
    };

    const handleDownloadIDCards = async () => {
        if (selectedWorkerIds.size === 0) {
            toast.warning('선택된 작업자가 없습니다.');
            return;
        }

        const selectedWorkers = workers.filter(w => selectedWorkerIds.has(w.id!));
        const workerswithImages = selectedWorkers.filter(w => w.id && idCardUrls[w.id]);

        if (workerswithImages.length === 0) {
            toast.warning('선택된 작업자 중 신분증 이미지가 있는 작업자가 없습니다.');
            return;
        }

        try {
            toast.info('신분증 이미지 다운로드 중...');
            const zip = new JSZip();

            const promises = workerswithImages.map(async (w) => {
                const url = idCardUrls[w.id!];
                try {
                    // Fetch image as blob
                    const response = await fetch(url, { mode: 'cors' });
                    if (!response.ok) throw new Error('Network response was not ok');
                    const blob = await response.blob();

                    // File name: Name_IDNumber(first 6).png or similar
                    const idNum = w.idNumber ? w.idNumber.substring(0, 6) : 'unknown';
                    const fileName = `${w.name}_${idNum}.png`; // Assuming PNG or standard image

                    zip.file(fileName, blob);
                } catch (err) {
                    console.error(`Failed to download image for ${w.name}`, err);
                }
            });

            await Promise.all(promises);

            const content = await zip.generateAsync({ type: "blob" });
            const dateStr = new Date().toISOString().split('T')[0];
            saveAs(content, `작업자_신분증_모음_${dateStr}.zip`);
            toast.success('신분증 압축 파일이 다운로드되었습니다.');

        } catch (error) {
            console.error('ZIP Process Error:', error);
            toast.error('압축 파일 생성에 실패했습니다.');
        }
    };

    const handleSingleIdCardCopy = async (workerName: string, url: string) => {
        try {
            // Create a temporary image to draw on canvas
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = url;

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(img, 0, 0);

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    toast.error('이미지 변환 실패');
                    return;
                }
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                toast.success(`${workerName}님의 신분증이 복사되었습니다.`);
            });

        } catch (error) {
            console.error('Single ID Copy Error:', error);
            toast.error('이미지 복사 실패 (CORS 문제일 수 있습니다)');
        }
    };

    const activeTeamName = teams.find(t => t.id === selectedTeam)?.name || '전체';

    if (loading) return <LoadingOverlay>데이터 로딩 중...</LoadingOverlay>;

    return (
        <PageContainer>
            <Sidebar>
                <SidebarHeader>
                    <Title>
                        <FontAwesomeIcon icon={faFilter} size="sm" />
                        작업자 필터
                    </Title>
                    <TeamFilter
                        value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}
                    >
                        <option value="">전체 팀 보기</option>
                        {teams.map(team => (
                            <option key={team.id} value={team.id}>
                                {team.name} ({team.memberCount || 0}명)
                            </option>
                        ))}
                    </TeamFilter>
                </SidebarHeader>

                <div style={{ padding: '0 20px' }}>
                    <SearchBox>
                        <FontAwesomeIcon icon={faSearch} />
                        <input
                            type="text"
                            placeholder="이름 또는 주민번호 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </SearchBox>
                </div>

                <SelectAllBar onClick={toggleSelectAll}>
                    <Checkbox $checked={filteredWorkers.length > 0 && filteredWorkers.every(w => selectedWorkerIds.has(w.id!))}>
                        <FontAwesomeIcon icon={faCheckSquare} style={{ visibility: filteredWorkers.length > 0 && filteredWorkers.every(w => selectedWorkerIds.has(w.id!)) ? 'visible' : 'hidden' }} />
                    </Checkbox>
                    <span>전체 선택 ({filteredWorkers.length}명)</span>
                </SelectAllBar>

                <WorkerList>
                    {filteredWorkers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#adb5bd', fontSize: '13px' }}>
                            검색 결과가 없습니다.
                        </div>
                    ) : (
                        filteredWorkers.map(worker => (
                            <WorkerItem
                                key={worker.id}
                                $selected={selectedWorkerIds.has(worker.id!)}
                                onClick={() => toggleSelection(worker.id!)}
                            >
                                <Checkbox $checked={selectedWorkerIds.has(worker.id!)}>
                                    {selectedWorkerIds.has(worker.id!) && <FontAwesomeIcon icon={faCheckSquare} size="xs" />}
                                </Checkbox>
                                <WorkerInfo>
                                    <WorkerName>{worker.name}</WorkerName>
                                    <WorkerDetail>
                                        {worker.teamName || '미배정'} | {worker.idNumber ? worker.idNumber.substring(0, 6) : '------'}
                                    </WorkerDetail>
                                </WorkerInfo>
                            </WorkerItem>
                        ))
                    )}
                </WorkerList>
            </Sidebar>

            <MainContent>
                <SummaryCard>
                    <CardHeader>
                        <HeaderTitle>
                            작업자 요약
                            <span>{selectedWorkerIds.size}명 선택됨</span>
                        </HeaderTitle>
                        <ActionButtons>
                            <label className="flex items-center gap-2 mr-4 cursor-pointer text-sm select-none text-slate-600 hover:text-slate-900 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={showIdCards}
                                    onChange={(e) => setShowIdCards(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                신분증 보기
                            </label>
                            <ActionButton onClick={handleDownloadIDCards} className="secondary">
                                <FontAwesomeIcon icon={faDownload} />
                                신분증 다운로드 (ZIP)
                            </ActionButton>
                            <ActionButton onClick={handleCopyImage}>
                                <FontAwesomeIcon icon={faCopy} />
                                이미지 복사
                            </ActionButton>
                        </ActionButtons>
                    </CardHeader>
                    {selectedWorkerIds.size === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                            좌측 목록에서 작업자를 선택하세요.
                        </div>
                    ) : (
                        <div className="flex-1 overflow-auto p-0">
                            <table ref={summaryRef} className="w-full text-left text-sm border-collapse">
                                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-slate-600 w-16 text-center">No</th>
                                        <th className="px-4 py-3 font-semibold text-slate-600 w-24 text-center">이름</th>
                                        <th className="px-2 py-3 font-semibold text-slate-600 w-32 text-center">주민번호</th>
                                        <th className="px-2 py-3 font-semibold text-slate-600 w-32 text-center">연락처</th>
                                        {/* <th className="px-6 py-3 font-semibold text-slate-600">소속팀</th> */}
                                        <th className="px-6 py-3 font-semibold text-slate-600 text-center">주소</th>
                                        <th className="px-4 py-3 font-semibold text-slate-600 w-20 text-center">혈액형</th>
                                        {showIdCards && <th className="px-6 py-3 font-semibold text-slate-600 w-24 text-center">신분증</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {workers
                                        .filter(w => selectedWorkerIds.has(w.id!))
                                        .map((w, index) => (
                                            <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 text-slate-500 text-center align-middle">{index + 1}</td>
                                                <td className="px-4 py-3 font-medium text-slate-900 text-center align-middle">{w.name}</td>
                                                <td className="px-2 py-3 text-slate-600 font-mono tracking-tight text-center text-sm align-middle">
                                                    {w.idNumber ? w.idNumber : '-'}
                                                </td>
                                                <td className="px-2 py-3 text-slate-600 text-center text-sm align-middle">{w.contact || '-'}</td>
                                                {/* <td className="px-6 py-3 text-slate-600 align-middle">
                                                    {w.teamName ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                            {w.teamName}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">미배정</span>
                                                    )}
                                                </td> */}
                                                <td className="px-6 py-3 text-slate-600 whitespace-pre-wrap break-words align-middle">{w.address || '-'}</td>
                                                <td className="px-4 py-3 text-slate-600 text-center align-middle">
                                                    {w.bloodType ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                                                            {w.bloodType}형
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                {showIdCards && (
                                                    <td className="px-6 py-3 align-middle text-center">
                                                        <div className="flex justify-center items-center h-full">
                                                            {idCardUrls[w.id!] ? (
                                                                <img
                                                                    src={idCardUrls[w.id!]}
                                                                    alt="ID Card"
                                                                    crossOrigin="anonymous"
                                                                    title="클릭하여 이미지 복사"
                                                                    onClick={() => handleSingleIdCardCopy(w.name, idCardUrls[w.id!])}
                                                                    className="w-16 h-10 object-cover rounded border border-slate-200 hover:scale-[3] origin-center transition-transform bg-white relative z-0 hover:z-50 shadow-sm hover:shadow-xl cursor-copy"
                                                                />
                                                            ) : (
                                                                <span className="text-slate-300 text-xs">
                                                                    <FontAwesomeIcon icon={faImage} className="mr-1" />
                                                                    없음
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>

                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SummaryCard>
            </MainContent>


        </PageContainer >
    );
};

export default WorkerSummaryPage;
