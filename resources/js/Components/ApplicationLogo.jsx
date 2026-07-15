export default function ApplicationLogo({ className = '', ...props }) {
    return (
        <img
            src="/images/logo-scs.png"
            alt="PT. Sinar Cerah Sempurna"
            className={className}
            {...props}
        />
    );
}
