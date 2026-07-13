export default function Card({
    title,
    subtitle,
    actions,
    footer,
    className = '',
    children,
}) {
    return (
        <div
            className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}
        >
            {(title || subtitle || actions) && (
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        {title && (
                            <h3 className="text-lg font-semibold text-gray-900">
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p className="mt-0.5 text-sm text-gray-500">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}

            <div className="px-6 py-4">{children}</div>

            {footer && (
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                    {footer}
                </div>
            )}
        </div>
    );
}
