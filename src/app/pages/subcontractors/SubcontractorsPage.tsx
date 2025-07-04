import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { SubcontractorManager } from '../../components/subcontractors/SubcontractorManager'

const SubcontractorsPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[]}>Subcontractor Network</PageTitle>
      
      <div className="row g-5 g-xl-8">
        <div className="col-xl-12">
          <SubcontractorManager />
        </div>
      </div>
    </>
  )
}

export default SubcontractorsPage