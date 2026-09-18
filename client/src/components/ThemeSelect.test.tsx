import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ThemeSelect from './ThemeSelect';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

it('follows system changes by default and remembers an explicit override', () => {
  const listeners = new Set<() => void>();
  const media = {
    matches: false,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal('matchMedia', () => media);
  const view = render(<ThemeSelect />);
  expect((screen.getByLabelText('Appearance') as HTMLSelectElement).value).toBe(
    'system',
  );
  act(() => {
    media.matches = true;
    listeners.forEach((fn) => fn());
  });
  expect(document.documentElement.dataset.theme).toBe('dark');
  fireEvent.change(screen.getByLabelText('Appearance'), {
    target: { value: 'light' },
  });
  act(() => listeners.forEach((fn) => fn()));
  expect(document.documentElement.dataset.theme).toBe('light');
  view.unmount();
  render(<ThemeSelect />);
  expect((screen.getByLabelText('Appearance') as HTMLSelectElement).value).toBe(
    'light',
  );
  fireEvent.change(screen.getByLabelText('Appearance'), {
    target: { value: 'system' },
  });
  expect(document.documentElement.dataset.theme).toBe('dark');
});

it('still changes appearance when browser storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  render(<ThemeSelect />);
  fireEvent.change(screen.getByLabelText('Appearance'), {
    target: { value: 'dark' },
  });
  expect(document.documentElement.dataset.theme).toBe('dark');
});
