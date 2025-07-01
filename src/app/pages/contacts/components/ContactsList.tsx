import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Contact } from '../../../../supabaseClient'
import { ClickablePhoneNumber } from '../../../components/communications/ClickablePhoneNumber'

interface ContactsListProps {
  contacts: Contact[]
  onEdit: (contact: Contact) => void
  onDelete: (id: string) => void
  onStartWorkflow: (contact: Contact) => void
}

export const ContactsList: React.FC<ContactsListProps> = ({ contacts, onEdit, onDelete, onStartWorkflow }) => {
  const navigate = useNavigate()
  if (contacts.length === 0) {
    return (
      <div className='d-flex flex-column flex-center'>
        <img
          src='/media/illustrations/sketchy-1/5.png'
          alt='No contacts'
          className='mw-400px'
        />
        <div className='fs-1 fw-bolder text-dark mb-4'>No contacts found.</div>
        <div className='fs-6'>Start by creating your first contact.</div>
      </div>
    )
  }

  return (
    <div className='table-responsive'>
      <table className='table align-middle table-row-dashed fs-6 gy-5'>
        <thead>
          <tr className='text-start text-muted fw-bolder fs-7 text-uppercase gs-0'>
            <th className='min-w-125px'>Name</th>
            <th className='min-w-125px'>Type / Account</th>
            <th className='min-w-125px'>Title</th>
            <th className='min-w-125px'>Contact Info</th>
            <th className='min-w-100px'>Primary</th>
            <th className='min-w-150px'>Quick Actions</th>
            <th className='text-end min-w-100px'>Actions</th>
          </tr>
        </thead>
        <tbody className='text-gray-600 fw-bold'>
          {contacts.map((contact) => (
            <tr key={contact.id}>
              <td>
                <div className='d-flex flex-column'>
                  <a
                    href='#'
                    className='text-gray-800 text-hover-primary mb-1'
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(`/contacts/${contact.id}`)
                    }}
                  >
                    {contact.first_name} {contact.last_name}
                  </a>
                  {contact.title && (
                    <span className='text-muted fs-7'>{contact.title}</span>
                  )}
                </div>
              </td>
              <td>
                <div className='d-flex flex-column'>
                  <div className='d-flex align-items-center mb-1'>
                    <span className={`badge ${contact.contact_type === 'individual' ? 'badge-light-info' : 'badge-light-primary'} fw-bolder me-2`}>
                      {contact.contact_type === 'individual' ? 'Customer' : 'Business Contact'}
                    </span>
                  </div>
                  <div className='text-gray-800'>
                    {contact.account?.name || (contact.contact_type === 'individual' ? 'Individual Customer' : 'No Account')}
                  </div>
                </div>
              </td>
              <td>
                <div className='text-gray-800'>
                  {contact.title || '-'}
                </div>
              </td>
              <td>
                <div className='d-flex flex-column'>
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className='text-gray-800 text-hover-primary mb-1'
                    >
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <ClickablePhoneNumber
                      phoneNumber={contact.phone}
                      contactId={contact.id}
                      contactName={`${contact.first_name} ${contact.last_name}`}
                      className='text-muted fs-7 mb-1'
                    />
                  )}
                  {contact.mobile && (
                    <div className='d-flex align-items-center'>
                      <span className='text-muted fs-7 me-2'>Mobile:</span>
                      <ClickablePhoneNumber
                        phoneNumber={contact.mobile}
                        contactId={contact.id}
                        contactName={`${contact.first_name} ${contact.last_name}`}
                        className='text-muted fs-7'
                        showIcon={false}
                      />
                    </div>
                  )}
                  {!contact.email && !contact.phone && !contact.mobile && (
                    <span className='text-muted'>-</span>
                  )}
                </div>
              </td>
              <td>
                {contact.is_primary ? (
                  <span className='badge badge-light-success fw-bolder'>Primary</span>
                ) : (
                  <span className='text-muted'>-</span>
                )}
              </td>
              <td>
                <div className='d-flex gap-2'>
                  <button
                    className='btn btn-sm btn-success'
                    onClick={() => onStartWorkflow(contact)}
                    title='Start Customer Workflow'
                  >
                    <i className='ki-duotone ki-rocket fs-4'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    Start Job
                  </button>
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
                        onStartWorkflow(contact)
                      }}
                    >
                      <i className='ki-duotone ki-rocket fs-5 me-2'>
                        <span className='path1'></span>
                        <span className='path2'></span>
                      </i>
                      Start Workflow
                    </a>
                  </div>
                  <div className='menu-item px-3'>
                    <a
                      href='#'
                      className='menu-link px-3'
                      onClick={(e) => {
                        e.preventDefault()
                        onEdit(contact)
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
                        onDelete(contact.id)
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
