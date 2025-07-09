import React from 'react'
import MobileLayout from '../../components/mobile/MobileLayout'
import { MyDayDashboard } from '../../components/mobile/MyDayDashboard'

const MobileMyDayPage: React.FC = () => {
  return (
    <MobileLayout title="My Day" showBackButton={false}>
      <MyDayDashboard />
    </MobileLayout>
  )
}

export default MobileMyDayPage