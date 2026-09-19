import { Link, useNavigate } from 'react-router-dom';
import UploadResume from '../components/UploadResume';
import { usePreparedUpload } from '../lib/uploadReviewContext';
export default function ResumeUpload() {
  const navigate = useNavigate();
  const { setPreparedUpload } = usePreparedUpload();
  return (
    <section>
      <Link to="/resumes">← Back to resumes</Link>
      <h1>Upload and extract</h1>
      <p className="muted">
        Add a resume, check the redaction, then review its extracted content.
      </p>
      <UploadResume
        onUploaded={(id, prepared) => {
          setPreparedUpload(prepared);
          navigate(`/resumes/uploads/${id}/review`);
        }}
      />
    </section>
  );
}
