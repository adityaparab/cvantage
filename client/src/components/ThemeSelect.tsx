import { useEffect, useState } from 'react';

type Appearance = 'system' | 'light' | 'dark';
function storedAppearance(): Appearance {
  try {
    const value = localStorage.getItem('cvantage-appearance');
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export default function ThemeSelect() {
  const [appearance, setAppearance] = useState<Appearance>(storedAppearance);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        appearance === 'system'
          ? media?.matches
            ? 'dark'
            : 'light'
          : appearance;
    };
    const sync = () => setAppearance(storedAppearance());
    apply();
    media?.addEventListener('change', apply);
    window.addEventListener('storage', sync);
    return () => {
      media?.removeEventListener('change', apply);
      window.removeEventListener('storage', sync);
    };
  }, [appearance]);

  return (
    <label className="theme-picker">
      <span className="sr-only">Appearance</span>
      <select
        value={appearance}
        onChange={(event) => {
          const next = event.target.value as Appearance;
          setAppearance(next);
          try {
            localStorage.setItem('cvantage-appearance', next);
          } catch {
            /* The choice still works when storage is unavailable. */
          }
        }}
      >
        <option value="system">System theme</option>
        <option value="light">Light theme</option>
        <option value="dark">Dark theme</option>
      </select>
    </label>
  );
}
