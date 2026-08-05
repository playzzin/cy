import React, { useEffect, useState, useMemo } from 'react';
import styled from 'styled-components';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faSearch, faCheckSquare, faFilter, faImage, faDownload, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
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

const TeamFilterWrapper = styled.div<{ $color: string }>`
    position: relative;

    &::before {
        content: '';
        position: absolute;
        left: 12px;
        top: 50%;
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: ${props => props.$color};
        border: 1px solid rgba(15, 23, 42, 0.12);
        transform: translateY(-50%);
        z-index: 1;
        pointer-events: none;
    }
`;

const TeamFilter = styled.select`
    width: 100%;
    padding: 10px 10px 10px 34px;
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

const WorkerItem = styled.div<{ $selected: boolean; $teamColor: string; $teamTint: string }>`
    display: flex;
    align-items: center;
    padding: 12px 15px;
    margin-bottom: 8px;
    background: ${props => props.$selected ? props.$teamTint : 'white'};
    border: 1px solid ${props => props.$selected ? props.$teamColor : '#e9ecef'};
    border-left: 5px solid ${props => props.$teamColor};
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        background: ${props => props.$selected ? props.$teamTint : '#f8f9fa'};
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
    display: flex;
    align-items: center;
    gap: 6px;
`;

const TeamColorDot = styled.span<{ $color: string }>`
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: ${props => props.$color};
    border: 1px solid rgba(15, 23, 42, 0.12);
    flex: 0 0 auto;
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
    max-height: 1120px;
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
    flex-wrap: wrap;
    justify-content: flex-end;
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

    &:hover:not(:disabled) {
        background: #228be6;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(51, 154, 240, 0.2);
    }

    &:active {
        transform: translateY(0);
    }

    &:disabled {
        opacity: 0.65;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }
    
    &.secondary {
        background: #fff;
        color: #339af0;
        border: 1px solid #339af0;
        
        &:hover:not(:disabled) {
            background: #e7f5ff;
        }
    }

    &.kakao {
        background: #fee500;
        color: #191919;

        &:hover:not(:disabled) {
            background: #f7d900;
            box-shadow: 0 4px 6px rgba(254, 229, 0, 0.25);
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

const normalizeText = (value?: string | null) => String(value ?? '').trim().toLowerCase();
const DEFAULT_TEAM_COLOR = '#94a3b8';

const normalizeHexColor = (value?: string | null, fallback = DEFAULT_TEAM_COLOR) => {
    const raw = String(value ?? '').trim();
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
};

const hexToRgba = (hex: string, alpha: number) => {
    const normalized = normalizeHexColor(hex).replace('#', '');
    const numeric = parseInt(normalized, 16);
    return `rgba(${(numeric >> 16) & 255}, ${(numeric >> 8) & 255}, ${numeric & 255}, ${alpha})`;
};

const isCheongyeonCompanyName = (value?: string | null) => {
    const normalized = normalizeText(value).replace(/\s+/g, '');
    return normalized.includes('청연');
};

const getTeamKey = (team: Team) => String(team.id ?? team.legacyId ?? team.name ?? '').trim();

const workerMatchesTeam = (worker: Worker, team?: Team | null, fallbackTeamId = '') => {
    const workerTeamId = String(worker.teamId ?? '').trim();
    const workerId = String(worker.id ?? '').trim();
    const teamIds = new Set(
        [fallbackTeamId, team?.id, team?.legacyId]
            .map((value) => String(value ?? '').trim())
            .filter((value) => value.length > 0)
    );
    const memberIds = new Set(
        (team?.memberIds ?? [])
            .map((value) => String(value ?? '').trim())
            .filter((value) => value.length > 0)
    );
    const teamName = normalizeText(team?.name);

    return (
        (workerTeamId.length > 0 && teamIds.has(workerTeamId)) ||
        (workerId.length > 0 && memberIds.has(workerId)) ||
        (teamName.length > 0 && normalizeText(worker.teamName) === teamName)
    );
};

const isActiveWorker = (worker: Worker) => {
    const status = normalizeText(worker.status);
    return worker.isActive !== false && status !== '퇴사' && status !== 'inactive' && status !== '출입금지';
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
    const [isSendingImage, setIsSendingImage] = useState(false);

    // Store resolved image download URLs
    const [idCardUrls, setIdCardUrls] = useState<Record<string, string>>({});

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [allWorkers, allTeams, allCompanies] = await Promise.all([
                    manpowerService.getWorkers(),
                    teamService.getTeams(),
                    companyService.getCompanies()
                ]);

                // Active workers only
                const activeWorkers = allWorkers.filter(isActiveWorker);

                const cheongyeonCompanies = allCompanies.filter((company) => isCheongyeonCompanyName(company.name));
                const cheongyeonCompanyIds = new Set(
                    cheongyeonCompanies
                        .map((company) => String(company.id ?? '').trim())
                        .filter((id) => id.length > 0)
                );
                const cheongyeonCompanyNames = new Set(
                    cheongyeonCompanies
                        .map((company) => normalizeText(company.name))
                        .filter((name) => name.length > 0)
                );
                const allowedTeams = allTeams
                    .filter((team) => {
                        const teamCompanyId = String(team.companyId ?? '').trim();
                        const teamCompanyName = normalizeText(team.companyName);

                        if (teamCompanyId && cheongyeonCompanyIds.has(teamCompanyId)) return true;
                        if (teamCompanyName && cheongyeonCompanyNames.has(teamCompanyName)) return true;
                        return isCheongyeonCompanyName(team.companyName);
                    })
                    .sort((left, right) => String(left.name ?? '').localeCompare(String(right.name ?? ''), 'ko-KR'));

                setWorkers(activeWorkers);
                setTeams(allowedTeams);
                setSelectedTeam((prev) => {
                    if (!prev) return '';
                    return allowedTeams.some((team) => getTeamKey(team) === prev) ? prev : '';
                });

                // Default select first team if available
                if (allowedTeams.length > 0) {
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

    const teamMemberCounts = useMemo(() => {
        const counts = new Map<string, number>();

        teams.forEach((team) => {
            const key = getTeamKey(team);
            if (!key) return;
            counts.set(key, workers.filter((worker) => workerMatchesTeam(worker, team, key)).length);
        });

        return counts;
    }, [teams, workers]);

    const workerTeamMetaById = useMemo(() => {
        const meta = new Map<string, { name: string; color: string; tint: string }>();

        workers.forEach((worker) => {
            if (!worker.id) return;
            const matchedTeam = teams.find((team) => workerMatchesTeam(worker, team, getTeamKey(team)));
            const color = normalizeHexColor(matchedTeam?.color || worker.color);
            meta.set(worker.id, {
                name: matchedTeam?.name || worker.teamName || '미배정',
                color,
                tint: hexToRgba(color, 0.1)
            });
        });

        return meta;
    }, [teams, workers]);

    const selectedTeamRecord = useMemo(
        () => teams.find((team) => getTeamKey(team) === selectedTeam),
        [teams, selectedTeam]
    );
    const selectedTeamColor = normalizeHexColor(selectedTeamRecord?.color, DEFAULT_TEAM_COLOR);

    // Filter Logic
    const filteredWorkers = useMemo(() => {
        let result = workers;

        if (selectedTeam) {
            result = result.filter(w => workerMatchesTeam(w, selectedTeamRecord, selectedTeam));
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
            const name = w.name.replace(/[0-9]/g, '');
            return `${team}${name} (${idNum}) / ${contact} / ${address}${bloodType}`;
        }).join('\n');

    }, [selectedWorkerIds, workers]);

    const captureSummaryImageBlob = async (): Promise<Blob> => {
        if (!summaryRef.current) {
            throw new Error('요약 테이블을 찾을 수 없습니다.');
        }

        const canvas = await html2canvas(summaryRef.current, {
            useCORS: true,
            allowTaint: true,
            background: '#ffffff',
            scale: 2 // High quality
        } as any);

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                    return;
                }
                reject(new Error('이미지 변환 실패'));
            }, 'image/png');
        });
    };

    const writeImageBlobToClipboard = async (blob: Blob) => {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
    };

    const buildSummaryImageFileName = () => {
        const today = new Date().toISOString().slice(0, 10);
        return `작업자요약_${today}_${selectedWorkerIds.size}명.png`;
    };

    const handleCopyImage = async () => {
        if (selectedWorkerIds.size === 0) {
            toast.warning('선택된 작업자가 없습니다.');
            return;
        }

        try {
            toast.info('이미지 생성 중...');
            const blob = await captureSummaryImageBlob();
            await writeImageBlobToClipboard(blob);
            toast.success('이미지가 클립보드에 복사되었습니다.');
        } catch (error) {
            console.error('Image Copy Error:', error);
            toast.error('이미지 복사에 실패했습니다.');
        }
    };

    const handleSendKakao = async () => {
        if (selectedWorkerIds.size === 0) {
            toast.warning('선택된 작업자가 없습니다.');
            return;
        }

        const shareNavigator = navigator as Navigator & {
            canShare?: (data: { files?: File[] }) => boolean;
            share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
        };
        const title = `작업자 요약 ${selectedWorkerIds.size}명`;
        const imageFileName = buildSummaryImageFileName();

        let blob: Blob | null = null;

        try {
            setIsSendingImage(true);
            toast.info('카톡으로 보낼 이미지 생성 중...');
            blob = await captureSummaryImageBlob();
            const file = new File([blob], imageFileName, { type: 'image/png' });

            if (shareNavigator.share && (!shareNavigator.canShare || shareNavigator.canShare({ files: [file] }))) {
                await shareNavigator.share({
                    title,
                    text: '작업자 요약 이미지입니다.',
                    files: [file]
                });
                toast.success('공유창을 열었습니다. 카카오톡을 선택해서 보내세요.');
                return;
            }

            try {
                await writeImageBlobToClipboard(blob);
                toast.info('이 브라우저는 바로 공유를 지원하지 않아 이미지를 복사했습니다. 카카오톡 채팅방에 붙여넣어 보내세요.');
            } catch (clipboardError) {
                console.warn('Kakao Share clipboard fallback failed:', clipboardError);
                saveAs(blob, imageFileName);
                toast.info('이 브라우저는 바로 공유와 이미지 복사를 지원하지 않아 PNG 파일로 저장했습니다. 카카오톡에서 파일을 첨부해 보내세요.');
            }
        } catch (error) {
            if ((error as DOMException)?.name === 'AbortError') return;

            console.error('Kakao Share Error:', error);
            if (blob) {
                saveAs(blob, imageFileName);
                toast.info('공유창을 열지 못해 PNG 파일로 저장했습니다. 카카오톡에서 파일을 첨부해 보내세요.');
                return;
            }
            toast.error('카톡 보내기를 시작하지 못했습니다.');
        } finally {
            setIsSendingImage(false);
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
                    const cleanName = w.name.replace(/[0-9]/g, '');
                    const fileName = `${cleanName}_${idNum}.png`; // Assuming PNG or standard image

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
                const cleanName = workerName.replace(/[0-9]/g, '');
                toast.success(`${cleanName}님의 신분증이 복사되었습니다.`);
            });

        } catch (error) {
            console.error('Single ID Copy Error:', error);
            toast.error('이미지 복사 실패 (CORS 문제일 수 있습니다)');
        }
    };

    if (loading) return <LoadingOverlay>데이터 로딩 중...</LoadingOverlay>;

    return (
        <PageContainer>
            <Sidebar>
                <SidebarHeader>
                    <Title>
                        <FontAwesomeIcon icon={faFilter} size="sm" />
                        작업자 필터
                    </Title>
                    <TeamFilterWrapper $color={selectedTeamColor}>
                        <TeamFilter
                            value={selectedTeam}
                            onChange={(e) => setSelectedTeam(e.target.value)}
                        >
                            <option value="">전체 팀 보기 ({workers.length}명)</option>
                            {teams.map(team => {
                                const teamKey = getTeamKey(team);
                                const teamColor = normalizeHexColor(team.color);
                                const memberCount = teamMemberCounts.get(teamKey) ?? 0;

                                return (
                                    <option key={teamKey} value={teamKey} style={{ color: teamColor }}>
                                        ● {team.name} ({memberCount}명)
                                    </option>
                                );
                            })}
                        </TeamFilter>
                    </TeamFilterWrapper>
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
                        filteredWorkers.map(worker => {
                            const teamMeta = worker.id ? workerTeamMetaById.get(worker.id) : undefined;
                            const teamColor = teamMeta?.color ?? normalizeHexColor(worker.color);
                            const teamTint = teamMeta?.tint ?? hexToRgba(teamColor, 0.1);
                            const teamName = teamMeta?.name || worker.teamName || '미배정';

                            return (
                                <WorkerItem
                                    key={worker.id}
                                    $selected={selectedWorkerIds.has(worker.id!)}
                                    $teamColor={teamColor}
                                    $teamTint={teamTint}
                                    onClick={() => toggleSelection(worker.id!)}
                                >
                                    <Checkbox $checked={selectedWorkerIds.has(worker.id!)}>
                                        {selectedWorkerIds.has(worker.id!) && <FontAwesomeIcon icon={faCheckSquare} size="xs" />}
                                    </Checkbox>
                                    <WorkerInfo>
                                        <WorkerName>{worker.name}</WorkerName>
                                        <WorkerDetail>
                                            <TeamColorDot $color={teamColor} />
                                            <span>{teamName} | {worker.idNumber ? worker.idNumber.substring(0, 6) : '------'}</span>
                                        </WorkerDetail>
                                    </WorkerInfo>
                                </WorkerItem>
                            );
                        })
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
                            <ActionButton
                                onClick={handleSendKakao}
                                className="kakao"
                                disabled={isSendingImage}
                                title="카카오톡으로 보내기"
                            >
                                <FontAwesomeIcon icon={faPaperPlane} />
                                {isSendingImage ? '준비 중' : '보내기'}
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
                                                <td className="px-4 py-3 font-medium text-slate-900 text-center align-middle">{w.name.replace(/[0-9]/g, '')}</td>
                                                <td className="px-2 py-3 text-slate-600 text-center text-sm align-middle">
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
