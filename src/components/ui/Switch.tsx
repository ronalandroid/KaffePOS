/**
 * Accessible on/off switch. The button is the 44px hit area; the visual track
 * inside it stays compact so it never inflates into a large green circle.
 */
type SwitchProps = {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
};

export default function Switch({ checked, onChange, label, disabled = false, className = '' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`group inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-xl disabled:opacity-50 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200 ${
          checked ? 'bg-emerald-600' : 'bg-slate-300 group-hover:bg-slate-400'
        }`}
      >
        <span
          className={`absolute h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.25)] transition-[left] duration-200 ${
            checked ? 'left-[19px]' : 'left-[3px]'
          }`}
        />
      </span>
    </button>
  );
}
