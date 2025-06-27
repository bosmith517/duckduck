import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { supabase, Job, Account, Contact } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { JobForm } from './components/JobForm'
import { JobsList } from './components/JobsList'
import { JobsKanban } from './components/JobsKanban'

const JobsPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [accounts, setAccounts] = useState<Pick<Account, 'id' | 'name'>[]>([])
  const [contacts, setContacts] = useState<Pick<Contact, 'id' | 'first_name' | 'last_name' | 'account_id'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchJobs()
      fetchAccounts()
      fetchContacts()
    }
  }, [userProfile?.tenant_id])

  const fetchJobs = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          account:accounts(id, name),
          contact:contacts(id, first_name, last_name)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching jobs:', error)
        return
      }

      setJobs(data || [])
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAccounts = async () => {
    if (!userProfile?.tenant_id) return

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching accounts:', error)
        return
      }

      setAccounts(data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }

  const fetchContacts = async () => {
    if (!userProfile?.tenant_id) return

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, account_id')
        .order('last_name', { ascending: true })

      if (error) {
        console.error('Error fetching contacts:', error)
        return
      }

      setContacts(data || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  const generateJobNumber = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const time = String(now.getTime()).slice(-4)
    return `JOB-${year}${month}${day}-${time}`
  }

  const handleCreateJob = async (jobData: Partial<Job>) => {
    if (!userProfile?.tenant_id) return

    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert([
          {
            ...jobData,
            tenant_id: userProfile.tenant_id,
            job_number: generateJobNumber(),
          }
        ])
        .select(`
          *,
          account:accounts(id, name),
          contact:contacts(id, first_name, last_name)
        `)
        .single()

      if (error) {
        console.error('Error creating job:', error)
        return
      }

      setJobs(prev => [data, ...prev])
      setShowForm(false)
    } catch (error) {
      console.error('Error creating job:', error)
    }
  }

  const handleUpdateJob = async (id: string, jobData: Partial<Job>) => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .update(jobData)
        .eq('id', id)
        .select(`
          *,
          account:accounts(id, name),
          contact:contacts(id, first_name, last_name)
        `)
        .single()

      if (error) {
        console.error('Error updating job:', error)
        return
      }

      setJobs(prev => prev.map(job => 
        job.id === id ? data : job
      ))
      setEditingJob(null)
      setShowForm(false)
    } catch (error) {
      console.error('Error updating job:', error)
    }
  }

  const handleDeleteJob = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job?')) return

    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting job:', error)
        return
      }

      setJobs(prev => prev.filter(job => job.id !== id))
    } catch (error) {
      console.error('Error deleting job:', error)
    }
  }

  const handleStatusChange = async (id: string, newStatus: Job['status']) => {
    await handleUpdateJob(id, { status: newStatus })
  }

  const handleEdit = (job: Job) => {
    setEditingJob(job)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingJob(null)
  }

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.job_number && job.job_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (job.account?.name && job.account.name.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || job.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  return (
    <>
      <PageTitle breadcrumbs={[]}>Jobs Management</PageTitle>
      
      <div className='card'>
        <div className='card-header border-0 pt-6'>
          <div className='card-title'>
            <div className='d-flex align-items-center position-relative my-1'>
              <i className='ki-duotone ki-magnifier fs-1 position-absolute ms-6'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              <input
                type='text'
                className='form-control form-control-solid w-250px ps-14'
                placeholder='Search jobs...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className='card-toolbar'>
            <div className='d-flex justify-content-end align-items-center'>
              {/* View Mode Toggle */}
              <div className='btn-group me-3' role='group'>
                <button
                  type='button'
                  className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-light'}`}
                  onClick={() => setViewMode('list')}
                >
                  <i className='ki-duotone ki-row-horizontal fs-3'></i>
                  List
                </button>
                <button
                  type='button'
                  className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-light'}`}
                  onClick={() => setViewMode('kanban')}
                >
                  <i className='ki-duotone ki-category fs-3'></i>
                  Kanban
                </button>
              </div>

              {/* Filters */}
              <select
                className='form-select form-select-solid form-select-sm w-150px me-3'
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value='all'>All Statuses</option>
                <option value='draft'>Draft</option>
                <option value='scheduled'>Scheduled</option>
                <option value='in_progress'>In Progress</option>
                <option value='completed'>Completed</option>
                <option value='on_hold'>On Hold</option>
                <option value='cancelled'>Cancelled</option>
              </select>

              <select
                className='form-select form-select-solid form-select-sm w-150px me-3'
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value='all'>All Priorities</option>
                <option value='low'>Low</option>
                <option value='medium'>Medium</option>
                <option value='high'>High</option>
                <option value='urgent'>Urgent</option>
              </select>

              <button
                type='button'
                className='btn btn-primary'
                onClick={() => setShowForm(true)}
              >
                <i className='ki-duotone ki-plus fs-2'></i>
                New Job
              </button>
            </div>
          </div>
        </div>

        <div className='card-body py-4'>
          {loading ? (
            <div className='d-flex justify-content-center py-10'>
              <div className='spinner-border text-primary' role='status'>
                <span className='visually-hidden'>Loading...</span>
              </div>
            </div>
          ) : viewMode === 'list' ? (
            <JobsList
              jobs={filteredJobs}
              onEdit={handleEdit}
              onDelete={handleDeleteJob}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <JobsKanban
              jobs={filteredJobs}
              onEdit={handleEdit}
              onDelete={handleDeleteJob}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>

      {showForm && (
        <JobForm
          job={editingJob}
          accounts={accounts}
          contacts={contacts}
          onSave={editingJob ? 
            (data) => handleUpdateJob(editingJob.id, data) : 
            handleCreateJob
          }
          onCancel={handleCloseForm}
        />
      )}
    </>
  )
}

export default JobsPage
