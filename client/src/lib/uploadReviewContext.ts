import { createContext, useContext } from 'react';
import type { PreparedUpload } from './useRedactionReview';

export const UploadReviewContext = createContext<{
  preparedUpload?: PreparedUpload;
  setPreparedUpload: (value: PreparedUpload | undefined) => void;
} | null>(null);

export function usePreparedUpload() {
  const context = useContext(UploadReviewContext);
  if (!context) throw new Error('Upload review provider is missing');
  return context;
}
