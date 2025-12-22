import React from 'react';
import './SidebarSkeleton.css'; // We'll need some CSS for the skeleton animation

const SidebarSkeleton: React.FC = () => {
    return (
        <nav id="sidebar" className="sidebar-skeleton">
            <div className="sidebar-header">
                {/* Logo Skeleton */}
                <div className="skeleton-logo-group">
                    <div className="skeleton-icon pulse"></div>
                    <div className="skeleton-text pulse"></div>
                </div>
            </div>
            <div className="menu-list-wrapper">
                <ul className="menu-list" style={{ paddingBottom: '20px' }}>
                    {/* Generate some skeleton items */}
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                        <li key={item} className="menu-item-skeleton">
                            <div className="skeleton-menu-btn">
                                <div className="skeleton-menu-icon pulse"></div>
                                <div className="skeleton-menu-text pulse"></div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
};

export default SidebarSkeleton;
