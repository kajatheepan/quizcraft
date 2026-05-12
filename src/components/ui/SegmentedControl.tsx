"use client";

interface Option {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export default function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex bg-surface border border-border rounded-md overflow-hidden"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`
            flex-1 py-[7px] px-2.5 text-sm font-sans
            transition-colors duration-[150ms] ease-out text-center
            ${value === opt.value
              ? "bg-border text-primary"
              : "text-secondary hover:text-primary"
            }
          `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
