import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import * as d3 from 'd3';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faUsers, faUser, faChevronDown, faChevronRight,
    faExpand, faCompress, faSearch, faTimes, faPhone, faEnvelope,
    faMapMarkerAlt, faBriefcase, faWallet, faInfoCircle, faStar,
    faLayerGroup, faUserTie
} from '@fortawesome/free-solid-svg-icons';
import { Company, companyService } from '../../services/companyService';
import { Team, teamService } from '../../services/teamService';
import { Worker, manpowerService } from '../../services/manpowerService';

// ============================================================================
// TYPES
// ============================================================================
interface OrgNode {
    id: string;
    name: string;
    type: 'root' | 'company' | 'team' | 'worker';
    data?: Company | Team | Worker;
    count?: number;
    children?: OrgNode[];
}

interface TreeNode extends d3.HierarchyPointNode<OrgNode> {
    _children?: TreeNode[];
}

// ============================================================================
// DESIGN SYSTEM - 2024/2025 Trend Colors
// ============================================================================
const COLORS = {
    // Background gradients
    bgFrom: '#0a0a0f',
    bgTo: '#12121a',
    bgVia: '#0f0f1a',

    // Aurora colors
    aurora1: 'rgba(139, 92, 246, 0.15)', // Purple
    aurora2: 'rgba(59, 130, 246, 0.12)', // Blue
    aurora3: 'rgba(16, 185, 129, 0.10)', // Emerald

    // Node colors
    root: {
        bg: 'rgba(139, 92, 246, 0.4)',
        border: 'rgba(139, 92, 246, 0.7)',
        glow: '#8b5cf6',
        text: '#ffffff',
        icon: '#a78bfa'
    },
    company: {
        bg: 'rgba(59, 130, 246, 0.35)',
        border: 'rgba(59, 130, 246, 0.6)',
        glow: '#3b82f6',
        text: '#ffffff',
        icon: '#60a5fa'
    },
    team: {
        bg: 'rgba(16, 185, 129, 0.35)',
        border: 'rgba(16, 185, 129, 0.6)',
        glow: '#10b981',
        text: '#ffffff',
        icon: '#34d399'
    },
    worker: {
        bg: 'rgba(255, 255, 255, 0.12)',
        border: 'rgba(255, 255, 255, 0.25)',
        glow: '#ffffff',
        text: '#ffffff',
        icon: '#94a3b8'
    },

    // Glass effect
    glass: 'rgba(255, 255, 255, 0.03)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    glassHover: 'rgba(255, 255, 255, 0.06)',

    // Text
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',

    // Lines
    line: 'rgba(148, 163, 184, 0.3)',
    lineActive: 'rgba(139, 92, 246, 0.6)'
};

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.03,
            delayChildren: 0.2
        }
    }
};

const nodeVariants = {
    hidden: {
        opacity: 0,
        scale: 0.8
    },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            type: 'spring' as const,
            stiffness: 300,
            damping: 25
        }
    },
    exit: {
        opacity: 0,
        scale: 0.8,
        transition: { duration: 0.2 }
    }
};

const lineVariants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
        pathLength: 1,
        opacity: 1,
        transition: {
            pathLength: { duration: 0.8, ease: 'easeInOut' as const },
            opacity: { duration: 0.3 }
        }
    }
};

