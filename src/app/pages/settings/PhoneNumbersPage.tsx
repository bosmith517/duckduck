import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { phoneNumberService, TenantPhoneNumber, AvailablePhoneNumber, formatPhoneNumber } from '../../services/phoneNumberService'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'
import { TableSkeleton, StatCardSkeleton } from '../../components/shared/skeletons/TableSkeleton'

const PhoneNumbersPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [myNumbers, setMyNumbers] = useState<TenantPhoneNumber[]>([])
  const [availableNumbers, setAvailableNumbers] = useState<AvailablePhoneNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)

  // Search criteria
  const [searchCriteria, setSearchCriteria] = useState({
    area_code: '',
    contains: '',
    locality: '',
    region: '',
    starts_with: '',
    ends_with: '',
    number_type: 'local' as 'local' | 'toll-free',
    max_results: 10
  })

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchMyNumbers()
    }
  }, [userProfile?.tenant_id])

  const fetchMyNumbers = async () => {
    try {
      setLoading(true)
      const numbers = await phoneNumberService.getTenantPhoneNumbers()
      setMyNumbers(numbers)
    } catch (error) {
      console.error('Error fetching phone numbers:', error)
      showToast.error('Failed to load phone numbers')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchCriteria.area_code && !searchCriteria.contains && !searchCriteria.locality) {
      showToast.warning('Please enter at least one search criteria')
      return
    }

    const loadingToast = showToast.loading('Searching available numbers...')
    setSearchLoading(true)

    try {
      const results = await phoneNumberService.searchAvailableNumbers(searchCriteria)
      setAvailableNumbers(results)
      showToast.dismiss(loadingToast)
      
      if (results.length === 0) {
        showToast.info('No available numbers found for your criteria. Try different search terms.')
      } else {
        showToast.success(`Found ${results.length} available numbers`)
      }
    } catch (error) {
      console.error('Error searching numbers:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to search available numbers. Please try again.')
    } finally {
      setSearchLoading(false)
    }
  }

  const handlePurchase = async (phoneNumber: string) => {
    const loadingToast = showToast.loading('Purchasing phone number...')
    setPurchaseLoading(phoneNumber)

    try {
      await phoneNumberService.purchasePhoneNumber(phoneNumber)
      
      // Remove from available numbers and refresh my numbers
      setAvailableNumbers(prev => prev.filter(num => num.phone_number !== phoneNumber))
      await fetchMyNumbers()
      
      showToast.dismiss(loadingToast)
      showToast.success(`Successfully purchased ${phoneNumber}!`)
    } catch (error) {
      console.error('Error purchasing number:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to purchase phone number. Please try again.')
    } finally {
      setPurchaseLoading(null)
    }
  }

  const handleRelease = async (phoneNumberId: string, phoneNumber: string) => {
    if (!confirm(`Are you sure you want to release ${phoneNumber}? This action cannot be undone.`)) {
      return
    }

    const loadingToast = showToast.loading('Releasing phone number...')

    try {
      await phoneNumberService.releasePhoneNumber(phoneNumberId)
      await fetchMyNumbers()
      
      showToast.dismiss(loadingToast)
      showToast.warning(`Phone number ${phoneNumber} has been released`)
    } catch (error) {
      console.error('Error releasing number:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to release phone number. Please try again.')
    }
  }

  // formatPhoneNumber is now imported from the service

  const getCapabilitiesBadges = (capabilities: { sms?: boolean; voice?: boolean } = {}) => {
    return (
      <div className='d-flex gap-1'>
        {capabilities.voice && (
          <span className='badge badge-light-success'>Voice</span>
        )}
        {capabilities.sms && (
          <span className='badge badge-light-info'>SMS</span>
        )}
      </div>
    )
  }

  return (
    <>
      <PageTitle breadcrumbs={[
        { title: 'Settings', path: '/settings', isSeparator: false, isActive: false },
        { title: 'Phone Numbers', path: '/settings/phone-numbers', isSeparator: false, isActive: true }
      ]}>
        Phone Numbers Management
      </PageTitle>

      {/* Stats Cards */}
      <div className='row g-5 g-xl-8 mb-5'>
        {loading ? (
          <>
            <div className='col-xl-6'><StatCardSkeleton /></div>
            <div className='col-xl-6'><StatCardSkeleton /></div>
          </>
        ) : (
          <>
            <div className='col-xl-6'>
              <div className='card card-bordered'>
                <div className='card-body'>
                  <div className='d-flex align-items-center'>
                    <div className='symbol symbol-50px me-5'>
                      <span className='symbol-label bg-light-primary'>
                        <i className='ki-duotone ki-phone fs-2x text-primary'></i>
                      </span>
                    </div>
                    <div className='d-flex flex-column'>
                      <span className='fw-bold fs-6 text-gray-800'>{myNumbers.length}</span>
                      <span className='fw-semibold fs-7 text-gray-400'>Active Phone Numbers</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className='col-xl-6'>
              <div className='card card-bordered'>
                <div className='card-body'>
                  <div className='d-flex align-items-center'>
                    <div className='symbol symbol-50px me-5'>
                      <span className='symbol-label bg-light-success'>
                        <i className='ki-duotone ki-check fs-2x text-success'></i>
                      </span>
                    </div>
                    <div className='d-flex flex-column'>
                      <span className='fw-bold fs-6 text-gray-800'>{availableNumbers.length}</span>
                      <span className='fw-semibold fs-7 text-gray-400'>Available for Purchase</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search for Available Numbers */}
      <div className='row g-5 g-xl-8 mb-5'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Search Available Numbers</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Find and purchase new phone numbers for your company</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              <form onSubmit={handleSearch} className='mb-7'>
                <div className='row g-3'>
                  <div className='col-md-3'>
                    <label className='form-label'>Number Type</label>
                    <select
                      className='form-select form-select-solid'
                      value={searchCriteria.number_type}
                      onChange={(e) => setSearchCriteria(prev => ({ ...prev, number_type: e.target.value as 'local' | 'toll-free' }))}
                    >
                      <option value='local'>Local Numbers</option>
                      <option value='toll-free'>Toll-Free Numbers</option>
                    </select>
                  </div>
                  <div className='col-md-3'>
                    <label className='form-label'>Area Code</label>
                    <input
                      type='text'
                      className='form-control form-control-solid'
                      placeholder='e.g., 555'
                      value={searchCriteria.area_code}
                      onChange={(e) => setSearchCriteria(prev => ({ ...prev, area_code: e.target.value }))}
                      maxLength={3}
                    />
                  </div>
                  <div className='col-md-3'>
                    <label className='form-label'>Contains Digits</label>
                    <input
                      type='text'
                      className='form-control form-control-solid'
                      placeholder='e.g., 1234'
                      value={searchCriteria.contains}
                      onChange={(e) => setSearchCriteria(prev => ({ ...prev, contains: e.target.value }))}
                      maxLength={7}
                    />
                  </div>
                  <div className='col-md-3'>
                    <label className='form-label'>Max Results</label>
                    <select
                      className='form-select form-select-solid'
                      value={searchCriteria.max_results}
                      onChange={(e) => setSearchCriteria(prev => ({ ...prev, max_results: parseInt(e.target.value) }))}
                    >
                      <option value={5}>5 Results</option>
                      <option value={10}>10 Results</option>
                      <option value={25}>25 Results</option>
                      <option value={50}>50 Results</option>
                    </select>
                  </div>
                </div>
                <div className='row g-3 mt-3'>
                  <div className='col-md-3'>
                    <label className='form-label'>Starts With</label>
                    <input
                      type='text'
                      className='form-control form-control-solid'
                      placeholder='e.g., 555'
                      value={searchCriteria.starts_with}
                      onChange={(e) => setSearchCriteria(prev => ({ ...prev, starts_with: e.target.value }))}
                      maxLength={7}
                    />
                  </div>
                  <div className='col-md-3'>
                    <label className='form-label'>Ends With</label>
                    <input
                      type='text'
                      className='form-control form-control-solid'
                      placeholder='e.g., 1234'
                      value={searchCriteria.ends_with}
                      onChange={(e) => setSearchCriteria(prev => ({ ...prev, ends_with: e.target.value }))}
                      maxLength={7}
                    />
                  </div>
                  <div className='col-md-3'>
                    <label className='form-label'>City</label>
                    <input
                      type='text'
                      className='form-control form-control-solid'
                      placeholder='e.g., Austin'
                      value={searchCriteria.locality}
                      onChange={(e) => setSearchCriteria(prev => ({ ...prev, locality: e.target.value }))}
                    />
                  </div>
                  <div className='col-md-3'>
                    <label className='form-label'>State</label>
                    <input
                      type='text'
                      className='form-control form-control-solid'
                      placeholder='e.g., TX'
                      value={searchCriteria.region}
                      onChange={(e) => setSearchCriteria(prev => ({ ...prev, region: e.target.value }))}
                      maxLength={2}
                    />
                  </div>
                </div>
                <div className='d-flex justify-content-end mt-5'>
                  <button
                    type='submit'
                    className='btn btn-primary'
                    disabled={searchLoading}
                  >
                    {searchLoading ? (
                      <>
                        <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                        Searching...
                      </>
                    ) : (
                      <>
                        <i className='ki-duotone ki-magnifier fs-2 me-2'></i>
                        Search Numbers
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Available Numbers Results */}
              {availableNumbers.length > 0 && (
                <div className='table-responsive'>
                  <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                    <thead>
                      <tr className='fw-bold text-muted'>
                        <th className='min-w-150px'>Phone Number</th>
                        <th className='min-w-120px'>Location</th>
                        <th className='min-w-120px'>Capabilities</th>
                        <th className='min-w-100px'>Price</th>
                        <th className='min-w-100px text-end'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableNumbers.map((number, index) => (
                        <tr key={number.phone_number || `available-${index}`}>
                          <td>
                            <span className='text-dark fw-bold fs-6'>
                              {formatPhoneNumber(number.phone_number)}
                            </span>
                          </td>
                          <td>
                            <div className='d-flex flex-column'>
                              <span className='text-dark fw-bold fs-6'>{number.locality}</span>
                              <span className='text-muted fw-semibold fs-7'>{number.region}</span>
                            </div>
                          </td>
                          <td>
                            {getCapabilitiesBadges(number.capabilities)}
                          </td>
                          <td>
                            <span className='text-dark fw-bold fs-6'>
                              {number.price || '$1.00/mo'}
                            </span>
                          </td>
                          <td>
                            <div className='d-flex justify-content-end'>
                              <button
                                className='btn btn-sm btn-success'
                                onClick={() => handlePurchase(number.phone_number)}
                                disabled={purchaseLoading === number.phone_number}
                              >
                                {purchaseLoading === number.phone_number ? (
                                  <>
                                    <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                                    Purchasing...
                                  </>
                                ) : (
                                  <>
                                    <i className='ki-duotone ki-plus fs-2 me-2'></i>
                                    Purchase
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* My Phone Numbers */}
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>My Phone Numbers</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Manage your company's phone numbers</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              {loading ? (
                <TableSkeleton rows={3} columns={5} />
              ) : myNumbers.length === 0 ? (
                <div className='text-center py-10'>
                  <div className='text-muted mb-3'>
                    <i className='ki-duotone ki-phone fs-3x text-muted mb-3'></i>
                  </div>
                  <div className='text-muted'>
                    No phone numbers purchased yet. Search and purchase your first number above to get started with voice and SMS communications.
                  </div>
                </div>
              ) : (
                <div className='table-responsive'>
                  <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                    <thead>
                      <tr className='fw-bold text-muted'>
                        <th className='min-w-150px'>Phone Number</th>
                        <th className='min-w-120px'>Provider</th>
                        <th className='min-w-120px'>Capabilities</th>
                        <th className='min-w-120px'>Status</th>
                        <th className='min-w-120px'>Purchased</th>
                        <th className='min-w-100px text-end'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myNumbers.map((number) => (
                        <tr key={number.id}>
                          <td>
                            <span className='text-dark fw-bold fs-6'>
                              {formatPhoneNumber(number.phone_number)}
                            </span>
                          </td>
                          <td>
                            <span className='text-dark fw-bold fs-6'>{number.provider}</span>
                          </td>
                          <td>
                            {getCapabilitiesBadges(number.capabilities)}
                          </td>
                          <td>
                            <span className={`badge ${number.is_active ? 'badge-light-success' : 'badge-light-danger'}`}>
                              {number.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <span className='text-dark fw-bold fs-6'>
                              {new Date(number.created_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td>
                            <div className='d-flex justify-content-end flex-shrink-0'>
                              <button
                                className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                                title='Settings'
                                onClick={() => showToast.info('Phone number settings will be available in a future update')}
                              >
                                <i className='ki-duotone ki-setting-2 fs-3'></i>
                              </button>
                              <button
                                className='btn btn-icon btn-bg-light btn-active-color-danger btn-sm'
                                title='Release Number'
                                onClick={() => handleRelease(number.id, number.phone_number)}
                              >
                                <i className='ki-duotone ki-trash fs-3'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                  <span className='path3'></span>
                                  <span className='path4'></span>
                                  <span className='path5'></span>
                                </i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </>
  )
}

export default PhoneNumbersPage
