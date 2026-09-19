export default function ResumeDeleteButton({
  label,
  onClick,
  disabled,
  required = false,
  className = '',
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  required?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`resume-trash ${className}`}
      aria-label={`Delete ${label}`}
      disabled={disabled || required}
      title={
        required ? `${label} is required for this resume` : `Delete ${label}`
      }
      onClick={onClick}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
      </svg>
    </button>
  );
}
