import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { WorkflowAutomationManager } from '../../components/workflow/WorkflowAutomationManager'
import { NotificationCenter } from '../../components/workflow/NotificationCenter'

const WorkflowAutomationPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[
        { title: 'Settings', path: '/settings', isSeparator: false },
        { title: 'Workflow Automation', path: '/settings/workflow-automation', isSeparator: true, isActive: true }
      ]}>
        Workflow Automation
      </PageTitle>
      
      <div className="row g-5 g-xl-8">
        <div className="col-xl-8">
          <WorkflowAutomationManager />
        </div>
        <div className="col-xl-4">
          <NotificationCenter />
        </div>
      </div>
    </>
  )
}

export default WorkflowAutomationPage