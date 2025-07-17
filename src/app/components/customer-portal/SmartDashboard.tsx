import React from 'react'
import { useCustomerJourneyStore, useJourneySubscriptions } from '../../stores/customerJourneyStore'
import { StepTrackerMini } from '../journey/StepTracker'
import { config } from '../../../lib/config'

interface SmartDashboardProps {
  customer: any
  currentJob: any
  jobHistory: any[]
  currentTrackingData: any
  onContactTechnician?: () => void
  onRescheduleJob?: () => void
  onPayInvoice?: () => void
  onViewJobDetails?: (jobId: string) => void
  onScheduleService?: () => void
}

export const SmartDashboard: React.FC<SmartDashboardProps> = ({
  customer,
  currentJob,
  jobHistory,
  currentTrackingData,
  onContactTechnician,
  onRescheduleJob,
  onPayInvoice,
  onViewJobDetails,
  onScheduleService
}) => {
  // Enable journey tracking for customer portal
  const { leadId, jobId, step } = useCustomerJourneyStore()
  useJourneySubscriptions() // Auto-subscribe to real-time updates
  
  // Show journey tracker if there's an active journey and feature is enabled
  const showJourneyTracker = (leadId || jobId) && step !== 'completed' && config.journey.enabled
  const hasOutstandingBalance = () => {
    // Check for unpaid invoices - this would come from invoices table
    return false // Placeholder
  }

  const getLastServiceSummary = () => {
    if (jobHistory.length === 0) return null
    const lastJob = jobHistory[0]
    return {
      date: new Date(lastJob.date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      service: lastJob.service,
      technician: lastJob.technician,
      id: lastJob.id
    }
  }

  const getNextServiceInfo = () => {
    if (!currentJob) return null
    
    return {
      date: new Date(currentJob.start_date).toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      service: currentJob.title,
      technician: currentJob.technician_name,
      timeWindow: currentJob.estimated_start_time || '9 AM - 11 AM', // Placeholder
      status: currentJob.status
    }
  }

  const nextService = getNextServiceInfo()
  const lastService = getLastServiceSummary()

  return (
    <div className="row g-3 g-lg-6 mb-5 mb-lg-8">
      {/* Journey Progress Tracker - Customer View */}
      {showJourneyTracker && (
        <div className="col-12">
          <div className="card card-flush bg-light-primary">
            <div className="card-body p-4 p-lg-6">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="text-primary fw-bold mb-0">
                  <i className="ki-duotone ki-route fs-2 text-primary me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Your Service Journey
                </h6>
                <span className="badge badge-light-primary fs-7">Live Updates</span>
              </div>
              <StepTrackerMini className="mb-0" />
              <p className="text-muted fs-7 mb-0 mt-2">
                Track your service request progress in real-time
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Welcome Header */}
      <div className="col-12">
        <div className="card card-flush h-lg-100">
          <div className="card-body p-4 p-lg-6">
            <div className="row align-items-center g-3">
              <div className="col-12 col-md-8">
                <h1 className="text-dark mb-3">
                  Welcome back, {customer.first_name || customer.name}! 👋
                </h1>
                <p className="text-muted fs-5 mb-0">
                  Your home at {[customer.address_line1, customer.city].filter(Boolean).join(', ')}
                </p>
              </div>
              <div className="col-12 col-md-4 text-center text-md-end">
                <div className="symbol symbol-70px symbol-lg-100px">
                  <span className="symbol-label bg-light-primary">
                    <i className="ki-duotone ki-home-2 fs-2x text-primary">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Outstanding Balance Card */}
      {hasOutstandingBalance() && (
        <div className="col-xl-6">
          <div className="card card-flush h-lg-100 bg-warning">
            <div className="card-body text-white">
              <div className="d-flex align-items-center mb-4">
                <i className="ki-duotone ki-dollar fs-2x me-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <h3 className="text-white mb-0">Outstanding Balance</h3>
              </div>
              
              <div className="mb-4">
                <h2 className="text-white fw-bold mb-2">$485.00</h2>
                <p className="text-white fs-6 mb-0">Invoice #1234 • Due March 25, 2024</p>
              </div>

              <button 
                className="btn btn-light btn-lg w-100"
                onClick={() => {
                  if (onPayInvoice) {
                    onPayInvoice()
                  } else {
                    // Fallback - open payment portal (placeholder)
                    alert('Payment portal coming soon! Please call us to pay your invoice.')
                  }
                }}
              >
                <i className="ki-duotone ki-credit-cart fs-4 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Pay Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last Service Summary */}
      {lastService && (
        <div className="col-12 col-xl-6">
          <div className="card card-flush h-lg-100">
            <div className="card-body p-4 p-lg-6">
              <div className="d-flex align-items-center mb-4">
                <i className="ki-duotone ki-check-circle fs-2x text-success me-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <h3 className="text-dark mb-0 fs-5 fs-lg-3">Last Service</h3>
              </div>
              
              <div className="mb-4">
                <h5 className="text-dark fw-bold mb-2 fs-6 fs-lg-5">{lastService.service}</h5>
                <div className="d-flex align-items-center mb-2">
                  <i className="ki-duotone ki-calendar fs-7 fs-lg-6 me-2 text-muted">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <span className="text-muted fs-7 fs-lg-6">{lastService.date}</span>
                </div>
                <div className="d-flex align-items-center mb-3">
                  <i className="ki-duotone ki-profile-circle fs-7 fs-lg-6 me-2 text-muted">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                  </i>
                  <span className="text-muted fs-7 fs-lg-6">Technician: {lastService.technician}</span>
                </div>
              </div>

              <button 
                className="btn btn-light-primary btn-sm"
                onClick={() => {
                  if (onViewJobDetails && lastService) {
                    onViewJobDetails(lastService.id)
                  } else {
                    alert('Job details coming soon!')
                  }
                }}
              >
                <i className="ki-duotone ki-eye fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                View Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default SmartDashboard