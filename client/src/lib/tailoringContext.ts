import { useOutletContext } from 'react-router-dom';
import type { FieldSchema } from './schema';
import type { Variant } from './tailoring';
export interface TailoringContext {
  variant: Variant;
  schema: FieldSchema;
  base: string;
  setVariant: (value: Variant) => void;
}
export const useTailoringVersion = () => useOutletContext<TailoringContext>();
