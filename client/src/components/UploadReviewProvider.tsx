import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { UploadReviewContext } from '../lib/uploadReviewContext';
import type { PreparedUpload } from '../lib/useRedactionReview';

export default function UploadReviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preparedUpload, setPreparedUpload] = useState<PreparedUpload>();
  const { pathname } = useLocation();
  // The provider outlives route remounts; the text only lives until leaving its review.
  useEffect(() => {
    setPreparedUpload((current) =>
      current &&
      (pathname === `/resumes/uploads/${current.jobId}/review` ||
        pathname === `/uploads/${current.jobId}/review`)
        ? current
        : undefined,
    );
  }, [pathname]);
  return (
    <UploadReviewContext.Provider value={{ preparedUpload, setPreparedUpload }}>
      {children}
    </UploadReviewContext.Provider>
  );
}
