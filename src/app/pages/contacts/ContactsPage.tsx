import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { supabase, Contact, Account } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { ContactForm } from './components/ContactForm'
import { ContactsList } from './components/ContactsList'
import { QuickAddClient } from '../../components/clients/QuickAddClient'
import { CustomerWorkflowModal } from '../../components/workflows/CustomerWorkflowModal'
import { Job } from '../../../supabaseClient'
import { useLocation } from 'react-router-dom'

const ContactsPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const location = useLocation()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [accounts, setAccounts] = useState<Pick<Account, 'id' | 'name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showWorkflow, setShowWorkflow] = useState(false)
  const [workflowContact, setWorkflowContact] = useState<Contact | null>(null)

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchContacts()
      fetchAccounts()
    }
  }, [userProfile?.tenant_id])

  // Handle URL parameter for editing
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const editId = params.get('edit')
    
    if (editId && contacts.length > 0) {
      const contactToEdit = contacts.find(c => c.id === editId)
      if (contactToEdit) {
        setEditingContact(contactToEdit)
        setShowForm(true)
      }
    }
  }, [location.search, contacts])

  const fetchContacts = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      
      // Try to fetch from Supabase first
      const { data, error } = await supabase
        .from('contacts')
        .select(`*`)
        .eq('tenant_id', userProfile.tenant_id)
        .order('last_name', { ascending: true })

      if (error) {
        console.error('Error fetching contacts from database:', error)
        console.log('Database not available, using local storage')
        
        // Fallback to localStorage if database not available
        const localContacts = localStorage.getItem(`contacts_${userProfile.tenant_id}`)
        if (localContacts) {
          setContacts(JSON.parse(localContacts))
        }
        return
      }

      setContacts(data || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
      // Fallback to localStorage
      const localContacts = localStorage.getItem(`contacts_${userProfile.tenant_id}`)
      if (localContacts) {
        setContacts(JSON.parse(localContacts))
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchAccounts = async () => {
    if (!userProfile?.tenant_id) return

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('tenant_id', userProfile.tenant_id)
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching accounts from database:', error)
        console.log('Database not available, using local storage for accounts')
        
        // Fallback to localStorage
        const localAccounts = localStorage.getItem(`accounts_${userProfile.tenant_id}`)
        if (localAccounts) {
          setAccounts(JSON.parse(localAccounts))
        } else {
          // Create some default accounts
          const defaultAccounts = [
            { id: '1', name: 'General Customers' },
            { id: '2', name: 'Residential Clients' },
            { id: '3', name: 'Commercial Clients' }
          ]
          setAccounts(defaultAccounts)
          localStorage.setItem(`accounts_${userProfile.tenant_id}`, JSON.stringify(defaultAccounts))
        }
        return
      }

      setAccounts(data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
      // Fallback to localStorage
      const localAccounts = localStorage.getItem(`accounts_${userProfile.tenant_id}`)
      if (localAccounts) {
        setAccounts(JSON.parse(localAccounts))
      }
    }
  }

  const handleCreateContact = async (contactData: Partial<Contact>) => {
    if (!userProfile?.tenant_id) return

    try {
      // Create contact with proper ID and timestamps
      const newContact: Contact = {
        id: `contact_${Date.now()}`,
        tenant_id: userProfile.tenant_id,
        contact_type: contactData.contact_type || 'individual',
        account_id: contactData.contact_type === 'individual' ? null : (contactData.account_id || '1'),
        first_name: contactData.first_name || '',
        last_name: contactData.last_name || '',
        title: contactData.title || '',
        email: contactData.email || '',
        phone: contactData.phone || '',
        mobile: contactData.mobile || '',
        is_primary: contactData.is_primary || false,
        notes: contactData.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Try to save to database first (with all available fields after schema fix)
      const dbContact = {
        first_name: newContact.first_name,
        last_name: newContact.last_name,
        name: `${newContact.first_name} ${newContact.last_name}`.trim(),
        contact_type: newContact.contact_type,
        account_id: newContact.account_id,
        title: newContact.title,
        email: newContact.email,
        phone: newContact.phone,
        mobile: newContact.mobile,
        notes: newContact.notes,
        tenant_id: newContact.tenant_id
        // Note: is_primary is kept in local storage only
      }

      const { data, error } = await supabase
        .from('contacts')
        .insert([dbContact])
        .select(`*`)
        .single()

      if (error) {
        console.error('Error creating contact in database:', error)
        console.log('Database not available, saving to local storage')
        
        // Save to localStorage as fallback
        const updatedContacts = [...contacts, newContact]
        setContacts(updatedContacts)
        localStorage.setItem(`contacts_${userProfile.tenant_id}`, JSON.stringify(updatedContacts))
        setShowForm(false)
        console.log('Contact saved to local storage successfully')
        return
      }

      // If database save was successful
      setContacts(prev => [...prev, data])
      setShowForm(false)
      console.log('Contact saved to database successfully')
    } catch (error) {
      console.error('Error creating contact:', error)
      
      // Fallback to localStorage on any error
      const newContact: Contact = {
        id: `contact_${Date.now()}`,
        tenant_id: userProfile.tenant_id,
        contact_type: contactData.contact_type || 'individual',
        account_id: contactData.contact_type === 'individual' ? null : (contactData.account_id || '1'),
        first_name: contactData.first_name || '',
        last_name: contactData.last_name || '',
        title: contactData.title || '',
        email: contactData.email || '',
        phone: contactData.phone || '',
        mobile: contactData.mobile || '',
        is_primary: contactData.is_primary || false,
        notes: contactData.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      const updatedContacts = [...contacts, newContact]
      setContacts(updatedContacts)
      localStorage.setItem(`contacts_${userProfile.tenant_id}`, JSON.stringify(updatedContacts))
      setShowForm(false)
      console.log('Contact saved to local storage as fallback')
    }
  }

  const handleUpdateContact = async (id: string, contactData: Partial<Contact>) => {
    if (!userProfile?.tenant_id) return

    try {
      const { data, error } = await supabase
        .from('contacts')
        .update({
          ...contactData,
          // If switching to individual, clear account_id
          account_id: contactData.contact_type === 'individual' ? null : contactData.account_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          account:accounts(*)
        `)
        .single()

      if (error) {
        console.error('Error updating contact in database:', error)
        console.log('Database not available, updating local storage')
        
        // Update in localStorage as fallback
        const updatedContacts = contacts.map(contact => 
          contact.id === id ? { ...contact, ...contactData, updated_at: new Date().toISOString() } : contact
        )
        setContacts(updatedContacts)
        localStorage.setItem(`contacts_${userProfile.tenant_id}`, JSON.stringify(updatedContacts))
        setEditingContact(null)
        setShowForm(false)
        console.log('Contact updated in local storage')
        return
      }

      setContacts(prev => prev.map(contact => 
        contact.id === id ? data : contact
      ))
      setEditingContact(null)
      setShowForm(false)
      console.log('Contact updated in database successfully')
    } catch (error) {
      console.error('Error updating contact:', error)
      
      // Fallback to localStorage
      const updatedContacts = contacts.map(contact => 
        contact.id === id ? { ...contact, ...contactData, updated_at: new Date().toISOString() } : contact
      )
      setContacts(updatedContacts)
      localStorage.setItem(`contacts_${userProfile.tenant_id}`, JSON.stringify(updatedContacts))
      setEditingContact(null)
      setShowForm(false)
      console.log('Contact updated in local storage as fallback')
    }
  }

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return
    if (!userProfile?.tenant_id) return

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting contact from database:', error)
        console.log('Database not available, deleting from local storage')
        
        // Delete from localStorage as fallback
        const updatedContacts = contacts.filter(contact => contact.id !== id)
        setContacts(updatedContacts)
        localStorage.setItem(`contacts_${userProfile.tenant_id}`, JSON.stringify(updatedContacts))
        console.log('Contact deleted from local storage')
        return
      }

      setContacts(prev => prev.filter(contact => contact.id !== id))
      console.log('Contact deleted from database successfully')
    } catch (error) {
      console.error('Error deleting contact:', error)
      
      // Fallback to localStorage
      const updatedContacts = contacts.filter(contact => contact.id !== id)
      setContacts(updatedContacts)
      localStorage.setItem(`contacts_${userProfile.tenant_id}`, JSON.stringify(updatedContacts))
      console.log('Contact deleted from local storage as fallback')
    }
  }

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingContact(null)
  }

  const handleQuickAddSuccess = (clientId: string, projectId?: string) => {
    setShowQuickAdd(false)
    // Refresh the contacts list
    fetchContacts()
    // Navigate to the created client or project if desired
    if (projectId) {
      window.location.href = `/jobs/${projectId}`
    } else {
      window.location.href = `/contacts/${clientId}`
    }
  }

  const handleStartWorkflow = (contact: Contact) => {
    setWorkflowContact(contact)
    setShowWorkflow(true)
  }

  const handleWorkflowComplete = (job: Job) => {
    setShowWorkflow(false)
    setWorkflowContact(null)
    // Navigate to the created job
    window.location.href = `/schedule?job=${job.id}`
  }

  const handleCloseWorkflow = () => {
    setShowWorkflow(false)
    setWorkflowContact(null)
  }

  const filteredContacts = contacts.filter(contact =>
    contact.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (contact.email && contact.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (contact.account?.name && contact.account.name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <>
      <PageTitle breadcrumbs={[]}>Contacts</PageTitle>
      
      <div className='card'>
        <div className='card-header border-0 pt-6'>
          <div className='card-title'>
            <div className='d-flex align-items-center position-relative my-1'>
              <i className='ki-duotone ki-magnifier fs-1 position-absolute ms-6'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              <input
                type='text'
                className='form-control form-control-solid w-250px ps-14'
                placeholder='Search contacts...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className='card-toolbar'>
            <div className='d-flex justify-content-end'>
              <button
                type='button'
                className='btn btn-light btn-light-primary me-3'
                onClick={() => setShowQuickAdd(true)}
              >
                <i className='ki-duotone ki-rocket fs-2'></i>
                Quick Add Client
              </button>
              <button
                type='button'
                className='btn btn-primary'
                onClick={() => setShowForm(true)}
              >
                <i className='ki-duotone ki-plus fs-2'></i>
                Add Contact
              </button>
            </div>
          </div>
        </div>

        <div className='card-body py-4'>
          {loading ? (
            <div className='d-flex justify-content-center py-10'>
              <div className='spinner-border text-primary' role='status'>
                <span className='visually-hidden'>Loading...</span>
              </div>
            </div>
          ) : (
            <ContactsList
              contacts={filteredContacts}
              onEdit={handleEdit}
              onDelete={handleDeleteContact}
              onStartWorkflow={handleStartWorkflow}
            />
          )}
        </div>
      </div>

      {showForm && (
        <ContactForm
          contact={editingContact}
          accounts={accounts}
          onSave={editingContact ? 
            (data) => handleUpdateContact(editingContact.id, data) : 
            handleCreateContact
          }
          onCancel={handleCloseForm}
        />
      )}

      {showQuickAdd && (
        <QuickAddClient
          onClose={() => setShowQuickAdd(false)}
          onSuccess={handleQuickAddSuccess}
        />
      )}

      {showWorkflow && workflowContact && (
        <CustomerWorkflowModal
          contact={workflowContact}
          onClose={handleCloseWorkflow}
          onWorkflowComplete={handleWorkflowComplete}
        />
      )}
    </>
  )
}

export default ContactsPage
