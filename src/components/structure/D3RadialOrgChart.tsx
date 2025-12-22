import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faExpand, faCompress, faRedo, faSearchPlus, faSearchMinus
} from '@fortawesome/free-solid-svg-icons';

// ============================================================================
// TYPES
// ============================================================================
export interface RadialOrgNode {
    id: string;
    name: string;
    type: 'root' | 'company' | 'team' | 'worker';
    role?: string;
    count?: number;
    children?: RadialOrgNode[];
}

interface D3RadialOrgChartProps {
    data: RadialOrgNode;
    width?: number;
    height?: number;
}

interface HierarchyNodeWithCollapse extends d3.HierarchyPointNode<RadialOrgNode> {
    _children?: HierarchyNodeWithCollapse[];
}

// ============================================================================
// DESIGN SYSTEM
// ============================================================================
const COLORS = {
    root: { bg: '#7c3aed', border: '#8b5cf6', text: '#ffffff', glow: 'rgba(139, 92, 246, 0.6)' },
    company: { bg: '#2563eb', border: '#3b82f6', text: '#ffffff', glow: 'rgba(59, 130, 246, 0.5)' },
    team: { bg: '#059669', border: '#10b981', text: '#ffffff', glow: 'rgba(16, 185, 129, 0.5)' },
    worker: { bg: '#f8fafc', border: '#94a3b8', text: '#334155', glow: 'rgba(148, 163, 184, 0.3)' },
};

const LINK_COLORS = {
    default: '#cbd5e1',
    highlighted: '#8b5cf6',
};

