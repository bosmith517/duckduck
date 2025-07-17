import React from 'react'

interface JobCostingStatusProps {
  job: {
    id: string
    title: string
    contract_price?: number
    estimated_cost?: number
    actual_cost?: number
  }
}

export const JobCostingStatus: React.FC<JobCostingStatusProps> = ({ job }) => {
  const contractPrice = job.contract_price || 0
  const estimatedCost = job.estimated_cost || 0
  const actualCost = job.actual_cost || 0
  
  const expectedProfit = contractPrice - estimatedCost
  const actualProfit = contractPrice - actualCost
  const profitMargin = contractPrice > 0 ? (expectedProfit / contractPrice) * 100 : 0
  
  return (
    <div className="card">
      <div className="card-header">
        <h5 className="card-title mb-0">Job Costing Status</h5>
      </div>
      <div className="card-body">
        <div className="row g-3">
          <div className="col-md-6">
            <h6 className="fw-bold">Financial Summary</h6>
            <table className="table table-sm">
              <tbody>
                <tr>
                  <td>Contract Price:</td>
                  <td className="text-end fw-bold">
                    ${contractPrice.toFixed(2)}
                    {contractPrice === 0 && (
                      <span className="badge badge-light-danger ms-2">Not Set</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Estimated Cost:</td>
                  <td className="text-end">${estimatedCost.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Actual Cost:</td>
                  <td className="text-end">${actualCost.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Expected Profit:</td>
                  <td className={`text-end fw-bold ${expectedProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                    ${expectedProfit.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td>Profit Margin:</td>
                  <td className={`text-end fw-bold ${profitMargin >= 0 ? 'text-success' : 'text-danger'}`}>
                    {profitMargin.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="col-md-6">
            <h6 className="fw-bold">Quick Actions</h6>
            {contractPrice === 0 && (
              <div className="alert alert-warning">
                <strong>Action Required:</strong> Set the contract price to get accurate profit calculations.
              </div>
            )}
            
            <div className="mb-3">
              <strong>For Scott Davis Job:</strong>
              <ul className="list-unstyled mt-2">
                <li>• Contract Price should be: <strong>$1,000</strong></li>
                <li>• Estimated Cost should be: <strong>$300</strong></li>
                <li>• Expected Profit: <strong>$700 (70%)</strong></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default JobCostingStatus