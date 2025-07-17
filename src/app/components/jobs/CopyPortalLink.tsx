import React, { useState } from 'react'
import { showToast } from '../../utils/toast'

interface CopyPortalLinkProps {
  portalUrl: string
  jobNumber?: string
}

const CopyPortalLink: React.FC<CopyPortalLinkProps> = ({ portalUrl, jobNumber }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl)
      setCopied(true)
      showToast.success('Portal link copied to clipboard!')
      
      // Reset copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      showToast.error('Failed to copy link. Please copy manually.')
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Customer Portal${jobNumber ? ` - ${jobNumber}` : ''}`,
          text: 'Access your project portal to track progress, view documents, and communicate with us.',
          url: portalUrl
        })
      } catch (err) {
        // User cancelled share or share failed
        if (err instanceof Error && err.name !== 'AbortError') {
          showToast.error('Failed to share link')
        }
      }
    } else {
      // Fallback to copy
      handleCopy()
    }
  }

  return (
    <div className='alert alert-success d-flex align-items-center p-5 mb-4'>
      <i className='ki-duotone ki-shield-tick fs-2hx text-success me-4'>
        <span className='path1'></span>
        <span className='path2'></span>
      </i>
      <div className='d-flex flex-column flex-grow-1'>
        <h5 className='mb-1'>Customer Portal Active</h5>
        <div className='d-flex align-items-center flex-wrap'>
          <span className='text-gray-800 fw-semibold me-2'>Portal Link:</span>
          <a 
            href={portalUrl} 
            target='_blank' 
            rel='noopener noreferrer' 
            className='link-primary text-hover-success me-3'
            style={{ wordBreak: 'break-all' }}
          >
            {portalUrl}
          </a>
        </div>
        <div className='d-flex gap-2 mt-3'>
          <button
            className={`btn btn-sm ${copied ? 'btn-success' : 'btn-light-primary'}`}
            onClick={handleCopy}
          >
            <i className={`ki-duotone ${copied ? 'ki-check' : 'ki-copy'} fs-6 me-1`}>
              <span className='path1'></span>
              <span className='path2'></span>
            </i>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              className='btn btn-sm btn-light-primary'
              onClick={handleShare}
            >
              <i className='ki-duotone ki-share fs-6 me-1'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              Share
            </button>
          )}
          
          <a
            href={portalUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='btn btn-sm btn-light-primary'
          >
            <i className='ki-duotone ki-eye fs-6 me-1'>
              <span className='path1'></span>
              <span className='path2'></span>
            </i>
            Open Portal
          </a>
        </div>
        <span className='text-muted fs-7 mt-2'>
          <i className='ki-duotone ki-information-5 fs-7 me-1'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          This link does not require login. Share it directly with your customer.
        </span>
      </div>
    </div>
  )
}

export default CopyPortalLink