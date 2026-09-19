import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import App from './App';
import ResumeLibrary from './pages/ResumeLibrary';
import ResumeUpload from './pages/ResumeUpload';
import TailoringWorkspace from './pages/TailoringWorkspace';
import ResumeEditor from './components/ResumeEditor';
import PrivacyReview from './components/PrivacyReview';
import WorkflowActivity from './components/WorkflowActivity';
import { usePreparedUpload } from './lib/uploadReviewContext';
import About from './pages/About';
import NotFound from './pages/NotFound';
function ResumeRoute() {
  const { resumeId = '' } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const variant = search.get('variant');
  if (variant)
    return (
      <Navigate
        replace
        to={`/tailoring?resume=${resumeId}&variant=${variant}`}
      />
    );
  return (
    <ResumeEditor
      key={resumeId}
      id={resumeId}
      onClose={() => navigate('/resumes')}
    />
  );
}
function PrivacyRoute() {
  const { uploadId = '' } = useParams();
  const { preparedUpload } = usePreparedUpload();
  return (
    <PrivacyReview key={uploadId} id={uploadId} initial={preparedUpload} />
  );
}
const refresh = () => {};
function ActivityRoute() {
  const { workflowId = '' } = useParams();
  return (
    <WorkflowActivity key={workflowId} id={workflowId} onComplete={refresh} />
  );
}
function LegacyUpload() {
  const { uploadId } = useParams();
  return <Navigate replace to={`/resumes/uploads/${uploadId}/review`} />;
}
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<App />}>
        <Route path="/" element={<Navigate replace to="/resumes" />} />
        <Route path="/resumes" element={<ResumeLibrary />} />
        <Route path="/resumes/upload" element={<ResumeUpload />} />
        <Route
          path="/resumes/uploads/:uploadId/review"
          element={<PrivacyRoute />}
        />
        <Route
          path="/resumes/activity/:workflowId"
          element={<ActivityRoute />}
        />
        <Route path="/resumes/:resumeId" element={<ResumeRoute />} />
        <Route path="/tailoring" element={<TailoringWorkspace />} />
        <Route
          path="/tailoring/activity/:workflowId"
          element={<ActivityRoute />}
        />
        <Route path="/uploads/:uploadId/review" element={<LegacyUpload />} />
        <Route path="/activity/:workflowId" element={<ActivityRoute />} />
      </Route>
      <Route path="/about" element={<About />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
