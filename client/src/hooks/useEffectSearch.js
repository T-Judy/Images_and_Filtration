import { useEffect, useMemo, useState } from 'react';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 200;

/**
 * The search box logic:
 *  - nothing is filtered until 3+ characters are typed
 *  - the filter is applied 200 ms after the user stops typing (debounce)
 *  - a hint line explains what is going on
 *  - matching is a case-insensitive "contains" on name or description.
 */
export default function useEffectSearch(effects) {
  const [query, setQueryState] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  const trimmed = query.trim();

  // Dropping below 3 characters "resets" immediately
  const setQuery = (value) => {
    setQueryState(value);
    if (value.trim().length < MIN_CHARS) setAppliedQuery('');
  };

  useEffect(() => {
    if (trimmed.length < MIN_CHARS) return undefined;
    const timer = setTimeout(() => setAppliedQuery(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer); // typing again cancels the pending filter
  }, [trimmed]);

  // While a new 3+ character query is debouncing the previous filter stays on screen
  const activeQuery = appliedQuery;

  const visible = useMemo(() => {
    if (!activeQuery) return effects;
    const q = activeQuery.toLowerCase();
    return effects.filter((e) => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
  }, [effects, activeQuery]);

  let hint;
  if (trimmed.length === 0) hint = `Type at least ${MIN_CHARS} characters to filter`;
  else if (trimmed.length < MIN_CHARS) hint = `${MIN_CHARS - trimmed.length} more character(s) to start filtering...`;
  else if (appliedQuery === trimmed) hint = `Showing results for "${trimmed}"`;
  else hint = 'Filtering...';

  return { query, setQuery, visible, hint };
}