const panelVariants = {
    hidden: { x: 400, opacity: 0 },
    visible: {
        x: 0,
        opacity: 1,
        transition: {
            type: 'spring' as const,
            stiffness: 300,
            damping: 30
        }
    },
    exit: {
        x: 400,
        opacity: 0,
        transition: { duration: 0.3 }
    }
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Animated Aurora Background
const AuroraBackground: React.FC = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Base gradient */}
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(135deg, ${COLORS.bgFrom} 0%, ${COLORS.bgVia} 50%, ${COLORS.bgTo} 100%)`
                }}
            />

            {/* Aurora blobs */}
            <motion.div
                className="absolute w-[600px] h-[600px] rounded-full blur-[120px]"
                style={{
                    background: COLORS.aurora1,
                    top: '-10%',
                    left: '20%'
                }}
                animate={{
                    x: [0, 50, -30, 0],
                    y: [0, -30, 20, 0],
                    scale: [1, 1.1, 0.95, 1]
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: 'easeInOut'
                }}
            />
            <motion.div
                className="absolute w-[500px] h-[500px] rounded-full blur-[100px]"
                style={{
                    background: COLORS.aurora2,
                    top: '30%',
                    right: '10%'
                }}
                animate={{
                    x: [0, -40, 30, 0],
                    y: [0, 40, -20, 0],
                    scale: [1, 0.9, 1.05, 1]
                }}
                transition={{
                    duration: 18,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 2
                }}
            />
            <motion.div
                className="absolute w-[400px] h-[400px] rounded-full blur-[80px]"
                style={{
                    background: COLORS.aurora3,
                    bottom: '10%',
                    left: '30%'
                }}
                animate={{
                    x: [0, 30, -40, 0],
                    y: [0, -20, 30, 0],
                    scale: [1, 1.05, 0.9, 1]
                }}
                transition={{
                    duration: 22,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 4
                }}
            />

            {/* Dot Grid Pattern */}
            <div
                className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }}
            />
        </div>
    );
};

// Stats Bar Component
interface StatsBarProps {
    companies: Company[];
    teams: Team[];
    workers: Worker[];
}

const StatsBar: React.FC<StatsBarProps> = ({ companies, teams, workers }) => {
    const stats = [
        {
            label: '회사',
            value: companies.length,
            icon: faBuilding,
            color: COLORS.company.icon,
            bgColor: COLORS.company.bg
        },
        {
            label: '팀',
            value: teams.length,
            icon: faUsers,
            color: COLORS.team.icon,
            bgColor: COLORS.team.bg
        },
        {
            label: '근로자',
            value: workers.length,
            icon: faUser,
            color: COLORS.worker.icon,
            bgColor: COLORS.worker.bg
        }
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-6"
        >
            {stats.map((stat, idx) => (
                <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + idx * 0.1 }}
                    className="flex items-center gap-3 px-4 py-2 rounded-xl"
                    style={{
                        background: stat.bgColor,
                        border: `1px solid ${COLORS.glassBorder}`
                    }}
                >
                    <FontAwesomeIcon icon={stat.icon} style={{ color: stat.color }} />
                    <div>
                        <div className="text-xs" style={{ color: COLORS.textMuted }}>
                            {stat.label}
                        </div>
                        <div className="text-lg font-bold" style={{ color: stat.color }}>
                            {stat.value.toLocaleString()}
                        </div>
                    </div>
                </motion.div>
            ))}
        </motion.div>
    );
};

// Org Node Card Component
interface OrgNodeCardProps {
    node: TreeNode;
    isExpanded: boolean;
    onToggle: () => void;
    onSelect: () => void;
    isSelected: boolean;
}

const OrgNodeCard: React.FC<OrgNodeCardProps> = React.memo(({
    node,
    isExpanded,
    onToggle,
    onSelect,
    isSelected
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const nodeData = node.data;
    const type = nodeData.type;
    const colors = COLORS[type] || COLORS.worker;
    const hasChildren = (node.children && node.children.length > 0) ||
        (node._children && node._children.length > 0);

    const getIcon = () => {
        switch (type) {
            case 'root': return faStar;
            case 'company': return faBuilding;
            case 'team': return faUsers;
            case 'worker': return faUser;
            default: return faLayerGroup;
        }
    };

    const getSubtitle = () => {
        if (type === 'root') return '조직 구조';
        if (type === 'company') {
            const company = nodeData.data as Company;
            return company?.type || '회사';
        }
        if (type === 'team') {
            const team = nodeData.data as Team;
            return team?.leaderName ? `대표: ${team.leaderName}` : '팀';
        }
        if (type === 'worker') {
            const worker = nodeData.data as Worker;
            return worker?.role || '근로자';
        }
        return '';
    };

    // Calculate card dimensions based on type
    const cardWidth = type === 'worker' ? 140 : type === 'root' ? 180 : 160;
    const cardHeight = type === 'worker' ? 60 : type === 'root' ? 80 : 70;

    return (
        <g transform={`translate(${node.x}, ${node.y})`}>
            <motion.foreignObject
                x={-cardWidth / 2}
                y={-cardHeight / 2}
                width={cardWidth}
                height={cardHeight}
                style={{ overflow: 'visible' }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
                <motion.div
                    className="relative cursor-pointer select-none"
                    style={{
                        width: cardWidth,
                        height: cardHeight,
                        background: colors.bg,
                        border: `1px solid ${isSelected ? colors.glow : colors.border}`,
                        borderRadius: type === 'root' ? 20 : 12,
                        backdropFilter: 'blur(12px)',
                        boxShadow: isHovered || isSelected
                            ? `0 0 30px ${colors.glow}40, 0 8px 32px rgba(0,0,0,0.3)`
                            : `0 4px 20px rgba(0,0,0,0.2)`
                    }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect();
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) onToggle();
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                    {/* Glow effect on hover */}
                    <AnimatePresence>
                        {(isHovered || isSelected) && (
                            <motion.div
                                className="absolute inset-0 rounded-xl pointer-events-none"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{
                                    background: `radial-gradient(circle at 50% 50%, ${colors.glow}20 0%, transparent 70%)`,
                                    borderRadius: type === 'root' ? 20 : 12
                                }}
                            />
                        )}
                    </AnimatePresence>

                    {/* Content */}
                    <div className="flex items-center gap-3 h-full px-3">
                        {/* Icon */}
                        <motion.div
                            className="flex items-center justify-center rounded-lg"
                            style={{
                                width: type === 'worker' ? 32 : 40,
                                height: type === 'worker' ? 32 : 40,
                                background: `${colors.glow}20`
                            }}
                            animate={{
                                boxShadow: isHovered
                                    ? `0 0 15px ${colors.glow}60`
                                    : 'none'
                            }}
                        >
                            <FontAwesomeIcon
                                icon={getIcon()}
                                style={{
                                    color: colors.icon,
                                    fontSize: type === 'worker' ? 14 : 18
                                }}
                            />
                        </motion.div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                            <div
                                className="font-bold truncate"
                                style={{
                                    color: colors.text,
                                    fontSize: type === 'worker' ? 12 : 14
                                }}
                            >
                                {nodeData.name}
                            </div>
                            <div
                                className="text-xs truncate"
                                style={{ color: COLORS.textMuted }}
                            >
                                {getSubtitle()}
                            </div>
                        </div>

                        {/* Expand/Collapse indicator */}
                        {hasChildren && (
                            <motion.div
                                className="flex items-center justify-center w-5 h-5 rounded-full"
                                style={{
                                    background: 'rgba(255,255,255,0.1)'
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggle();
                                }}
                            >
                                <FontAwesomeIcon
                                    icon={isExpanded ? faChevronDown : faChevronRight}
                                    style={{
                                        color: COLORS.textMuted,
                                        fontSize: 10
                                    }}
                                />
                            </motion.div>
                        )}
                    </div>

                    {/* Count badge */}
                    {nodeData.count !== undefined && nodeData.count > 0 && (
                        <motion.div
                            className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{
                                background: colors.glow,
                                color: '#fff',
                                boxShadow: `0 0 10px ${colors.glow}80`
                            }}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.3 }}
                        >
                            {nodeData.count}
                        </motion.div>
                    )}
                </motion.div>
            </motion.foreignObject>
        </g>
    );
});

OrgNodeCard.displayName = 'OrgNodeCard';

// Connection Line Component
interface ConnectionLineProps {
    source: { x: number; y: number };
    target: { x: number; y: number };
    sourceType: string;
}

const ConnectionLine: React.FC<ConnectionLineProps> = React.memo(({ source, target, sourceType }) => {
    const colors = COLORS[sourceType as keyof typeof COLORS] || COLORS.worker;
    const glowColor = typeof colors === 'object' && 'glow' in colors ? colors.glow : COLORS.line;

    // Bezier curve path
    const midY = (source.y + target.y) / 2;
    const path = `M ${source.x} ${source.y + 35} 
                  C ${source.x} ${midY}, 
                    ${target.x} ${midY}, 
                    ${target.x} ${target.y - 35}`;

    return (
        <motion.path
            d={path}
            fill="none"
            stroke={COLORS.line}
            strokeWidth={2}
            variants={lineVariants}
            initial="hidden"
            animate="visible"
            style={{
                filter: `drop-shadow(0 0 4px ${glowColor}40)`
            }}
        />
    );
});

ConnectionLine.displayName = 'ConnectionLine';

// Detail Panel Component
interface DetailPanelProps {
    node: OrgNode | null;
    onClose: () => void;
    companies: Company[];
    teams: Team[];
    workers: Worker[];
}

const DetailPanel: React.FC<DetailPanelProps> = ({ node, onClose, companies, teams, workers }) => {
    if (!node) return null;

    const colors = COLORS[node.type] || COLORS.worker;

    const renderContent = () => {
        switch (node.type) {
            case 'root':
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 rounded-lg" style={{ background: COLORS.company.bg }}>
                                <div className="text-2xl font-bold" style={{ color: COLORS.company.icon }}>
                                    {companies.length}
                                </div>
                                <div className="text-xs" style={{ color: COLORS.textMuted }}>회사</div>
                            </div>
                            <div className="text-center p-3 rounded-lg" style={{ background: COLORS.team.bg }}>
                                <div className="text-2xl font-bold" style={{ color: COLORS.team.icon }}>
                                    {teams.length}
                                </div>
                                <div className="text-xs" style={{ color: COLORS.textMuted }}>팀</div>
                            </div>
                            <div className="text-center p-3 rounded-lg" style={{ background: COLORS.worker.bg }}>
                                <div className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>
                                    {workers.length}
                                </div>
                                <div className="text-xs" style={{ color: COLORS.textMuted }}>근로자</div>
                            </div>
                        </div>
                    </div>
                );

            case 'company': {
                const company = node.data as Company;
                const companyTeams = teams.filter(t => t.companyId === node.id);
                const companyWorkers = workers.filter(w =>
                    companyTeams.some(t => t.id === w.teamId)
                );
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg" style={{ background: COLORS.glass }}>
                                <div className="text-xs" style={{ color: COLORS.textMuted }}>유형</div>
                                <div className="font-medium" style={{ color: COLORS.textPrimary }}>
                                    {company?.type || '미지정'}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg" style={{ background: COLORS.glass }}>
                                <div className="text-xs" style={{ color: COLORS.textMuted }}>대표</div>
                                <div className="font-medium" style={{ color: COLORS.textPrimary }}>
                                    {company?.ceoName || '-'}
                                </div>
                            </div>
                        </div>

                        {company?.phone && (
                            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: COLORS.glass }}>
                                <FontAwesomeIcon icon={faPhone} style={{ color: COLORS.textMuted }} />
                                <span style={{ color: COLORS.textPrimary }}>{company.phone}</span>
                            </div>
                        )}

                        {company?.address && (
                            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: COLORS.glass }}>
                                <FontAwesomeIcon icon={faMapMarkerAlt} style={{ color: COLORS.textMuted }} />
                                <span className="text-sm" style={{ color: COLORS.textPrimary }}>{company.address}</span>
                            </div>
                        )}

                        <div className="border-t pt-4" style={{ borderColor: COLORS.glassBorder }}>
                            <div className="text-xs mb-2" style={{ color: COLORS.textMuted }}>소속 팀 ({companyTeams.length})</div>
                            <div className="flex flex-wrap gap-2">
                                {companyTeams.slice(0, 5).map(team => (
                                    <span
                                        key={team.id}
                                        className="px-2 py-1 rounded-lg text-xs"
                                        style={{ background: COLORS.team.bg, color: COLORS.team.text }}
                                    >
                                        {team.name}
                                    </span>
                                ))}
                                {companyTeams.length > 5 && (
                                    <span className="text-xs" style={{ color: COLORS.textMuted }}>
                                        +{companyTeams.length - 5}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="border-t pt-4" style={{ borderColor: COLORS.glassBorder }}>
                            <div className="text-xs mb-2" style={{ color: COLORS.textMuted }}>
                                총 인원: {companyWorkers.length}명
                            </div>
                        </div>
                    </div>
                );
            }

            case 'team': {
                const team = node.data as Team;
                const teamWorkers = workers.filter(w => w.teamId === node.id);
                const parentCompany = companies.find(c => c.id === team?.companyId);
                return (
                    <div className="space-y-4">
                        {parentCompany && (
                            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: COLORS.company.bg }}>
                                <FontAwesomeIcon icon={faBuilding} style={{ color: COLORS.company.icon }} />
                                <span style={{ color: COLORS.company.text }}>{parentCompany.name}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg" style={{ background: COLORS.glass }}>
                                <div className="text-xs" style={{ color: COLORS.textMuted }}>대표</div>
                                <div className="font-medium" style={{ color: COLORS.textPrimary }}>
                                    {team?.leaderName || '-'}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg" style={{ background: COLORS.glass }}>
                                <div className="text-xs" style={{ color: COLORS.textMuted }}>인원</div>
                                <div className="font-medium" style={{ color: COLORS.textPrimary }}>
                                    {teamWorkers.length}명
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4" style={{ borderColor: COLORS.glassBorder }}>
                            <div className="text-xs mb-2" style={{ color: COLORS.textMuted }}>팀원</div>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {teamWorkers.map(worker => (
                                    <div
                                        key={worker.id}
                                        className="flex items-center gap-2 p-2 rounded-lg"
                                        style={{ background: COLORS.glass }}
                                    >
                                        <FontAwesomeIcon icon={faUser} style={{ color: COLORS.textMuted }} />
                                        <span className="flex-1 text-sm" style={{ color: COLORS.textPrimary }}>
                                            {worker.name}
                                        </span>
                                        <span className="text-xs" style={{ color: COLORS.textMuted }}>
                                            {worker.role}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            }

            case 'worker': {
                const worker = node.data as Worker;
                const parentTeam = teams.find(t => t.id === worker?.teamId);
                return (
                    <div className="space-y-4">
                        {parentTeam && (
                            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: COLORS.team.bg }}>
                                <FontAwesomeIcon icon={faUsers} style={{ color: COLORS.team.icon }} />
                                <span style={{ color: COLORS.team.text }}>{parentTeam.name}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg" style={{ background: COLORS.glass }}>
                                <div className="text-xs" style={{ color: COLORS.textMuted }}>직종</div>
                                <div className="font-medium" style={{ color: COLORS.textPrimary }}>
                                    {worker?.role || '-'}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg" style={{ background: COLORS.glass }}>
                                <div className="text-xs" style={{ color: COLORS.textMuted }}>급여방식</div>
                                <div className="font-medium" style={{ color: COLORS.textPrimary }}>
                                    {worker?.salaryModel || '-'}
                                </div>
                            </div>
                        </div>

                        {worker?.contact && (
                            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: COLORS.glass }}>
                                <FontAwesomeIcon icon={faPhone} style={{ color: COLORS.textMuted }} />
                                <span style={{ color: COLORS.textPrimary }}>{worker.contact}</span>
                            </div>
                        )}
                    </div>
                );
            }

            default:
                return null;
        }
    };

    return (
        <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-0 right-0 w-80 h-full z-50"
            style={{
                background: 'rgba(15, 15, 26, 0.95)',
                backdropFilter: 'blur(20px)',
                borderLeft: `1px solid ${COLORS.glassBorder}`
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between p-4 border-b"
                style={{ borderColor: COLORS.glassBorder }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ background: colors.bg }}
                    >
                        <FontAwesomeIcon
                            icon={
                                node.type === 'root' ? faStar :
                                    node.type === 'company' ? faBuilding :
                                        node.type === 'team' ? faUsers : faUser
                            }
                            style={{ color: typeof colors === 'object' && 'icon' in colors ? colors.icon : COLORS.textPrimary }}
                        />
                    </div>
                    <div>
                        <div className="font-bold" style={{ color: COLORS.textPrimary }}>
                            {node.name}
                        </div>
                        <div className="text-xs" style={{ color: COLORS.textMuted }}>
                            {node.type === 'root' ? '루트' :
                                node.type === 'company' ? '회사' :
                                    node.type === 'team' ? '팀' : '근로자'}
                        </div>
                    </div>
                </div>
                <motion.button
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: COLORS.glass }}
                    whileHover={{ scale: 1.1, background: 'rgba(255,255,255,0.1)' }}
                    whileTap={{ scale: 0.95 }}
                >
                    <FontAwesomeIcon icon={faTimes} style={{ color: COLORS.textMuted }} />
                </motion.button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100% - 80px)' }}>
                {renderContent()}
            </div>
        </motion.div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const PremiumOrgChart: React.FC = () => {
    // State
    const [companies, setCompanies] = useState<Company[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
    const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    // Container size for proper centering
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    // Zoom & Pan state
    const [scale, setScale] = useState(0.7);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    // Update container size on mount and resize
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setContainerSize({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);

        // Also update after a short delay for initial render
        const timer = setTimeout(updateSize, 100);

        return () => {
            window.removeEventListener('resize', updateSize);
            clearTimeout(timer);
        };
    }, [loading]);

    // Load data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [c, t, w] = await Promise.all([
                    companyService.getCompanies(),
                    teamService.getTeams(),
                    manpowerService.getWorkers()
                ]);
                setCompanies(c);
                setTeams(t);
                setWorkers(w);
            } catch (error) {
                console.error('Failed to load data:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Build tree data
    const treeData = useMemo((): OrgNode => {
        const root: OrgNode = {
            id: 'root',
            name: '청연SITE',
            type: 'root',
            count: companies.length + teams.length + workers.length,
            children: []
        };

        // Group teams by company
        const companyMap = new Map<string, { company: Company; teams: Team[] }>();
        companies.forEach(c => {
            if (c.id) companyMap.set(c.id, { company: c, teams: [] });
        });

        // Assign teams to companies
        const unassignedTeams: Team[] = [];
        teams.forEach(team => {
            if (team.companyId && companyMap.has(team.companyId)) {
                companyMap.get(team.companyId)!.teams.push(team);
            } else {
                unassignedTeams.push(team);
            }
        });

        // Build company nodes
        companyMap.forEach(({ company, teams: companyTeams }) => {
            const companyWorkers = workers.filter(w =>
                companyTeams.some(t => t.id === w.teamId)
            );

            const companyNode: OrgNode = {
                id: company.id!,
                name: company.name,
                type: 'company',
                data: company,
                count: companyWorkers.length,
                children: []
            };

            // Add teams to company
            companyTeams.forEach(team => {
                const teamWorkers = workers.filter(w => w.teamId === team.id);
                const teamNode: OrgNode = {
                    id: team.id!,
                    name: team.name,
                    type: 'team',
                    data: team,
                    count: teamWorkers.length,
                    children: teamWorkers.map(w => ({
                        id: w.id!,
                        name: w.name,
                        type: 'worker' as const,
                        data: w
                    }))
                };
                companyNode.children!.push(teamNode);
            });

            if (companyNode.children!.length > 0 || companyTeams.length > 0) {
                root.children!.push(companyNode);
            }
        });

        // Add unassigned teams
        if (unassignedTeams.length > 0) {
            const unassignedNode: OrgNode = {
                id: 'unassigned',
                name: '미배정',
                type: 'company',
                count: unassignedTeams.length,
                children: unassignedTeams.map(team => {
                    const teamWorkers = workers.filter(w => w.teamId === team.id);
                    return {
                        id: team.id!,
                        name: team.name,
                        type: 'team' as const,
                        data: team,
                        count: teamWorkers.length,
                        children: teamWorkers.map(w => ({
                            id: w.id!,
                            name: w.name,
                            type: 'worker' as const,
                            data: w
                        }))
                    };
                })
            };
            root.children!.push(unassignedNode);
        }

        return root;
    }, [companies, teams, workers]);

    // Helper to find node in tree - defined before useMemo that uses it
    const findNode = useCallback((root: OrgNode, id: string): OrgNode | null => {
        if (root.id === id) return root;
        if (root.children) {
            for (const child of root.children) {
                const found = findNode(child, id);
                if (found) return found;
            }
        }
        return null;
    }, []);

    // Calculate tree layout with D3
    const { nodes, links } = useMemo(() => {
        if (!treeData) return { nodes: [], links: [] };

        // Filter visible nodes based on expansion state
        const filterTree = (node: OrgNode): OrgNode | null => {
            const isExpanded = expandedNodes.has(node.id);
            if (!node.children || !isExpanded) {
                return { ...node, children: undefined };
            }
            const children = node.children
                .map(filterTree)
                .filter((n): n is OrgNode => n !== null);
            return { ...node, children };
        };

        const filteredRoot = filterTree(treeData);
        if (!filteredRoot) return { nodes: [], links: [] };

        const treeLayout = d3.tree<OrgNode>()
            .nodeSize([200, 140])
            .separation((a, b) => (a.parent === b.parent ? 1 : 1.3));

        const root = d3.hierarchy(filteredRoot);
        const treeResult = treeLayout(root);

        const nodes = treeResult.descendants() as TreeNode[];
        const links = treeResult.links();

        // Store collapsed children reference
        nodes.forEach(node => {
            const originalNode = findNode(treeData, node.data.id);
            if (originalNode && !expandedNodes.has(node.data.id) && originalNode.children) {
                (node as any)._children = originalNode.children;
            }
        });

        return { nodes, links };
    }, [treeData, expandedNodes, findNode]);

    // Toggle node expansion
    const toggleNode = useCallback((nodeId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    }, []);

    // Handle wheel zoom
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setScale(prev => Math.min(Math.max(prev * delta, 0.2), 3));
    }, []);

    // Handle drag pan
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 0) {
            setIsDragging(true);
            dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        }
    }, [position]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y
            });
        }
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Reset view
    const handleReset = useCallback(() => {
        setScale(0.8);
        setPosition({ x: 0, y: 0 });
    }, []);

    // Toggle fullscreen
    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;
        if (!isFullscreen) {
            containerRef.current.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
        setIsFullscreen(!isFullscreen);
    }, [isFullscreen]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                setShowSearch(true);
            }
            if (e.key === 'Escape') {
                setShowSearch(false);
                setSelectedNode(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full" style={{ background: COLORS.bgFrom }}>
                <motion.div
                    className="flex flex-col items-center gap-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <motion.div
                        className="w-16 h-16 rounded-full"
                        style={{
                            background: `linear-gradient(135deg, ${COLORS.root.glow}, ${COLORS.company.glow})`,
                            boxShadow: `0 0 40px ${COLORS.root.glow}60`
                        }}
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 1, 0.5]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut'
                        }}
                    />
                    <div style={{ color: COLORS.textSecondary }}>
                        조직도를 불러오는 중...
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden"
            style={{ minHeight: '100vh' }}
        >
            {/* Aurora Background */}
            <AuroraBackground />

            {/* Top Bar */}
            <motion.div
                className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {/* Title */}
                <div className="flex items-center gap-4">
                    <motion.div
                        className="flex items-center gap-3 px-4 py-2 rounded-xl"
                        style={{
                            background: COLORS.glass,
                            border: `1px solid ${COLORS.glassBorder}`,
                            backdropFilter: 'blur(12px)'
                        }}
                    >
                        <FontAwesomeIcon icon={faStar} style={{ color: COLORS.root.icon }} />
                        <span className="font-bold text-lg" style={{ color: COLORS.textPrimary }}>
                            프리미엄 조직도
                        </span>
                    </motion.div>

                    {/* Stats */}
                    <StatsBar companies={companies} teams={teams} workers={workers} />
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    {/* Search Button */}
                    <motion.button
                        onClick={() => setShowSearch(true)}
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                            background: COLORS.glass,
                            border: `1px solid ${COLORS.glassBorder}`
                        }}
                        whileHover={{ scale: 1.05, background: COLORS.glassHover }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <FontAwesomeIcon icon={faSearch} style={{ color: COLORS.textMuted }} />
                    </motion.button>

                    {/* Fullscreen Button */}
                    <motion.button
                        onClick={toggleFullscreen}
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                            background: COLORS.glass,
                            border: `1px solid ${COLORS.glassBorder}`
                        }}
                        whileHover={{ scale: 1.05, background: COLORS.glassHover }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <FontAwesomeIcon
                            icon={isFullscreen ? faCompress : faExpand}
                            style={{ color: COLORS.textMuted }}
                        />
                    </motion.button>
                </div>
            </motion.div>

            {/* Instructions */}
            <motion.div
                className="absolute bottom-4 left-4 z-20 px-4 py-2 rounded-xl text-xs"
                style={{
                    background: COLORS.glass,
                    border: `1px solid ${COLORS.glassBorder}`,
                    backdropFilter: 'blur(12px)',
                    color: COLORS.textMuted
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <span className="font-medium" style={{ color: COLORS.textSecondary }}>드래그:</span> 이동 &nbsp;|&nbsp;
                <span className="font-medium" style={{ color: COLORS.textSecondary }}>스크롤:</span> 확대/축소 &nbsp;|&nbsp;
                <span className="font-medium" style={{ color: COLORS.textSecondary }}>클릭:</span> 상세보기 &nbsp;|&nbsp;
                <span className="font-medium" style={{ color: COLORS.textSecondary }}>더블클릭:</span> 펼침/접기
            </motion.div>

            {/* Zoom indicator */}
            <motion.div
                className="absolute bottom-4 right-4 z-20 px-3 py-1.5 rounded-lg text-xs font-mono"
                style={{
                    background: COLORS.glass,
                    border: `1px solid ${COLORS.glassBorder}`,
                    color: COLORS.textMuted
                }}
            >
                {Math.round(scale * 100)}%
            </motion.div>

            {/* SVG Canvas */}
            <svg
                ref={svgRef}
                className="w-full h-full"
                style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    position: 'relative',
                    zIndex: 10
                }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <g
                    transform={`translate(${position.x + (containerSize.width || 1200) / 2}, ${position.y + (containerSize.height || 800) * 0.35}) scale(${scale})`}
                >
                    {/* Connection Lines */}
                    <motion.g variants={containerVariants} initial="hidden" animate="visible">
                        {links.map((link, idx) => (
                            <ConnectionLine
                                key={`link-${idx}`}
                                source={{ x: link.source.x, y: link.source.y }}
                                target={{ x: link.target.x, y: link.target.y }}
                                sourceType={link.source.data.type}
                            />
                        ))}
                    </motion.g>

                    {/* Nodes */}
                    <motion.g variants={containerVariants} initial="hidden" animate="visible">
                        <AnimatePresence>
                            {nodes.map(node => (
                                <OrgNodeCard
                                    key={node.data.id}
                                    node={node}
                                    isExpanded={expandedNodes.has(node.data.id)}
                                    onToggle={() => toggleNode(node.data.id)}
                                    onSelect={() => setSelectedNode(node.data)}
                                    isSelected={selectedNode?.id === node.data.id}
                                />
                            ))}
                        </AnimatePresence>
                    </motion.g>
                </g>
            </svg>

            {/* Detail Panel */}
            <AnimatePresence>
                {selectedNode && (
                    <DetailPanel
                        node={selectedNode}
                        onClose={() => setSelectedNode(null)}
                        companies={companies}
                        teams={teams}
                        workers={workers}
                    />
                )}
            </AnimatePresence>

            {/* Search Overlay */}
            <AnimatePresence>
                {showSearch && (
                    <motion.div
                        className="absolute inset-0 z-50 flex items-start justify-center pt-32"
                        style={{ background: 'rgba(0,0,0,0.6)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowSearch(false)}
                    >
                        <motion.div
                            className="w-full max-w-lg p-1 rounded-2xl"
                            style={{
                                background: `linear-gradient(135deg, ${COLORS.root.glow}40, ${COLORS.company.glow}40)`,
                            }}
                            initial={{ scale: 0.9, y: -20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: -20 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div
                                className="rounded-xl overflow-hidden"
                                style={{
                                    background: COLORS.bgVia,
                                    backdropFilter: 'blur(20px)'
                                }}
                            >
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <FontAwesomeIcon icon={faSearch} style={{ color: COLORS.textMuted }} />
                                    <input
                                        type="text"
                                        placeholder="이름, 팀명, 회사명 검색..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        autoFocus
                                        className="flex-1 bg-transparent border-none outline-none text-lg"
                                        style={{ color: COLORS.textPrimary }}
                                    />
                                    <motion.button
                                        onClick={() => setShowSearch(false)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{ background: COLORS.glass }}
                                        whileHover={{ background: COLORS.glassHover }}
                                    >
                                        <FontAwesomeIcon icon={faTimes} style={{ color: COLORS.textMuted }} />
                                    </motion.button>
                                </div>

                                {/* Search Results */}
                                {searchTerm && (
                                    <div
                                        className="border-t max-h-80 overflow-y-auto"
                                        style={{ borderColor: COLORS.glassBorder }}
                                    >
                                        {/* Companies */}
                                        {companies
                                            .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .slice(0, 5)
                                            .map(company => (
                                                <div
                                                    key={company.id}
                                                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                                                    style={{ background: 'transparent' }}
                                                    onClick={() => {
                                                        setSelectedNode({
                                                            id: company.id!,
                                                            name: company.name,
                                                            type: 'company',
                                                            data: company
                                                        });
                                                        setShowSearch(false);
                                                    }}
                                                    onMouseEnter={e => {
                                                        (e.target as HTMLElement).style.background = COLORS.glassHover;
                                                    }}
                                                    onMouseLeave={e => {
                                                        (e.target as HTMLElement).style.background = 'transparent';
                                                    }}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                        style={{ background: COLORS.company.bg }}
                                                    >
                                                        <FontAwesomeIcon icon={faBuilding} style={{ color: COLORS.company.icon }} />
                                                    </div>
                                                    <div>
                                                        <div style={{ color: COLORS.textPrimary }}>{company.name}</div>
                                                        <div className="text-xs" style={{ color: COLORS.textMuted }}>{company.type}</div>
                                                    </div>
                                                </div>
                                            ))}

                                        {/* Teams */}
                                        {teams
                                            .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .slice(0, 5)
                                            .map(team => (
                                                <div
                                                    key={team.id}
                                                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                                                    onClick={() => {
                                                        setSelectedNode({
                                                            id: team.id!,
                                                            name: team.name,
                                                            type: 'team',
                                                            data: team
                                                        });
                                                        setShowSearch(false);
                                                    }}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                        style={{ background: COLORS.team.bg }}
                                                    >
                                                        <FontAwesomeIcon icon={faUsers} style={{ color: COLORS.team.icon }} />
                                                    </div>
                                                    <div>
                                                        <div style={{ color: COLORS.textPrimary }}>{team.name}</div>
                                                        <div className="text-xs" style={{ color: COLORS.textMuted }}>{team.leaderName}</div>
                                                    </div>
                                                </div>
                                            ))}

                                        {/* Workers */}
                                        {workers
                                            .filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .slice(0, 5)
                                            .map(worker => (
                                                <div
                                                    key={worker.id}
                                                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                                                    onClick={() => {
                                                        setSelectedNode({
                                                            id: worker.id!,
                                                            name: worker.name,
                                                            type: 'worker',
                                                            data: worker
                                                        });
                                                        setShowSearch(false);
                                                    }}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                        style={{ background: COLORS.worker.bg }}
                                                    >
                                                        <FontAwesomeIcon icon={faUser} style={{ color: COLORS.worker.icon }} />
                                                    </div>
                                                    <div>
                                                        <div style={{ color: COLORS.textPrimary }}>{worker.name}</div>
                                                        <div className="text-xs" style={{ color: COLORS.textMuted }}>{worker.role}</div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PremiumOrgChart;
