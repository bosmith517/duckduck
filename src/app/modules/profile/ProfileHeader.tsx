import React, { useState, useRef } from 'react'
import { KTIcon, toAbsoluteUrl } from '../../../_metronic/helpers'
import { Link, useLocation } from 'react-router-dom'
import { Toolbar } from '../../../_metronic/layout/components/toolbar/Toolbar'
import { Content } from '../../../_metronic/layout/components/Content'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

const ProfileHeader: React.FC = () => {
  const location = useLocation()
  const { userProfile, tenant } = useSupabaseAuth()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !userProfile?.id) return

    setUploading(true)
    const loadingToast = showToast.loading('Uploading avatar...')

    try {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        showToast.error('File size must be less than 2MB')
        return
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        showToast.error('Please select an image file')
        return
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${userProfile.tenant_id}/${userProfile.id}/avatar.${fileExt}`

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Update user profile with new avatar URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userProfile.id)

      if (updateError) throw updateError

      showToast.dismiss(loadingToast)
      showToast.success('Avatar updated successfully!')
      
      // Force a page refresh to update the avatar
      window.location.reload()

    } catch (error) {
      console.error('Error uploading avatar:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to upload avatar. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const getDisplayName = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`
    }
    return userProfile?.email || 'User'
  }

  const getAvatarUrl = () => {
    if ((userProfile as any)?.avatar_url) {
      return (userProfile as any).avatar_url
    }
    return toAbsoluteUrl('/media/avatars/300-1.jpg')
  }

  return (
    <>
      <Toolbar />
      <Content>
        <div className='card mb-5 mb-xl-10'>
          <div className='card-body pt-9 pb-0'>
            <div className='d-flex flex-wrap flex-sm-nowrap mb-3'>
              <div className='me-7 mb-4'>
                <div className='symbol symbol-100px symbol-lg-160px symbol-fixed position-relative'>
                  <img 
                    src={getAvatarUrl()} 
                    alt='Profile Avatar'
                    className='cursor-pointer'
                    onClick={handleAvatarClick}
                    style={{ objectFit: 'cover' }}
                  />
                  <div 
                    className='position-absolute translate-middle bottom-0 start-100 mb-6 bg-primary rounded-circle border border-4 border-white h-20px w-20px cursor-pointer d-flex align-items-center justify-content-center'
                    onClick={handleAvatarClick}
                    title='Change avatar'
                  >
                    {uploading ? (
                      <div className='spinner-border spinner-border-sm text-white' style={{ width: '10px', height: '10px' }}></div>
                    ) : (
                      <KTIcon iconName='pencil' className='fs-7 text-white' />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/*'
                    onChange={handleAvatarUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              <div className='flex-grow-1'>
                <div className='d-flex justify-content-between align-items-start flex-wrap mb-2'>
                  <div className='d-flex flex-column'>
                    <div className='d-flex align-items-center mb-2'>
                      <span className='text-gray-800 fs-2 fw-bolder me-1'>
                        {getDisplayName()}
                      </span>
                      {userProfile?.role === 'admin' && (
                        <KTIcon iconName='crown' className='fs-1 text-warning' />
                      )}
                    </div>

                    <div className='d-flex flex-wrap fw-bold fs-6 mb-4 pe-2'>
                      <span className='d-flex align-items-center text-gray-500 me-5 mb-2'>
                        <KTIcon iconName='profile-circle' className='fs-4 me-1' />
                        {userProfile?.role ? (userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)) : 'User'}
                      </span>
                      <span className='d-flex align-items-center text-gray-500 me-5 mb-2'>
                        <KTIcon iconName='sms' className='fs-4 me-1' />
                        {userProfile?.email}
                      </span>
                      {(userProfile as any)?.phone && (
                        <span className='d-flex align-items-center text-gray-500 mb-2'>
                          <KTIcon iconName='phone' className='fs-4 me-1' />
                          {(userProfile as any).phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className='d-flex flex-wrap flex-stack'>
                  <div className='d-flex flex-column flex-grow-1 pe-8'>
                    <div className='d-flex flex-wrap'>
                      <div className='border border-gray-300 border-dashed rounded min-w-125px py-3 px-4 me-6 mb-3'>
                        <div className='d-flex align-items-center'>
                          <KTIcon iconName='buildings' className='fs-3 text-primary me-2' />
                          <div className='fs-2 fw-bolder'>{tenant?.name || 'Company'}</div>
                        </div>
                        <div className='fw-bold fs-6 text-gray-500'>Organization</div>
                      </div>

                      <div className='border border-gray-300 border-dashed rounded min-w-125px py-3 px-4 me-6 mb-3'>
                        <div className='d-flex align-items-center'>
                          <KTIcon iconName='calendar' className='fs-3 text-success me-2' />
                          <div className='fs-2 fw-bolder'>
                            {userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                        <div className='fw-bold fs-6 text-gray-500'>Member Since</div>
                      </div>

                      <div className='border border-gray-300 border-dashed rounded min-w-125px py-3 px-4 me-6 mb-3'>
                        <div className='d-flex align-items-center'>
                          <KTIcon iconName='shield-tick' className='fs-3 text-success me-2' />
                          <div className='fs-2 fw-bolder'>Active</div>
                        </div>
                        <div className='fw-bold fs-6 text-gray-500'>Account Status</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className='d-flex overflow-auto h-55px'>
              <ul className='nav nav-stretch nav-line-tabs nav-line-tabs-2x border-transparent fs-5 fw-bolder flex-nowrap'>
                <li className='nav-item'>
                  <Link
                    className={
                      `nav-link text-active-primary me-6 ` +
                      (location.pathname === '/profile/account' && 'active')
                    }
                    to='/profile/account'
                  >
                    Account Settings
                  </Link>
                </li>
                <li className='nav-item'>
                  <Link
                    className={
                      `nav-link text-active-primary me-6 ` +
                      (location.pathname === '/profile/company' && 'active')
                    }
                    to='/profile/company'
                  >
                    Company Information
                  </Link>
                </li>
                <li className='nav-item'>
                  <Link
                    className={
                      `nav-link text-active-primary me-6 ` +
                      (location.pathname === '/profile/notifications' && 'active')
                    }
                    to='/profile/notifications'
                  >
                    Notifications
                  </Link>
                </li>
                <li className='nav-item'>
                  <Link
                    className={
                      `nav-link text-active-primary me-6 ` +
                      (location.pathname === '/profile/security' && 'active')
                    }
                    to='/profile/security'
                  >
                    Security
                  </Link>
                </li>
                <li className='nav-item'>
                  <Link
                    className={
                      `nav-link text-active-primary me-6 ` +
                      (location.pathname === '/profile/documents' && 'active')
                    }
                    to='/profile/documents'
                  >
                    Documents
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Content>
    </>
  )
}

export {ProfileHeader}