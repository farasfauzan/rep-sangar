import { forwardRef } from 'react';

const Select = forwardRef(function Select(
    {
        label,
        error,
        required = false,
        options = [],
        placeholder = 'Select an option',
        className = '',
        ...props
    },
    ref
) {
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
            <select
                ref={ref}
                required={required}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? `${label}-error` : undefined}
                className={`
                    block w-full rounded-lg border-gray-300 shadow-sm
                    focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm
                    transition-colors duration-150
                    ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
                `}
                {...props}
            >
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((option) => {
                    const value = typeof option === 'object' ? option.value : option;
                    const label = typeof option === 'object' ? option.label : option;
                    return (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    );
                })}
            </select>
            {error && (
                <p
                    id={`${label}-error`}
                    className="mt-1 text-sm text-red-600"
                    role="alert"
                >
                    {error}
                </p>
            )}
        </div>
    );
});

export default Select;
