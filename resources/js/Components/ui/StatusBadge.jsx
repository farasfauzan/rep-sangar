const defaultColorMap = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    paid: 'bg-blue-100 text-blue-800',
    active: 'bg-emerald-100 text-emerald-800',
    inactive: 'bg-gray-100 text-gray-600',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    processing: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
};

export default function StatusBadge({
    status,
    colorMap = {},
    className = '',
}) {
    const mergedMap = { ...defaultColorMap, ...colorMap };
    const colors = mergedMap[status?.toLowerCase()] || 'bg-gray-100 text-gray-700';

    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colors} ${className}`}
        >
            {status}
        </span>
    );
}
