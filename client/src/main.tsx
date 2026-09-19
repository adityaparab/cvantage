import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import AppRoutes from './AppRoutes';
import UploadReviewProvider from './components/UploadReviewProvider';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <UploadReviewProvider>
        <AppRoutes />
      </UploadReviewProvider>
    </BrowserRouter>
  </StrictMode>,
);
