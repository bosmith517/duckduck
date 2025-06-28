import React, { useState, useEffect } from 'react'
import { MenuComponent } from '../../../_metronic/assets/ts/components'
import { Modal } from 'bootstrap'

const UITestPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false)
  const [accounts] = useState([
    { id: '1', name: 'Test Account 1' },
    { id: '2', name: 'Test Account 2' }
  ])

  // Initialize Metronic components when page loads
  useEffect(() => {
    // Reinitialize MenuComponent for this page
    MenuComponent.reinitialization()
  }, [])

  const handleOpenModal = () => {
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
  }

  const handleSaveAccount = (data: any) => {
    console.log('Saving account:', data)
    alert('Account saved successfully!')
    setShowModal(false)
  }

  return (
    <div className='d-flex flex-column flex-column-fluid'>
      {/* Header */}
      <div className='app-toolbar py-3 py-lg-6'>
        <div className='app-container container-xxl d-flex flex-stack'>
          <div className='page-title d-flex flex-column justify-content-center flex-wrap me-3'>
            <h1 className='page-heading d-flex text-dark fw-bold fs-3 flex-column justify-content-center my-0'>
              UI Component Test Page
            </h1>
            <ul className='breadcrumb breadcrumb-separatorless fw-semibold fs-7 my-0 pt-1'>
              <li className='breadcrumb-item text-muted'>
                <span className='text-muted'>Test</span>
              </li>
              <li className='breadcrumb-item'>
                <span className='bullet bg-gray-400 w-5px h-2px'></span>
              </li>
              <li className='breadcrumb-item text-muted'>UI Components</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className='app-content flex-column-fluid'>
        <div className='app-container container-xxl'>
          <div className='row g-5 g-xl-10 mb-5 mb-xl-10'>
            
            {/* Test Dropdown Menu */}
            <div className='col-md-6 col-lg-6 col-xl-6 col-xxl-3 mb-md-5 mb-xl-10'>
              <div className='card card-flush h-md-50 mb-5 mb-xl-10'>
                <div className='card-header pt-5'>
                  <div className='card-title d-flex flex-column'>
                    <span className='fs-2hx fw-bold text-dark me-2 lh-1 ls-n2'>Dropdown Test</span>
                    <span className='text-gray-400 pt-1 fw-semibold fs-6'>Test Metronic dropdown</span>
                  </div>
                </div>
                <div className='card-body pt-2 pb-4 d-flex align-items-center'>
                  <div className='d-flex flex-center me-5 pt-2'>
                    <div className='menu-item'>
                      <div
                        className='btn btn-primary'
                        data-kt-menu-trigger='click'
                        data-kt-menu-placement='bottom-start'
                      >
                        Test Dropdown
                        <i className='ki-duotone ki-down fs-5 ms-1'></i>
                      </div>
                      <div
                        className='menu menu-sub menu-sub-dropdown menu-column menu-rounded menu-gray-600 menu-state-bg-light-primary fw-semibold fs-7 w-200px py-4'
                        data-kt-menu='true'
                      >
                        <div className='menu-item px-3'>
                          <a href='#' className='menu-link px-3'>
                            Option 1
                          </a>
                        </div>
                        <div className='menu-item px-3'>
                          <a href='#' className='menu-link px-3'>
                            Option 2
                          </a>
                        </div>
                        <div className='menu-item px-3'>
                          <a href='#' className='menu-link px-3'>
                            Option 3
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Modal Button */}
            <div className='col-md-6 col-lg-6 col-xl-6 col-xxl-3 mb-md-5 mb-xl-10'>
              <div className='card card-flush h-md-50 mb-5 mb-xl-10'>
                <div className='card-header pt-5'>
                  <div className='card-title d-flex flex-column'>
                    <span className='fs-2hx fw-bold text-dark me-2 lh-1 ls-n2'>Modal Test</span>
                    <span className='text-gray-400 pt-1 fw-semibold fs-6'>Test modal functionality</span>
                  </div>
                </div>
                <div className='card-body pt-2 pb-4 d-flex align-items-center'>
                  <div className='d-flex flex-center me-5 pt-2'>
                    <button
                      type='button'
                      className='btn btn-success'
                      onClick={handleOpenModal}
                    >
                      Open Test Modal
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Form */}
            <div className='col-md-12'>
              <div className='card card-flush'>
                <div className='card-header pt-5'>
                  <div className='card-title d-flex flex-column'>
                    <span className='fs-2hx fw-bold text-dark me-2 lh-1 ls-n2'>Form Test</span>
                    <span className='text-gray-400 pt-1 fw-semibold fs-6'>Test form submission</span>
                  </div>
                </div>
                <div className='card-body pt-2 pb-4'>
                  <form onSubmit={(e) => { e.preventDefault(); alert('Form submitted!'); }}>
                    <div className='row'>
                      <div className='col-md-6 mb-7'>
                        <label className='required fw-semibold fs-6 mb-2'>Test Field 1</label>
                        <input
                          type='text'
                          className='form-control form-control-solid'
                          placeholder='Enter test value'
                        />
                      </div>
                      <div className='col-md-6 mb-7'>
                        <label className='required fw-semibold fs-6 mb-2'>Test Field 2</label>
                        <select className='form-select form-select-solid'>
                          <option value=''>Select option</option>
                          <option value='1'>Option 1</option>
                          <option value='2'>Option 2</option>
                        </select>
                      </div>
                      <div className='col-md-12'>
                        <button type='submit' className='btn btn-primary'>
                          Submit Test Form
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Test Modal */}
      {showModal && (
        <div className='modal fade show d-block' tabIndex={-1} role='dialog'>
          <div className='modal-dialog modal-dialog-centered modal-lg' role='document'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>Test Modal</h5>
                <button
                  type='button'
                  className='btn-close'
                  onClick={handleCloseModal}
                  aria-label='Close'
                ></button>
              </div>
              <div className='modal-body'>
                <form onSubmit={(e) => { e.preventDefault(); handleSaveAccount({ name: 'Test Account' }); }}>
                  <div className='row'>
                    <div className='col-md-12 mb-7'>
                      <label className='required fw-semibold fs-6 mb-2'>Account Name</label>
                      <input
                        type='text'
                        className='form-control form-control-solid'
                        placeholder='Enter account name'
                        defaultValue='Test Account'
                      />
                    </div>
                    <div className='col-md-12 mb-7'>
                      <label className='required fw-semibold fs-6 mb-2'>Account Type</label>
                      <select className='form-select form-select-solid'>
                        <option value='prospect'>Prospect</option>
                        <option value='customer'>Customer</option>
                        <option value='vendor'>Vendor</option>
                      </select>
                    </div>
                  </div>
                  <div className='modal-footer'>
                    <button
                      type='button'
                      className='btn btn-light'
                      onClick={handleCloseModal}
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      className='btn btn-primary'
                    >
                      Save Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UITestPage
