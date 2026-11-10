export default function ToggleSwitch({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-1 group/toggle">
      <div className="pr-4 flex-1">
        <div className="font-medium text-nds-text-primary mb-0.5 group-hover/toggle:text-nds-text-secondary transition-colors">
          {label}
        </div>
        <div className="text-caption text-nds-text-tertiary group-hover/toggle:text-nds-text-secondary transition-colors">
          {description}
        </div>
      </div>
      <button
        onClick={onChange}
        className={`w-14 h-7 rounded-full relative transition-all duration-slow ease-in-out border-2 shrink-0 focus:outline-none ${
          checked
            ? "bg-gradient-to-r from-nds-success to-nds-success/90 border-nds-success/50 shadow-nds-glow-success"
            : "bg-nds-bg-secondary border-nds-border-light hover:border-nds-border-medium"
        }`}
      >
        <div
          className={`absolute top-0 left-[3px] w-6 h-6 bg-white rounded-full shadow-lg transform transition-all duration-500 ease-in-out flex items-center justify-center ${
            checked ? "translate-x-[26px]" : "translate-x-0"
          }`}
        >
          {checked && (
            <div className="w-2 h-2 bg-nds-success rounded-full animate-pulse"></div>
          )}
        </div>
        {/* Glow effect */}
        {checked && (
          <div className="absolute inset-0 bg-nds-success/20 rounded-full blur-sm animate-pulse"></div>
        )}
      </button>
    </div>
  );
}
