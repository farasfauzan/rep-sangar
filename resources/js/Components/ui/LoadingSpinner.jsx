export default function LoadingSpinner({
    message,
    size = 'md',
    className = '',
}) {
    const sizeMap = {
        sm: 'w-5 h-5',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status">
            <svg
                className={`animate-spin text-indigo-600 ${sizeMap[size] || sizeMap.md}`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                />
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
            </svg>
            {message && (
                <p className="text-sm text-gray-500">{message}</p>
            )}
            <span className="sr-only">{message || 'Loading...'}</span>
        </div>
    );
}