// ============================================================================
// COMPONENT
// ============================================================================
const D3RadialOrgChart: React.FC<D3RadialOrgChartProps> = ({
    data,
    width = 1000,
    height = 800
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    // Get node color scheme
    const getNodeColors = useCallback((type: string) => {
        return COLORS[type as keyof typeof COLORS] || COLORS.worker;
    }, []);

    // Get all ancestor IDs of a node
    const getAncestorIds = useCallback((node: HierarchyNodeWithCollapse): string[] => {
        const ancestors: string[] = [];
        let current = node.parent;
        while (current) {
            ancestors.push(current.data.id);
            current = current.parent;
        }
        return ancestors;
    }, []);

    // Get all descendant IDs of a node
    const getDescendantIds = useCallback((node: HierarchyNodeWithCollapse): string[] => {
        const descendants: string[] = [];
        const traverse = (n: HierarchyNodeWithCollapse) => {
            if (n.children) {
                n.children.forEach(child => {
                    descendants.push(child.data.id);
                    traverse(child);
                });
            }
        };
        traverse(node);
        return descendants;
    }, []);

    // Filter data based on collapsed nodes
    const filterData = useCallback((node: RadialOrgNode): RadialOrgNode => {
        if (collapsedNodes.has(node.id)) {
            return { ...node, children: undefined };
        }
        if (node.children) {
            return {
                ...node,
                children: node.children.map(child => filterData(child))
            };
        }
        return node;
    }, [collapsedNodes]);

    // Toggle node collapse
    const toggleCollapse = useCallback((nodeId: string) => {
        setCollapsedNodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(nodeId)) {
                newSet.delete(nodeId);
            } else {
                newSet.add(nodeId);
            }
            return newSet;
        });
    }, []);

    // Main rendering effect
    useEffect(() => {
        if (!svgRef.current || !data) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 120;

        // Create defs for gradients and filters
        const defs = svg.append('defs');

        // Glow filter
        const glowFilter = defs.append('filter')
            .attr('id', 'glow')
            .attr('x', '-50%')
            .attr('y', '-50%')
            .attr('width', '200%')
            .attr('height', '200%');

        glowFilter.append('feGaussianBlur')
            .attr('stdDeviation', '3')
            .attr('result', 'coloredBlur');

        const feMerge = glowFilter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        // Background gradient
        const bgGradient = defs.append('radialGradient')
            .attr('id', 'bgGradient')
            .attr('cx', '50%')
            .attr('cy', '50%')
            .attr('r', '50%');

        bgGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#1e1b4b')
            .attr('stop-opacity', 0.1);

        bgGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#0f172a')
            .attr('stop-opacity', 0.05);

        // Background
        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'url(#bgGradient)');

        // Decorative circles
        const circleGroup = svg.append('g')
            .attr('transform', `translate(${centerX}, ${centerY})`);

        [0.3, 0.5, 0.7, 0.9].forEach((scale, i) => {
            circleGroup.append('circle')
                .attr('r', radius * scale)
                .attr('fill', 'none')
                .attr('stroke', '#e2e8f0')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', i % 2 === 0 ? '4,4' : 'none')
                .attr('opacity', 0.3);
        });

        // Main group for zoom
        const g = svg.append('g')
            .attr('transform', `translate(${centerX}, ${centerY})`);
        gRef.current = g;

        // Zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.3, 3])
            .on('zoom', (event) => {
                g.attr('transform', `translate(${centerX + event.transform.x}, ${centerY + event.transform.y}) scale(${event.transform.k})`);
                circleGroup.attr('transform', `translate(${centerX + event.transform.x}, ${centerY + event.transform.y}) scale(${event.transform.k})`);
            });

        svg.call(zoom);
        zoomRef.current = zoom;

        // Filter and create hierarchy
        const filteredData = filterData(data);
        const root = d3.hierarchy(filteredData) as HierarchyNodeWithCollapse;

        // Tree layout
        const treeLayout = d3.tree<RadialOrgNode>()
            .size([2 * Math.PI, radius])
            .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

        const treeData = treeLayout(root);

        // Radial link generator
        const linkGenerator = d3.linkRadial<d3.HierarchyPointLink<RadialOrgNode>, d3.HierarchyPointNode<RadialOrgNode>>()
            .angle(d => d.x)
            .radius(d => d.y);

        // Draw links
        const links = g.append('g')
            .attr('class', 'links')
            .selectAll('path')
            .data(treeData.links())
            .enter()
            .append('path')
            .attr('d', linkGenerator as any)
            .attr('fill', 'none')
            .attr('stroke', LINK_COLORS.default)
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6)
            .attr('data-source', d => d.source.data.id)
            .attr('data-target', d => d.target.data.id);

        // Animate links
        links.each(function () {
            const path = d3.select(this);
            const totalLength = (this as SVGPathElement).getTotalLength();
            path
                .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
                .attr('stroke-dashoffset', totalLength)
                .transition()
                .duration(1000)
                .ease(d3.easeQuadOut)
                .attr('stroke-dashoffset', 0);
        });

        // Draw nodes
        const nodes = g.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(treeData.descendants())
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => {
                const [x, y] = d3.pointRadial(d.x, d.y);
                return `translate(${x}, ${y})`;
            })
            .style('cursor', 'pointer')
            .on('click', function (event, d) {
                event.stopPropagation();
                const nodeData = d as HierarchyNodeWithCollapse;
                if (nodeData.children || collapsedNodes.has(nodeData.data.id)) {
                    toggleCollapse(nodeData.data.id);
                }
            })
            .on('mouseenter', function (event, d) {
                const nodeData = d as HierarchyNodeWithCollapse;
                setHoveredNodeId(nodeData.data.id);

                // Get related IDs
                const ancestorIds = getAncestorIds(nodeData);
                const descendantIds = getDescendantIds(nodeData);
                const relatedIds = new Set([nodeData.data.id, ...ancestorIds, ...descendantIds]);

                // Highlight related links
                g.selectAll('.links path')
                    .transition()
                    .duration(200)
                    .attr('stroke', function () {
                        const source = d3.select(this).attr('data-source');
                        const target = d3.select(this).attr('data-target');
                        if (relatedIds.has(source) && relatedIds.has(target)) {
                            return LINK_COLORS.highlighted;
                        }
                        return LINK_COLORS.default;
                    })
                    .attr('stroke-width', function () {
                        const source = d3.select(this).attr('data-source');
                        const target = d3.select(this).attr('data-target');
                        if (relatedIds.has(source) && relatedIds.has(target)) {
                            return 3;
                        }
                        return 2;
                    })
                    .attr('stroke-opacity', function () {
                        const source = d3.select(this).attr('data-source');
                        const target = d3.select(this).attr('data-target');
                        if (relatedIds.has(source) && relatedIds.has(target)) {
                            return 1;
                        }
                        return 0.2;
                    });

                // Highlight related nodes
                g.selectAll('.nodes .node')
                    .each(function (n) {
                        const nodeData = n as HierarchyNodeWithCollapse;
                        d3.select(this)
                            .transition()
                            .duration(200)
                            .attr('opacity', relatedIds.has(nodeData.data.id) ? 1 : 0.3);
                    });
            })
            .on('mouseleave', function () {
                setHoveredNodeId(null);

                // Reset links
                g.selectAll('.links path')
                    .transition()
                    .duration(200)
                    .attr('stroke', LINK_COLORS.default)
                    .attr('stroke-width', 2)
                    .attr('stroke-opacity', 0.6);

                // Reset nodes
                g.selectAll('.nodes .node')
                    .transition()
                    .duration(200)
                    .attr('opacity', 1);
            });

        // Node circles/shapes
        nodes.each(function (d) {
            const node = d3.select(this);
            const nodeData = d.data;
            const colors = getNodeColors(nodeData.type);
            const isRoot = nodeData.type === 'root';
            const isWorker = nodeData.type === 'worker';
            const hasChildren = d.children || collapsedNodes.has(nodeData.id);
            const isCollapsed = collapsedNodes.has(nodeData.id);

            // Node size
            const nodeWidth = isRoot ? 100 : isWorker ? 70 : 85;
            const nodeHeight = isRoot ? 100 : isWorker ? 35 : 45;

            if (isRoot) {
                // Root: Circle
                node.append('circle')
                    .attr('r', 0)
                    .attr('fill', colors.bg)
                    .attr('stroke', colors.border)
                    .attr('stroke-width', 3)
                    .attr('filter', 'url(#glow)')
                    .transition()
                    .duration(500)
                    .ease(d3.easeElastic)
                    .attr('r', nodeWidth / 2);
            } else {
                // Others: Rounded rect
                node.append('rect')
                    .attr('x', -nodeWidth / 2)
                    .attr('y', -nodeHeight / 2)
                    .attr('width', nodeWidth)
                    .attr('height', nodeHeight)
                    .attr('rx', isWorker ? 6 : 10)
                    .attr('ry', isWorker ? 6 : 10)
                    .attr('fill', colors.bg)
                    .attr('stroke', colors.border)
                    .attr('stroke-width', 2)
                    .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
                    .attr('transform', 'scale(0)')
                    .transition()
                    .duration(400)
                    .ease(d3.easeBackOut)
                    .attr('transform', 'scale(1)');
            }

            // Node name
            node.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', isRoot ? 4 : (isWorker ? 4 : 0))
                .attr('font-size', isRoot ? 14 : isWorker ? 10 : 11)
                .attr('font-weight', isWorker ? 'normal' : 'bold')
                .attr('fill', colors.text)
                .text(nodeData.name.length > 8 ? nodeData.name.slice(0, 8) + '...' : nodeData.name)
                .style('pointer-events', 'none')
                .attr('opacity', 0)
                .transition()
                .delay(300)
                .duration(300)
                .attr('opacity', 1);

            // Subtitle (role or count)
            if (!isRoot && !isWorker) {
                const subtitle = nodeData.count !== undefined
                    ? `${nodeData.count}명`
                    : nodeData.role || '';

                if (subtitle) {
                    node.append('text')
                        .attr('text-anchor', 'middle')
                        .attr('dy', 14)
                        .attr('font-size', 9)
                        .attr('fill', colors.text)
                        .attr('opacity', 0.8)
                        .text(subtitle)
                        .style('pointer-events', 'none');
                }
            }

            // Collapse indicator
            if (hasChildren && !isRoot) {
                node.append('circle')
                    .attr('cx', nodeWidth / 2 - 5)
                    .attr('cy', -nodeHeight / 2 + 5)
                    .attr('r', 8)
                    .attr('fill', isCollapsed ? '#f59e0b' : '#10b981')
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 2);

                node.append('text')
                    .attr('x', nodeWidth / 2 - 5)
                    .attr('y', -nodeHeight / 2 + 9)
                    .attr('text-anchor', 'middle')
                    .attr('font-size', 10)
                    .attr('font-weight', 'bold')
                    .attr('fill', '#fff')
                    .text(isCollapsed ? '+' : '−')
                    .style('pointer-events', 'none');
            }
        });

        // Initial fit
        const bounds = g.node()?.getBBox();
        if (bounds) {
            const scale = Math.min(
                (width - 80) / (bounds.width || 1),
                (height - 80) / (bounds.height || 1),
                1.2
            );
            svg.call(
                zoom.transform,
                d3.zoomIdentity.scale(scale * 0.85)
            );
        }

    }, [data, width, height, collapsedNodes, filterData, getNodeColors, getAncestorIds, getDescendantIds, toggleCollapse]);

    // Zoom controls
    const handleZoomIn = () => {
        if (svgRef.current && zoomRef.current) {
            d3.select(svgRef.current)
                .transition()
                .duration(300)
                .call(zoomRef.current.scaleBy, 1.3);
        }
    };

    const handleZoomOut = () => {
        if (svgRef.current && zoomRef.current) {
            d3.select(svgRef.current)
                .transition()
                .duration(300)
                .call(zoomRef.current.scaleBy, 0.7);
        }
    };

    const handleReset = () => {
        if (svgRef.current && zoomRef.current) {
            d3.select(svgRef.current)
                .transition()
                .duration(500)
                .call(zoomRef.current.transform, d3.zoomIdentity.scale(0.85));
        }
        setCollapsedNodes(new Set());
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!isFullscreen) {
            containerRef.current.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
        setIsFullscreen(!isFullscreen);
    };

    return (
        <div
            ref={containerRef}
            className="relative rounded-2xl overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)'
            }}
        >
            {/* Animated background particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full animate-pulse"
                        style={{
                            width: Math.random() * 4 + 2,
                            height: Math.random() * 4 + 2,
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            background: `rgba(139, 92, 246, ${Math.random() * 0.3 + 0.1})`,
                            animationDelay: `${Math.random() * 3}s`,
                            animationDuration: `${Math.random() * 3 + 2}s`
                        }}
                    />
                ))}
            </div>

            {/* Toolbar */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button
                    onClick={handleZoomIn}
                    className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-200 group"
                    title="확대"
                >
                    <FontAwesomeIcon icon={faSearchPlus} className="text-white/80 group-hover:text-white" />
                </button>
                <button
                    onClick={handleZoomOut}
                    className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-200 group"
                    title="축소"
                >
                    <FontAwesomeIcon icon={faSearchMinus} className="text-white/80 group-hover:text-white" />
                </button>
                <button
                    onClick={handleReset}
                    className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-200 group"
                    title="초기화"
                >
                    <FontAwesomeIcon icon={faRedo} className="text-white/80 group-hover:text-white" />
                </button>
                <button
                    onClick={toggleFullscreen}
                    className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-200 group"
                    title={isFullscreen ? '전체화면 종료' : '전체화면'}
                >
                    <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} className="text-white/80 group-hover:text-white" />
                </button>
            </div>

            {/* Instructions */}
            <div className="absolute top-4 left-4 z-10 bg-white/10 backdrop-blur-md rounded-xl px-4 py-2.5 border border-white/20">
                <div className="text-xs text-white/70 flex items-center gap-4">
                    <span><span className="font-semibold text-white/90">드래그:</span> 이동</span>
                    <span><span className="font-semibold text-white/90">스크롤:</span> 확대/축소</span>
                    <span><span className="font-semibold text-white/90">클릭:</span> 접기/펼치기</span>
                </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-10 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="text-xs font-bold text-white/90 mb-3">범례</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    {[
                        { type: 'root', label: '청연' },
                        { type: 'company', label: '회사' },
                        { type: 'team', label: '팀' },
                        { type: 'worker', label: '근로자' },
                    ].map(item => (
                        <div key={item.type} className="flex items-center gap-2">
                            <div
                                className="w-4 h-4 rounded"
                                style={{
                                    backgroundColor: COLORS[item.type as keyof typeof COLORS].bg,
                                    border: `2px solid ${COLORS[item.type as keyof typeof COLORS].border}`
                                }}
                            />
                            <span className="text-white/80">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className="absolute bottom-4 right-4 z-10 bg-white/10 backdrop-blur-md rounded-xl px-4 py-2.5 border border-white/20">
                <div className="text-xs text-white/70">
                    {collapsedNodes.size > 0 && (
                        <span className="text-amber-400 font-medium">
                            {collapsedNodes.size}개 노드 접힘
                        </span>
                    )}
                </div>
            </div>

            {/* SVG Canvas */}
            <svg
                ref={svgRef}
                width={width}
                height={height}
                className="w-full"
                style={{ minHeight: height }}
            />
        </div>
    );
};

export default D3RadialOrgChart;
