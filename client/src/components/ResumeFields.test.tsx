import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ResumeFields, SchemaFields } from './ResumeFields'
afterEach(cleanup)
it('edits nested arrays and newly discovered fields',()=>{
  const change=vi.fn()
  render(<ResumeFields schema={{type:'object',properties:{education:{type:'array',items:{type:'object',properties:{degree:{type:'string'}}}}}}} value={{education:[{degree:'Original'}]}} onChange={change}/>)
  fireEvent.change(screen.getByLabelText('Degree'),{target:{value:'Corrected'}})
  expect(change).toHaveBeenCalledWith({education:[{degree:'Corrected'}]})
  fireEvent.click(screen.getByText('Add education'))
  expect(change).toHaveBeenCalledWith({education:[{degree:'Original'},{degree:''}]})
})
it('supports adding definitions while locking published field types',()=>{
  const change=vi.fn();const base={type:'object' as const,properties:{summary:{type:'string' as const}}}
  render(<SchemaFields schema={base} base={base} onChange={change}/>)
  expect((screen.getAllByLabelText('Field type')[1] as HTMLSelectElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('New field key'),{target:{value:'education'}})
  fireEvent.click(screen.getByText('Add field definition'))
  expect(change).toHaveBeenCalledWith({...base,properties:{...base.properties,education:{type:'string'}}})
})
