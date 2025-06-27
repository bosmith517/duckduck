import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { supabase, Contact, Account } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { ContactForm } from './components/ContactForm'
import { ContactsList } from './components/ContactsList'

const ContactsPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [accounts, setAccounts] = useState<Pick<Account, 'id' | 'name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchContacts()
      fetchAccounts()
    }
  }, [userProfile?.tenant_id])

  const fetchContacts = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          account:accounts(*)
        `)
        .order('last_name', { ascending: true })

      if (error) {
        console.error('Error fetching contacts:', error)
        return
      }

      setContacts(data || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
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
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching accounts:', error)
        return
      }

      setAccounts(data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }

  const handleCreateContact = async (contactData: Partial<Contact>) => {
    if (!userProfile?.tenant_id) return

    try {
      const { data, error } = await supabase
        .from('contacts')
        .insert([
          {
            ...contactData,
            tenant_id: userProfile.tenant_id,
          }
        ])
        .select(`
          *,
          account:accounts(*)
        `)
        .single()

      if (error) {
        console.error('Error creating contact:', error)
        return
      }

      setContacts(prev => [...prev, data])
      setShowForm(false)
    } catch (error) {
      console.error('Error creating contact:', error)
    }
  }

  const handleUpdateContact = async (id: string, contactData: Partial<Contact>) => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .update(contactData)
        .eq('id', id)
        .select(`
          *,
          account:accounts(*)
        `)
        .single()

      if (error) {
        console.error('Error updating contact:', error)
        return
      }

      setContacts(prev => prev.map(contact => 
        contact.id === id ? data : contact
      ))
      setEditingContact(null)
      setShowForm(false)
    } catch (error) {
      console.error('Error updating contact:', error)
    }
  }

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting contact:', error)
        return
      }

      setContacts(prev => prev.filter(contact => contact.id !== id))
    } catch (error) {
      console.error('Error deleting contact:', error)
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
    </>
  )
}

export default ContactsPage
