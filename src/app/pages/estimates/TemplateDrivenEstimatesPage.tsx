import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import TemplateDrivenEstimates from '../../components/estimates/TemplateDrivenEstimates'

const TemplateDrivenEstimatesPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[
        { title: 'Estimates', path: '/estimates' },
        { title: 'Template-Driven', path: '/estimates/templates' }
      ]}>
        Template-Driven Estimates ⚡
      </PageTitle>
      
      <TemplateDrivenEstimates />
    </>
  )
}

export default TemplateDrivenEstimatesPage