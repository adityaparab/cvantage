import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActivitySteps } from './WorkflowActivity';
import WorkflowNotifications from './WorkflowNotifications';
import type { Activity } from '../lib/activity';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const activity: Activity = {
  id: 'workflow',
  resumeId: 'resume',
  kind: 'parsing',
  status: 'mapping',
  piiConfirmed: true,
  stage: 'mapping',
  createdAt: '2026-09-18T12:00:00Z',
  steps: [
    {
      step: 'mapping_worker',
      attempt: 1,
      retries: 1,
      status: 'failure',
      output: 'Earlier draft',
      received: 10,
      outcome: 'revision_requested',
    },
    {
      step: 'mapping_worker',
      attempt: 2,
      retries: 0,
      status: 'active',
      output: 'A revised summary',
      received: 20,
    },
  ],
};
it('shows live content, step states, bounded attempts and prior retry history without a schema editor', () => {
  render(<ActivitySteps activity={activity} />);
  expect(screen.getByText('A revised summary')).toBeTruthy();
  expect(screen.getByText(/Attempt 2 of 5/)).toBeTruthy();
  expect(
    screen.getByText(/Attempt 1 · failure · 1 transport retries/),
  ).toBeTruthy();
  expect(screen.getAllByText('inactive')).toHaveLength(2);
  expect(screen.queryByText(/schema/i)).toBeNull();
});
it('opens an aligned workflow link dropdown and restores focus on Escape', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify([activity]), {
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  render(
    <MemoryRouter>
      <WorkflowNotifications />
    </MemoryRouter>,
  );
  const button = await screen.findByRole('button', {
    name: 'Workflow notifications (1)',
  });
  fireEvent.click(button);
  const link = screen.getByRole('link', { name: /Resume parsing/ });
  expect(link.getAttribute('href')).toBe('/resumes/activity/workflow');
  expect(screen.getByText('In progress')).toBeTruthy();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('region', { name: 'Active workflows' })).toBeNull();
  expect(document.activeElement).toBe(button);
});
it('shows the preparation limit without promising a second pass after rejection', () => {
  render(
    <ActivitySteps
      activity={{
        ...activity,
        stage: 'preparation',
        status: 'failed',
        steps: [
          {
            step: 'preparation_judge',
            attempt: 1,
            retries: 0,
            status: 'failure',
            received: 10,
            output: 'Internal schema output',
            outcome: 'revision_requested',
          },
        ],
      }}
    />,
  );
  expect(screen.getByText(/Attempt 1 of 1/)).toBeTruthy();
  expect(screen.getByText(/attempt limit reached/)).toBeTruthy();
  expect(screen.queryByText(/another loop attempt/)).toBeNull();
  expect(screen.queryByText(/Internal schema output/)).toBeNull();
});
