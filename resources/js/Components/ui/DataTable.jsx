import LoadingSpinner from './LoadingSpinner';

export default function DataTable({
    columns = [],
    data = [],
    onSort,
    sortKey,
    sortDirection = 'asc',
    emptyMessage = 'No data available',
    loading = false,
    className = '',
}) {
    const handleSort = (key) => {
        if (!onSort) return;
        const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
        onSort(key, newDirection);
    };

    const renderSortIcon = (key, sortable) => {
        if (!sortable) return null;
        const isActive = sortKey === key;
        return (
            <span className="ml-1 inline-flex flex-col" aria-hidden="true">
                <svg
                    className={`w-3 h-3 ${isActive && sortDirection === 'asc' ? 'text-indigo-600' : 'text-gray-300'}`}
                    viewBox="0 0 10 5"
                    fill="currentColor"
                >
                    <path d="M5 0L10 5H0z" />
                </svg>
                <svg
                    className={`w-3 h-3 -mt-1 ${isActive && sortDirection === 'desc' ? 'text-indigo-600' : 'text-gray-300'}`}
                    viewBox="0 0 10 5"
                    fill="currentColor"
                >
                    <path d="M5 5L0 0h10z" />
                </svg>
            </span>
        );
    };

    return (
        <div className={`overflow-x-auto ${className}`}>
            <table className="min-w-full divide-y divide-gray-200" role="table">
                <thead className="bg-gray-50">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                scope="col"
                                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                className={`
                                    px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider
                                    ${col.sortable ? 'cursor-pointer select-none hover:text-gray-700' : ''}
                                    ${col.headerClassName || ''}
                                `}
                                aria-sort={
                                    sortKey === col.key
                                        ? sortDirection === 'asc'
                                            ? 'ascending'
                                            : 'descending'
                                        : col.sortable
                                          ? 'none'
                                          : undefined
                                }
                            >
                                <span className="flex items-center">
                                    {col.label}
                                    {renderSortIcon(col.key, col.sortable)}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="px-6 py-12 text-center"
                            >
                                <LoadingSpinner message="Loading data..." />
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="px-6 py-12 text-center text-sm text-gray-500"
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, rowIndex) => (
                            <tr
                                key={row.id || rowIndex}
                                className="hover:bg-gray-50 transition-colors"
                            >
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        className={`px-6 py-4 whitespace-nowrap text-sm text-gray-700 ${col.className || ''}`}
                                    >
                                        {col.render
                                            ? col.render(row[col.key], row, rowIndex)
                                            : row[col.key] ?? '—'}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
