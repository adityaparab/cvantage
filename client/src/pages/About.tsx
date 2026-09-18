import Nav from '../components/Nav'
export default function About() {
  return (
    <main className="app-shell">
      <Nav />
      <h1>Make your experience count.</h1>
      <p>
        CVantage helps you turn your experience into a clear, relevant resume.
      </p>
      <ol>
        <li>Upload a readable PDF, DOCX, or DOC file up to 20 MB.</li>
        <li>
          Check that identifying details are removed before AI processing.
        </li>
        <li>
          Review and correct your experience, then tailor a separate version to
          a job description.
        </li>
        <li>Approve your changes and download PDF or DOCX.</li>
      </ol>
      <p>
        Original files are discarded after extraction. Unfinished reviews expire
        after 30 days. Contact details stay separate and are restored when you
        export.
      </p>
    </main>
  )
}
