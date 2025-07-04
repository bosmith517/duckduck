import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { TeamAssignmentService, JobTeamAssignment } from '../../services/teamAssignmentService'
import { MaterialOrderService, JobMaterialOrder } from '../../services/teamAssignmentService'
import { showToast } from '../../utils/toast'

interface TeamMaterialsStats {
  totalTeamMembers: number
  activeAssignments: number
  totalMaterialOrders: number
  pendingOrders: number
  overdueOrders: number
  totalOrderValue: number
}

const TeamMaterialsPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<TeamMaterialsStats>({
    totalTeamMembers: 0,
    activeAssignments: 0,
    totalMaterialOrders: 0,
    pendingOrders: 0,
    overdueOrders: 0,
    totalOrderValue: 0
  })
  const [recentAssignments, setRecentAssignments] = useState<JobTeamAssignment[]>([])
  const [recentOrders, setRecentOrders] = useState<JobMaterialOrder[]>([])
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadDashboardData()
    }
  }, [userProfile?.tenant_id])

  const loadDashboardData = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      
      // Load team assignments
      const assignments = await TeamAssignmentService.getAllTeamAssignments(userProfile.tenant_id)
      const activeAssignments = assignments.filter(a => a.status === 'active' || a.status === 'assigned')
      
      // Load material orders
      const orders = await MaterialOrderService.getAllMaterialOrders(userProfile.tenant_id)
      const pendingOrders = orders.filter(o => o.status === 'pending')
      const overdueOrders = orders.filter(o => 
        o.expected_delivery && 
        new Date(o.expected_delivery) < new Date() && 
        (o.status === 'ordered' || o.status === 'partial')
      )
      const totalOrderValue = orders.reduce((sum, order) => sum + (order.order_total || 0), 0)

      // Get unique team members
      const uniqueTeamMembers = new Set(
        assignments.map(a => a.assignment_type === 'internal' ? a.user_id : a.contractor_name)
      ).size

      setStats({
        totalTeamMembers: uniqueTeamMembers,
        activeAssignments: activeAssignments.length,
        totalMaterialOrders: orders.length,
        pendingOrders: pendingOrders.length,
        overdueOrders: overdueOrders.length,
        totalOrderValue
      })

      // Get recent data
      setRecentAssignments(assignments.slice(0, 5))
      setRecentOrders(orders.slice(0, 5))

    } catch (error) {
      console.error('Error loading dashboard data:', error)
      showToast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'badge-light-success'
      case 'assigned': return 'badge-light-info'
      case 'completed': return 'badge-light-primary'
      case 'pending': return 'badge-light-warning'
      case 'ordered': return 'badge-light-info'
      case 'delivered': return 'badge-light-success'
      case 'cancelled': return 'badge-light-danger'
      default: return 'badge-light-secondary'
    }
  }

  if (loading) {
    return (
      <div className='d-flex justify-content-center align-items-center' style={{ minHeight: '400px' }}>
        <div className='spinner-border text-primary' role='status'>
          <span className='visually-hidden'>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Team & Materials Dashboard</PageTitle>

      <div className='row g-5 g-xl-8'>
        {/* Stats Cards */}
        <div className='col-xl-12'>
          <div className='row g-5'>
            <div className='col-sm-6 col-xl-2'>
              <KTCard className='card-flush bgi-no-repeat bgi-size-contain bgi-position-x-end h-md-50px mb-5 mb-xl-10'>
                <KTCardBody className='text-center'>
                  <div className='text-gray-900 fw-bold fs-6 mb-2'>Team Members</div>
                  <div className='fw-bold text-primary fs-1'>{stats.totalTeamMembers}</div>
                </KTCardBody>
              </KTCard>
            </div>
            <div className='col-sm-6 col-xl-2'>
              <KTCard className='card-flush bgi-no-repeat bgi-size-contain bgi-position-x-end h-md-50px mb-5 mb-xl-10'>
                <KTCardBody className='text-center'>
                  <div className='text-gray-900 fw-bold fs-6 mb-2'>Active Assignments</div>
                  <div className='fw-bold text-success fs-1'>{stats.activeAssignments}</div>
                </KTCardBody>
              </KTCard>
            </div>
            <div className='col-sm-6 col-xl-2'>
              <KTCard className='card-flush bgi-no-repeat bgi-size-contain bgi-position-x-end h-md-50px mb-5 mb-xl-10'>
                <KTCardBody className='text-center'>
                  <div className='text-gray-900 fw-bold fs-6 mb-2'>Material Orders</div>
                  <div className='fw-bold text-info fs-1'>{stats.totalMaterialOrders}</div>
                </KTCardBody>
              </KTCard>
            </div>
            <div className='col-sm-6 col-xl-2'>
              <KTCard className='card-flush bgi-no-repeat bgi-size-contain bgi-position-x-end h-md-50px mb-5 mb-xl-10'>
                <KTCardBody className='text-center'>
                  <div className='text-gray-900 fw-bold fs-6 mb-2'>Pending Orders</div>
                  <div className='fw-bold text-warning fs-1'>{stats.pendingOrders}</div>
                </KTCardBody>
              </KTCard>
            </div>
            <div className='col-sm-6 col-xl-2'>
              <KTCard className='card-flush bgi-no-repeat bgi-size-contain bgi-position-x-end h-md-50px mb-5 mb-xl-10'>
                <KTCardBody className='text-center'>
                  <div className='text-gray-900 fw-bold fs-6 mb-2'>Overdue Orders</div>
                  <div className='fw-bold text-danger fs-1'>{stats.overdueOrders}</div>
                </KTCardBody>
              </KTCard>
            </div>
            <div className='col-sm-6 col-xl-2'>
              <KTCard className='card-flush bgi-no-repeat bgi-size-contain bgi-position-x-end h-md-50px mb-5 mb-xl-10'>
                <KTCardBody className='text-center'>
                  <div className='text-gray-900 fw-bold fs-6 mb-2'>Total Order Value</div>
                  <div className='fw-bold text-primary fs-1'>{formatCurrency(stats.totalOrderValue)}</div>
                </KTCardBody>
              </KTCard>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className='col-xl-12'>
          <div className='card card-flush'>
            <div className='card-header align-items-center py-5 gap-2 gap-md-5'>
              <ul className='nav nav-stretch nav-line-tabs nav-line-tabs-2x border-transparent fs-5 fw-bolder'>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'overview' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('overview')
                    }}
                  >
                    <i className='ki-duotone ki-chart-simple fs-6 me-1'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                      <span className='path4'></span>
                    </i>
                    Overview
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'assignments' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('assignments')
                    }}
                  >
                    <i className='ki-duotone ki-people fs-6 me-1'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                      <span className='path4'></span>
                      <span className='path5'></span>
                    </i>
                    Team Assignments
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'materials' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('materials')
                    }}
                  >
                    <i className='ki-duotone ki-package fs-6 me-1'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                    </i>
                    Material Orders
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className='col-xl-12'>
          {activeTab === 'overview' && (
            <div className='row g-5'>
              {/* Recent Team Assignments */}
              <div className='col-xl-6'>
                <KTCard>
                  <div className='card-header'>
                    <h3 className='card-title'>Recent Team Assignments</h3>
                  </div>
                  <KTCardBody>
                    {recentAssignments.length === 0 ? (
                      <div className='text-center text-muted py-10'>
                        <i className='ki-duotone ki-people fs-3x text-muted mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                          <span className='path4'></span>
                          <span className='path5'></span>
                        </i>
                        <div>No team assignments yet</div>
                      </div>
                    ) : (
                      <div className='table-responsive'>
                        <table className='table table-row-bordered'>
                          <thead>
                            <tr className='fw-semibold fs-6 text-gray-800'>
                              <th>Team Member</th>
                              <th>Role</th>
                              <th>Status</th>
                              <th>Job</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentAssignments.map((assignment) => (
                              <tr key={assignment.id}>
                                <td>
                                  <div className='fw-bold'>
                                    {assignment.assignment_type === 'internal' ? 
                                      `${assignment.user_profile?.first_name || ''} ${assignment.user_profile?.last_name || ''}`.trim() :
                                      assignment.contractor_name
                                    }
                                  </div>
                                </td>
                                <td>
                                  <span className='badge badge-light-primary'>
                                    {assignment.role.replace('_', ' ').toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${getStatusColor(assignment.status)}`}>
                                    {assignment.status.replace('_', ' ').toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  <div className='text-muted fs-7'>
                                    {assignment.job?.title || 'N/A'}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </KTCardBody>
                </KTCard>
              </div>

              {/* Recent Material Orders */}
              <div className='col-xl-6'>
                <KTCard>
                  <div className='card-header'>
                    <h3 className='card-title'>Recent Material Orders</h3>
                  </div>
                  <KTCardBody>
                    {recentOrders.length === 0 ? (
                      <div className='text-center text-muted py-10'>
                        <i className='ki-duotone ki-package fs-3x text-muted mb-3'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                        </i>
                        <div>No material orders yet</div>
                      </div>
                    ) : (
                      <div className='table-responsive'>
                        <table className='table table-row-bordered'>
                          <thead>
                            <tr className='fw-semibold fs-6 text-gray-800'>
                              <th>Vendor</th>
                              <th>Status</th>
                              <th>Amount</th>
                              <th>Job</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentOrders.map((order) => (
                              <tr key={order.id}>
                                <td>
                                  <div className='fw-bold'>{order.vendor_name}</div>
                                </td>
                                <td>
                                  <span className={`badge ${getStatusColor(order.status)}`}>
                                    {order.status.replace('_', ' ').toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  <span className='fw-bold text-success'>
                                    {formatCurrency(order.order_total || 0)}
                                  </span>
                                </td>
                                <td>
                                  <div className='text-muted fs-7'>
                                    {order.job?.title || 'N/A'}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </KTCardBody>
                </KTCard>
              </div>
            </div>
          )}

          {activeTab === 'assignments' && (
            <div className='text-center py-10'>
              <div className='text-muted mb-3'>
                <i className='ki-duotone ki-wrench fs-3x text-muted mb-3'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                </i>
              </div>
              <div className='text-muted mb-3'>
                Full team assignments management coming soon!
              </div>
              <div className='text-muted fs-7'>
                For now, manage team assignments from individual job pages in the "Team & Materials" tab.
              </div>
            </div>
          )}

          {activeTab === 'materials' && (
            <div className='text-center py-10'>
              <div className='text-muted mb-3'>
                <i className='ki-duotone ki-wrench fs-3x text-muted mb-3'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                </i>
              </div>
              <div className='text-muted mb-3'>
                Full material orders management coming soon!
              </div>
              <div className='text-muted fs-7'>
                For now, manage material orders from individual job pages in the "Team & Materials" tab.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default TeamMaterialsPage