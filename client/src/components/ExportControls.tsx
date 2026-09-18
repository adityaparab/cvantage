import { useEffect, useState } from 'react'
import { apiFile } from '../lib/api'
export default function ExportControls({
  resumeId,
  variantId,
  disabled = false,
}: {
  resumeId: string
  variantId?: string
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )
  async function generate(format: 'pdf' | 'docx', show = false) {
    setBusy(true)
    setError('')
    try {
      const blob = await apiFile(`/resumes/${resumeId}/export`, {
        method: 'POST',
        body: JSON.stringify({ format, ...(variantId ? { variantId } : {}) }),
      })
      const url = URL.createObjectURL(blob)
      if (show) {
        setPreview(url)
      } else {
        const link = document.createElement('a')
        link.href = url
        link.download = `resume.${format}`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="exports">
      <h4>
        {variantId
          ? 'Download this tailored version'
          : 'Download your saved resume'}
      </h4>
      <div className="export-buttons">
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => void generate('pdf', true)}
        >
          Preview PDF
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || disabled}
          onClick={() => void generate('pdf')}
        >
          Download PDF
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || disabled}
          onClick={() => void generate('docx')}
        >
          Download DOCX
        </button>
      </div>
      {preview && (
        <>
          <button className="text-button" onClick={() => setPreview('')}>
            Close preview
          </button>
          <iframe
            title="Resume PDF preview"
            src={preview}
            style={{ width: '100%', height: 600, border: 0, marginTop: 16 }}
          />
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  )
}
