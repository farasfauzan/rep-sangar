import { useEffect, useRef } from 'react';

const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
};

export default function Modal({
    open = false,
    onClose,
    title,
    size = 'md',
    className = '',
    children,
}) {
    const overlayRef = useRef(null);
    const contentRef = useRef(null);

    useEffect(() => {
        if (!open) return;

        const handleEscape = (e) => {
            if (e.key === 'Escape' && onClose) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    if (!open) return null;

    const handleOverlayClick = (e) => {
        if (e.target === overlayRef.current && onClose) {
            onClose();
        }
    };

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={title || 'Dialog'}
        >
            <div
                ref={contentRef}
                className={`bg-white rounded-xl shadow-2xl w-full ${sizeClasses[size] || sizeClasses.md} max-h-[90vh] flex flex-col ${className}`}
            >
                {title && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1 hover:bg-gray-100"
                                aria-label="Close dialog"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
            </div>
        </div>
    );
}
