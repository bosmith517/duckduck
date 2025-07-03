import React, { useState, useEffect } from 'react'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { attomDataService } from '../../services/attomDataService'
import { showToast } from '../../utils/toast'

interface PropertyDetailsProps {
  address?: string
  city?: string
  state?: string
  zip?: string
  className?: string
  showHeader?: boolean
}

interface PropertyData {
  // Basic info
  address: string
  city?: string
  state?: string
  zip_code?: string
  
  // Property details
  property_type?: string
  year_built?: number
  square_footage?: number
  lot_size?: string
  bedrooms?: number
  bathrooms?: number
  stories?: number
  total_rooms?: number
  garage_spaces?: number
  
  // Amenities
  pool?: boolean
  fireplace?: boolean
  central_air?: boolean
  heating_type?: string
  cooling_type?: string
  roof_material?: string
  exterior_walls?: string
  construction_quality?: string
  condition_rating?: string
  
  // Financial data
  market_value_estimate?: number
  market_value_date?: string
  tax_assessment?: number
  tax_year?: number
  last_sold_price?: number
  last_sold_date?: string
  
  // Enhanced data
  comparable_sales?: any[]
  price_history?: any[]
  
  // Metadata
  last_attom_sync?: string
  attom_sync_status?: 'pending' | 'syncing' | 'success' | 'error' | 'not_found'
  attom_error_message?: string
}

