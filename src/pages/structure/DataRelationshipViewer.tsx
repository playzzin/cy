import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faProjectDiagram, faSync, faSpinner, faFilter, faSearch } from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';
import { teamService, Team } from '../../services/teamService';
import { siteService, Site } from '../../services/siteService';
import { manpowerService, Worker } from '../../services/manpowerService';

const DataRelationshipViewer: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);

    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
    const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
    const [showWorkers, setShowWorkers] = useState(false);

    const mermaidRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });
    }, []);

    useEffect(() => {
        if (!loading) {
            renderGraph();
        }
    }, [loading, selectedCompanyId, selectedTeamId, showWorkers, companies, teams, sites, workers]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [compData, teamData, siteData, workerData] = await Promise.all([
                companyService.getCompanies(),
                teamService.getTeams(),
                siteService.getSites(),
                manpowerService.getWorkers()
            ]);
            setCompanies(compData);
            setTeams(teamData);
            setSites(siteData);
            setWorkers(workerData);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    const renderGraph = async () => {
        if (!mermaidRef.current) return;

        let graph = 'graph TD\n';

        // Styles
        graph += 'classDef company fill:#e0e7ff,stroke:#4338ca,stroke-width:2px;\n';
        graph += 'classDef team fill:#dcfce7,stroke:#15803d,stroke-width:2px;\n';
        graph += 'classDef site fill:#fef9c3,stroke:#a16207,stroke-width:2px;\n';
        graph += 'classDef worker fill:#f3f4f6,stroke:#4b5563,stroke-width:1px;\n';

        // Filter Data
        let filteredCompanies = companies;
        if (selectedCompanyId !== 'all') {
            filteredCompanies = companies.filter(c => c.id === selectedCompanyId);
        }

        let filteredTeams = teams;
        if (selectedCompanyId !== 'all') {
            filteredTeams = teams.filter(t => t.companyName === filteredCompanies[0]?.name); // Assuming companyName link
        }
        if (selectedTeamId !== 'all') {
            filteredTeams = filteredTeams.filter(t => t.id === selectedTeamId);
        }

        let filteredSites = sites;
        // Filter sites based on responsible teams
        const teamIds = filteredTeams.map(t => t.id);
        filteredSites = sites.filter(s => teamIds.includes(s.responsibleTeamId || ''));

        let filteredWorkers = workers;
        if (showWorkers) {
            filteredWorkers = workers.filter(w => teamIds.includes(w.teamId || ''));
        } else {
            filteredWorkers = [];
        }

        // Nodes & Edges

        // Companies
        filteredCompanies.forEach(c => {
            const safeName = c.name.replace(/["()]/g, '');
            graph += `C_${c.id}["🏢 ${safeName}"]:::company\n`;
        });

        // Teams
        filteredTeams.forEach(t => {
            const safeName = t.name.replace(/["()]/g, '');
            graph += `T_${t.id}["👥 ${safeName}"]:::team\n`;

            // Link to Company
            const company = companies.find(c => c.name === t.companyName);
            if (company && (selectedCompanyId === 'all' || selectedCompanyId === company.id)) {
                graph += `C_${company.id} -->|소속| T_${t.id}\n`;
            }
        });

        // Sites
        filteredSites.forEach(s => {
            const safeName = s.name.replace(/["()]/g, '');
            graph += `S_${s.id}["🏗️ ${safeName}"]:::site\n`;

            // Link to Team
            if (s.responsibleTeamId) {
                // Only link if team is visible
                if (filteredTeams.some(t => t.id === s.responsibleTeamId)) {
                    graph += `T_${s.responsibleTeamId} -.->|담당| S_${s.id}\n`;
                }
            }
        });

        // Workers
        if (showWorkers) {
            filteredWorkers.forEach(w => {
                const safeName = w.name.replace(/["()]/g, '');
                graph += `W_${w.id}["👷 ${safeName}"]:::worker\n`;

                // Link to Team
                if (w.teamId && filteredTeams.some(t => t.id === w.teamId)) {
                    graph += `T_${w.teamId} -->|구성원| W_${w.id}\n`;
                }
            });
        }

        // Render
        try {
            mermaidRef.current.innerHTML = '';
            const { svg } = await mermaid.render('mermaid-graph', graph);
            mermaidRef.current.innerHTML = svg;
        } catch (error) {
            console.error("Mermaid render error:", error);
            mermaidRef.current.innerHTML = '<div class="text-red-500 p-4">그래프 생성 중 오류가 발생했습니다. 데이터가 너무 많거나 형식이 올바르지 않을 수 있습니다.</div>';
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto h-screen flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faProjectDiagram} className="text-indigo-600" />
                        데이터 관계 시각화 (Entity Relationships)
                    </h1>
                    <p className="text-slate-500 mt-1">
                        회사, 팀, 현장, 작업자 간의 연결 구조를 시각적으로 확인합니다.
                    </p>
                </div>
                <button onClick={loadData} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="새로고침">
                    <FontAwesomeIcon icon={faSync} spin={loading} />
                </button>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center flex-shrink-0">
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faFilter} className="text-slate-400" />
                    <span className="font-semibold text-slate-700">필터:</span>
                </div>

                <select
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    value={selectedCompanyId}
                    onChange={(e) => {
                        setSelectedCompanyId(e.target.value);
                        setSelectedTeamId('all'); // Reset team when company changes
                    }}
                >
                    <option value="all">모든 회사</option>
                    {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                <select
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                >
                    <option value="all">모든 팀</option>
                    {teams
                        .filter(t => selectedCompanyId === 'all' || t.companyName === companies.find(c => c.id === selectedCompanyId)?.name)
                        .map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))
                    }
                </select>

                <label className="flex items-center gap-2 cursor-pointer ml-4">
                    <input
                        type="checkbox"
                        checked={showWorkers}
                        onChange={(e) => setShowWorkers(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">작업자 표시 (데이터가 많을 수 있음)</span>
                </label>
            </div>

            {/* Graph Area */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-indigo-600" />
                    </div>
                )}
                <div className="w-full h-full overflow-auto p-8 flex justify-center items-start bg-slate-50">
                    <div ref={mermaidRef} className="mermaid-container"></div>
                </div>
            </div>
        </div>
    );
};

export default DataRelationshipViewer;
