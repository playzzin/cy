import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { MenuItem } from '../../../types/menu';
import { MenuTreeItem, MenuTreeItemProps } from './MenuTreeItem';

// Define the props required by MenuTree, inheriting handlers from MenuTreeItemProps
// We exclude item-specific props (id, item, depth) as they are determined during recursion
type MenuTreeHandlers = Omit<MenuTreeItemProps, 'id' | 'item' | 'depth' | 'isSelected' | 'isCollapsed'>;

interface MenuTreeProps extends MenuTreeHandlers {
    items: MenuItem[];
    selectedItemId: string | null;
    collapsedItems: Set<string>;
}

export const MenuTree: React.FC<MenuTreeProps> = ({
    items,
    selectedItemId,
    collapsedItems,
    ...handlers // Pass through all handlers (onRemove, onRename, etc.)
}) => {

    const renderItems = (currentItems: MenuItem[], depth = 0) => {
        return currentItems.map((item) => (
            <React.Fragment key={item.id}>
                <MenuTreeItem
                    id={item.id!}
                    item={item}
                    depth={depth}
                    isSelected={selectedItemId === item.id}
                    isCollapsed={collapsedItems.has(item.id!)}
                    {...handlers}
                />

                {item.sub && item.sub.length > 0 && !collapsedItems.has(item.id!) && (
                    <SortableContext
                        items={(item.sub as MenuItem[]).map(i => i.id!)}
                        strategy={verticalListSortingStrategy}
                    >
                        {renderItems(item.sub as MenuItem[], depth + 1)}
                    </SortableContext>
                )}
            </React.Fragment>
        ));
    };

    return (
        <React.Fragment>
            {renderItems(items)}
        </React.Fragment>
    );
};
