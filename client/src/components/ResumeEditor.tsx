import ExportControls from './ExportControls'
import TailoringPanel from './TailoringPanel'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { ResumeFields } from './ResumeFields'
import type { FieldSchema } from '../lib/schema'
export interface Resume {
  _id: string
  schemaVersion: number
  revision: number
  data: unknown
  updatedAt: string
}
interface Pii {
  name: string
  contactNumber: string
  email: string
  location: string
  revision: number
}
export default function ResumeEditor({
  id,
  onClose,
}: {
  id: string
  onClose: () => void
}) {
  const [resume, setResume] = useState<Resume | null>(null)
  const [schema, setSchema] = useState<FieldSchema | null>(null)
  const [data, setData] = useState<unknown>({})
  const [pii, setPii] = useState<Pii | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [record, contact] = await Promise.all([
          api<Resume>(`/resumes/${id}`),
          api<Pii>(`/resumes/${id}/pii`),
        ])
        const definition = await api<{ definition: FieldSchema }>(
          `/resume-schemas/${record.schemaVersion}`,
        )
        if (active) {
          setResume(record)
          setData(record.data)
          setPii(contact)
          setSchema(definition.definition)
        }
      } catch {
        if (active)
          setError('Could not load resume. Close and reopen to retry.')
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [id])
  async function save(contact = false) {
    if (!resume || !pii || busy || (!contact && editing)) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (contact) {
        const { name, email, location, contactNumber } = pii
        setPii(
          await api<Pii>(`/resumes/${id}/pii`, {
            method: 'PATCH',
            body: JSON.stringify({
              revision: pii.revision,
              resumeRevision: resume.revision,
              pii: { name, email, location, contactNumber },
            }),
          }),
        )
        setResume({ ...resume, revision: resume.revision + 1 })
      } else {
        setResume(
          await api<Resume>(`/resumes/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ revision: resume.revision, data }),
          }),
        )
      }
      setMessage('Changes saved.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="panel">
      <button className="text-button" onClick={onClose}>
        ← Back to workspace
      </button>
      <h2>Your resume</h2>
      <p className="muted">
        Review and refine every detail. Contact details are kept separately.
      </p>
      {resume && schema ? (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <ResumeFields
              schema={schema}
              value={data}
              onChange={setData}
              onEditingChange={setEditing}
              disabled={busy}
            />
            <button disabled={busy || editing}>Save resume changes</button>
          </form>
          {pii && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void save(true)
              }}
            >
              <h3>Contact details</h3>
              <div className="field-grid">
                {(['name', 'email', 'contactNumber', 'location'] as const).map(
                  (key) => (
                    <label key={key}>
                      {key === 'name'
                        ? 'Full name'
                        : key === 'contactNumber'
                          ? 'Phone'
                          : key === 'email'
                            ? 'Contact email'
                            : 'Location'}
                      <input
                        value={pii[key]}
                        type={key === 'email' ? 'email' : 'text'}
                        maxLength={key === 'email' ? 254 : 200}
                        onChange={(event) =>
                          setPii({ ...pii, [key]: event.target.value })
                        }
                      />
                    </label>
                  ),
                )}
              </div>
              <button disabled={busy} className="secondary">
                Save contact details
              </button>
            </form>
          )}
          <ExportControls
            resumeId={resume._id}
            disabled={
              editing || JSON.stringify(data) !== JSON.stringify(resume.data)
            }
          />
          <TailoringPanel
            resume={resume}
            schema={schema}
            unsaved={
              editing || JSON.stringify(data) !== JSON.stringify(resume.data)
            }
          />
        </>
      ) : (
        !error && <p role="status">Loading resume…</p>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  )
}
