import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'

interface JobInspection {
  id: string
  job_id: string
  trade: string
  phase: string
  inspection_type: string
  required: boolean
  prerequisites: string[]
  status: 'pending' | 'scheduled' | 'passed' | 'failed' | 'waived'
  scheduled_date?: string
  completed_date?: string
  inspector_name?: string
  inspector_contact?: string
  result?: 'pass' | 'fail' | 'conditional'
  notes?: string
  punch_list?: string[]
  certificate_number?: string
}

interface InspectionManagerProps {
  jobId: string
  jobType?: string
  onInspectionUpdate?: () => void
}

export const InspectionManager: React.FC<InspectionManagerProps> = ({
  jobId,
  jobType = 'electrical',
  onInspectionUpdate
}) => {
  const [inspections, setInspections] = useState<JobInspection[]>([])
  const [loading, setLoading] = useState(true)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedInspection, setSelectedInspection] = useState<JobInspection | null>(null)

  // Define inspection templates based on trade type
  const getInspectionTemplates = (jobType: string): Partial<JobInspection>[] => {
    const templates: Record<string, Partial<JobInspection>[]> = {
      electrical: [
        {
          trade: 'electrical',
          phase: 'rough',
          inspection_type: 'city',
          required: true,
          prerequisites: ['permit_approved', 'rough_wiring_complete']
        },
        {
          trade: 'electrical',
          phase: 'final',
          inspection_type: 'city',
          required: true,
          prerequisites: ['rough_inspection_passed', 'final_connections_complete']
        }
      ],
      plumbing: [
        {
          trade: 'plumbing',
          phase: 'rough',
          inspection_type: 'city',
          required: true,
          prerequisites: ['permit_approved', 'rough_plumbing_complete']
        },
        {
          trade: 'plumbing',
          phase: 'final',
          inspection_type: 'city',
          required: true,
          prerequisites: ['rough_inspection_passed', 'fixtures_installed']
        }
      ],
      hvac: [
        {
          trade: 'hvac',
          phase: 'rough',
          inspection_type: 'city',
          required: true,
          prerequisites: ['permit_approved', 'ductwork_complete']
        },
        {
          trade: 'hvac',
          phase: 'final',
          inspection_type: 'city',
          required: true,
          prerequisites: ['rough_inspection_passed', 'equipment_installed']
        }
      ],
      general: [
        {
          trade: 'structural',
          phase: 'final',
          inspection_type: 'city',
          required: true,
          prerequisites: ['construction_complete']
        }
      ]
    }

    return templates[jobType] || templates.general
  }

  const loadInspections = async () => {
    try {
      const { data, error } = await supabase
        .from('job_inspections')
        .select('*')
        .eq('job_id', jobId)
        .order('trade', { ascending: true })

      if (error) throw error

      setInspections(data || [])
    } catch (error) {
      console.error('Error loading inspections:', error)
    } finally {
      setLoading(false)
    }
  }

  const createInspectionsFromTemplate = async () => {
    const templates = getInspectionTemplates(jobType)
    
    try {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single()

      if (!userProfile?.tenant_id) throw new Error('No tenant found')

      const inspectionRecords = templates.map(template => ({
        job_id: jobId,
        tenant_id: userProfile.tenant_id,
        trade: template.trade!,
        phase: template.phase!,
        inspection_type: template.inspection_type!,
        required: template.required!,
        prerequisites: template.prerequisites!,
        status: 'pending' as const
      }))

      const { error } = await supabase
        .from('job_inspections')
        .insert(inspectionRecords)

      if (error) throw error

      await loadInspections()
      onInspectionUpdate?.()
    } catch (error) {
      console.error('Error creating inspections:', error)
    }
  }

  const scheduleInspection = async (inspection: JobInspection, scheduleData: any) => {
    try {
      const { error } = await supabase
        .from('job_inspections')
        .update({
          status: 'scheduled',
          scheduled_date: scheduleData.scheduled_date,
          inspector_name: scheduleData.inspector_name,
          inspector_contact: scheduleData.inspector_contact,
          notes: scheduleData.notes
        })
        .eq('id', inspection.id)

      if (error) throw error

      await loadInspections()
      onInspectionUpdate?.()
      setShowScheduleModal(false)
      setSelectedInspection(null)
    } catch (error) {
      console.error('Error scheduling inspection:', error)
    }
  }

  const updateInspectionResult = async (inspection: JobInspection, result: any) => {
    try {
      const { error } = await supabase
        .from('job_inspections')
        .update({
          status: result.result === 'pass' ? 'passed' : 'failed',
          completed_date: new Date().toISOString(),
          result: result.result,
          notes: result.notes,
          punch_list: result.punch_list || [],
          certificate_number: result.certificate_number
        })
        .eq('id', inspection.id)

      if (error) throw error

      await loadInspections()
      onInspectionUpdate?.()
    } catch (error) {
      console.error('Error updating inspection result:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-warning'
      case 'scheduled': return 'text-info'
      case 'passed': return 'text-success'
      case 'failed': return 'text-danger'
      case 'waived': return 'text-muted'
      default: return 'text-secondary'
    }
  }

  const canScheduleInspection = (inspection: JobInspection) => {
    // Check if prerequisites are met (simplified logic)
    return inspection.status === 'pending' && inspection.required
  }

  useEffect(() => {
    loadInspections()
  }, [jobId])

  if (loading) {
    return <div className="text-center">Loading inspections...</div>
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Job Inspections</h3>
        {inspections.length === 0 && (
          <button 
            className="btn btn-primary btn-sm"
            onClick={createInspectionsFromTemplate}
          >
            Generate Required Inspections
          </button>
        )}
      </div>
      
      <div className="card-body">
        {inspections.length === 0 ? (
          <div className="text-center text-muted">
            No inspections created yet. Click "Generate Required Inspections" to create them based on job type.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-row-bordered">
              <thead>
                <tr className="fw-semibold fs-6 text-gray-800">
                  <th>Trade</th>
                  <th>Phase</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Scheduled Date</th>
                  <th>Inspector</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((inspection) => (
                  <tr key={inspection.id}>
                    <td>
                      <span className="badge badge-light-primary">
                        {inspection.trade}
                      </span>
                    </td>
                    <td>{inspection.phase}</td>
                    <td>{inspection.inspection_type}</td>
                    <td>
                      <span className={`fw-bold ${getStatusColor(inspection.status)}`}>
                        {inspection.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {inspection.scheduled_date ? 
                        new Date(inspection.scheduled_date).toLocaleDateString() : 
                        '-'
                      }
                    </td>
                    <td>{inspection.inspector_name || '-'}</td>
                    <td>
                      {inspection.status === 'pending' && canScheduleInspection(inspection) && (
                        <button
                          className="btn btn-sm btn-light-primary"
                          onClick={() => {
                            setSelectedInspection(inspection)
                            setShowScheduleModal(true)
                          }}
                        >
                          Schedule
                        </button>
                      )}
                      {inspection.status === 'scheduled' && (
                        <button
                          className="btn btn-sm btn-light-success"
                          onClick={() => updateInspectionResult(inspection, { result: 'pass' })}
                        >
                          Mark Passed
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Inspection Modal */}
      {showScheduleModal && selectedInspection && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Schedule {selectedInspection.trade} {selectedInspection.phase} Inspection
                </h5>
                <button 
                  className="btn-close"
                  onClick={() => setShowScheduleModal(false)}
                />
              </div>
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                scheduleInspection(selectedInspection, {
                  scheduled_date: formData.get('scheduled_date'),
                  inspector_name: formData.get('inspector_name'),
                  inspector_contact: formData.get('inspector_contact'),
                  notes: formData.get('notes')
                })
              }}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Scheduled Date</label>
                    <input 
                      type="datetime-local" 
                      className="form-control" 
                      name="scheduled_date"
                      required 
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Inspector Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="inspector_name"
                      required 
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Inspector Contact</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      name="inspector_contact"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea 
                      className="form-control" 
                      name="notes"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowScheduleModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Schedule Inspection
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}