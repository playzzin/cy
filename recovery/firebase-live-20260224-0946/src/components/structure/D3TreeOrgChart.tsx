import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faUsers, faUser, faExpand, faCompress, faRedo
} from '@fortawesome/free-solid-svg-icons';

// Types
export interface OrgNode {
    id: string;
    name: string;
    type: 'root' | 'company' | 'team' | 'worker';
    role?: string;
    count?: number;
    children?: OrgNode[];
}

interface D3TreeOrgChartProps {
    data: OrgNode;
    width?: number;
    height?: number;
}

// Color mapping by node type
const nodeColors: Record<string, { bg: string; border: string; text: string }> = {
    root: { bg: '#1e1b4b', border: '#4338ca', text: '#ffffff' },
    company: { bg: '#1e40af', border: '#3b82f6', text: '#ffffff' },
    team: { bg: '#047857', border: '#10b981', text: '#ffffff' },
    worker: { bg: '#f8fafc', border: '#cbd5e1', text: '#334155' },
};

const D3TreeOrgChart: React.FC<D3TreeOrgChartProps> = ({ data, width = 1200, height = 800 }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!svgRef.current || !data) return;

        // Clear previous content
        d3.select(svgRef.current).selectAll('*').remove();

        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height);

        // Create zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Create main group for transformations
        const g = svg.append('g')
            .attr('transform', `translate(${width / 2}, 60)`);

        // Create tree layout (top-to-bottom)
        const treeLayout = d3.tree<OrgNode>()
            .nodeSize([180, 120])
            .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));

        // Create hierarchy from data
        const root = d3.hierarchy(data);

        // Apply tree layout
        const treeData = treeLayout(root);

        // Draw links (curved paths)
        const linkGenerator = d3.linkVertical<d3.HierarchyPointLink<OrgNode>, d3.HierarchyPointNode<OrgNode>>()
            .x(d => d.x)
            .y(d => d.y);

        g.selectAll('.link')
            .data(treeData.links())
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', linkGenerator as any)
            .attr('fill', 'none')
            .attr('stroke', '#94a3b8')
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);

        // Create node groups
        const nodes = g.selectAll('.node')
            .data(treeData.descendants())
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);

        // Draw node rectangles with rounded corners
        nodes.append('rect')
            .attr('x', -70)
            .attr('y', -25)
            .attr('width', 140)
            .attr('height', 50)
            .attr('rx', 8)
            .attr('ry', 8)
            .attr('fill', d => nodeColors[d.data.type]?.bg || '#f1f5f9')
            .attr('stroke', d => nodeColors[d.data.type]?.border || '#e2e8f0')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

        // Add icon based on node type
        nodes.append('text')
            .attr('x', -55)
            .attr('y', 5)
            .attr('font-family', 'FontAwesome')
            .attr('font-size', '14px')
            .attr('fill', d => nodeColors[d.data.type]?.text || '#334155')
            .text(d => {
                switch (d.data.type) {
                    case 'root': return '\uf1ad'; // fa-building
                    case 'company': return '\uf1ad'; // fa-building
                    case 'team': return '\uf0c0'; // fa-users
                    case 'worker': return '\uf007'; // fa-user
                    default: return '\uf111'; // fa-circle
                }
            });

        // Add node name text
        nodes.append('text')
            .attr('x', -35)
            .attr('y', -2)
            .attr('font-size', d => d.data.type === 'worker' ? '11px' : '13px')
            .attr('font-weight', d => d.data.type === 'worker' ? 'normal' : 'bold')
            .attr('fill', d => nodeColors[d.data.type]?.text || '#334155')
            .text(d => {
                const name = d.data.name;
                return name.length > 10 ? name.substring(0, 10) + '...' : name;
            });

        // Add role/count info
        nodes.append('text')
            .attr('x', -35)
            .attr('y', 14)
            .attr('font-size', '10px')
            .attr('fill', d => {
                const color = nodeColors[d.data.type]?.text || '#64748b';
                return d.data.type === 'worker' ? '#64748b' : color;
            })
            .attr('opacity', 0.8)
            .text(d => {
                if (d.data.role) return d.data.role;
                if (d.data.count !== undefined) return `${d.data.count}명`;
                if (d.data.children) return `${d.data.children.length}개`;
                return '';
            });

        // Add hover effect
        nodes.on('mouseover', function () {
            d3.select(this).select('rect')
                .transition()
                .duration(200)
                .attr('stroke-width', 3)
                .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))');
        }).on('mouseout', function () {
            d3.select(this).select('rect')
                .transition()
                .duration(200)
                .attr('stroke-width', 2)
                .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');
        });

        // Initial zoom to fit
        const bounds = g.node()?.getBBox();
        if (bounds) {
            const scale = Math.min(
                width / (bounds.width + 100),
                height / (bounds.height + 100),
                1
            );
            const tx = width / 2 - (bounds.x + bounds.width / 2) * scale;
            const ty = 60 - bounds.y * scale;

            svg.call(
                zoom.transform,
                d3.zoomIdentity.translate(tx, ty).scale(scale)
            );
        }

    }, [data, width, height]);

    const handleReset = () => {
        if (!svgRef.current) return;
        const svg = d3.select(svgRef.current);
        svg.transition()
            .duration(500)
            .call(
                d3.zoom<SVGSVGElement, unknown>().transform as any,
                d3.zoomIdentity.translate(width / 2, 60).scale(0.8)
            );
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
        <div ref={containerRef} className="relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            {/* Toolbar */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button
                    onClick={handleReset}
                    className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
                    title="뷰 초기화"
                >
                    <FontAwesomeIcon icon={faRedo} className="text-slate-600" />
                </button>
                <button
                    onClick={toggleFullscreen}
                    className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
                    title={isFullscreen ? '전체화면 종료' : '전체화면'}
                >
                    <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} className="text-slate-600" />
                </button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm border border-slate-200">
                <div className="text-xs font-bold text-slate-600 mb-2">범례</div>
                <div className="flex flex-wrap gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: nodeColors.root.bg }}></div>
                        <span>청연SITE</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: nodeColors.company.bg }}></div>
                        <span>회사</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: nodeColors.team.bg }}></div>
                        <span>팀</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded border" style={{ backgroundColor: nodeColors.worker.bg, borderColor: nodeColors.worker.border }}></div>
                        <span>근로자</span>
                    </div>
                </div>
            </div>

            {/* Instructions */}
            <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-slate-200">
                <div className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">마우스 드래그:</span> 이동 &nbsp;|&nbsp;
                    <span className="font-medium text-slate-700">스크롤:</span> 확대/축소
                </div>
            </div>

            {/* D3 SVG Canvas */}
            <svg ref={svgRef} className="w-full" style={{ minHeight: height }} />
        </div>
    );
};

export default D3TreeOrgChart;
