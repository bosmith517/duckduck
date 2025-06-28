import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import ProfitabilityReports from '../../components/billing/ProfitabilityReports'

const ProfitabilityPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[]}>Profitability Reports</PageTitle>
      
      <div className="row g-5 g-xl-8">
        <div className="col-12">
          <ProfitabilityReports />
        </div>
      </div>
    </>
  )
}

export default ProfitabilityPage