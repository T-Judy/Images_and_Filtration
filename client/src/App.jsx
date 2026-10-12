import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import EffectCard from './components/EffectCard.jsx';
import EffectModal from './components/EffectModal.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import useEffectSearch from './hooks/useEffectSearch.js';
import useShiftHeld from './hooks/useShiftHeld.js';
import useTheme from './hooks/useTheme.js';

export default function App() {
  const [effects, setEffects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [isDark, setDark] = useTheme();
  const shiftHeld = useShiftHeld();
  const { query, setQuery, visible, hint } = useEffectSearch(effects);

  const reload = useCallback(async () => {
    try {
      setEffects(await api.listEffects());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const handleSaved = async () => {
    setModalOpen(false);
    await reload();
  };

  const handleDelete = async (effect) => {
    try {
      await api.deleteEffect(effect.id);
    } catch (err) {
      setError(err.message);
      return;
    }
    await reload();
  };

  return (
    <>
      <ThemeToggle isDark={isDark} onChange={setDark} />

      <h1>Status Effect Viewer</h1>

      {/* Top */}
      <div className="top-bar">
        <input
          type="text"
          id="search-bar"
          placeholder="Search by name or description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" id="add-btn" onClick={() => setModalOpen(true)}>
          + Add Effect
        </button>
      </div>
      <p id="status-hint">{hint}</p>

      {error && <p className="app-error">{error}</p>}

      {/* Cards grid */}
      <div id="effects-grid">
        {visible.map((effect) => (
          <EffectCard key={effect.id} effect={effect} shiftHeld={shiftHeld} onDelete={handleDelete} />
        ))}
      </div>
      {!loading && visible.length === 0 && <p id="no-results">No status effects found.</p>}

      {modalOpen && <EffectModal effects={effects} onClose={closeModal} onSaved={handleSaved} />}
    </>
  );
}
