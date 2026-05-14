"use client";

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`
        px-3.5 py-[7px] rounded-md text-sm font-sans
        border transition-all duration-[150ms] ease-out btn-anim
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${active
          ? "border-accent bg-accent/10 text-primary"
          : "border-border bg-surface text-secondary hover:text-primary hover:border-secondary"
        }
      `}
    >
      {label}
    </button>
  );
}
