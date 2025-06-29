import React from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import WhiteLabelBrandingManager from '../../components/branding/WhiteLabelBrandingManager'

const BrandingSettingsPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[
        { title: 'Settings', path: '/settings' },
        { title: 'Branding', path: '/settings/branding' }
      ]}>
        White-Label Branding
      </PageTitle>
      
      <WhiteLabelBrandingManager />
    </>
  )
}

export default BrandingSettingsPage