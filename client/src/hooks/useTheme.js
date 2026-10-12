import { useLayoutEffect, useState } from 'react';

const KEY = 'theme';

function readStoredTheme() {
  try {
    return localStorage.getItem(KEY) === 'dark';
  } catch {
    return false; // storage unavailable (private mode etc.)
  }
}

// Dark mode
export default function useTheme() {
  const [isDark, setIsDark] = useState(readStoredTheme);

  useLayoutEffect(() => {
    document.body.classList.toggle('dark', isDark);
  }, [isDark]);

  const setTheme = (dark) => {
    setIsDark(dark);
    try {
      localStorage.setItem(KEY, dark ? 'dark' : 'light');
    } catch {
      // Do nothing
    }
  };

  return [isDark, setTheme];
}
