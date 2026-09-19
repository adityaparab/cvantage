import type { Resume } from '../components/ResumeEditor';
export function resumeTitle(resume: Resume) {
  const data = resume.data as {
    basics?: { label?: string; summary?: string };
    professionalSummary?: string;
  } | null;
  const text =
    data?.basics?.label || data?.basics?.summary || data?.professionalSummary;
  return typeof text === 'string' && text.trim()
    ? text.slice(0, 70)
    : `Resume ${resume._id.slice(0, 8)}`;
}
