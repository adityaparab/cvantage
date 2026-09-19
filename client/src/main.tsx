import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import UploadReviewProvider from './components/UploadReviewProvider';
import About from './pages/About.tsx';
import NotFound from './pages/NotFound.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <UploadReviewProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/uploads/:uploadId/review" element={<App />} />
          <Route path="/activity/:workflowId" element={<App />} />
          <Route path="/resumes/:resumeId" element={<App />} />
          <Route path="/about" element={<About />} />
          {/* Client-side 404: any unknown path renders this page. The server
            already returned index.html (SPA fallback), so deep links work. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </UploadReviewProvider>
    </BrowserRouter>
  </StrictMode>,
);
