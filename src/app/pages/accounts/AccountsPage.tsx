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
        .eq('tenant_id', userProfile.tenant_id)
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching accounts from database:', error)
        console.log('Database not available, using local storage for accounts')
        
        // Fallback to localStorage
        const localAccounts = localStorage.getItem(`accounts_${userProfile.tenant_id}`)
        if (localAccounts) {
          setAccounts(JSON.parse(localAccounts))
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

    try {
      // Create account with proper ID and timestamps
      const newAccount: Account = {
        id: `account_${Date.now()}`,
        tenant_id: userProfile.tenant_id,
        name: accountData.name || '',
        account_status: accountData.account_status || 'active',
        type: accountData.type || '',
        industry: accountData.industry || '',
        phone: accountData.phone || '',
        email: accountData.email || '',
        website: accountData.website || '',
        address_line1: accountData.address_line1 || '',
        address_line2: accountData.address_line2 || '',
        city: accountData.city || '',
        state: accountData.state || '',
        zip_code: accountData.zip_code || '',
        country: accountData.country || '',
        notes: accountData.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log('Creating account with data:', newAccount)

      // Try to save to database first
      const { data, error } = await supabase
        .from('accounts')
        .insert([newAccount])
        .select()
        .single()

      if (error) {
        console.error('Error creating account in database:', error)
        console.log('Database not available, saving to local storage')
        
        // Save to localStorage as fallback
        const updatedAccounts = [...accounts, newAccount]
        setAccounts(updatedAccounts)
        localStorage.setItem(`accounts_${userProfile.tenant_id}`, JSON.stringify(updatedAccounts))
        setShowForm(false)
        console.log('Account saved to local storage successfully')
        alert('Account created successfully (saved locally)')
        return
      }

      console.log('Account created successfully in database:', data)
      setAccounts(prev => [...prev, data])
      setShowForm(false)
      alert('Account created successfully!')
    } catch (error) {
      console.error('Error creating account:', error)
      
      // Fallback to localStorage on any error
      const newAccount: Account = {
        id: `account_${Date.now()}`,
        tenant_id: userProfile.tenant_id,
        name: accountData.name || '',
        account_status: accountData.account_status || 'active',
        type: accountData.type || '',
        industry: accountData.industry || '',
        phone: accountData.phone || '',
        email: accountData.email || '',
        website: accountData.website || '',
        address_line1: accountData.address_line1 || '',
        address_line2: accountData.address_line2 || '',
        city: accountData.city || '',
        state: accountData.state || '',
        zip_code: accountData.zip_code || '',
        country: accountData.country || '',
        notes: accountData.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      const updatedAccounts = [...accounts, newAccount]
      setAccounts(updatedAccounts)
      localStorage.setItem(`accounts_${userProfile.tenant_id}`, JSON.stringify(updatedAccounts))
      setShowForm(false)
      console.log('Account saved to local storage as fallback')
      alert('Account created successfully (saved locally)')
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