const PropertyDetails: React.FC<PropertyDetailsProps> = ({ 
  address, 
  city, 
  state, 
  zip, 
  className = '',
  showHeader = true 
}) => {
  const { userProfile } = useSupabaseAuth()
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (address && userProfile?.tenant_id) {
      fetchPropertyData()
    }
  }, [address, city, state, userProfile?.tenant_id])

  const fetchPropertyData = async () => {
    if (!address || !userProfile?.tenant_id) return

    setLoading(true)
    setError(null)

    try {
      console.log('🏠 Fetching property data for:', address)
      
      const data = await attomDataService.getPropertyDataWithCache(
        address,
        city,
        state,
        userProfile.tenant_id
      )

      setPropertyData(data)
      console.log('✅ Property data loaded:', data)
      console.log('🔍 Data structure:', {
        hasAddress: !!data?.address,
        hasPropertyType: !!data?.property_type,
        hasYearBuilt: !!data?.year_built,
        hasSquareFootage: !!data?.square_footage,
        hasMarketValue: !!data?.market_value_estimate,
        allKeys: Object.keys(data || {})
      })
    } catch (err: any) {
      console.error('❌ Error fetching property data:', err)
      
      let errorMessage = err.message || 'Failed to fetch property data'
      
      // Provide helpful error messages
      if (err.message?.includes('not deployed')) {
        errorMessage = 'Attom integration not deployed yet. Contact your administrator.'
      } else if (err.message?.includes('Function not found')) {
        errorMessage = 'Property data service not available. Please contact support.'
      } else if (err.message?.includes('not found')) {
        errorMessage = 'Property not found in Attom database'
      }
      
      setError(errorMessage)
      
      // Only show toast for deployment/configuration errors
      if (err.message?.includes('not deployed') || err.message?.includes('Function not found')) {
        showToast.error(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchPropertyData()
  }

  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  if (!address) {
    return (
      <KTCard className={className}>
        {showHeader && (
          <div className='card-header'>
            <h3 className='card-title'>Property Information</h3>
          </div>
        )}
        <KTCardBody>
          <div className='text-muted text-center py-5'>
            <i className='ki-duotone ki-home fs-3x text-muted mb-3'>
              <span className='path1'></span>
              <span className='path2'></span>
            </i>
            <div>No property address available</div>
          </div>
        </KTCardBody>
      </KTCard>
    )
  }

  const cardContent = (
    <>
      {loading && !propertyData ? (
        <div className='text-center py-5'>
          <div className='spinner-border text-primary mb-3'></div>
          <div className='text-muted'>Loading property data...</div>
        </div>
      ) : error ? (
        <div className='text-center py-5'>
          <i className='ki-duotone ki-information fs-3x text-warning mb-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <div className='text-muted mb-3'>{error}</div>
          <button 
            className='btn btn-sm btn-light-primary'
            onClick={handleRefresh}
          >
            Try Again
          </button>
        </div>
      ) : propertyData ? (
        <div className='row g-6'>
          {/* Basic Property Info */}
          <div className='col-md-6'>
            <div className='card card-flush h-100'>
              <div className='card-header'>
                <h4 className='card-title'>Basic Information</h4>
              </div>
              <div className='card-body pt-0'>
                <div className='d-flex flex-column gap-3'>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Property Type:</span>
                    <span className='fw-bold'>{propertyData.property_type || 'N/A'}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Year Built:</span>
                    <span className='fw-bold'>{propertyData.year_built || 'N/A'}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Square Footage:</span>
                    <span className='fw-bold'>
                      {propertyData.square_footage ? `${propertyData.square_footage.toLocaleString()} sq ft` : 'N/A'}
                    </span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Lot Size:</span>
                    <span className='fw-bold'>{propertyData.lot_size || 'N/A'}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Bedrooms:</span>
                    <span className='fw-bold'>{propertyData.bedrooms || 'N/A'}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Bathrooms:</span>
                    <span className='fw-bold'>{propertyData.bathrooms || 'N/A'}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Stories:</span>
                    <span className='fw-bold'>{propertyData.stories || 'N/A'}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Garage Spaces:</span>
                    <span className='fw-bold'>{propertyData.garage_spaces || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div className='col-md-6'>
            <div className='card card-flush h-100'>
              <div className='card-header'>
                <h4 className='card-title'>Financial Information</h4>
              </div>
              <div className='card-body pt-0'>
                <div className='d-flex flex-column gap-3'>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Market Value:</span>
                    <span className='fw-bold text-success'>
                      {formatCurrency(propertyData.market_value_estimate)}
                    </span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Value Date:</span>
                    <span className='fw-bold'>{formatDate(propertyData.market_value_date)}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Tax Assessment:</span>
                    <span className='fw-bold'>{formatCurrency(propertyData.tax_assessment)}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Tax Year:</span>
                    <span className='fw-bold'>{propertyData.tax_year || 'N/A'}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Last Sold Price:</span>
                    <span className='fw-bold'>{formatCurrency(propertyData.last_sold_price)}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Last Sold Date:</span>
                    <span className='fw-bold'>{formatDate(propertyData.last_sold_date)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Amenities & Features */}
          <div className='col-md-6'>
            <div className='card card-flush h-100'>
              <div className='card-header'>
                <h4 className='card-title'>Amenities & Features</h4>
              </div>
              <div className='card-body pt-0'>
                <div className='d-flex flex-column gap-3'>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Pool:</span>
                    <span className={`badge badge-${propertyData.pool ? 'success' : 'secondary'}`}>
                      {propertyData.pool ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Fireplace:</span>
                    <span className={`badge badge-${propertyData.fireplace ? 'success' : 'secondary'}`}>
                      {propertyData.fireplace ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Central Air:</span>
                    <span className={`badge badge-${propertyData.central_air ? 'success' : 'secondary'}`}>
                      {propertyData.central_air ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Heating Type:</span>
                    <span className='fw-bold'>{propertyData.heating_type || 'N/A'}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Cooling Type:</span>
                    <span className='fw-bold'>{propertyData.cooling_type || 'N/A'}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Roof Material:</span>
                    <span className='fw-bold'>{propertyData.roof_material || 'N/A'}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Exterior Walls:</span>
                    <span className='fw-bold'>{propertyData.exterior_walls || 'N/A'}</span>
                  </div>
                  <div className='d-flex justify-content-between'>
                    <span className='text-muted'>Construction Quality:</span>
                    <span className='fw-bold'>{propertyData.construction_quality || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comparable Sales */}
          {propertyData.comparable_sales && propertyData.comparable_sales.length > 0 && (
            <div className='col-md-6'>
              <div className='card card-flush h-100'>
                <div className='card-header'>
                  <h4 className='card-title'>Recent Comparable Sales</h4>
                </div>
                <div className='card-body pt-0'>
                  <div className='d-flex flex-column gap-3'>
                    {propertyData.comparable_sales.slice(0, 3).map((comp: any, index: number) => (
                      <div key={index} className='d-flex flex-column p-3 bg-light rounded'>
                        <div className='fw-bold text-truncate'>{comp.address || 'Address N/A'}</div>
                        <div className='d-flex justify-content-between'>
                          <span className='text-muted'>Sale Price:</span>
                          <span className='fw-bold text-success'>{formatCurrency(comp.sale_price)}</span>
                        </div>
                        <div className='d-flex justify-content-between'>
                          <span className='text-muted'>Sale Date:</span>
                          <span className='text-muted'>{formatDate(comp.sale_date)}</span>
                        </div>
                        {comp.sqft && (
                          <div className='d-flex justify-content-between'>
                            <span className='text-muted'>$/sq ft:</span>
                            <span className='text-muted'>{formatCurrency(comp.price_per_sqft)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Debug section - show raw data */}
          {process.env.NODE_ENV === 'development' && (
            <div className='col-12 mt-6'>
              <div className='card'>
                <div className='card-header'>
                  <h4 className='card-title text-warning'>🐛 Debug - Raw Property Data</h4>
                </div>
                <div className='card-body'>
                  <pre className='text-muted fs-7 bg-light p-3 rounded' style={{maxHeight: '300px', overflow: 'auto'}}>
                    {JSON.stringify(propertyData, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className='text-center py-5'>
          <i className='ki-duotone ki-home fs-3x text-muted mb-3'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
          <div className='text-muted'>Click "Refresh" to load property data</div>
        </div>
      )}

      {/* Sync Status */}
      {propertyData && (
        <div className='mt-6 pt-6 border-top'>
          <div className='d-flex justify-content-between align-items-center'>
            <span className='text-muted fs-7'>
              Last updated: {formatDate(propertyData.last_attom_sync)}
            </span>
            <span className={`badge badge-${
              propertyData.attom_sync_status === 'success' ? 'success' : 
              propertyData.attom_sync_status === 'error' ? 'danger' : 'warning'
            }`}>
              {propertyData.attom_sync_status || 'unknown'}
            </span>
          </div>
          {propertyData.attom_error_message && (
            <div className='text-danger fs-7 mt-1'>
              Error: {propertyData.attom_error_message}
            </div>
          )}
        </div>
      )}
    </>
  )

  if (showHeader) {
    return (
      <KTCard className={className}>
        <div className='card-header'>
          <h3 className='card-title'>
            <i className='ki-duotone ki-home fs-2 me-2'>
              <span className='path1'></span>
              <span className='path2'></span>
            </i>
            Property Information
          </h3>
          <div className='card-toolbar'>
            <button 
              className='btn btn-sm btn-light-primary'
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? (
                <span className='spinner-border spinner-border-sm me-1'></span>
              ) : (
                <i className='ki-duotone ki-arrows-circle fs-4 me-1'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                </i>
              )}
              Refresh
            </button>
          </div>
        </div>
        <KTCardBody>
          {cardContent}
        </KTCardBody>
      </KTCard>
    )
  }

  return (
    <div className={className}>
      {cardContent}
    </div>
  )
}

export default PropertyDetails