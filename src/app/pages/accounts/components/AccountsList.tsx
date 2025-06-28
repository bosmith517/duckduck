import React from 'react'
import { Account } from '../../../../supabaseClient'
import { ClickablePhoneNumber } from '../../../components/communications/ClickablePhoneNumber'

interface AccountsListProps {
  accounts: Account[]
  onEdit: (account: Account) => void
  onDelete: (id: string) => void
}

export const AccountsList: React.FC<AccountsListProps> = ({ accounts, onEdit, onDelete }) => {
  const getAccountTypeColor = (type: string | undefined) => {
    if (!type) return 'badge-light-secondary'
    switch (type) {
      case 'customer':
        return 'badge-light-success'
      case 'prospect':
        return 'badge-light-primary'
      case 'vendor':
        return 'badge-light-warning'
      case 'partner':
        return 'badge-light-info'
      default:
        return 'badge-light-secondary'
    }
  }

  const formatAccountType = (type: string | undefined) => {
    if (!type) return 'Unknown'
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  if (accounts.length === 0) {
    return (
      <div className='d-flex flex-column flex-center'>
        <img
          src='/media/illustrations/sketchy-1/5.png'
          alt='No accounts'
          className='mw-400px'
        />
        <div className='fs-1 fw-bolder text-dark mb-4'>No accounts found.</div>
        <div className='fs-6'>Start by creating your first account.</div>
      </div>
    )
  }

  return (
    <div className='table-responsive'>
      <table className='table align-middle table-row-dashed fs-6 gy-5'>
        <thead>
          <tr className='text-start text-muted fw-bolder fs-7 text-uppercase gs-0'>
            <th className='min-w-125px'>Account Name</th>
            <th className='min-w-100px'>Type</th>
            <th className='min-w-125px'>Industry</th>
            <th className='min-w-125px'>Contact Info</th>
            <th className='min-w-125px'>Location</th>
            <th className='text-end min-w-100px'>Actions</th>
          </tr>
        </thead>
        <tbody className='text-gray-600 fw-bold'>
          {accounts.map((account) => (
            <tr key={account.id}>
              <td>
                <div className='d-flex flex-column'>
                  <a
                    href='#'
                    className='text-gray-800 text-hover-primary mb-1'
                    onClick={(e) => {
                      e.preventDefault()
                      onEdit(account)
                    }}
                  >
                    {account.name}
                  </a>
                  {account.website && (
                    <a
                      href={account.website}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-muted text-hover-primary fs-7'
                    >
                      {account.website}
                    </a>
                  )}
                </div>
              </td>
              <td>
                <span className={`badge ${getAccountTypeColor(account.type)} fw-bolder`}>
                  {formatAccountType(account.type)}
                </span>
              </td>
              <td>
                <div className='text-gray-800'>
                  {account.industry || '-'}
                </div>
              </td>
              <td>
                <div className='d-flex flex-column'>
                  {account.email && (
                    <a
                      href={`mailto:${account.email}`}
                      className='text-gray-800 text-hover-primary mb-1'
                    >
                      {account.email}
                    </a>
                  )}
                  {account.phone && (
                    <ClickablePhoneNumber
                      phoneNumber={account.phone}
                      contactName={account.name}
                      className='text-muted fs-7'
                      disabled={true}
                    />
                  )}
                  {!account.email && !account.phone && (
                    <span className='text-muted'>-</span>
                  )}
                </div>
              </td>
              <td>
                <div className='d-flex flex-column'>
                  {account.city && account.state ? (
                    <div className='text-gray-800 mb-1'>
                      {account.city}, {account.state}
                    </div>
                  ) : account.city ? (
                    <div className='text-gray-800 mb-1'>{account.city}</div>
                  ) : account.state ? (
                    <div className='text-gray-800 mb-1'>{account.state}</div>
                  ) : null}
                  {account.country && (
                    <div className='text-muted fs-7'>{account.country}</div>
                  )}
                  {!account.city && !account.state && !account.country && (
                    <span className='text-muted'>-</span>
                  )}
                </div>
              </td>
              <td className='text-end'>
                <a
                  href='#'
                  className='btn btn-light btn-active-light-primary btn-sm'
                  data-kt-menu-trigger='click'
                  data-kt-menu-placement='bottom-end'
                >
                  Actions
                  <i className='ki-duotone ki-down fs-5 m-0'></i>
                </a>
                <div
                  className='menu menu-sub menu-sub-dropdown menu-column menu-rounded menu-gray-600 menu-state-bg-light-primary fw-bold fs-7 w-125px py-4'
                  data-kt-menu='true'
                >
                  <div className='menu-item px-3'>
                    <a
                      href='#'
                      className='menu-link px-3'
                      onClick={(e) => {
                        e.preventDefault()
                        onEdit(account)
                      }}
                    >
                      Edit
                    </a>
                  </div>
                  <div className='menu-item px-3'>
                    <a
                      href='#'
                      className='menu-link px-3'
                      onClick={(e) => {
                        e.preventDefault()
                        onDelete(account.id)
                      }}
                    >
                      Delete
                    </a>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
