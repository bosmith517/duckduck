import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface PhoneNumber {
  id: string
  number: string
  friendly_name: string
  type: 'local' | 'toll_free' | 'mobile'
  capabilities: {
    voice: boolean
    sms: boolean
    fax: boolean
  }
  status: 'active' | 'inactive' | 'pending'
  monthly_cost: number
  assigned_to?: string
  assigned_to_name?: string
  forwarding_enabled: boolean
  forwarding_number?: string
  voicemail_enabled: boolean
  auto_attendant?: boolean
  created_at: string
}

interface AvailableNumber {
  number: string
  friendly_name: string
  type: 'local' | 'toll_free'
  monthly_cost: number
  capabilities: {
    voice: boolean
    sms: boolean
    fax: boolean
  }
}

const PhoneNumbersSettingsPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [searchingNumbers, setSearchingNumbers] = useState(false)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [selectedNumber, setSelectedNumber] = useState<AvailableNumber | null>(null)
  const [areaCode, setAreaCode] = useState('')
  const [teamMembers, setTeamMembers] = useState<any[]>([])

  useEffect(() => {
    loadPhoneNumbers()
    loadTeamMembers()
  }, [])

  const loadPhoneNumbers = async () => {
    try {
      setLoading(true)
      
      // Load existing phone numbers from database
      const { data: numbers, error } = await supabase
        .from('signalwire_phone_numbers')
        .select(`
          *,
          user_profiles!assigned_to(first_name, last_name)
        `)
        .eq('tenant_id', userProfile?.tenant_id)
      
      if (error) throw error

      // Mock data if no real data available
      const mockNumbers: PhoneNumber[] = [
        {
          id: '1',
          number: '+15551234567',
          friendly_name: '(555) 123-4567',
          type: 'local',
          capabilities: { voice: true, sms: true, fax: false },
          status: 'active',
          monthly_cost: 1.00,
          assigned_to: '1',
          assigned_to_name: 'Mike Rodriguez',
          forwarding_enabled: false,
          voicemail_enabled: true,
          auto_attendant: true,
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '2',
          number: '+18885551234',
          friendly_name: '(888) 555-1234',
          type: 'toll_free',
          capabilities: { voice: true, sms: false, fax: true },
          status: 'active',
          monthly_cost: 3.00,
          forwarding_enabled: true,
          forwarding_number: '+15551234567',
          voicemail_enabled: true,
          auto_attendant: true,
          created_at: '2024-01-10T10:00:00Z'
        },
        {
          id: '3',
          number: '+15559876543',
          friendly_name: '(555) 987-6543',
          type: 'local',
          capabilities: { voice: true, sms: true, fax: false },
          status: 'inactive',
          monthly_cost: 1.00,
          assigned_to: '2',
          assigned_to_name: 'Sarah Johnson',
          forwarding_enabled: false,
          voicemail_enabled: false,
          created_at: '2024-02-01T10:00:00Z'
        }
      ]

      setPhoneNumbers(numbers?.length ? numbers : mockNumbers)
    } catch (error: any) {
      console.error('Error loading phone numbers:', error)
      showToast.error('Failed to load phone numbers')
    } finally {
      setLoading(false)
    }
  }

  const loadTeamMembers = async () => {
    try {
      const { data: members, error } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email')
        .eq('tenant_id', userProfile?.tenant_id)
      
      if (error) throw error

      // Mock data if no real data
      const mockMembers = [
        { id: '1', first_name: 'Mike', last_name: 'Rodriguez', email: 'mike@tradeworks.com' },
        { id: '2', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah@tradeworks.com' },
        { id: '3', first_name: 'Tom', last_name: 'Wilson', email: 'tom@tradeworks.com' }
      ]

      setTeamMembers(members?.length ? members : mockMembers)
    } catch (error) {
      console.error('Error loading team members:', error)
    }
  }

  const searchAvailableNumbers = async () => {
    if (!areaCode || areaCode.length !== 3) {
      showToast.error('Please enter a valid 3-digit area code')
      return
    }

    setSearchingNumbers(true)
    try {
      // Call SignalWire API to search for available numbers
      const { data: result, error } = await supabase.functions.invoke('search-available-numbers', {
        body: { areaCode }
      })

      if (error) throw error

      // Mock data for demonstration
      const mockAvailable: AvailableNumber[] = [
        {
          number: `+1${areaCode}5551234`,
          friendly_name: `(${areaCode}) 555-1234`,
          type: 'local',
          monthly_cost: 1.00,
          capabilities: { voice: true, sms: true, fax: false }
        },
        {
          number: `+1${areaCode}5555678`,
          friendly_name: `(${areaCode}) 555-5678`,
          type: 'local',
          monthly_cost: 1.00,
          capabilities: { voice: true, sms: true, fax: false }
        },
        {
          number: `+1${areaCode}5559012`,
          friendly_name: `(${areaCode}) 555-9012`,
          type: 'local',
          monthly_cost: 1.00,
          capabilities: { voice: true, sms: true, fax: false }
        }
      ]

      setAvailableNumbers(result?.numbers || mockAvailable)
      showToast.success(`Found ${mockAvailable.length} available numbers`)
    } catch (error: any) {
      showToast.error(error.message || 'Failed to search for numbers')
    } finally {
      setSearchingNumbers(false)
    }
  }

  const purchaseNumber = async (number: AvailableNumber) => {
    try {
      // Purchase number via SignalWire API
      const { data: result, error } = await supabase.functions.invoke('purchase-phone-number', {
        body: {
          phoneNumber: number.number,
          friendlyName: number.friendly_name
        }
      })

      if (error) throw error

      showToast.success(`Successfully purchased ${number.friendly_name}`)
      setShowPurchaseModal(false)
      setSelectedNumber(null)
      loadPhoneNumbers()
    } catch (error: any) {
      showToast.error(error.message || 'Failed to purchase number')
    }
  }

  const toggleNumberStatus = async (numberId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      
      // Update in database
      const { error } = await supabase
        .from('signalwire_phone_numbers')
        .update({ status: newStatus })
        .eq('id', numberId)

      if (error) throw error

      // Update local state
      setPhoneNumbers(prev => prev.map(num => 
        num.id === numberId ? { ...num, status: newStatus as 'active' | 'inactive' } : num
      ))

      showToast.success(`Number ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    } catch (error: any) {
      showToast.error('Failed to update number status')
    }
  }

  const assignNumber = async (numberId: string, userId: string) => {
    try {
      const member = teamMembers.find(m => m.id === userId)
      const memberName = member ? `${member.first_name} ${member.last_name}` : null

      // Update in database
      const { error } = await supabase
        .from('signalwire_phone_numbers')
        .update({ 
          assigned_to: userId || null,
          assigned_to_name: memberName
        })
        .eq('id', numberId)

      if (error) throw error

      // Update local state
      setPhoneNumbers(prev => prev.map(num => 
        num.id === numberId ? { 
          ...num, 
          assigned_to: userId || undefined, 
          assigned_to_name: memberName || undefined 
        } : num
      ))

      showToast.success(userId ? `Number assigned to ${memberName}` : 'Number unassigned')
    } catch (error: any) {
      showToast.error('Failed to assign number')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return 'badge-light-success'
      case 'inactive': return 'badge-light-danger'
      case 'pending': return 'badge-light-warning'
      default: return 'badge-light'
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'local': return 'badge-light-primary'
      case 'toll_free': return 'badge-light-info'
      case 'mobile': return 'badge-light-success'
      default: return 'badge-light'
    }
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Phone Numbers</PageTitle>

      {/* Stats Row */}
      <div className="row g-6 mb-6">
        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="symbol symbol-50px me-5">
                  <div className="symbol-label bg-light-success">
                    <i className="ki-duotone ki-phone fs-2x text-success">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  </div>
                </div>
                <div>
                  <div className="fw-bold fs-6 text-gray-800">
                    {phoneNumbers.filter(n => n.status === 'active').length}
                  </div>
                  <div className="text-muted">Active Numbers</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="symbol symbol-50px me-5">
                  <div className="symbol-label bg-light-primary">
                    <i className="ki-duotone ki-dollar fs-2x text-primary">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                  </div>
                </div>
                <div>
                  <div className="fw-bold fs-6 text-gray-800">
                    ${phoneNumbers.reduce((sum, n) => sum + n.monthly_cost, 0).toFixed(2)}
                  </div>
                  <div className="text-muted">Monthly Cost</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="symbol symbol-50px me-5">
                  <div className="symbol-label bg-light-info">
                    <i className="ki-duotone ki-sms fs-2x text-info">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  </div>
                </div>
                <div>
                  <div className="fw-bold fs-6 text-gray-800">
                    {phoneNumbers.filter(n => n.capabilities.sms).length}
                  </div>
                  <div className="text-muted">SMS Enabled</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="symbol symbol-50px me-5">
                  <div className="symbol-label bg-light-warning">
                    <i className="ki-duotone ki-people fs-2x text-warning">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                      <span className="path4"></span>
                      <span className="path5"></span>
                    </i>
                  </div>
                </div>
                <div>
                  <div className="fw-bold fs-6 text-gray-800">
                    {phoneNumbers.filter(n => n.assigned_to).length}
                  </div>
                  <div className="text-muted">Assigned</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search for New Numbers */}
      <KTCard className="mb-6">
        <div className="card-header">
          <h3 className="card-title">Add New Phone Number</h3>
        </div>
        <KTCardBody>
          <div className="row align-items-end">
            <div className="col-md-3">
              <label className="form-label">Area Code</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., 555"
                maxLength={3}
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="col-md-3">
              <button
                className="btn btn-primary"
                onClick={searchAvailableNumbers}
                disabled={searchingNumbers || !areaCode}
              >
                {searchingNumbers ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Searching...
                  </>
                ) : (
                  <>
                    <i className="ki-duotone ki-magnifier fs-4 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Search Numbers
                  </>
                )}
              </button>
            </div>
          </div>

          {availableNumbers.length > 0 && (
            <div className="mt-6">
              <h5>Available Numbers</h5>
              <div className="table-responsive">
                <table className="table table-row-dashed">
                  <thead>
                    <tr className="text-start text-muted fw-bold fs-7 text-uppercase">
                      <th>Number</th>
                      <th>Type</th>
                      <th>Capabilities</th>
                      <th>Monthly Cost</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableNumbers.map((number, index) => (
                      <tr key={index}>
                        <td className="fw-bold">{number.friendly_name}</td>
                        <td>
                          <span className={`badge ${getTypeBadge(number.type)}`}>
                            {number.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            {number.capabilities.voice && <span className="badge badge-light-success">Voice</span>}
                            {number.capabilities.sms && <span className="badge badge-light-info">SMS</span>}
                            {number.capabilities.fax && <span className="badge badge-light-warning">Fax</span>}
                          </div>
                        </td>
                        <td>${number.monthly_cost}/month</td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setSelectedNumber(number)
                              setShowPurchaseModal(true)
                            }}
                          >
                            Purchase
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </KTCardBody>
      </KTCard>

      {/* Current Phone Numbers */}
      <KTCard>
        <div className="card-header border-0 pt-6">
          <div className="card-title">
            <h3>Your Phone Numbers</h3>
          </div>
        </div>
        <KTCardBody className="py-4">
          <div className="table-responsive">
            <table className="table align-middle table-row-dashed fs-6 gy-5">
              <thead>
                <tr className="text-start text-muted fw-bold fs-7 text-uppercase gs-0">
                  <th>Phone Number</th>
                  <th>Type</th>
                  <th>Capabilities</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                  <th>Monthly Cost</th>
                  <th>Features</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {phoneNumbers.map((number) => (
                  <tr key={number.id}>
                    <td>
                      <div className="d-flex align-items-center">
                        <i className="ki-duotone ki-phone fs-2x text-primary me-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div>
                          <div className="fw-bold">{number.friendly_name}</div>
                          <div className="text-muted fs-7">{number.number}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getTypeBadge(number.type)}`}>
                        {number.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        {number.capabilities.voice && <span className="badge badge-light-success">Voice</span>}
                        {number.capabilities.sms && <span className="badge badge-light-info">SMS</span>}
                        {number.capabilities.fax && <span className="badge badge-light-warning">Fax</span>}
                      </div>
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={number.assigned_to || ''}
                        onChange={(e) => assignNumber(number.id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {teamMembers.map(member => (
                          <option key={member.id} value={member.id}>
                            {member.first_name} {member.last_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(number.status)}`}>
                        {number.status}
                      </span>
                    </td>
                    <td>${number.monthly_cost}/month</td>
                    <td>
                      <div className="d-flex gap-1">
                        {number.voicemail_enabled && <span className="badge badge-light-primary">VM</span>}
                        {number.forwarding_enabled && <span className="badge badge-light-info">FWD</span>}
                        {number.auto_attendant && <span className="badge badge-light-success">AA</span>}
                      </div>
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-2">
                        <button
                          className={`btn btn-sm btn-light-${number.status === 'active' ? 'danger' : 'success'}`}
                          onClick={() => toggleNumberStatus(number.id, number.status)}
                        >
                          {number.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="btn btn-sm btn-light-primary">
                          <i className="ki-duotone ki-setting-3 fs-4">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          Configure
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </KTCardBody>
      </KTCard>

      {/* Purchase Confirmation Modal */}
      {showPurchaseModal && selectedNumber && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Purchase Phone Number</h5>
                <button
                  className="btn btn-icon btn-sm btn-active-light-primary ms-2"
                  onClick={() => setShowPurchaseModal(false)}
                >
                  <i className="ki-duotone ki-cross fs-2x">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </button>
              </div>
              <div className="modal-body">
                <div className="d-flex align-items-center mb-5">
                  <i className="ki-duotone ki-phone fs-3x text-primary me-4">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <div>
                    <h4>{selectedNumber.friendly_name}</h4>
                    <p className="text-muted mb-0">{selectedNumber.type.replace('_', ' ')} number</p>
                  </div>
                </div>
                <div className="border rounded p-4 bg-light">
                  <div className="row">
                    <div className="col-6">
                      <strong>Monthly Cost:</strong>
                    </div>
                    <div className="col-6 text-end">
                      ${selectedNumber.monthly_cost}/month
                    </div>
                  </div>
                  <div className="row mt-2">
                    <div className="col-6">
                      <strong>Setup Fee:</strong>
                    </div>
                    <div className="col-6 text-end">
                      $0.00
                    </div>
                  </div>
                  <hr />
                  <div className="row">
                    <div className="col-6">
                      <strong>Total Today:</strong>
                    </div>
                    <div className="col-6 text-end">
                      <strong>${selectedNumber.monthly_cost}</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-light"
                  onClick={() => setShowPurchaseModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => purchaseNumber(selectedNumber)}
                >
                  Purchase Number
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default PhoneNumbersSettingsPage