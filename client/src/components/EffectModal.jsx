import { useEffect, useState } from 'react';
import { api, ApiError } from '../api.js';
import FieldErrors from './FieldErrors.jsx';

export default function EffectModal({ effects, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(null);
  const [description, setDescription] = useState('');
  const [maxPotency, setMaxPotency] = useState('1');
  const [maxStack, setMaxStack] = useState('1');
  const [related, setRelated] = useState([]); // ids
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Close with Escape
  useEffect(() => {
    const onKeyDown = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const toggleRelated = (id) =>
    setRelated((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const form = new FormData();
    form.append('name', name);
    if (icon) form.append('icon', icon);
    form.append('description', description);
    form.append('max_potency', maxPotency);
    form.append('max_stack', maxStack);
    related.forEach((id) => form.append('related_effects', id));

    try {
      await api.createEffect(form);
      onSaved(); 
    } catch (err) {
      setErrors(err instanceof ApiError && err.errors ? err.errors : { _form: [err.message] });
      setSaving(false);
    }
  }

  return (
    // Close when clicking the dark backdrop
    <div className="modal-overlay active" id="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          &#x2715;
        </button>
        <h2 id="modal-title">Add Status Effect</h2>

        <form onSubmit={handleSubmit}>
          <FieldErrors errors={errors._form} />

          <div className="form-group">
            <label htmlFor="id_name">Name</label>
            <input
              type="text"
              id="id_name"
              name="name"
              maxLength={100}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <FieldErrors errors={errors.name} />
          </div>

          <div className="form-group">
            <label htmlFor="id_icon">Icon (.jpg or .png)</label>
            <input
              type="file"
              id="id_icon"
              name="icon"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              required
              onChange={(e) => setIcon(e.target.files[0] ?? null)}
            />
            <FieldErrors errors={errors.icon} />
          </div>

          <div className="form-group">
            <label htmlFor="id_description">Description</label>
            <textarea
              id="id_description"
              name="description"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <FieldErrors errors={errors.description} />
          </div>

          <div className="form-group">
            <label htmlFor="id_max_potency">Max Potency</label>
            <input
              type="number"
              id="id_max_potency"
              name="max_potency"
              min={0}
              required
              value={maxPotency}
              onChange={(e) => setMaxPotency(e.target.value)}
            />
            <FieldErrors errors={errors.max_potency} />
          </div>

          <div className="form-group">
            <label htmlFor="id_max_stack">Max Stack</label>
            <input
              type="number"
              id="id_max_stack"
              name="max_stack"
              min={0}
              required
              value={maxStack}
              onChange={(e) => setMaxStack(e.target.value)}
            />
            <FieldErrors errors={errors.max_stack} />
          </div>

          <div className="form-group">
            <label>Related Effects</label>
            <div className="checkbox-list">
              {effects.length === 0 && (
                <span style={{ color: '#999', fontSize: '0.85rem' }}>No other effects yet</span>
              )}
              {effects.map((effect) => (
                <label key={effect.id}>
                  <input
                    type="checkbox"
                    name="related_effects"
                    value={effect.id}
                    checked={related.includes(effect.id)}
                    onChange={() => toggleRelated(effect.id)}
                  />{' '}
                  {effect.name}
                </label>
              ))}
            </div>
            <FieldErrors errors={errors.related_effects} />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={saving}>
              Save Effect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
