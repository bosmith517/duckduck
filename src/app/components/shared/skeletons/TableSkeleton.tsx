import React from 'react'

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 6 }) => {
  return (
    <div className='table-responsive'>
      <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
        <thead>
          <tr className='fw-bold text-muted'>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} className='min-w-120px'>
                <div className='placeholder-glow'>
                  <span className='placeholder col-8'></span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex}>
                  <div className='placeholder-glow'>
                    <span className='placeholder col-10'></span>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const CardSkeleton: React.FC = () => {
  return (
    <div className='card card-bordered'>
      <div className='card-body'>
        <div className='placeholder-glow'>
          <span className='placeholder col-6 mb-3'></span>
          <span className='placeholder col-8 mb-2'></span>
          <span className='placeholder col-4'></span>
        </div>
      </div>
    </div>
  )
}

export const StatCardSkeleton: React.FC = () => {
  return (
    <div className='card card-bordered'>
      <div className='card-body'>
        <div className='d-flex align-items-center'>
          <div className='symbol symbol-50px me-5'>
            <span className='symbol-label bg-light-secondary'>
              <div className='placeholder-glow'>
                <span className='placeholder col-12' style={{ height: '24px' }}></span>
              </div>
            </span>
          </div>
          <div className='d-flex flex-column flex-grow-1'>
            <div className='placeholder-glow'>
              <span className='placeholder col-8 mb-2'></span>
              <span className='placeholder col-6'></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const PaymentScheduleSkeleton: React.FC = () => {
  return (
    <div className='card card-bordered'>
      <div className='card-header'>
        <div className='placeholder-glow'>
          <span className='placeholder col-4'></span>
        </div>
        <div className='card-toolbar'>
          <div className='placeholder-glow'>
            <span className='placeholder col-12' style={{ width: '120px', height: '32px' }}></span>
          </div>
        </div>
      </div>
      <div className='card-body'>
        {/* Summary Cards */}
        <div className='row mb-7'>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className='col-md-3'>
              <div className='d-flex flex-column'>
                <div className='placeholder-glow'>
                  <span className='placeholder col-8 mb-2'></span>
                  <span className='placeholder col-6'></span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Table Skeleton */}
        <TableSkeleton rows={3} columns={6} />
      </div>
    </div>
  )
}
