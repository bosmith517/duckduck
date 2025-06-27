import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { ClientForm, Client as ClientFormType } from './components/ClientForm'
import { MenuComponent } from '../../../_metronic/assets/ts/components'

interface Client {
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  totalJobs: number
  totalValue: number
  status: 'active' | 'inactive'
  joinDate: string
}

const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([
    {
      id: '1',
      name: 'Smith Family',
      email: 'john.smith@email.com',
      phone: '(555) 123-4567',
      address: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
      totalJobs: 3,
      totalValue: 45000,
      status: 'active',
      joinDate: '2023-06-15'
    },
    {
      id: '2',
      name: 'Johnson Residence',
      email: 'mary.johnson@email.com',
      phone: '(555) 987-6543',
      address: '456 Oak Ave',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62702',
      totalJobs: 1,
      totalValue: 8500,
      status: 'active',
      joinDate: '2023-11-20'
    },
    {
      id: '3',
      name: 'Williams Property',
      email: 'bob.williams@email.com',
      phone: '(555) 456-7890',
      address: '789 Pine Rd',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62703',
      totalJobs: 2,
      totalValue: 12000,
      status: 'inactive',
      joinDate: '2023-03-10'
    }
  ])

  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  // Initialize Metronic components when page loads
  useEffect(() => {
    MenuComponent.reinitialization()
  }, [])

  const handleNewClient = () => {
    setEditingClient(null)
    setShowForm(true)
  }

  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    setShowForm(true)
  }

  const handleSaveClient = async (data: Partial<ClientFormType>) => {
    if (editingClient) {
      // Update existing client
      setClients(prev => prev.map(client => 
        client.id === editingClient.id 
          ? { ...client, ...data }
          : client
      ))
    } else {
      // Add new client
      const newClient: Client = {
        id: Date.now().toString(),
        name: data.name!,
        email: data.email!,
        phone: data.phone!,
        address: data.address!,
        city: data.city!,
        state: data.state!,
        zipCode: data.zipCode!,
        status: data.status!,
        totalJobs: 0,
        totalValue: 0,
        joinDate: new Date().toISOString().split('T')[0]
      }
      setClients(prev => [...prev, newClient])
    }
    setShowForm(false)
    setEditingClient(null)
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingClient(null)
  }

  const handleDeleteClient = (clientId: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      setClients(prev => prev.filter(client => client.id !== clientId))
    }
  }

  const getStatusBadge = (status: string) => {
    return status === 'active' 
      ? 'badge badge-light-success' 
      : 'badge badge-light-danger'
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Clients Management</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Client Directory</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Manage your client relationships</span>
              </h3>
              <div className='card-toolbar'>
                <button className='btn btn-sm btn-primary' onClick={handleNewClient}>
                  <i className='ki-duotone ki-plus fs-2'></i>
                  New Client
                </button>
              </div>
            </div>
            <KTCardBody className='py-3'>
              <div className='table-responsive'>
                <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                  <thead>
                    <tr className='fw-bold text-muted'>
                      <th className='min-w-150px'>Client Name</th>
                      <th className='min-w-140px'>Contact Info</th>
                      <th className='min-w-200px'>Address</th>
                      <th className='min-w-120px'>Total Jobs</th>
                      <th className='min-w-120px'>Total Value</th>
                      <th className='min-w-120px'>Status</th>
                      <th className='min-w-120px'>Join Date</th>
                      <th className='min-w-100px text-end'>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id}>
                        <td>
                          <div className='d-flex align-items-center'>
                            <div className='symbol symbol-45px me-5'>
                              <div className='symbol-label bg-light-primary text-primary fw-bold'>
                                {client.name.charAt(0)}
                              </div>
                            </div>
                            <div className='d-flex justify-content-start flex-column'>
                              <a href='#' className='text-dark fw-bold text-hover-primary fs-6'>
                                {client.name}
                              </a>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className='d-flex flex-column'>
                            <span className='text-dark fw-bold fs-6'>{client.email}</span>
                            <span className='text-muted fw-semibold fs-7'>{client.phone}</span>
                          </div>
                        </td>
                        <td>
                          <div className='d-flex flex-column'>
                            <span className='text-dark fw-bold fs-6'>{client.address}</span>
                            <span className='text-muted fw-semibold fs-7'>
                              {client.city}, {client.state} {client.zipCode}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className='text-dark fw-bold d-block fs-6'>
                            {client.totalJobs}
                          </span>
                        </td>
                        <td>
                          <span className='text-dark fw-bold d-block fs-6'>
                            ${client.totalValue.toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <span className={getStatusBadge(client.status)}>
                            {client.status}
                          </span>
                        </td>
                        <td>
                          <span className='text-dark fw-bold d-block fs-6'>
                            {new Date(client.joinDate).toLocaleDateString()}
                          </span>
                        </td>
                        <td>
                          <div className='d-flex justify-content-end flex-shrink-0'>
                            <button
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                              onClick={() => handleEditClient(client)}
                              title='Edit client'
                            >
                              <i className='ki-duotone ki-pencil fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                            </button>
                            <button
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm'
                              onClick={() => handleDeleteClient(client.id)}
                              title='Delete client'
                            >
                              <i className='ki-duotone ki-trash fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                                <span className='path3'></span>
                                <span className='path4'></span>
                                <span className='path5'></span>
                              </i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Client Form Modal */}
      {showForm && (
        <ClientForm
          client={editingClient}
          onSave={handleSaveClient}
          onCancel={handleCancelForm}
        />
      )}
    </>
  )
}

export default ClientsPage
