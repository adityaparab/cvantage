import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import TailoringSuggestions from './TailoringSuggestions';
import type { Variant } from '../lib/tailoring';
import { activityHref } from '../lib/activity';
const variant: Variant = {
  _id: 'version',
  resumeId: 'resume',
  revision: 4,
  schemaVersion: 1,
  data: {},
  sourceData: {},
  sourceRevision: 0,
  status: 'review_required',
  suggestions: [
    {
      id: '/basics/summary',
      label: 'Professional summary',
      before: 'Original summary',
      after: 'Proposed summary',
    },
    {
      id: '/work/0/highlights/0',
      label: 'Experience 1 · Highlight 1',
      before: 'Original highlight',
      after: 'Proposed highlight',
    },
  ],
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const setVariant = vi.fn();
function show() {
  render(
    <MemoryRouter initialEntries={['/version/suggestions']}>
      <Routes>
        <Route
          element={
            <Outlet context={{ variant, base: '/version', setVariant }} />
          }
        >
          <Route
            path="/version/suggestions"
            element={<TailoringSuggestions />}
          />
          <Route
            path="/version/resume"
            element={<h1>Updated resume screen</h1>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}
it('applies only checked suggestions with the current revision and navigates after persistence', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        ...variant,
        revision: 5,
        appliedSuggestionIds: ['/basics/summary'],
      }),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  show();
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Experience 1 · Highlight 1' }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Apply selected suggestions' }),
  );
  expect(
    await screen.findByRole('heading', { name: 'Updated resume screen' }),
  ).toBeTruthy();
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    revision: 4,
    suggestionIds: ['/basics/summary'],
  });
  expect(fetcher.mock.calls[0][0]).toBe(
    '/api/resumes/resume/variants/version/apply',
  );
});
it('allows zero selected changes and retains the selection when a stale save fails', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ message: 'Variant changed; reload' }), {
      status: 409,
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Continue without changes' }),
  );
  await screen.findByRole('alert');
  expect(JSON.parse(fetcher.mock.calls[0][1].body).suggestionIds).toEqual([]);
  await waitFor(() =>
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Professional summary',
        }) as HTMLInputElement
      ).checked,
    ).toBe(false),
  );
});
it('links tailoring notifications to analysis, suggestions or the approved result', () => {
  const activity = {
    id: 'workflow',
    resumeId: 'resume',
    kind: 'tailoring' as const,
    status: 'running',
    steps: [],
    createdAt: '',
  };
  expect(activityHref(activity)).toBe('/tailoring/analysis/workflow');
  expect(
    activityHref({
      ...activity,
      status: 'review_required',
      variantId: 'version',
    }),
  ).toBe('/tailoring/resumes/resume/versions/version/suggestions');
  expect(
    activityHref({ ...activity, status: 'completed', variantId: 'version' }),
  ).toBe('/tailoring/resumes/resume/versions/version/resume');
});
