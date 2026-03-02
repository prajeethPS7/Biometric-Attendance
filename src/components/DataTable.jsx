import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * DataTable Component
 * Reusable sortable/paginated table for attendance and employee data
 */
export default function DataTable({
    columns = [],
    data = [],
    totalCount = 0,
    page = 1,
    pageSize = 20,
    onPageChange,
    loading = false,
    emptyMessage = 'No data found',
    emptyIcon: EmptyIcon,
}) {
    const [sortColumn, setSortColumn] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');

    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    const handleSort = (columnKey) => {
        if (sortColumn === columnKey) {
            setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortColumn(columnKey);
            setSortDirection('asc');
        }
    };

    const sortedData = [...data].sort((a, b) => {
        if (!sortColumn) return 0;
        const aVal = a[sortColumn] ?? '';
        const bVal = b[sortColumn] ?? '';
        const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    return (
        <div className="w-full">
            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-surface-700/50">
                <table className="data-table">
                    <thead>
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    onClick={() => col.sortable !== false && handleSort(col.key)}
                                    className={col.sortable !== false ? 'cursor-pointer select-none hover:text-surface-200' : ''}
                                    style={{ width: col.width || 'auto' }}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.label}
                                        {sortColumn === col.key && (
                                            <span className="text-primary-400 text-[10px]">
                                                {sortDirection === 'asc' ? '▲' : '▼'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            // Loading skeleton rows
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={`skeleton-${i}`}>
                                    {columns.map((col) => (
                                        <td key={col.key}>
                                            <div className="skeleton h-4 w-3/4 rounded" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : sortedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length}>
                                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                                        {EmptyIcon && <EmptyIcon className="w-12 h-12 text-surface-600" />}
                                        <p className="text-surface-500 text-sm">{emptyMessage}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            sortedData.map((row, i) => (
                                <tr key={row.id || i} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                                    {columns.map((col) => (
                                        <td key={col.key}>
                                            {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalCount > pageSize && (
                <div className="flex items-center justify-between mt-4 px-2">
                    <p className="text-sm text-surface-500">
                        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of{' '}
                        {totalCount}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onPageChange?.(page - 1)}
                            disabled={page <= 1}
                            className="p-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-surface-400 min-w-[80px] text-center">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            onClick={() => onPageChange?.(page + 1)}
                            disabled={page >= totalPages}
                            className="p-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
