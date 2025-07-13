import React, { useState, useEffect } from 'react'
import { clientService, UnifiedClient } from '../../services/clientService'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface ClientSelectorProps {
  value?: string // Unified client ID
  onChange: (clientId: string, accountId?: string, contactId?: string) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
  label?: string
  error?: string
  showType?: boolean // Show business/individual badge
  allowBusinessOnly?: boolean // For invoices that might only support businesses
}

export const ClientSelector: React.FC<ClientSelectorProps> = ({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = 'Select a client...',
  label = 'Client',
  error,
  showType = true,
  allowBusinessOnly = false
}) => {
  const { userProfile } = useSupabaseAuth()
  const [clients, setClients] = useState<UnifiedClient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredClients, setFilteredClients] = useState<UnifiedClient[]>([])

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadClients()
    }
  }, [userProfile?.tenant_id])

  useEffect(() => {
    // Filter clients based on search term
    if (searchTerm) {
      const filtered = clients.filter(client => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.includes(searchTerm)
      )
      setFilteredClients(filtered)
    } else {
      setFilteredClients(clients)
    }
  }, [searchTerm, clients])

  const loadClients = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      const allClients = await clientService.getAllClients(userProfile.tenant_id)
      
      // Filter out individuals if only businesses are allowed
      const clientList = allowBusinessOnly 
        ? allClients.filter(c => c.type === 'business')
        : allClients

      setClients(clientList)
      setFilteredClients(clientList)
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    if (!selectedId) {
      onChange('', undefined, undefined)
      return
    }

    const { accountId, contactId } = clientService.parseUnifiedId(selectedId)
    onChange(selectedId, accountId, contactId)
  }

  const getClientBadge = (type: 'business' | 'individual') => {
    if (!showType) return null
    
    return type === 'business' 
      ? <span className="badge badge-light-primary ms-2">Business</span>
      : <span className="badge badge-light-info ms-2">Individual</span>
  }

  return (
    <div className="mb-5">
      {label && (
        <label className="form-label fs-6 fw-bold">
          {label}
          {required && <span className="text-danger ms-1">*</span>}
        </label>
      )}
      
      <div className="position-relative">
        {/* Search input for filtering */}
        {clients.length > 10 && (
          <input
            type="text"
            className="form-control form-control-sm mb-2"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={disabled || loading}
          />
        )}

        {/* Client select dropdown */}
        <select
          className={`form-select form-select-solid ${error ? 'is-invalid' : ''}`}
          value={value || ''}
          onChange={handleChange}
          disabled={disabled || loading}
          required={required}
        >
          <option value="">{loading ? 'Loading...' : placeholder}</option>
          
          {/* Group by type if showing both */}
          {!allowBusinessOnly && showType && (
            <>
              <optgroup label="Business Accounts">
                {filteredClients
                  .filter(c => c.type === 'business')
                  .map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                      {client.email && ` (${client.email})`}
                    </option>
                  ))}
              </optgroup>
              
              <optgroup label="Individual Customers">
                {filteredClients
                  .filter(c => c.type === 'individual')
                  .map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                      {client.email && ` (${client.email})`}
                    </option>
                  ))}
              </optgroup>
            </>
          )}
          
          {/* Flat list if not grouping */}
          {(allowBusinessOnly || !showType) && 
            filteredClients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name}
                {client.email && ` (${client.email})`}
              </option>
            ))
          }
        </select>

        {/* Error message */}
        {error && (
          <div className="invalid-feedback d-block">
            {error}
          </div>
        )}
      </div>

      {/* Selected client details */}
      {value && (
        <div className="mt-2">
          {filteredClients
            .filter(c => c.id === value)
            .map(client => (
              <div key={client.id} className="text-muted small">
                {client.type && showType && getClientBadge(client.type)}
                {client.phone && <span className="ms-2">📞 {client.phone}</span>}
                {client.address && <span className="ms-2">📍 {client.address}</span>}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export default ClientSelector