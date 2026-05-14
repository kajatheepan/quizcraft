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
          aria-pressed={value === opt.value}
          className={`
            flex-1 py-[7px] px-2.5 text-sm font-sans
            transition-colors duration-[150ms] ease-out text-center
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:z-10
            ${value === opt.value
              ? "bg-accent/10 text-primary"
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
