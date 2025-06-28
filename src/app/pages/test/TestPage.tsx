import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'

const TestPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[]}>Test Page</PageTitle>
      <div className='card'>
        <div className='card-body'>
          <h1>Test Page - Routing Works!</h1>
          <p>If you can see this page with the sidebar, then the routing and layout are working correctly.</p>
          <p>This means all the TradeWorks Pro pages should be accessible via the sidebar navigation.</p>
        </div>
      </div>
    </>
  )
}

export default TestPage
