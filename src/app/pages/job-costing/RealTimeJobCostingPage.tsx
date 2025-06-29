import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import RealTimeJobCosting from '../../components/job-costing/RealTimeJobCosting'

const RealTimeJobCostingPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[
        { title: 'Jobs', path: '/jobs' },
        { title: 'Real-Time Costing', path: '/jobs/costing' }
      ]}>
        Real-Time Job Costing 💰
      </PageTitle>
      
      <RealTimeJobCosting />
    </>
  )
}

export default RealTimeJobCostingPage