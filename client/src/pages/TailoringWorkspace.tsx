import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import type { Resume } from '../components/ResumeEditor';
import { api } from '../lib/api';
import { resumeTitle } from '../lib/resume';
import { analysisPath, variantPath } from '../lib/tailoring';
import type { Variant } from '../lib/tailoring';
import JobDescriptionInput from '../components/JobDescriptionInput';
import TailoringStages from '../components/TailoringStages';
function TailoringStart({
  resume,
  onBusyChange,
}: {
  resume: Resume;
  onBusyChange: (busy: boolean) => void;
}) {
  const navigate = useNavigate();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    onBusyChange(busy || importing);
    return () => onBusyChange(false);
  }, [busy, importing, onBusyChange]);
  const [error, setError] = useState('');
  const [versions, setVersions] = useState<Variant[] | null>(null);
  useEffect(() => {
    let active = true;
    api<Variant[]>(`/resumes/${resume._id}/variants`)
      .then((result) => {
        if (active) setVersions(result);
      })
      .catch(() => {
        if (active)
          setError('Could not load previous versions. Refresh to retry.');
      });
    return () => {
      active = false;
    };
  }, [resume._id]);
  async function start() {
    if (busy || importing) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ workflowId: string }>(
        `/resumes/${resume._id}/tailor`,
        {
          method: 'POST',
          body: JSON.stringify({
            revision: resume.revision,
            jobDescription: description,
            piiConfirmed: true,
          }),
        },
      );
      if (mounted.current) navigate(analysisPath(result.workflowId));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not start tailoring',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
      >
        <JobDescriptionInput
          resumeId={resume._id}
          description={description}
          onChange={setDescription}
          disabled={busy}
          onImportingChange={setImporting}
        />
        <button disabled={busy || importing}>
          {busy ? 'Starting analysis…' : 'Analyze and tailor'}
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="tailoring-history">
        <h2>Previous tailored versions</h2>
        {versions ? (
          versions.length ? (
            <ul className="resume-library">
              {versions.map((item, index) => (
                <li className="panel" key={item._id}>
                  <h3>Version {versions.length - index}</h3>
                  <p>
                    {item.status === 'reviewed'
                      ? 'Approved'
                      : 'Awaiting your review'}
                    {item.stale ? ' · Uses an older source' : ''}
                  </p>
                  <Link
                    to={`${variantPath(resume._id, item._id)}/${item.status === 'reviewed' || item.appliedSuggestionIds ? 'resume' : 'suggestions'}`}
                  >
                    Open tailored version
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Your tailored versions will appear here.</p>
          )
        ) : (
          <p role="status">Loading versions…</p>
        )}
      </section>
    </>
  );
}
export default function TailoringWorkspace() {
  const [search, setSearch] = useSearchParams();
  const selected = search.get('resume') || '';
  const legacyVariant = search.get('variant');
  const [locked, setLocked] = useState(false);
  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<Resume[]>('/resumes')
      .then((items) => {
        if (active) setResumes(items);
      })
      .catch(() => {
        if (active) setError('Could not load your resumes. Refresh to retry.');
      });
    return () => {
      active = false;
    };
  }, []);
  const resume = resumes?.find((item) => item._id === selected);
  if (legacyVariant && selected)
    return (
      <Navigate replace to={`${variantPath(selected, legacyVariant)}/resume`} />
    );
  return (
    <section className="tailoring-page">
      <TailoringStages />
      <p className="eyebrow">TAILORING</p>
      <h1>Tailor a resume</h1>
      <p className="muted">
        Choose a saved resume and the opportunity you want to tailor it for.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {resumes ? (
        resumes.length ? (
          <>
            <label>
              Source resume
              <select
                disabled={locked}
                value={selected}
                onChange={(event) => setSearch({ resume: event.target.value })}
              >
                <option value="">Choose a saved resume</option>
                {resumes.map((item) => (
                  <option key={item._id} value={item._id}>
                    {resumeTitle(item)} · {item._id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            {resume && (
              <TailoringStart
                key={resume._id}
                resume={resume}
                onBusyChange={setLocked}
              />
            )}
          </>
        ) : (
          <p className="panel">
            Upload and approve a source resume first.{' '}
            <Link to="/resumes/upload">Upload resume</Link>
          </p>
        )
      ) : (
        !error && <p role="status">Loading resumes…</p>
      )}
    </section>
  );
}
