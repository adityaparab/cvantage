import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { activityStatus, activityTitle } from '../lib/activity';
import type { Activity } from '../lib/activity';
export default function WorkflowNotifications() {
  const [items, setItems] = useState<Activity[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [dropdownTop, setDropdownTop] = useState(150);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const value = await api<Activity[]>('/workflows');
        if (active) {
          setItems(value);
          setError('');
          setLoaded(true);
        }
      } catch {
        if (active) setError('Could not refresh workflows. Reconnecting…');
      }
      if (active) timer = setTimeout(() => void refresh(), 2000);
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    function position() {
      const bounds = trigger.current?.getBoundingClientRect();
      if (bounds) setDropdownTop(bounds.bottom + 12);
    }
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="notifications" ref={root}>
      <button
        className="notification-trigger secondary"
        ref={trigger}
        aria-label={`Workflow notifications (${items.length})`}
        aria-expanded={open}
        aria-controls="workflow-notifications"
        onClick={() => setOpen(!open)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {items.length > 0 && (
          <span className="notification-count">{items.length}</span>
        )}
      </button>
      {open && (
        <section
          className="notification-dropdown"
          id="workflow-notifications"
          style={{ '--notification-top': `${dropdownTop}px` } as CSSProperties}
          aria-label="Active workflows"
        >
          <div className="notification-heading">
            <strong>Workflow activity</strong>
            <span>{items.length} active</span>
          </div>
          {error && (
            <p role="status" className="error">
              {error}
            </p>
          )}
          {!loaded && !error && <p role="status">Loading workflows…</p>}
          {loaded && !items.length && (
            <p className="muted">
              No active workflows. Your next upload will appear here.
            </p>
          )}
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  className="notification-item"
                  to={`/activity/${item.id}`}
                  onClick={() => setOpen(false)}
                >
                  <span
                    className={`activity-dot ${item.status === 'failed' ? 'failure' : 'active'}`}
                    aria-hidden="true"
                  />
                  <span className="notification-copy">
                    <strong>{activityTitle(item)}</strong>
                    <span>{activityStatus(item)}</span>
                    {item.steps.some((step) => step.status === 'active') && (
                      <span>{progress(item)}</span>
                    )}
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                  </span>
                  <span aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function progress(item: Activity) {
  const run = item.steps.find((step) => step.status === 'active');
  if (!run) return '';
  const labels: Record<string, string> = {
    preparation_worker: 'Preparing document',
    preparation_judge: 'Checking preparation',
    mapping_worker: 'Extracting content',
    mapping_judge: 'Reviewing content',
    tailoring_worker: 'Tailoring wording',
    tailoring_judge: 'Reviewing wording',
  };
  return `${labels[run.step] ?? 'Processing'} · attempt ${run.attempt}/${item.kind === 'parsing' ? 5 : 1} · retries ${run.retries}/2`;
}
