import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface ColumnDefinition {
    key: string;
    label: string;
}

export const useColumnSettings = (
    storageKeyId: string,
    allColumns: ColumnDefinition[]
) => {
    const { currentUser } = useAuth();
    const [visibleColumns, setVisibleColumns] = useState<string[]>(allColumns.map(c => c.key));
    const [columnOrder, setColumnOrder] = useState<string[]>(allColumns.map(c => c.key));
    const [showColumnSettings, setShowColumnSettings] = useState(false);

    // Load settings on mount or user change
    useEffect(() => {
        if (currentUser) {
            const visibleKey = `column_settings_${storageKeyId}_${currentUser.uid}`;
            const orderKey = `column_order_${storageKeyId}_${currentUser.uid}`;

            const savedVisible = localStorage.getItem(visibleKey);
            const savedOrder = localStorage.getItem(orderKey);

            if (savedVisible) {
                try {
                    setVisibleColumns(JSON.parse(savedVisible));
                } catch (e) {
                    console.error("Failed to parse column settings", e);
                    setVisibleColumns(allColumns.map(c => c.key));
                }
            } else {
                setVisibleColumns(allColumns.map(c => c.key));
            }

            if (savedOrder) {
                try {
                    const order = JSON.parse(savedOrder);
                    const allKeys = allColumns.map(c => c.key);

                    // Deduplicate and filter valid keys only
                    const validOrder = [...new Set(order as string[])].filter((k) => allKeys.includes(k));

                    // Append missing keys
                    allKeys.forEach(k => {
                        if (!validOrder.includes(k)) validOrder.push(k as string);
                    });

                    setColumnOrder(validOrder as string[]);
                } catch (e) {
                    console.error("Failed to parse column order", e);
                    setColumnOrder(allColumns.map(c => c.key));
                }
            } else {
                setColumnOrder(allColumns.map(c => c.key));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.uid, storageKeyId]);

    // Save visible columns on change
    useEffect(() => {
        if (currentUser) {
            const key = `column_settings_${storageKeyId}_${currentUser.uid}`;
            localStorage.setItem(key, JSON.stringify(visibleColumns));
        }
    }, [visibleColumns, currentUser?.uid, storageKeyId]);

    // Save column order on change
    useEffect(() => {
        if (currentUser) {
            const key = `column_order_${storageKeyId}_${currentUser.uid}`;
            localStorage.setItem(key, JSON.stringify(columnOrder));
        }
    }, [columnOrder, currentUser?.uid, storageKeyId]);

    const toggleColumn = (key: string) => {
        setVisibleColumns(prev =>
            prev.includes(key)
                ? prev.filter(k => k !== key)
                : [...prev, key]
        );
    };

    // 열 순서 변경 (from -> to 인덱스)
    const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
        setColumnOrder(prev => {
            const newOrder = [...prev];
            const [removed] = newOrder.splice(fromIndex, 1);
            newOrder.splice(toIndex, 0, removed);
            return newOrder;
        });
    }, []);

    // 전체 순서 재설정
    const reorderColumns = useCallback((newOrder: string[]) => {
        setColumnOrder(newOrder);
    }, []);

    const resetColumns = () => {
        setVisibleColumns(allColumns.map(c => c.key));
        setColumnOrder(allColumns.map(c => c.key));
    };

    // 순서대로 정렬된 열 반환 (표시될 열만)
    const getOrderedColumns = useCallback(() => {
        return columnOrder.filter(key => visibleColumns.includes(key));
    }, [columnOrder, visibleColumns]);

    return {
        visibleColumns,
        setVisibleColumns,
        columnOrder,
        setColumnOrder,
        toggleColumn,
        moveColumn,
        reorderColumns,
        getOrderedColumns,
        showColumnSettings,
        setShowColumnSettings,
        resetColumns
    };
};
