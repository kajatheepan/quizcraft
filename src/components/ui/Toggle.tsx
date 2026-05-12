"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}

export default function Toggle({ checked, onChange, label, id }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="relative inline-flex items-center cursor-pointer w-9 h-5 flex-shrink-0"
      aria-label={label}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span className="absolute inset-0 bg-border rounded-full transition-colors duration-[150ms] peer-checked:bg-accent" />
      <span
        className={`
          absolute top-[3px] left-[3px] w-3.5 h-3.5 bg-primary rounded-full
          transition-transform duration-[150ms]
          ${checked ? "translate-x-4" : "translate-x-0"}
        `}
      />
    </label>
  );
}
