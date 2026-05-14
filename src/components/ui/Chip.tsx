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
      className={`
        px-3.5 py-[7px] rounded-md text-sm font-sans
        border transition-all duration-[150ms] ease-out btn-anim
        ${active
          ? "border-accent bg-border text-primary"
          : "border-border bg-surface text-secondary hover:text-primary"
        }
      `}
    >
      {label}
    </button>
  );
}
