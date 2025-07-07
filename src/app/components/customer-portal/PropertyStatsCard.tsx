import React from 'react'

interface PropertyData {
  zestimate?: number
  yearBuilt?: number
  squareFootage?: number
  bedrooms?: number
  bathrooms?: number
  propertyType?: string
  lastSoldPrice?: number
  lastSoldDate?: string
  taxAssessment?: number
  pricePerSqFt?: number
  annualTaxAmount?: number
}

interface PropertyStatsCardProps {
  propertyData: PropertyData
}

const PropertyStatsCard: React.FC<PropertyStatsCardProps> = ({ propertyData }) => {
  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`
  const formatNumber = (num: number) => num.toLocaleString()

  // Calculate trends and insights
  const marketValuePerSqFt = propertyData.zestimate && propertyData.squareFootage 
    ? Math.round(propertyData.zestimate / propertyData.squareFootage)
    : propertyData.pricePerSqFt

  const appreciation = propertyData.zestimate && propertyData.lastSoldPrice
    ? ((propertyData.zestimate - propertyData.lastSoldPrice) / propertyData.lastSoldPrice * 100)
    : null

  return (
    <div className="card shadow-sm mb-6">
      <div className="card-header border-0 pt-6">
        <div className="card-title">
          <div className="d-flex align-items-center">
            <i className="ki-duotone ki-chart-line-up fs-2 text-primary me-3">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            <div>
              <h3 className="fw-bold text-gray-900 mb-1">Property Value Overview</h3>
              <div className="text-muted fs-7">Real-time market data and insights</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="card-body pt-0">
        {/* Primary Metrics Row */}
        <div className="row g-4 mb-6">
          {/* Market Value - Primary KPI */}
          <div className="col-lg-4">
            <div className="card border border-primary h-100">
              <div className="card-body text-center py-6">
                <i className="ki-duotone ki-dollar fs-3x text-primary mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <div className="fw-bold text-gray-900 fs-2x mb-2">
                  {propertyData.zestimate ? formatCurrency(propertyData.zestimate) : 'N/A'}
                </div>
                <div className="text-muted fs-6 fw-semibold mb-2">Current Market Value</div>
                {appreciation !== null && (
                  <div className={`badge fs-7 fw-bold ${appreciation >= 0 ? 'badge-light-success text-success' : 'badge-light-danger text-danger'}`}>
                    {appreciation >= 0 ? '↗' : '↘'} {Math.abs(appreciation).toFixed(1)}% since purchase
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Square Footage */}
          <div className="col-lg-4">
            <div className="card border h-100">
              <div className="card-body text-center py-6">
                <i className="ki-duotone ki-home-3 fs-3x text-success mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="fw-bold text-gray-900 fs-2x mb-2">
                  {propertyData.squareFootage ? formatNumber(propertyData.squareFootage) : 'N/A'}
                </div>
                <div className="text-muted fs-6 fw-semibold mb-2">Square Feet</div>
                {marketValuePerSqFt && (
                  <div className="badge badge-light-info text-info fs-7 fw-bold">
                    {formatCurrency(marketValuePerSqFt)}/sq ft
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Property Age */}
          <div className="col-lg-4">
            <div className="card border h-100">
              <div className="card-body text-center py-6">
                <i className="ki-duotone ki-calendar fs-3x text-warning mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="fw-bold text-gray-900 fs-2x mb-2">
                  {propertyData.yearBuilt ? new Date().getFullYear() - propertyData.yearBuilt : 'N/A'}
                </div>
                <div className="text-muted fs-6 fw-semibold mb-2">Years Old</div>
                {propertyData.yearBuilt && (
                  <div className="badge badge-light-secondary text-secondary fs-7 fw-bold">
                    Built in {propertyData.yearBuilt}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Metrics Row */}
        <div className="row g-3">
          {/* Bedrooms & Bathrooms */}
          {(propertyData.bedrooms || propertyData.bathrooms) && (
            <div className="col-md-3">
              <div className="d-flex align-items-center p-3 bg-light-primary rounded">
                <i className="ki-duotone ki-home-2 fs-2 text-primary me-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div>
                  <div className="fw-bold text-gray-900 fs-5">
                    {propertyData.bedrooms || 0}bd / {propertyData.bathrooms || 0}ba
                  </div>
                  <div className="text-muted fs-7">Bed/Bath</div>
                </div>
              </div>
            </div>
          )}

          {/* Tax Assessment */}
          {propertyData.taxAssessment && (
            <div className="col-md-3">
              <div className="d-flex align-items-center p-3 bg-light-warning rounded">
                <i className="ki-duotone ki-percentage fs-2 text-warning me-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div>
                  <div className="fw-bold text-gray-900 fs-5">{formatCurrency(propertyData.taxAssessment)}</div>
                  <div className="text-muted fs-7">Tax Assessment</div>
                </div>
              </div>
            </div>
          )}

          {/* Annual Taxes */}
          {propertyData.annualTaxAmount && (
            <div className="col-md-3">
              <div className="d-flex align-items-center p-3 bg-light-danger rounded">
                <i className="ki-duotone ki-document fs-2 text-danger me-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div>
                  <div className="fw-bold text-gray-900 fs-5">{formatCurrency(propertyData.annualTaxAmount)}</div>
                  <div className="text-muted fs-7">Annual Taxes</div>
                </div>
              </div>
            </div>
          )}

          {/* Property Type */}
          {propertyData.propertyType && (
            <div className="col-md-3">
              <div className="d-flex align-items-center p-3 bg-light-info rounded">
                <i className="ki-duotone ki-home fs-2 text-info me-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div>
                  <div className="fw-bold text-gray-900 fs-5">{propertyData.propertyType}</div>
                  <div className="text-muted fs-7">Property Type</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Last Sale Information */}
        {(propertyData.lastSoldPrice || propertyData.lastSoldDate) && (
          <div className="separator my-4"></div>
        )}
        {(propertyData.lastSoldPrice || propertyData.lastSoldDate) && (
          <div className="row">
            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center p-4 bg-light-secondary rounded">
                <div className="d-flex align-items-center">
                  <i className="ki-duotone ki-handshake fs-2 text-secondary me-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <div>
                    <div className="fw-bold text-gray-900">Last Sale Information</div>
                    <div className="text-muted fs-7">Historical transaction data</div>
                  </div>
                </div>
                <div className="text-end">
                  {propertyData.lastSoldPrice && (
                    <div className="fw-bold text-gray-900 fs-5">{formatCurrency(propertyData.lastSoldPrice)}</div>
                  )}
                  {propertyData.lastSoldDate && (
                    <div className="text-muted fs-7">{propertyData.lastSoldDate}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Refresh Notice */}
        <div className="text-center mt-4">
          <div className="text-muted fs-8">
            <i className="ki-duotone ki-information-5 fs-7 me-1">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
            </i>
            Property data refreshed monthly • Market value is an estimate
          </div>
        </div>
      </div>
    </div>
  )
}

export default PropertyStatsCard