export default function PageHeader({
    title,
    subtitle,
    breadcrumbs,
    actions,
    className = '',
}) {
    return (
        <div className={`mb-6 ${className}`}>
            {breadcrumbs && breadcrumbs.length > 0 && (
                <nav className="mb-2" aria-label="Breadcrumb">
                    <ol className="flex items-center gap-1.5 text-sm text-gray-500">
                        {breadcrumbs.map((crumb, index) => (
                            <li key={index} className="flex items-center gap-1.5">
                                {index > 0 && (
                                    <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                                {crumb.href ? (
                                    <a
                                        href={crumb.href}
                                        className="hover:text-indigo-600 transition-colors"
                                    >
                                        {crumb.label}
                                    </a>
                                ) : (
                                    <span className="text-gray-900 font-medium">{crumb.label}</span>
                                )}
                            </li>
                        ))}
                    </ol>
                </nav>
            )}

            <div className="flex items-center justify-between gap-4">
                <div>
                    {title && (
                        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                    )}
                    {subtitle && (
                        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
                    )}
                </div>
                {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
            </div>
        </div>
    );
}
