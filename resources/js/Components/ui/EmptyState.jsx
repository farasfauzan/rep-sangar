import Button from './Button';

export default function EmptyState({
    icon,
    message = 'No data found',
    actionLabel,
    onAction,
    className = '',
}) {
    return (
        <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
            {icon && (
                <div className="mb-4 text-gray-300">
                    {icon}
                </div>
            )}
            <p className="text-sm text-gray-500 mb-4 max-w-sm">{message}</p>
            {actionLabel && onAction && (
                <Button variant="primary" onClick={onAction}>
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}
