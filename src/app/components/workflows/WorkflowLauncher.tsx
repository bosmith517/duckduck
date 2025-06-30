import React, { useState } from 'react'
import { NewInquiryModal } from './NewInquiryModal'
import { PromoteToJobModal } from './PromoteToJobModal'

interface WorkflowLauncherProps {
  onWorkflowComplete?: (result: any) => void
}

export const WorkflowLauncher: React.FC<WorkflowLauncherProps> = ({ onWorkflowComplete }) => {
  const [showNewInquiry, setShowNewInquiry] = useState(false)
  const [showPromoteToJob, setShowPromoteToJob] = useState(false)
  const [currentLead, setCurrentLead] = useState<any>(null)

  const handleNewInquirySuccess = (leadId: string) => {
    setShowNewInquiry(false)
    // Auto-advance to promote to job workflow
    // In a real implementation, you might want to confirm first
    // For now, we'll let them manually click "Promote to Job"
    console.log('Lead created:', leadId)
    if (onWorkflowComplete) {
      onWorkflowComplete({ type: 'lead_created', leadId })
    }
  }

  const handlePromoteToJobSuccess = (jobId: string) => {
    setShowPromoteToJob(false)
    setCurrentLead(null)
    console.log('Job created:', jobId)
    if (onWorkflowComplete) {
      onWorkflowComplete({ type: 'job_created', jobId })
    }
  }

  const startPromoteWorkflow = (leadData: any) => {
    setCurrentLead(leadData)
    setShowPromoteToJob(true)
  }

  return (
    <>
      {/* Main "New Inquiry" Button */}
      <button
        type="button"
        className="btn btn-lg btn-primary"
        onClick={() => setShowNewInquiry(true)}
      >
        <i className="ki-duotone ki-phone fs-2 me-2">
          <span className="path1"></span>
          <span className="path2"></span>
        </i>
        New Inquiry
      </button>

      {/* Step 1: New Inquiry Modal */}
      {showNewInquiry && (
        <NewInquiryModal
          isOpen={showNewInquiry}
          onClose={() => setShowNewInquiry(false)}
          onSuccess={handleNewInquirySuccess}
        />
      )}

      {/* Step 2: Promote to Job Modal */}
      {showPromoteToJob && currentLead && (
        <PromoteToJobModal
          isOpen={showPromoteToJob}
          onClose={() => {
            setShowPromoteToJob(false)
            setCurrentLead(null)
          }}
          leadId={currentLead.id}
          leadData={currentLead}
          onSuccess={handlePromoteToJobSuccess}
        />
      )}
    </>
  )
}

// Standalone New Inquiry Button for placement anywhere
export const NewInquiryButton: React.FC<{ 
  onSuccess?: (leadId: string) => void,
  variant?: 'primary' | 'success' | 'warning' | 'danger',
  size?: 'sm' | 'md' | 'lg'
}> = ({ onSuccess, variant = 'primary', size = 'md' }) => {
  const [showModal, setShowModal] = useState(false)

  const handleSuccess = (leadId: string) => {
    setShowModal(false)
    if (onSuccess) {
      onSuccess(leadId)
    }
  }

  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''

  return (
    <>
      <button
        type="button"
        className={`btn btn-${variant} ${sizeClass}`}
        onClick={() => setShowModal(true)}
      >
        <i className="ki-duotone ki-phone fs-4 me-2">
          <span className="path1"></span>
          <span className="path2"></span>
        </i>
        New Inquiry
      </button>

      {showModal && (
        <NewInquiryModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}