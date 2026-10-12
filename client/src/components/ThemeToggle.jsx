export default function ThemeToggle({ isDark, onChange }) {
  return (
    <div className="theme-toggle-wrapper">
      <label className="theme-toggle" title="Toggle dark mode">
        <input
          type="checkbox"
          id="theme-checkbox"
          checked={isDark}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-track">
          <span className="toggle-thumb"></span>
        </span>
      </label>
    </div>
  );
}
