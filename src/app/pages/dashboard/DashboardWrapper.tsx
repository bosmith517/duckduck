import {useIntl} from 'react-intl'
import {PageTitle} from '../../../_metronic/layout/core'
import {
  ListsWidget2,
  ListsWidget3,
  ListsWidget4,
  ListsWidget5,
  ListsWidget6,
  MixedWidget10,
  MixedWidget11,
  MixedWidget2,
  MixedWidget8,
  TablesWidget10,
  TilesWidget1,
  TilesWidget2,
  TilesWidget3,
  TilesWidget4,
  TilesWidget5,
} from '../../../_metronic/partials/widgets'
import NewFeaturesWidget from '../../components/dashboard/NewFeaturesWidget'

const DashboardPage = () => (
  <>
    {/* KPI Cards Row */}
    <div className='row g-5 g-xl-8 mb-8'>
      <div className='col-xl-3'>
        <div className='card card-xl-stretch mb-xl-8'>
          <div className='card-body'>
            <div className='d-flex align-items-center'>
              <div className='symbol symbol-50px me-5'>
                <div className='symbol-label bg-light-primary'>
                  <i className='ki-duotone ki-briefcase fs-2x text-primary'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                </div>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bold fs-6 text-gray-800'>12</span>
                <span className='fw-semibold fs-7 text-gray-400'>Active Jobs</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className='col-xl-3'>
        <div className='card card-xl-stretch mb-xl-8'>
          <div className='card-body'>
            <div className='d-flex align-items-center'>
              <div className='symbol symbol-50px me-5'>
                <div className='symbol-label bg-light-warning'>
                  <i className='ki-duotone ki-file-text fs-2x text-warning'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                </div>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bold fs-6 text-gray-800'>8</span>
                <span className='fw-semibold fs-7 text-gray-400'>Pending Estimates</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className='col-xl-3'>
        <div className='card card-xl-stretch mb-xl-8'>
          <div className='card-body'>
            <div className='d-flex align-items-center'>
              <div className='symbol symbol-50px me-5'>
                <div className='symbol-label bg-light-danger'>
                  <i className='ki-duotone ki-bill fs-2x text-danger'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                    <span className='path3'></span>
                    <span className='path4'></span>
                    <span className='path5'></span>
                    <span className='path6'></span>
                  </i>
                </div>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bold fs-6 text-gray-800'>3</span>
                <span className='fw-semibold fs-7 text-gray-400'>Overdue Invoices</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className='col-xl-3'>
        <div className='card card-xl-stretch mb-xl-8'>
          <div className='card-body'>
            <div className='d-flex align-items-center'>
              <div className='symbol symbol-50px me-5'>
                <div className='symbol-label bg-light-success'>
                  <i className='ki-duotone ki-dollar fs-2x text-success'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                    <span className='path3'></span>
                  </i>
                </div>
              </div>
              <div className='d-flex flex-column'>
                <span className='fw-bold fs-6 text-gray-800'>$45,200</span>
                <span className='fw-semibold fs-7 text-gray-400'>Revenue This Month</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* New Features Showcase */}
    <div className='row g-5 g-xl-8 mb-8'>
      <div className='col-xl-12'>
        <NewFeaturesWidget />
      </div>
    </div>

    {/* Charts and Widgets Row */}
    <div className='row g-5 g-xl-8 mb-8'>
      <div className='col-xl-8'>
        <div className='card card-xl-stretch mb-xl-8'>
          <div className='card-header border-0 pt-5'>
            <h3 className='card-title align-items-start flex-column'>
              <span className='card-label fw-bold fs-3 mb-1'>Monthly Revenue Trend</span>
              <span className='text-muted mt-1 fw-semibold fs-7'>Revenue performance over the last 6 months</span>
            </h3>
          </div>
          <div className='card-body'>
            <MixedWidget8
              className='card-xxl-stretch'
              chartColor='success'
              chartHeight='300px'
            />
          </div>
        </div>
      </div>
      
      <div className='col-xl-4'>
        <div className='card card-xl-stretch mb-xl-8'>
          <div className='card-header border-0 pt-5'>
            <h3 className='card-title align-items-start flex-column'>
              <span className='card-label fw-bold fs-3 mb-1'>Quick Actions</span>
              <span className='text-muted mt-1 fw-semibold fs-7'>Common tasks</span>
            </h3>
          </div>
          <div className='card-body'>
            <div className='d-flex flex-column'>
              <a href='/estimates' className='btn btn-light-primary mb-3'>
                <i className='ki-duotone ki-plus fs-2 me-2'></i>
                Create New Estimate
              </a>
              <a href='/jobs' className='btn btn-light-info mb-3'>
                <i className='ki-duotone ki-briefcase fs-2 me-2'></i>
                View Active Jobs
              </a>
              <a href='/invoices' className='btn btn-light-warning mb-3'>
                <i className='ki-duotone ki-bill fs-2 me-2'></i>
                Review Overdue Invoices
              </a>
              <a href='/reports' className='btn btn-light-success'>
                <i className='ki-duotone ki-chart-simple fs-2 me-2'></i>
                Generate Project Report
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
)

const DashboardWrapper = () => {
  const intl = useIntl()
  return (
    <>
      <PageTitle breadcrumbs={[]}>{intl.formatMessage({id: 'MENU.DASHBOARD'})}</PageTitle>
      <DashboardPage />
    </>
  )
}

export {DashboardWrapper}
