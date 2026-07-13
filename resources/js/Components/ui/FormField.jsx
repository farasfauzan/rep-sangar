export default function FormField({
    label,
    error,
    required = false,
    className = '',
    children,
}) {
    return (
        <div className={className}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                    {required && (
                        <span className="text-red-500 ml-0.5" aria-hidden="true">
                            *
                        </span>
                    )}
                </label>
            )}
            {children}
            {error && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
