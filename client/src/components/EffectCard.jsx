export default function EffectCard({ effect, shiftHeld, onDelete }) {
  const handleDelete = () => {
    if (window.confirm(`Delete ${effect.name}?`)) onDelete(effect);
  };

  return (
    <div className={`effect-card${shiftHeld ? ' shift-held' : ''}`}>
      <img className="icon" src={effect.icon} alt={effect.name} />
      <h3>{effect.name}</h3>
      <p>{effect.description}</p>
      <div className="stats">
        Max Potency: {effect.max_potency} &nbsp;|&nbsp; Max Count: {effect.max_stack}
      </div>

      {effect.related_effects.length > 0 && (
        <div className="related">
          <span>Related:</span>
          <br />
          {effect.related_effects.map((related) => (
            <img
              key={related.id}
              className="related-icon"
              src={related.icon}
              alt={related.name}
              title={related.name}
            />
          ))}
        </div>
      )}

      {/* Only visible while hovering the card with Shift held */}
      <div className="delete-form">
        <button type="button" className="btn-delete" title={`Delete ${effect.name}`} onClick={handleDelete}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
