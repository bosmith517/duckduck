import React, { useState } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'

interface InventoryItem {
  id: string
  name: string
  category: string
  sku: string
  quantity: number
  minQuantity: number
  unit: string
  unitCost: number
  totalValue: number
  supplier: string
  location: string
  lastUpdated: string
}

const InventoryPage: React.FC = () => {
  const [inventory] = useState<InventoryItem[]>([
    {
      id: '1',
      name: 'Ceramic Tiles 12x12',
      category: 'Flooring',
      sku: 'TILE-CER-12',
      quantity: 150,
      minQuantity: 50,
      unit: 'sq ft',
      unitCost: 3.50,
      totalValue: 525,
      supplier: 'Tile World',
      location: 'Warehouse A',
      lastUpdated: '2024-01-15'
    },
    {
      id: '2',
      name: 'Kitchen Cabinet Hinges',
      category: 'Hardware',
      sku: 'HINGE-KIT-001',
      quantity: 25,
      minQuantity: 20,
      unit: 'pieces',
      unitCost: 12.99,
      totalValue: 324.75,
      supplier: 'Hardware Plus',
      location: 'Storage Room B',
      lastUpdated: '2024-01-20'
    },
    {
      id: '3',
      name: 'Pressure Treated Lumber 2x4x8',
      category: 'Lumber',
      sku: 'LUM-PT-2X4X8',
      quantity: 8,
      minQuantity: 15,
      unit: 'pieces',
      unitCost: 8.75,
      totalValue: 70,
      supplier: 'Lumber Depot',
      location: 'Yard Storage',
      lastUpdated: '2024-01-25'
    },
    {
      id: '4',
      name: 'Paint - Interior White',
      category: 'Paint & Finishes',
      sku: 'PAINT-INT-WHT',
      quantity: 12,
      minQuantity: 10,
      unit: 'gallons',
      unitCost: 45.99,
      totalValue: 551.88,
      supplier: 'Paint Pro',
      location: 'Storage Room A',
      lastUpdated: '2024-01-18'
    }
  ])

  const getStockStatus = (quantity: number, minQuantity: number) => {
    if (quantity === 0) return { badge: 'badge-light-danger', text: 'Out of Stock' }
    if (quantity <= minQuantity) return { badge: 'badge-light-warning', text: 'Low Stock' }
    return { badge: 'badge-light-success', text: 'In Stock' }
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Inventory Management</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Inventory Control</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Track materials and supplies</span>
              </h3>
              <div className='card-toolbar'>
                <button className='btn btn-sm btn-light me-3'>
                  <i className='ki-duotone ki-exit-down fs-2'></i>
                  Export
                </button>
                <button className='btn btn-sm btn-primary'>
                  <i className='ki-duotone ki-plus fs-2'></i>
                  Add Item
                </button>
              </div>
            </div>
            <KTCardBody className='py-3'>
              <div className='table-responsive'>
                <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                  <thead>
                    <tr className='fw-bold text-muted'>
                      <th className='min-w-200px'>Item</th>
                      <th className='min-w-120px'>Category</th>
                      <th className='min-w-100px'>SKU</th>
                      <th className='min-w-100px'>Quantity</th>
                      <th className='min-w-120px'>Status</th>
                      <th className='min-w-100px'>Unit Cost</th>
                      <th className='min-w-120px'>Total Value</th>
                      <th className='min-w-140px'>Supplier</th>
                      <th className='min-w-100px text-end'>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => {
                      const stockStatus = getStockStatus(item.quantity, item.minQuantity)
                      return (
                        <tr key={item.id}>
                          <td>
                            <div className='d-flex align-items-center'>
                              <div className='d-flex justify-content-start flex-column'>
                                <a href='#' className='text-dark fw-bold text-hover-primary fs-6'>
                                  {item.name}
                                </a>
                                <span className='text-muted fw-semibold fs-7'>
                                  Location: {item.location}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className='text-dark fw-bold d-block fs-6'>
                              {item.category}
                            </span>
                          </td>
                          <td>
                            <span className='text-dark fw-bold d-block fs-6'>
                              {item.sku}
                            </span>
                          </td>
                          <td>
                            <div className='d-flex flex-column'>
                              <span className='text-dark fw-bold fs-6'>
                                {item.quantity} {item.unit}
                              </span>
                              <span className='text-muted fw-semibold fs-7'>
                                Min: {item.minQuantity}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${stockStatus.badge}`}>
                              {stockStatus.text}
                            </span>
                          </td>
                          <td>
                            <span className='text-dark fw-bold d-block fs-6'>
                              ${item.unitCost.toFixed(2)}
                            </span>
                          </td>
                          <td>
                            <span className='text-dark fw-bold d-block fs-6'>
                              ${item.totalValue.toFixed(2)}
                            </span>
                          </td>
                          <td>
                            <span className='text-dark fw-bold d-block fs-6'>
                              {item.supplier}
                            </span>
                          </td>
                          <td>
                            <div className='d-flex justify-content-end flex-shrink-0'>
                              <a
                                href='#'
                                className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                                title='Edit Item'
                              >
                                <i className='ki-duotone ki-pencil fs-3'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </a>
                              <a
                                href='#'
                                className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                                title='Adjust Stock'
                              >
                                <i className='ki-duotone ki-arrows-loop fs-3'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </a>
                              <a
                                href='#'
                                className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm'
                                title='Delete'
                              >
                                <i className='ki-duotone ki-trash fs-3'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                  <span className='path3'></span>
                                  <span className='path4'></span>
                                  <span className='path5'></span>
                                </i>
                              </a>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </>
  )
}

export default InventoryPage
