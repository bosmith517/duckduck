import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { supabase, Account } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { AccountForm, AccountsList } from './components'
import { MenuComponent } from '../../../_metronic/assets/ts/components'

const AccountsPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (userProfile?.tenant_id) {
      fetchAccounts()
    }
  }, [userProfile?.tenant_id])

  // Initialize Metronic components when page loads
  useEffect(() => {
    MenuComponent.reinitialization()
  }, [])

  const fetchAccounts = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching accounts:', error)
        return
      }

      setAccounts(data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAccount = async (accountData: Partial<Account>) => {
    if (!userProfile?.tenant_id) {
      console.error('No tenant_id available')
      alert('Error: No tenant ID available. Please try logging out and back in.')
      return
    }

    console.log('Creating account with data:', accountData)
    console.log('User profile:', userProfile)

    try {
      const insertData = {
        ...accountData,
        tenant_id: userProfile.tenant_id,
      }
      
      console.log('Inserting data:', insertData)

      const { data, error } = await supabase
        .from('accounts')
        .insert([insertData])
        .select()
        .single()

      if (error) {
        console.error('Supabase error creating account:', error)
        alert(`Error creating account: ${error.message}`)
        return
      }

      console.log('Account created successfully:', data)
      setAccounts(prev => [...prev, data])
      setShowForm(false)
    } catch (error) {
      console.error('Unexpected error creating account:', error)
      alert(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleUpdateAccount = async (id: string, accountData: Partial<Account>) => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .update(accountData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating account:', error)
        return
      }

      setAccounts(prev => prev.map(account => 
        account.id === id ? data : account
      ))
      setEditingAccount(null)
      setShowForm(false)
    } catch (error) {
      console.error('Error updating account:', error)
    }
  }

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return

    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting account:', error)
        return
      }

      setAccounts(prev => prev.filter(account => account.id !== id))
    } catch (error) {
      console.error('Error deleting account:', error)
    }
  }

  const handleEdit = (account: Account) => {
    setEditingAccount(account)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingAccount(null)
  }

  const filteredAccounts = accounts.filter(account =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (account.type && account.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (account.industry && account.industry.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <>
      <PageTitle breadcrumbs={[]}>Accounts</PageTitle>
      
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
                placeholder='Search accounts...'
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
                Add Account
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
            <AccountsList
              accounts={filteredAccounts}
              onEdit={handleEdit}
              onDelete={handleDeleteAccount}
            />
          )}
        </div>
      </div>

      {showForm && (
        <AccountForm
          account={editingAccount}
          onSave={editingAccount ? 
            (data) => handleUpdateAccount(editingAccount.id, data) : 
            handleCreateAccount
          }
          onCancel={handleCloseForm}
        />
      )}
    </>
  )
}

export default AccountsPage
