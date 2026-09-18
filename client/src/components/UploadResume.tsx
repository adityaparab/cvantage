import ReviewPanel from './ReviewPanel'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
interface Job { _id:string; resumeId:string; source:string; revision:number; status:string; piiConfirmed?:boolean }
export default function UploadResume({onComplete}:{onComplete:()=>void}) {
  const [job,setJob]=useState<Job|null>(null)
  const [source,setSource]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [jobs,setJobs]=useState<Job[]>([])
  useEffect(()=>{api<Job[]>('/parsing-jobs').then(setJobs).catch(()=>setError('Could not load in-progress uploads.'))},[])
  const closeReview=useCallback(()=>{setJob(null);api<Job[]>('/parsing-jobs').then(setJobs).catch(()=>setError('Could not refresh uploads.'))},[])
  async function upload(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');setBusy(true)
    const form=new FormData(event.currentTarget)
    const file=form.get('file')
    if (!(file instanceof File) || !file.size || file.size>20_000_000) {setError('Choose a PDF, DOCX, or DOC file up to 20 MB.');setBusy(false);return}
    const payload=new FormData();payload.set('file',file)
    payload.set('pii',JSON.stringify({name:form.get('name')||'',contactNumber:form.get('contactNumber')||'',email:form.get('email')||'',location:form.get('location')||''}))
    try {
      const result=await api<{jobId:string;resumeId:string;source:string;revision:number;status:string}>('/resumes/upload',{method:'POST',body:payload})
      setJob({...result,_id:result.jobId});setSource(result.source)
    } catch(reason) {setError(reason instanceof Error?reason.message:'Upload failed')}
    finally {setBusy(false)}
  }
  async function open(id:string) {try{const result=await api<Job>(`/parsing-jobs/${id}`);setJob(result);setSource(result.source)}catch{setError('This upload is no longer available. Upload the original again.')}}
  async function prepare(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!job)return;setBusy(true);setError('')
    try {setJob(await api<Job>(`/parsing-jobs/${job._id}/prepare`,{method:'POST',body:JSON.stringify({source,revision:job.revision,confirmed:true})}))}
    catch(reason){setError(reason instanceof Error?reason.message:'Could not confirm review')}
    finally{setBusy(false)}
  }
  return <section className="panel upload-panel"><h2>Bring your experience</h2>
    {!job ? <><p className="muted">Add your contact details as written on your resume so we can keep them separate while preparing your application.</p>
      <form onSubmit={event=>void upload(event)}><div className="field-grid">
      <label>Full name<input name="name" maxLength={200} required /></label><label>Location<input name="location" maxLength={200} placeholder="As written on your resume" /></label>
      <label>Contact email<input name="email" type="email" /></label><label>Contact number<input name="contactNumber" maxLength={80} /></label></div>
      <label>Resume file<input name="file" type="file" accept=".pdf,.docx,.doc" required /></label><p className="hint">PDF, DOCX, or DOC · up to 20 MB. The original file is discarded after extraction.</p>
      <button disabled={busy}>{busy?'Reading your resume…':'Upload resume'}</button></form>
      {jobs.length>0&&<><h3>In progress</h3>{jobs.map(item=><button className="text-button" key={item._id} onClick={()=>void open(item._id)}>Resume upload · {item.status.replaceAll('_',' ')}</button>)}</>}
    </> : job.piiConfirmed ? <ReviewPanel id={job._id} onComplete={onComplete} onClose={closeReview} /> :
      <form onSubmit={event=>void prepare(event)}><h3>Review before AI processing</h3><p className="muted">Check that your name, phone, email, and location are removed everywhere. Edit anything we missed. Your contact details are stored separately for your final download.</p>
        <label>Redacted resume text<textarea rows={14} value={source} onChange={event=>setSource(event.target.value)} required /></label>
        <label className="confirmation"><input type="checkbox" required />I checked the text and removed identifying details.</label><button disabled={busy}>{busy?'Saving…':'Confirm redacted text'}</button>
      </form>}
    {error&&<p role="alert" className="error">{error}</p>}
  </section>
}
