import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import TailoringPanel from '../components/TailoringPanel';
import type { Resume } from '../components/ResumeEditor';
import type { FieldSchema } from '../lib/schema';
import { api } from '../lib/api';
import { resumeTitle } from '../lib/resume';
export default function TailoringWorkspace() {
  const [search, setSearch] = useSearchParams();
  const selected = search.get('resume') || '';
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [schema, setSchema] = useState<FieldSchema | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api<Resume[]>('/resumes')
      .then((items) => {
        if (active) setResumes(items);
      })
      .catch(() => {
        if (active) setError('Could not load your resumes. Refresh to retry.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const resume = resumes.find((item) => item._id === selected);
  useEffect(() => {
    let active = true;
    setSchema(null);
    if (resume)
      void api<{ definition: FieldSchema }>(
        `/resume-schemas/${resume.schemaVersion}`,
      )
        .then((result) => {
          if (active) setSchema(result.definition);
        })
        .catch(() => {
          if (active) setError('Could not load this resume. Refresh to retry.');
        });
    return () => {
      active = false;
    };
  }, [resume]);
  return (
    <section className="tailoring-page">
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
      {loading ? (
        <p role="status">Loading resumes…</p>
      ) : resumes.length ? (
        <>
          <label>
            Source resume
            <select
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
          {resume &&
            (schema ? (
              <TailoringPanel
                key={resume._id}
                resume={resume}
                schema={schema}
                unsaved={false}
              />
            ) : (
              <p role="status">Loading resume…</p>
            ))}
        </>
      ) : (
        <p className="panel">
          Upload and approve a source resume first.{' '}
          <Link to="/resumes/upload">Upload resume</Link>
        </p>
      )}
    </section>
  );
}
