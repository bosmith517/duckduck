import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { VendorManager } from '../../components/vendors/VendorManager'

const VendorsPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[]}>Vendor Management</PageTitle>
      
      <div className="row g-5 g-xl-8">
        <div className="col-xl-12">
          <VendorManager />
        </div>
      </div>
    </>
  )
}

export default VendorsPage