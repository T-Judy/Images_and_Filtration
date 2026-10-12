import { useEffect, useState } from 'react';

// delete button only appears on hover + Shift
export default function useShiftHeld() {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const down = (e) => e.key === 'Shift' && setHeld(true);
    const up = (e) => e.key === 'Shift' && setHeld(false);
    const reset = () => setHeld(false); 
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    return () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
    };
  }, []);

  return held;
}
