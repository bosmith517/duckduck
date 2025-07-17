import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { useCustomerJourneyStore, journeyEventBus, JOURNEY_EVENTS } from '../../stores/customerJourneyStore'
import { useSmartAssistant } from '../../hooks/useSmartAssistant'
import { StepTrackerMini } from '../journey/StepTracker'
import type { EstimateSchema } from '../../contexts/CustomerJourneyContext'
import { showToast } from '../../utils/toast'
import { KTIcon } from '../../../_metronic/helpers'
// Dynamic import for marked.js to reduce bundle size
import { jobActivityService } from '../../services/jobActivityService'
import { EstimateForm } from '../../pages/estimates/components/EstimateForm'
import { estimatesService } from '../../services/estimatesService'

interface EstimateTier {
  tier_name: 'Good' | 'Better' | 'Best'
  description: string
  total_amount: number
  line_items: Array<{
    description: string
    quantity: number
    unit_price: number
    total_price: number
    item_type: 'labor' | 'material' | 'service'
  }>
}

interface JobPhoto {
  id: string
  file_url: string
  description: string
  photo_type: string
  selected?: boolean
  userNote?: string
}

interface BasicRepair {
  description: string
  quantity: number
  unit: string
  item_type: 'labor' | 'material' | 'equipment' | 'permit' | 'disposal'
}

type AIStage = 'idle' | 's1' | 's2' | 's3'

interface CreateEstimateModalProps {
  leadId?: string
  jobId?: string
  isOpen: boolean
  onClose: () => void
  onEstimateCreated: (estimateId: string) => void
  mode?: 'create' | 'revise'
  existingEstimateId?: string
}

export const CreateEstimateModal: React.FC<CreateEstimateModalProps> = ({
  leadId: propLeadId,
  jobId: propJobId,
  isOpen,
  onClose,
  onEstimateCreated,
  mode = 'create',
  existingEstimateId
}) => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  
  // Customer Journey integration
  const { lead, siteVisit, leadId: storeLeadId, setEstimate, updateStep, completeCurrentStep } = useCustomerJourneyStore()
  const { trackAction } = useSmartAssistant()
  
  // Use store data or props as fallback
  const effectiveLeadId = propLeadId || storeLeadId
  const [leadDetails, setLeadDetails] = useState<any>(null)
  const [currentEstimateVersion, setCurrentEstimateVersion] = useState(1)
  const [existingEstimate, setExistingEstimate] = useState<EstimateSchema | null>(null)
  const [estimateNotes, setEstimateNotes] = useState('')
  const [currentStep, setCurrentStep] = useState(0) // Start at 0 for method selection
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiNarrative, setAiNarrative] = useState<string | null>(null)
  const [aiStage, setAiStage] = useState<AIStage>('idle')
  const [selectedTier, setSelectedTier] = useState<'Good' | 'Better' | 'Best'>('Better')
  const [customTotals, setCustomTotals] = useState<{Good?: number, Better?: number, Best?: number}>({})
  const [manuallySetTiers, setManuallySetTiers] = useState<{Good?: boolean, Better?: boolean, Best?: boolean}>({})
  const [showLineItemPricing, setShowLineItemPricing] = useState(false)
  const [estimateMethod, setEstimateMethod] = useState<'ai' | 'template' | 'manual' | null>(null)
  const [showManualForm, setShowManualForm] = useState(false)
  
  // Debug log
  console.log('CreateEstimateModal state:', { showManualForm, estimateMethod, currentStep })
  
  // New pipeline state
  const [availablePhotos, setAvailablePhotos] = useState<JobPhoto[]>([])
  const [showPhotoSelector, setShowPhotoSelector] = useState(false)
  const [damageBullets, setDamageBullets] = useState<string[]>([])
  const [hazardParagraph, setHazardParagraph] = useState<string>('')
  const [basicRepairs, setBasicRepairs] = useState<BasicRepair[]>([])
  const [betterRepairs, setBetterRepairs] = useState<BasicRepair[]>([])
  const [bestRepairs, setBestRepairs] = useState<BasicRepair[]>([])
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [marked, setMarked] = useState<any>(null)

  // Lazy load marked.js
  useEffect(() => {
    const loadMarked = async () => {
      try {
        const { marked: markedLib } = await import('marked')
        setMarked(() => markedLib)
      } catch (error) {
        console.warn('Failed to load marked.js:', error)
      }
    }
    loadMarked()
  }, [])

  
  const [estimateTiers, setEstimateTiers] = useState<EstimateTier[]>([
    {
      tier_name: 'Good',
      description: 'Basic solution that gets the job done',
      total_amount: 0,
      line_items: []
    },
    {
      tier_name: 'Better', 
      description: 'Enhanced solution with better materials',
      total_amount: 0,
      line_items: []
    },
    {
      tier_name: 'Best',
      description: 'Premium solution with top-tier materials and warranty',
      total_amount: 0,
      line_items: []
    }
  ])

  useEffect(() => {
    if (isOpen && effectiveLeadId) {
      loadLeadDetails()
      loadAvailablePhotos()
      loadExistingEstimate()
      // Clear any existing stage notifications when modal opens
      cleanupStageNotifications()
      trackAction(mode === 'revise' ? 'opened_revise_estimate_modal' : 'opened_create_estimate_modal')
      
      // Navigate to appropriate step based on mode
      if (storeLeadId) {
        const currentStep = useCustomerJourneyStore.getState().step
        if (mode === 'revise' && currentStep !== 'estimate_revision') {
          updateStep('estimate_revision')
        } else if (mode === 'create' && currentStep !== 'estimate') {
          updateStep('estimate')
        }
      }
    } else if (!isOpen) {
      // Clean up notifications when modal closes
      cleanupStageNotifications()
    }
  }, [isOpen, effectiveLeadId, trackAction, storeLeadId, updateStep, mode])

  const loadLeadDetails = async () => {
    if (!effectiveLeadId) {
      console.warn('Cannot load lead details: effectiveLeadId is null')
      return
    }

    // If we have lead data from store, use it
    if (lead && lead.id === effectiveLeadId) {
      // CRITICAL: Check if lead has customer relationships
      // Check both direct relationships and converted relationships
      const hasAccountRelationship = lead.account_id || lead.converted_account_id
      const hasContactRelationship = lead.contact_id || lead.converted_contact_id
      
      if (!hasAccountRelationship && !hasContactRelationship) {
        showToast.error('Cannot create estimate: Customer information is missing. Please ensure the lead has contact details.')
        console.error('Lead from store missing relationships:', {
          leadId: lead.id,
          account_id: lead.account_id,
          contact_id: lead.contact_id,
          converted_account_id: lead.converted_account_id,
          converted_contact_id: lead.converted_contact_id
        })
        handleClose()
        return
      }
      
      setLeadDetails({
        id: lead.id,
        title: `Estimate for ${lead.name || 'Customer'}`,
        description: lead.service_type || 'Service request',
        location_city: lead.full_address?.split(',')[1]?.trim(),
        location_state: lead.full_address?.split(',')[2]?.trim(),
        location_address: lead.full_address,
        estimated_cost: null,
        notes: lead.notes,
        account_id: lead.account_id || lead.converted_account_id,
        contact_id: lead.contact_id || lead.converted_contact_id,
        contacts: {
          name: lead.name || 'Unknown',
          first_name: (lead.name || '').split(' ')[0] || 'Unknown',
          last_name: (lead.name || '').split(' ').slice(1).join(' ') || '',
          phone: lead.contact?.phone || '',
          email: lead.contact?.email || ''
        }
      })
      return
    }

    // Otherwise fetch from database
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', effectiveLeadId)
        .single()

      if (error) throw error
      
      // CRITICAL: Check if lead has customer relationships
      // Check both direct relationships and converted relationships
      const hasAccountRelationship = data.account_id || data.converted_account_id
      const hasContactRelationship = data.contact_id || data.converted_contact_id
      
      if (!hasAccountRelationship && !hasContactRelationship) {
        showToast.error('Cannot create estimate: Customer information is missing. Please ensure the lead has contact details.')
        console.error('Lead missing relationships:', {
          leadId: data.id,
          account_id: data.account_id,
          contact_id: data.contact_id,
          converted_account_id: data.converted_account_id,
          converted_contact_id: data.converted_contact_id
        })
        handleClose()
        return
      }
      
      setLeadDetails({
        ...data,
        title: `Estimate for ${data.name || data.caller_name || 'Customer'}`,
        account_id: data.account_id || data.converted_account_id,
        contact_id: data.contact_id || data.converted_contact_id,
        // Create a mock contacts object from lead data
        contacts: {
          name: data.name || data.caller_name || 'Unknown',
          first_name: (data.name || data.caller_name || '').split(' ')[0] || 'Unknown',
          last_name: (data.name || data.caller_name || '').split(' ').slice(1).join(' ') || '',
          phone: data.phone_number || data.phone || '',
          email: data.email || ''
        }
      })
    } catch (error) {
      console.error('Error loading lead details:', error)
      showToast.error('Failed to load lead details')
    }
  }

  const loadExistingEstimate = async () => {
    if (mode === 'create') return
    
    if (!effectiveLeadId) {
      console.warn('Cannot load existing estimate: effectiveLeadId is null')
      return
    }

    try {
      let estimateQuery = supabase
        .from('estimates')
        .select('*')
        .eq('lead_id', effectiveLeadId)
        .order('version', { ascending: false })

      if (existingEstimateId) {
        estimateQuery = estimateQuery.eq('id', existingEstimateId)
      } else {
        estimateQuery = estimateQuery.limit(1)
      }

      const { data, error } = await estimateQuery

      if (error) throw error
      
      if (data && data.length > 0) {
        const estimate = data[0]
        setExistingEstimate(estimate)
        setCurrentEstimateVersion((estimate.version || 1) + 1)
        
        // Pre-populate form with existing data
        if (estimate.line_items) {
          // Convert estimate line items to tier format
          const tiers = estimateTiers.map(tier => ({
            ...tier,
            line_items: estimate.line_items || [],
            total_amount: estimate.total || 0
          }))
          setEstimateTiers(tiers)
        }
        
        setEstimateNotes(estimate.notes || '')
      }
    } catch (error) {
      console.error('Error loading existing estimate:', error)
      showToast.error('Failed to load existing estimate')
    }
  }

  const loadAvailablePhotos = async () => {
    if (!effectiveLeadId) {
      setAvailablePhotos([])
      return
    }

    try {
      // First try to load photos directly associated with the lead
      const { data: leadPhotos, error: leadPhotosError } = await supabase
        .from('job_photos')
        .select('*')
        .eq('lead_id', effectiveLeadId)
        .order('created_at', { ascending: false })

      if (!leadPhotosError && leadPhotos && leadPhotos.length > 0) {
        setAvailablePhotos(leadPhotos.map(photo => ({
          ...photo,
          selected: false,
          userNote: ''
        })))
        return
      }


      // Finally, check if the lead has been converted to a job
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('converted_to_job_id')
        .eq('id', effectiveLeadId)
        .single()

      if (!leadError && leadData?.converted_to_job_id) {
        // Load photos associated with the job
        const { data: jobPhotos, error: jobPhotosError } = await supabase
          .from('job_photos')
          .select('*')
          .eq('job_id', leadData.converted_to_job_id)
          .order('created_at', { ascending: false })

        if (!jobPhotosError && jobPhotos && jobPhotos.length > 0) {
          setAvailablePhotos(jobPhotos.map(photo => ({
            ...photo,
            selected: false,
            userNote: ''
          })))
          return
        }
      }

      // No photos found anywhere
      setAvailablePhotos([])
    } catch (error) {
      console.error('Error loading photos:', error)
      // Don't show error toast if it's just a missing column error during migration
      if (error && typeof error === 'object' && 'code' in error && error.code !== '42703') {
        showToast.error('Failed to load photos')
      }
      setAvailablePhotos([])
    }
  }

  // Cleanup function for stage notifications
  const cleanupStageNotifications = () => {
    showToast.dismiss('ai-stage1')
    showToast.dismiss('ai-stage2')
    showToast.dismiss('ai-stage3')
  }

  // Enhanced close handler that cleans up notifications
  const handleClose = () => {
    cleanupStageNotifications()
    setAiStage('idle')
    setAiGenerating(false)
    onClose()
  }

  // Helper function to extract service type from lead data
  const getServiceType = () => {
    if (!leadDetails) return 'general'
    
    // Extract service type from lead title, description, or service_type
    const leadText = `${leadDetails.title || ''} ${leadDetails.description || ''} ${leadDetails.service_type || ''}`.toLowerCase()
    
    if (leadText.includes('electrical') || leadText.includes('electric') || leadText.includes('wiring')) return 'electrical'
    if (leadText.includes('hvac') || leadText.includes('heating') || leadText.includes('cooling') || leadText.includes('air conditioning')) return 'hvac'
    if (leadText.includes('plumbing') || leadText.includes('pipe') || leadText.includes('water') || leadText.includes('sewer')) return 'plumbing'
    if (leadText.includes('roof') || leadText.includes('shingle') || leadText.includes('gutter')) return 'roofing'
    if (leadText.includes('flooring') || leadText.includes('carpet') || leadText.includes('tile')) return 'flooring'
    if (leadText.includes('painting') || leadText.includes('paint')) return 'painting'
    if (leadText.includes('concrete') || leadText.includes('driveway') || leadText.includes('foundation')) return 'concrete'
    
    return 'general'
  }

  // Stage 1: Analyze Damage
  const runStage1AnalyzeDamage = async () => {
    const selectedPhotos = availablePhotos.filter(p => p.selected)
    
    if (selectedPhotos.length === 0) {
      showToast.error('Please select at least one photo for analysis')
      return
    }

    setAiStage('s1')
    setAiGenerating(true)
    setPipelineError(null)
    showToast.loading('Stage 1: Analyzing damage from photos...')

    try {
      const photoUrls = selectedPhotos.map(p => p.file_url)
      const photoNotes = selectedPhotos.reduce((acc, photo) => {
        acc[photo.file_url] = photo.userNote || photo.description
        return acc
      }, {} as Record<string, string>)

      const serviceType = getServiceType()

      const { data, error } = await supabase.functions.invoke('analyze-damage', {
        body: {
          photoUrls,
          photoNotes,
          leadDetails: {
            title: leadDetails?.title || '',
            description: leadDetails?.description || '',
            location: `${leadDetails?.location_city || ''}, ${leadDetails?.location_state || ''}`,
            serviceType: serviceType
          }
        }
      })

      if (error) throw error

      if (data?.damage_bullets && data?.hazard_paragraph && data?.basic_repairs) {
        setDamageBullets(data.damage_bullets)
        setHazardParagraph(data.hazard_paragraph)
        setBasicRepairs(data.basic_repairs)
        
        // Dismiss the loading notification and show success
        setTimeout(() => {
          showToast.dismiss('ai-stage1')
          showToast.success(`Stage 1 complete! Found ${data.damage_bullets.length} issues and ${data.basic_repairs.length} repairs`)
        }, 100)
      } else {
        throw new Error('Invalid response structure from damage analysis')
      }

    } catch (error) {
      console.error('Stage 1 failed:', error)
      setPipelineError(`Stage 1 failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setTimeout(() => {
        showToast.dismiss('ai-stage1')
        showToast.error('Damage analysis failed')
      }, 100)
    } finally {
      setAiGenerating(false)
      // Add a small delay to ensure UI updates properly
      setTimeout(() => setAiStage('idle'), 100)
    }
  }

  // Stage 2: Extend Scope
  const runStage2ExtendScope = async () => {
    if (basicRepairs.length === 0) {
      showToast.error('Please run damage analysis first')
      return
    }

    setAiStage('s2')
    setAiGenerating(true)
    setPipelineError(null)
    showToast.loading('Stage 2: Generating Better/Best scopes...')

    try {
      const serviceType = getServiceType()
      
      const { data, error } = await supabase.functions.invoke('extend-scope', {
        body: {
          basic_repairs: basicRepairs,
          damage_bullets: damageBullets,
          jobMeta: {
            serviceType: serviceType,
            propertyAge: 25, // Could be extracted from lead details
            location: `${leadDetails?.location_city || ''}, ${leadDetails?.location_state || ''}`,
            jobTitle: leadDetails?.title || '',
            jobDescription: leadDetails?.description || ''
          }
        }
      })

      if (error) throw error

      if (data?.better_repairs && data?.best_repairs) {
        setBetterRepairs(data.better_repairs)
        setBestRepairs(data.best_repairs)
        
        // Dismiss the loading notification and show success
        setTimeout(() => {
          showToast.dismiss('ai-stage2')
          showToast.success(`Stage 2 complete! Generated Better (${data.better_repairs.length}) and Best (${data.best_repairs.length}) scopes`)
        }, 100)
      } else {
        throw new Error('Invalid response structure from scope extension')
      }

    } catch (error) {
      console.error('Stage 2 failed:', error)
      setPipelineError(`Stage 2 failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setTimeout(() => {
        showToast.dismiss('ai-stage2')
        showToast.error('Scope extension failed')
      }, 100)
    } finally {
      setAiGenerating(false)
      // Add a small delay to ensure UI updates properly
      setTimeout(() => setAiStage('idle'), 100)
    }
  }

  // Stage 3: Price and Narrate
  const runStage3PriceAndNarrate = async () => {
    if (basicRepairs.length === 0 || betterRepairs.length === 0 || bestRepairs.length === 0) {
      showToast.error('Please complete Stages 1 and 2 first')
      return
    }

    setAiStage('s3')
    setAiGenerating(true)
    setPipelineError(null)
    showToast.loading('Stage 3: Pricing and generating narrative...')

    try {
      const serviceType = getServiceType()
      
      const { data, error } = await supabase.functions.invoke('price-and-narrate', {
        body: {
          tiers: [
            { tier_name: 'Good', line_items: basicRepairs },
            { tier_name: 'Better', line_items: betterRepairs },
            { tier_name: 'Best', line_items: bestRepairs }
          ],
          priceBook: {}, // Will use default pricing
          targetPrices: customTotals, // Pass custom price targets
          jobMeta: {
            serviceType: serviceType,
            location: `${leadDetails?.location_city || ''}, ${leadDetails?.location_state || ''}`,
            complexity: 'standard',
            jobTitle: leadDetails?.title || '',
            jobDescription: leadDetails?.description || '',
            customerName: leadDetails?.accounts?.name || 
                          (leadDetails?.contacts ? (
                            leadDetails.contacts.name || 
                            `${leadDetails.contacts.first_name || ''} ${leadDetails.contacts.last_name || ''}`.trim()
                          ) : '') || 
                          '',
            propertyAddress: leadDetails?.location_address || ''
          }
        }
      })

      if (error) throw error

      if (data?.narrative && data?.priced_tiers) {
        setAiNarrative(data.narrative)
        
        // Convert to EstimateTier format and apply custom totals
        const convertedTiers: EstimateTier[] = data.priced_tiers.map((tier: any) => {
          const tierName = tier.tier_name as 'Good' | 'Better' | 'Best'
          const customTotal = customTotals[tierName]
          
          // If custom total is provided, use it instead of AI total
          const finalTotal = customTotal || tier.total_amount
          
          return {
            tier_name: tierName,
            description: tier.description,
            total_amount: finalTotal,
            line_items: tier.line_items.map((item: any) => ({
              description: item.description,
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0, // Preserve actual pricing from AI
              total_price: item.total_price || 0, // Preserve actual pricing from AI  
              item_type: item.item_type || 'service'
            }))
          }
        })
        
        setEstimateTiers(convertedTiers)
        
        // Dismiss the loading notification and show success
        setTimeout(() => {
          showToast.dismiss('ai-stage3')
          showToast.success('Stage 3 complete! Generated pricing and narrative')
        }, 100)
        setCurrentStep(2) // Move to review step
      } else {
        throw new Error('Invalid response structure from pricing and narrative')
      }

    } catch (error) {
      console.error('Stage 3 failed:', error)
      setPipelineError(`Stage 3 failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setTimeout(() => {
        showToast.dismiss('ai-stage3')
        showToast.error('Pricing and narrative generation failed')
      }, 100)
    } finally {
      setAiGenerating(false)
      // Add a small delay to ensure UI updates properly
      setTimeout(() => setAiStage('idle'), 100)
    }
  }

  const togglePhotoSelection = (photoId: string) => {
    setAvailablePhotos(prev => prev.map(photo => 
      photo.id === photoId 
        ? { ...photo, selected: !photo.selected }
        : photo
    ))
  }

  const updatePhotoNote = (photoId: string, note: string) => {
    setAvailablePhotos(prev => prev.map(photo => 
      photo.id === photoId 
        ? { ...photo, userNote: note }
        : photo
    ))
  }

  const addLineItem = (tierIndex: number) => {
    const newTiers = [...estimateTiers]
    const newItem = {
      description: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      item_type: 'service' as const
    }
    
    // Add item to the current tier
    newTiers[tierIndex].line_items.push(newItem)
    
    // If adding to Good (index 0), propagate to Better and Best with price multipliers
    if (tierIndex === 0) {
      // Add to Better tier (index 1) with 1.3x multiplier
      if (newTiers[1]) {
        newTiers[1].line_items.push({
          ...newItem,
          description: newItem.description + (newItem.description ? ' (Enhanced)' : ''),
          unit_price: Math.round(newItem.unit_price * 1.3 * 100) / 100
        })
      }
      
      // Add to Best tier (index 2) with 1.6x multiplier
      if (newTiers[2]) {
        newTiers[2].line_items.push({
          ...newItem,
          description: newItem.description + (newItem.description ? ' (Premium)' : ''),
          unit_price: Math.round(newItem.unit_price * 1.6 * 100) / 100
        })
      }
    }
    
    // If adding to Better (index 1), propagate to Best with multiplier
    else if (tierIndex === 1) {
      // Add to Best tier (index 2) with 1.23x multiplier (1.6/1.3)
      if (newTiers[2]) {
        newTiers[2].line_items.push({
          ...newItem,
          description: newItem.description + (newItem.description ? ' (Premium)' : ''),
          unit_price: Math.round(newItem.unit_price * 1.23 * 100) / 100
        })
      }
    }
    
    setEstimateTiers(newTiers)
  }

  const updateLineItem = (tierIndex: number, itemIndex: number, field: string, value: any) => {
    const newTiers = [...estimateTiers]
    const item = newTiers[tierIndex].line_items[itemIndex]
    
    ;(item as any)[field] = value
    
    // Propagate description changes from lower tiers to higher tiers
    if (field === 'description') {
      if (tierIndex === 0 && itemIndex < newTiers[1]?.line_items.length) {
        // Update Better tier description
        const betterItem = newTiers[1].line_items[itemIndex]
        if (betterItem) {
          betterItem.description = value + (value ? ' (Enhanced)' : '')
        }
        
        // Update Best tier description
        if (itemIndex < newTiers[2]?.line_items.length) {
          const bestItem = newTiers[2].line_items[itemIndex]
          if (bestItem) {
            bestItem.description = value + (value ? ' (Premium)' : '')
          }
        }
      }
      
      // Propagate from Better to Best
      else if (tierIndex === 1 && itemIndex < newTiers[2]?.line_items.length) {
        const bestItem = newTiers[2].line_items[itemIndex]
        if (bestItem) {
          bestItem.description = value + (value ? ' (Premium)' : '')
        }
      }
    }
    
    setEstimateTiers(newTiers)
  }

  const removeLineItem = (tierIndex: number, itemIndex: number) => {
    const newTiers = [...estimateTiers]
    
    // Remove from current tier
    newTiers[tierIndex].line_items.splice(itemIndex, 1)
    
    // If removing from Good (index 0), also remove from Better and Best
    if (tierIndex === 0) {
      if (newTiers[1] && itemIndex < newTiers[1].line_items.length) {
        newTiers[1].line_items.splice(itemIndex, 1)
      }
      if (newTiers[2] && itemIndex < newTiers[2].line_items.length) {
        newTiers[2].line_items.splice(itemIndex, 1)
      }
    }
    
    // If removing from Better (index 1), also remove from Best
    else if (tierIndex === 1) {
      if (newTiers[2] && itemIndex < newTiers[2].line_items.length) {
        newTiers[2].line_items.splice(itemIndex, 1)
      }
    }
    
    // Recalculate totals for all affected tiers
    for (let i = tierIndex; i < newTiers.length; i++) {
      newTiers[i].total_amount = newTiers[i].line_items.reduce(
        (sum, item) => sum + item.total_price, 0
      )
    }
    
    setEstimateTiers(newTiers)
  }

  const updateCustomTotal = (tierName: 'Good' | 'Better' | 'Best', total: number) => {
    setCustomTotals(prev => ({
      ...prev,
      [tierName]: total
    }))
    
    // Update the tier's total_amount if custom total is provided
    setEstimateTiers(prev => prev.map(tier => 
      tier.tier_name === tierName && total > 0
        ? { ...tier, total_amount: total }
        : tier
    ))
  }

  const generateAIPricing = async (templateName: string) => {
    if (!leadDetails) return

    setAiGenerating(true)
    showToast.loading('AI is analyzing photos and job details...')

    try {
      // First, get photos for this lead
      const { data: photos, error: photosError } = await supabase
        .from('job_photos')
        .select('file_url, description, photo_type')
        .eq('lead_id', effectiveLeadId)
        .order('created_at', { ascending: false })

      if (photosError) throw photosError

      console.log('🔍 Found photos for analysis:', photos?.length || 0)
      console.log('📷 Photo URLs:', photos?.map(p => p.file_url))
      console.log('📋 Lead details for AI:', {
        title: leadDetails.title,
        description: leadDetails.description,
        serviceType: templateName
      })
      
      // Use Supabase Edge Function for comprehensive AI analysis with photos
      const { data, error } = await supabase.functions.invoke('generate-estimate', {
        body: {
          leadId: effectiveLeadId,
          analysisType: 'comprehensive_pricing',
          leadDetails: {
            title: leadDetails.title,
            description: leadDetails.description,
            serviceType: templateName,
            location: `${leadDetails.location_city}, ${leadDetails.location_state}`,
            estimatedCost: leadDetails.estimated_cost,
            notes: leadDetails.notes
          },
          photoUrls: photos?.map(p => p.file_url) || [],
          photoDescriptions: photos?.map(p => ({ 
            url: p.file_url, 
            description: p.description || '', 
            type: p.photo_type 
          })) || []
        }
      })
      
if (data?.narrative) {
  setAiNarrative(data.narrative)        // ⬅️ store Markdown text
}

      if (error) throw error

      // Apply AI-generated pricing
      if (data?.pricingSuggestions) {
        console.log('🤖 AI response:', data.pricingSuggestions)
        console.log('🤖 AI response type:', typeof data.pricingSuggestions)
        console.log('🤖 AI response is array:', Array.isArray(data.pricingSuggestions))
        
        let pricingSuggestions = data.pricingSuggestions
        
        // If it's a string, try to parse as JSON
        if (typeof pricingSuggestions === 'string') {
          try {
            pricingSuggestions = JSON.parse(pricingSuggestions)
            console.log('🤖 Parsed AI response:', pricingSuggestions)
          } catch (parseError) {
            console.error('❌ Failed to parse AI response as JSON:', parseError)
            throw new Error('AI response is not valid JSON')
          }
        }
        
        // Ensure it's an array before setting
        if (Array.isArray(pricingSuggestions)) {
          // Validate that each tier has the required structure
          const validTiers = pricingSuggestions.filter(tier => 
            tier && 
            typeof tier === 'object' && 
            tier.tier_name && 
            Array.isArray(tier.line_items)
          )
          
          if (validTiers.length > 0) {
            setEstimateTiers(validTiers)
            showToast.dismiss('ai-pricing')
            showToast.success(`AI analyzed ${photos?.length || 0} photos and generated specific pricing!`)
            setCurrentStep(2)
          } else {
            console.error('❌ No valid tiers found in AI response')
            throw new Error('AI response contains no valid pricing tiers')
          }
        } else {
          console.error('❌ AI response is not an array:', pricingSuggestions)
          console.error('❌ Full AI response structure:', data)
          throw new Error('AI response format is invalid - expected array of pricing tiers')
        }
      } else {
        console.error('❌ No pricingSuggestions in response:', data)
        throw new Error('No pricing suggestions received from AI')
      }

    } catch (error) {
      console.error('AI pricing failed:', error)
      showToast.dismiss('ai-pricing')
      showToast.error('AI pricing failed. Using template pricing.')
      
      // Fallback to template pricing
      applyQuickTemplate(templateName)
    } finally {
      setAiGenerating(false)
    }
  }

  const applyQuickTemplate = (templateName: string) => {
    let basePrice = 0
    let baseItems: any[] = []

    // Quick templates based on common service types
    switch (templateName) {
      case 'hvac_repair':
        basePrice = 300
        baseItems = [
          { description: 'Diagnostic and inspection', quantity: 1, unit_price: 120, item_type: 'service' },
          { description: 'Repair labor', quantity: 2, unit_price: 90, item_type: 'labor' }
        ]
        break
      case 'plumbing_repair':
        basePrice = 250
        baseItems = [
          { description: 'Service call and diagnosis', quantity: 1, unit_price: 100, item_type: 'service' },
          { description: 'Repair work', quantity: 1.5, unit_price: 100, item_type: 'labor' }
        ]
        break
      case 'electrical_repair':
        basePrice = 200
        baseItems = [
          { description: 'Electrical diagnosis', quantity: 1, unit_price: 80, item_type: 'service' },
          { description: 'Repair labor', quantity: 1.5, unit_price: 80, item_type: 'labor' }
        ]
        break
      default:
        basePrice = 200
        baseItems = [
          { description: 'Service call', quantity: 1, unit_price: 100, item_type: 'service' },
          { description: 'Labor', quantity: 1, unit_price: 100, item_type: 'labor' }
        ]
    }

    // Apply template to all three tiers with multipliers
    const newTiers = estimateTiers.map((tier, index) => {
      const multiplier = index === 0 ? 1.0 : index === 1 ? 1.3 : 1.6 // Good, Better, Best pricing
      
      const tierItems = baseItems.map(item => ({
        description: item.description + (index === 0 ? '' : index === 1 ? ' (Enhanced)' : ' (Premium)'),
        quantity: item.quantity,
        unit_price: Math.round(item.unit_price * multiplier * 100) / 100,
        total_price: Math.round(item.unit_price * item.quantity * multiplier * 100) / 100,
        item_type: item.item_type
      }))

      const tierTotal = tierItems.reduce((sum, item) => sum + item.total_price, 0)

      return {
        ...tier,
        line_items: tierItems,
        total_amount: tierTotal
      }
    })

    setEstimateTiers(newTiers)
    setCurrentStep(2)
  }

  const createEstimate = async (action: 'draft' | 'send' = 'draft') => {
    if (!leadDetails) {
      showToast.error('Lead details not loaded')
      return
    }

    if (!effectiveLeadId) {
      showToast.error('No lead ID available')
      return
    }

    setLoading(true)
    try {
      // Get the selected tier's total (custom or calculated)
      const selectedTierData = estimateTiers.find(t => t.tier_name === selectedTier)
      const selectedTierTotal = customTotals[selectedTier] || selectedTierData?.total_amount || 0

      // Determine estimate status based on action
      const estimateStatus = action === 'send' ? 'sent' : 'draft'

      // Create main estimate record with versioning
      const { data: estimate, error: estimateError } = await supabase
        .from('estimates')
        .insert({
          lead_id: effectiveLeadId,
          tenant_id: userProfile?.tenant_id,
          estimate_number: `EST-${Date.now().toString().slice(-6)}`,
          project_title: `Estimate for ${leadDetails.title}`,
          description: estimateNotes,
          total_amount: selectedTierTotal,
          selected_tier: selectedTier.toLowerCase(),
          status: estimateStatus,
          version: currentEstimateVersion,
          valid_until: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (estimateError) throw estimateError

      // Create estimate tiers
      if (!Array.isArray(estimateTiers)) {
        throw new Error('Invalid estimate tiers - not an array')
      }
      
      console.log('Creating estimate with tiers:', estimateTiers)
      
      for (const tier of estimateTiers) {
        console.log(`Processing tier ${tier.tier_name}:`, tier)
        
        // Create tier even if line_items is empty - we still need the pricing tier
        // if (tier.line_items.length === 0) continue // REMOVED: This was causing blank estimates

        // Use custom total if provided, otherwise use calculated total
        const finalTotal = customTotals[tier.tier_name] || tier.total_amount

        const { data: tierData, error: tierError } = await supabase
          .from('estimate_tiers')
          .insert({
            estimate_id: estimate.id,
            tenant_id: userProfile?.tenant_id,
            tier_level: tier.tier_name.toLowerCase(), // good, better, best
            tier_name: tier.tier_name,
            description: tier.description,
            total_amount: finalTotal,
            is_selected: tier.tier_name === selectedTier, // Use customer's choice
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (tierError) throw tierError

        // Create line items for this tier (only if there are actual line items)
        if (tier.line_items && tier.line_items.length > 0) {
          // Map item types to database-allowed values
          const mapItemType = (type: string): string => {
            switch (type?.toLowerCase()) {
              case 'labor': return 'labor'
              case 'material': return 'material'
              case 'equipment': return 'material' // Map equipment to material
              case 'permit': return 'other' // Map permit to other
              case 'disposal': return 'other' // Map disposal to other
              case 'service': return 'service'
              default: return 'service' // Default fallback
            }
          }
          
          const lineItems = tier.line_items.map(item => ({
            estimate_tier_id: tierData.id,
            tenant_id: userProfile?.tenant_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.total_price, // Use line_total instead of total_price
            item_type: mapItemType(item.item_type), // Map to valid database values
            created_at: new Date().toISOString()
          }))

          console.log(`Inserting ${lineItems.length} line items for tier ${tier.tier_name}:`, lineItems)
          
          const { error: itemsError } = await supabase
            .from('estimate_line_items')
            .insert(lineItems)

          if (itemsError) {
            console.error('Error inserting line items:', itemsError)
            throw itemsError
          }
        } else {
          console.log(`No line items to insert for tier ${tier.tier_name}`)
        }
      }

      // Update lead's active_estimate_id to point to the latest version
      if (estimateStatus === 'draft' || estimateStatus === 'sent') {
        await supabase
          .from('leads')
          .update({ active_estimate_id: estimate.id })
          .eq('id', effectiveLeadId)
      }

      // Log the estimate creation activity
      if (userProfile?.tenant_id && userProfile?.id) {
        await jobActivityService.logActivity({
          leadId: effectiveLeadId,
          tenantId: userProfile.tenant_id,
          userId: userProfile.id,
          activityType: mode === 'revise' ? 'estimate_revised' : 'estimate_created',
          title: mode === 'revise' ? 'Estimate Revised' : 'Estimate Created',
          description: `${mode === 'revise' ? 'Revised' : 'Created'} estimate v${currentEstimateVersion} for ${selectedTierTotal}`,
          metadata: {
            estimate_id: estimate.id,
            version: currentEstimateVersion,
            selected_tier: selectedTier,
            total_amount: selectedTierTotal,
            action: action
          }
        })
      }

      // Update Customer Journey Store
      const estimateData: EstimateSchema = {
        id: estimate.id,
        lead_id: effectiveLeadId,
        number: estimate.estimate_number,
        line_items: estimateTiers.find(t => t.tier_name === selectedTier)?.line_items?.map(item => ({
          title: item.description,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total_price || (item.quantity * item.unit_price)
        })) || [],
        subtotal: selectedTierTotal,
        tax_rate: 0,
        tax_amount: 0,
        total: selectedTierTotal,
        valid_until: estimate.valid_until,
        status: estimateStatus as 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected',
        created_at: estimate.created_at
      }
      
      setEstimate(estimateData)
      
      // Emit appropriate events for journey tracking
      if (mode === 'revise') {
        journeyEventBus.emit(JOURNEY_EVENTS.ESTIMATE_CREATED, {
          estimate: estimateData,
          version: currentEstimateVersion,
          action: 'revised'
        })
      } else {
        journeyEventBus.emit(JOURNEY_EVENTS.ESTIMATE_CREATED, {
          estimate: estimateData,
          selectedTier: selectedTier,
          totalAmount: selectedTierTotal
        })
      }

      trackAction(mode === 'revise' ? 'estimate_revised_successfully' : 'estimate_created_successfully')
      
      // Handle journey step progression
      if (estimateStatus === 'draft') {
        // Stay on current step for drafts
        const successMessage = mode === 'revise' 
          ? `Estimate v${currentEstimateVersion} saved as draft!`
          : 'Estimate saved as draft!'
        showToast.success(successMessage)
      } else {
        // Auto-advance step when estimate is sent
        completeCurrentStep()
        const successMessage = mode === 'revise'
          ? `Estimate v${currentEstimateVersion} sent to customer!`
          : 'Estimate sent to customer!'
        showToast.success(successMessage)
      }
      
      onEstimateCreated(estimate.id)
      setCurrentStep(3) // Show completion step

    } catch (error) {
      console.error('Error creating estimate:', error)
      showToast.error('Failed to create estimate')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
        <div className="modal-dialog modal-fullscreen">
          <div className="modal-content">
          <div className="modal-header bg-success">
            <h5 className="modal-title text-white">
              <KTIcon iconName="document" className="fs-2 text-white me-2" />
              {mode === 'revise' 
                ? `Revise Estimate v${currentEstimateVersion} - ${leadDetails?.title || 'New Estimate'}`
                : `Create Estimate - ${leadDetails?.title || 'New Estimate'}`
              }
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={handleClose}></button>
          </div>

          <div className="modal-body">
            {/* Lead Information Card */}
            {(lead || leadDetails) && (
              <div className="alert alert-light-primary d-flex align-items-center p-5 mb-5">
                <KTIcon iconName="profile-user" className="fs-2hx text-primary me-4" />
                <div className="d-flex flex-column">
                  <h4 className="mb-1 text-primary">Creating Estimate For:</h4>
                  <div className="fs-6 text-gray-800">
                    <strong>{lead?.name || leadDetails?.name || leadDetails?.title || 'Customer'}</strong>
                    {(lead?.service_type || leadDetails?.service_type) && (
                      <span className="text-gray-600 ms-2">• {lead?.service_type || leadDetails?.service_type}</span>
                    )}
                    {(lead?.phone_number || leadDetails?.phone) && (
                      <span className="text-gray-600 d-block mt-1">
                        <KTIcon iconName="phone" className="fs-6 me-1" />
                        {lead?.phone_number || leadDetails?.phone}
                      </span>
                    )}
                    {(lead?.full_address || leadDetails?.location_address) && (
                      <span className="text-gray-600 d-block mt-1">
                        <KTIcon iconName="geolocation" className="fs-6 me-1" />
                        {lead?.full_address || leadDetails?.location_address}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Journey Progress */}
            <StepTrackerMini className="mb-5" />
            {/* Progress Indicator */}
            <div className="d-flex justify-content-center mb-6">
              <div className="d-flex align-items-center">
                <div className={`rounded-circle d-flex align-items-center justify-content-center me-3 ${currentStep >= 0 ? 'bg-primary text-white' : 'bg-light text-muted'}`} style={{ width: '40px', height: '40px' }}>
                  {currentStep > 0 ? <KTIcon iconName="check" className="fs-6" /> : '1'}
                </div>
                <span className={`me-3 ${currentStep >= 0 ? 'text-primary' : 'text-muted'}`}>Choose Method</span>
                
                <div className={`border-top ${currentStep >= 1 ? 'border-primary' : 'border-muted'}`} style={{ width: '60px', height: '2px' }}></div>
                
                <div className={`rounded-circle d-flex align-items-center justify-content-center mx-3 ${currentStep >= 1 ? 'bg-primary text-white' : 'bg-light text-muted'}`} style={{ width: '40px', height: '40px' }}>
                  {currentStep > 1 ? <KTIcon iconName="check" className="fs-6" /> : '2'}
                </div>
                <span className={`me-3 ${currentStep >= 1 ? 'text-primary' : 'text-muted'}`}>
                  {estimateMethod === 'ai' ? 'Select Photos' : 'Build Estimate'}
                </span>
                
                <div className={`border-top ${currentStep >= 2 ? 'border-primary' : 'border-muted'}`} style={{ width: '60px', height: '2px' }}></div>
                
                <div className={`rounded-circle d-flex align-items-center justify-content-center mx-3 ${currentStep >= 2 ? 'bg-primary text-white' : 'bg-light text-muted'}`} style={{ width: '40px', height: '40px' }}>
                  {currentStep > 2 ? <KTIcon iconName="check" className="fs-6" /> : '3'}
                </div>
                <span className={`me-3 ${currentStep >= 2 ? 'text-primary' : 'text-muted'}`}>
                  {estimateMethod === 'ai' ? 'AI Analysis' : 'Review & Send'}
                </span>
                
                <div className={`border-top ${currentStep >= 3 ? 'border-primary' : 'border-muted'}`} style={{ width: '60px', height: '2px' }}></div>
                
                <div className={`rounded-circle d-flex align-items-center justify-content-center mx-3 ${currentStep >= 3 ? 'bg-primary text-white' : 'bg-light text-muted'}`} style={{ width: '40px', height: '40px' }}>
                  {currentStep > 3 ? <KTIcon iconName="check" className="fs-6" /> : '4'}
                </div>
                <span className={`${currentStep >= 3 ? 'text-primary' : 'text-muted'}`}>Review & Send</span>
              </div>
            </div>

            {/* Step 0: Method Selection */}
            {currentStep === 0 && (
              <div>
                <div className="text-center mb-8">
                  <h4 className="mb-3">Choose Your Estimate Method</h4>
                  <p className="text-muted">Select how you'd like to create your estimate</p>
                </div>

                <div className="row g-6 mb-8">
                  {/* AI-Powered */}
                  <div className="col-md-4">
                    <div className="card h-100 hover-elevate-up">
                      <div className="card-body text-center">
                        <div className="mb-4 text-primary">
                          <KTIcon iconName="technology" className="fs-3x" />
                        </div>
                        <h5 className="mb-3">AI-Powered</h5>
                        <p className="text-muted small mb-4">
                          Upload photos and let AI analyze damage, generate repairs, and create pricing
                        </p>
                        <div className="text-start mb-4">
                          <div className="d-flex align-items-center mb-2">
                            <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                            <small>Photo-based damage analysis</small>
                          </div>
                          <div className="d-flex align-items-center mb-2">
                            <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                            <small>Automated scope generation</small>
                          </div>
                          <div className="d-flex align-items-center">
                            <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                            <small>Smart pricing suggestions</small>
                          </div>
                        </div>
                        <button
                          className="btn btn-primary w-100"
                          onClick={async () => {
                            setEstimateMethod('ai')
                            trackAction('estimate_method_selected:ai')
                            // Load photos before proceeding
                            await loadAvailablePhotos()
                            setCurrentStep(1)
                          }}
                        >
                          Use AI Assistant
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Template Based */}
                  <div className="col-md-4">
                    <div className="card h-100 hover-elevate-up">
                      <div className="card-body text-center">
                        <div className="mb-4 text-info">
                          <KTIcon iconName="element-11" className="fs-3x" />
                        </div>
                        <h5 className="mb-3">Quick Templates</h5>
                        <p className="text-muted small mb-4">
                          Choose from pre-built templates for common services and customize as needed
                        </p>
                        <div className="text-start mb-4">
                          <div className="d-flex align-items-center mb-2">
                            <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                            <small>Industry-standard pricing</small>
                          </div>
                          <div className="d-flex align-items-center mb-2">
                            <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                            <small>Customizable line items</small>
                          </div>
                          <div className="d-flex align-items-center">
                            <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                            <small>Fast estimate creation</small>
                          </div>
                        </div>
                        <button
                          className="btn btn-info w-100"
                          onClick={() => {
                            setEstimateMethod('template')
                            setCurrentStep(2) // Skip to template selection
                            trackAction('estimate_method_selected:template')
                          }}
                        >
                          Use Templates
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Manual Form */}
                  <div className="col-md-4">
                    <div className="card h-100 hover-elevate-up">
                      <div className="card-body text-center">
                        <div className="mb-4 text-success">
                          <KTIcon iconName="notepad-edit" className="fs-3x" />
                        </div>
                        <h5 className="mb-3">Manual Entry</h5>
                        <p className="text-muted small mb-4">
                          Complete control with our comprehensive estimate form for complex projects
                        </p>
                        <div className="text-start mb-4">
                          <div className="d-flex align-items-center mb-2">
                            <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                            <small>Full customization</small>
                          </div>
                          <div className="d-flex align-items-center mb-2">
                            <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                            <small>Detailed line items</small>
                          </div>
                          <div className="d-flex align-items-center">
                            <KTIcon iconName="check-circle" className="fs-6 text-success me-2" />
                            <small>Advanced pricing options</small>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-success w-100"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            console.log('Manual entry button clicked')
                            trackAction('estimate_method_selected:manual')
                            setEstimateMethod('manual')
                            setShowManualForm(true)
                          }}
                        >
                          Manual Entry
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                {existingEstimate && (
                  <div className="alert alert-info d-flex align-items-center">
                    <KTIcon iconName="information" className="fs-2 me-3" />
                    <div>
                      <strong>Previous Estimate Found</strong>
                      <p className="mb-0 text-muted">
                        Version {existingEstimate.version || 1} created on {new Date(existingEstimate.created_at).toLocaleDateString()}
                        {' - '}${existingEstimate.total_amount?.toLocaleString() || '0'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Photo Selection for AI */}
            {currentStep === 1 && estimateMethod === 'ai' && (
              <div>
                <div className="text-center mb-8">
                  <h4 className="mb-3">📸 Select Photos for AI Analysis</h4>
                  <p className="text-muted">Choose the photos you want the AI to analyze for damage assessment</p>
                </div>

                {availablePhotos.length === 0 ? (
                  <div className="text-center py-5">
                    <KTIcon iconName="picture" className="fs-3x text-muted mb-4" />
                    <h5 className="text-muted">No Photos Available</h5>
                    <p className="text-muted mb-4">No photos have been uploaded for this lead yet.</p>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        // TODO: Open photo upload modal
                        showToast.info('Photo upload feature coming soon')
                      }}
                    >
                      <KTIcon iconName="cloud-add" className="fs-4 me-2" />
                      Upload Photos
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="row g-4 mb-6">
                      {availablePhotos.map(photo => (
                        <div key={photo.id} className="col-md-4 col-lg-3">
                          <div 
                            className={`card cursor-pointer h-100 ${photo.selected ? 'border-primary shadow-sm' : 'border-gray-300'}`}
                            onClick={() => togglePhotoSelection(photo.id)}
                          >
                            <div className="position-relative">
                              <img 
                                src={photo.file_url} 
                                alt={photo.description}
                                className="card-img-top"
                                style={{ height: '200px', objectFit: 'cover' }}
                              />
                              {photo.selected && (
                                <div className="position-absolute top-0 end-0 m-3">
                                  <div className="btn btn-sm btn-primary rounded-circle">
                                    <KTIcon iconName="check" className="fs-6" />
                                  </div>
                                </div>
                              )}
                              <div className="position-absolute bottom-0 start-0 end-0 bg-dark bg-opacity-50 text-white p-2">
                                <small>{photo.photo_type || 'General'}</small>
                              </div>
                            </div>
                            <div className="card-body">
                              <p className="text-muted small mb-2">{photo.description || 'No description'}</p>
                              {photo.selected && (
                                <textarea
                                  className="form-control form-control-sm"
                                  placeholder="Add notes about what to analyze in this photo..."
                                  value={photo.userNote || ''}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    updatePhotoNote(photo.id, e.target.value)
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  rows={2}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Selection Summary */}
                    <div className="d-flex justify-content-between align-items-center p-4 bg-light rounded">
                      <div>
                        <h6 className="mb-0">
                          {availablePhotos.filter(p => p.selected).length} of {availablePhotos.length} photos selected
                        </h6>
                        <small className="text-muted">
                          {availablePhotos.filter(p => p.selected).length === 0 
                            ? 'Select at least one photo to continue'
                            : 'AI will analyze the selected photos for damage and repairs'
                          }
                        </small>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={() => setCurrentStep(2)}
                        disabled={availablePhotos.filter(p => p.selected).length === 0}
                      >
                        Continue to AI Analysis
                        <KTIcon iconName="arrow-right" className="fs-4 ms-2" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 2: 3-Stage AI Pipeline */}
            {currentStep === 2 && estimateMethod === 'ai' && (
              <div>
                {/* Lead Info Banner */}
                {lead && (
                  <div className="alert alert-primary d-flex align-items-center mb-6">
                    <KTIcon iconName="user" className="fs-2 me-3" />
                    <div>
                      <h6 className="mb-0">Creating estimate for: <strong>{lead.name}</strong></h6>
                      <p className="mb-0 text-muted small">
                        {lead.service_type} • {lead.contact?.phone || 'No phone'} • {lead.urgency} priority
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Pipeline Header */}
                <div className="text-center mb-8">
                  <h4 className="mb-3">🤖 AI-Powered Estimate Builder</h4>
                  <p className="text-muted">Advanced 3-stage pipeline for accurate estimates</p>
                </div>

                {/* Pipeline Stages */}
                <div className="row g-6 mb-8">
                  {/* Stage 1 */}
                  <div className="col-md-4">
                    <div className={`card h-100 ${aiStage === 's1' ? 'border-primary' : basicRepairs.length > 0 ? 'border-success' : ''}`}>
                      <div className="card-body text-center">
                        <div className={`mb-4 ${basicRepairs.length > 0 ? 'text-success' : 'text-primary'}`}>
                          {basicRepairs.length > 0 ? (
                            <KTIcon iconName="check-circle" className="fs-2x" />
                          ) : (
                            <KTIcon iconName="eye" className="fs-2x" />
                          )}
                        </div>
                        <h5 className="mb-3">Stage 1: Analyze Damage</h5>
                        <p className="text-muted small mb-4">AI analyzes photos to identify damage and basic repairs</p>
                        
                        {basicRepairs.length > 0 && (
                          <div className="alert alert-success py-2 mb-3">
                            <small>✅ Found {damageBullets.length} issues, {basicRepairs.length} repairs</small>
                          </div>
                        )}

                        <button
                          className="btn btn-primary btn-sm w-100"
                          onClick={runStage1AnalyzeDamage}
                          disabled={aiGenerating || availablePhotos.filter(p => p.selected).length === 0}
                        >
                          {aiStage === 's1' ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              Analyzing...
                            </>
                          ) : basicRepairs.length > 0 ? (
                            'Re-analyze'
                          ) : (
                            'Analyze Damage'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stage 2 */}
                  <div className="col-md-4">
                    <div className={`card h-100 ${aiStage === 's2' ? 'border-primary' : betterRepairs.length > 0 ? 'border-success' : ''}`}>
                      <div className="card-body text-center">
                        <div className={`mb-4 ${betterRepairs.length > 0 ? 'text-success' : basicRepairs.length > 0 ? 'text-primary' : 'text-muted'}`}>
                          {betterRepairs.length > 0 ? (
                            <KTIcon iconName="check-circle" className="fs-2x" />
                          ) : (
                            <KTIcon iconName="setting-3" className="fs-2x" />
                          )}
                        </div>
                        <h5 className="mb-3">Stage 2: Generate Scopes</h5>
                        <p className="text-muted small mb-4">Expand to Better/Best tiers with upgrades</p>
                        
                        {betterRepairs.length > 0 && (
                          <div className="alert alert-success py-2 mb-3">
                            <small>✅ Better: {betterRepairs.length}, Best: {bestRepairs.length} items</small>
                          </div>
                        )}

                        <button
                          className="btn btn-primary btn-sm w-100"
                          onClick={runStage2ExtendScope}
                          disabled={aiGenerating || basicRepairs.length === 0}
                        >
                          {aiStage === 's2' ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              Generating...
                            </>
                          ) : betterRepairs.length > 0 ? (
                            'Re-generate'
                          ) : (
                            'Generate Scopes'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stage 3 */}
                  <div className="col-md-4">
                    <div className={`card h-100 ${aiStage === 's3' ? 'border-primary' : aiNarrative ? 'border-success' : ''}`}>
                      <div className="card-body text-center">
                        <div className={`mb-4 ${aiNarrative ? 'text-success' : betterRepairs.length > 0 ? 'text-primary' : 'text-muted'}`}>
                          {aiNarrative ? (
                            <KTIcon iconName="check-circle" className="fs-2x" />
                          ) : (
                            <KTIcon iconName="dollar" className="fs-2x" />
                          )}
                        </div>
                        <h5 className="mb-3">Stage 3: Price & Narrate</h5>
                        <p className="text-muted small mb-4">Generate pricing and professional narrative</p>
                        
                        {(customTotals.Good || customTotals.Better || customTotals.Best) && (
                          <div className="alert alert-info py-2 mb-3">
                            <small>💰 Using custom target prices</small>
                          </div>
                        )}
                        
                        {aiNarrative && (
                          <div className="alert alert-success py-2 mb-3">
                            <small>✅ Pricing complete with narrative</small>
                          </div>
                        )}

                        <button
                          className="btn btn-primary btn-sm w-100"
                          onClick={runStage3PriceAndNarrate}
                          disabled={aiGenerating || bestRepairs.length === 0}
                        >
                          {aiStage === 's3' ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              Pricing...
                            </>
                          ) : aiNarrative ? (
                            'Re-price'
                          ) : (
                            'Price & Narrate'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pipeline Results */}
                {(damageBullets.length > 0 || hazardParagraph || pipelineError) && (
                  <div className="row g-4 mb-6">
                    {/* Damage Assessment */}
                    {damageBullets.length > 0 && (
                      <div className="col-md-6">
                        <div className="card">
                          <div className="card-header">
                            <h6 className="card-title">🔍 Damage Assessment</h6>
                          </div>
                          <div className="card-body">
                            <ul className="list-unstyled mb-0">
                              {damageBullets.map((bullet, index) => (
                                <li key={index} className="d-flex align-items-start mb-2">
                                  <KTIcon iconName="arrow-right" className="fs-6 text-primary me-2 mt-1" />
                                  <span className="small">{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Safety Hazards */}
                    {hazardParagraph && (
                      <div className="col-md-6">
                        <div className="card">
                          <div className="card-header">
                            <h6 className="card-title">⚠️ Safety Assessment</h6>
                          </div>
                          <div className="card-body">
                            <p className="small text-warning mb-0">{hazardParagraph}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Pipeline Error */}
                    {pipelineError && (
                      <div className="col-12">
                        <div className="alert alert-danger">
                          <KTIcon iconName="warning" className="fs-6 me-2" />
                          {pipelineError}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Custom Price Targets */}
                <div className="card mb-6">
                  <div className="card-header">
                    <h6 className="card-title">💰 Target Pricing (Optional)</h6>
                  </div>
                  <div className="card-body">
                    <p className="text-muted mb-4">
                      Set target prices for each tier. The AI will distribute these amounts across line items proportionally.
                    </p>
                    <div className="row g-4">
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Good Tier Target</label>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control"
                            placeholder="Leave blank for AI pricing"
                            value={customTotals.Good || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || undefined
                              // Update both states together using current state
                              setManuallySetTiers(prevManual => {
                                const newManual = { ...prevManual, Good: !!value }
                                setCustomTotals(prevTotals => {
                                  const newTotals = { ...prevTotals, Good: value }
                                  // Auto-calculate Better and Best if they haven't been manually set
                                  if (value) {
                                    if (!newManual.Better) {
                                      newTotals.Better = Math.round(value * 1.3 * 100) / 100
                                    }
                                    if (!newManual.Best) {
                                      newTotals.Best = Math.round(value * 1.6 * 100) / 100
                                    }
                                  } else {
                                    // If Good is cleared, clear others if they weren't manually set
                                    if (!newManual.Better) newTotals.Better = undefined
                                    if (!newManual.Best) newTotals.Best = undefined
                                  }
                                  return newTotals
                                })
                                return newManual
                              })
                            }}
                          />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          Better Tier Target
                          {customTotals.Better && !manuallySetTiers.Better && (
                            <span className="badge badge-light-info ms-2">Auto +30%</span>
                          )}
                        </label>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <input
                            type="number"
                            step="0.01"
                            className={`form-control ${customTotals.Better && !manuallySetTiers.Better ? 'bg-light-info' : ''}`}
                            placeholder="Leave blank for AI pricing"
                            value={customTotals.Better || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || undefined
                              setManuallySetTiers(prev => ({ ...prev, Better: !!value }))
                              setCustomTotals(prev => ({ ...prev, Better: value }))
                            }}
                          />
                        </div>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">
                          Best Tier Target
                          {customTotals.Best && !manuallySetTiers.Best && (
                            <span className="badge badge-light-info ms-2">Auto +60%</span>
                          )}
                        </label>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <input
                            type="number"
                            step="0.01"
                            className={`form-control ${customTotals.Best && !manuallySetTiers.Best ? 'bg-light-info' : ''}`}
                            placeholder="Leave blank for AI pricing"
                            value={customTotals.Best || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || undefined
                              setManuallySetTiers(prev => ({ ...prev, Best: !!value }))
                              setCustomTotals(prev => ({ ...prev, Best: value }))
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <small className="text-muted d-block mt-3">
                      💡 Tip: Setting a Good price will automatically calculate Better (+30%) and Best (+60%) unless you override them manually.
                    </small>
                  </div>
                </div>

                {/* Fallback Templates */}
                <div className="card">
                  <div className="card-header">
                    <h6 className="card-title">📋 Quick Templates (Fallback)</h6>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-md-3">
                        <button
                          className="btn btn-light btn-sm w-100"
                          onClick={() => applyQuickTemplate('electrical_repair')}
                        >
                          <KTIcon iconName="flash" className="fs-6 me-1" />
                          Electrical
                        </button>
                      </div>
                      <div className="col-md-3">
                        <button
                          className="btn btn-light btn-sm w-100"
                          onClick={() => applyQuickTemplate('hvac_repair')}
                        >
                          <KTIcon iconName="home-2" className="fs-6 me-1" />
                          HVAC
                        </button>
                      </div>
                      <div className="col-md-3">
                        <button
                          className="btn btn-light btn-sm w-100"
                          onClick={() => applyQuickTemplate('plumbing_repair')}
                        >
                          <KTIcon iconName="wrench" className="fs-6 me-1" />
                          Plumbing
                        </button>
                      </div>
                      <div className="col-md-3">
                        <button
                          className="btn btn-light btn-sm w-100"
                          onClick={() => applyQuickTemplate('custom')}
                        >
                          <KTIcon iconName="setting" className="fs-6 me-1" />
                          Custom
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Step 2: Template Selection (for template method) */}
            {currentStep === 2 && estimateMethod === 'template' && (
              <div>
                {/* Lead Info Banner */}
                {lead && (
                  <div className="alert alert-primary d-flex align-items-center mb-6">
                    <KTIcon iconName="user" className="fs-2 me-3" />
                    <div>
                      <h6 className="mb-0">Creating estimate for: <strong>{lead.name}</strong></h6>
                      <p className="mb-0 text-muted small">
                        {lead.service_type} • {lead.contact?.phone || 'No phone'} • {lead.urgency} priority
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h4 className="mb-3">Select an Estimate Template</h4>
                  <p className="text-muted">Choose a template that matches your service type</p>
                </div>

                <div className="row g-4 mb-6">
                  {[
                    { id: 'hvac_repair', name: 'HVAC Repair', icon: 'thermometer', price: '$350-$1,200' },
                    { id: 'plumbing_repair', name: 'Plumbing Repair', icon: 'drop', price: '$250-$800' },
                    { id: 'electrical_repair', name: 'Electrical Repair', icon: 'electricity', price: '$200-$600' },
                    { id: 'general_maintenance', name: 'General Maintenance', icon: 'wrench', price: '$150-$500' }
                  ].map(template => (
                    <div key={template.id} className="col-md-3">
                      <div className="card h-100 hover-elevate-up cursor-pointer" 
                           onClick={() => {
                             applyQuickTemplate(template.id)
                             setCurrentStep(3) // Move to review
                           }}>
                        <div className="card-body text-center">
                          <KTIcon iconName={template.icon} className="fs-3x text-primary mb-3" />
                          <h6>{template.name}</h6>
                          <p className="text-muted small mb-0">{template.price}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Review & Send (Final Step) */}
            {currentStep === 3 && (
              <div>
                {/* Lead Info Header */}
                {leadDetails && (
                  <div className="card mb-6">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-6">
                          <h5>{leadDetails.accounts?.name || 
                              (leadDetails.contacts ? (
                                leadDetails.contacts.name || 
                                `${leadDetails.contacts.first_name || ''} ${leadDetails.contacts.last_name || ''}`.trim()
                              ) : '') || 
                              'Unknown Client'}</h5>
                          <p className="text-muted mb-0">
                            {leadDetails.location_address || 'No address provided'}<br/>
                            {leadDetails.location_city}, {leadDetails.location_state}
                          </p>
                        </div>
                        <div className="col-md-6 text-end">
                          <p className="mb-0">
                            <strong>Contact:</strong> {leadDetails.contacts?.first_name} {leadDetails.contacts?.last_name}<br/>
                            <strong>Phone:</strong> {leadDetails.contacts?.phone}<br/>
                            <strong>Email:</strong> {leadDetails.contacts?.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

{aiNarrative && (
  <div className="card mb-6">
    <div
      className="card-body"
      style={{ whiteSpace: 'pre-wrap' }}
      dangerouslySetInnerHTML={{ 
        __html: marked && typeof marked === 'function' 
          ? marked(aiNarrative) as string
          : aiNarrative 
      }}
    />
  </div>
)}

                {/* Customer Choice Section */}
                <div className="card mb-6">
                  <div className="card-body">
                    <div className="row align-items-center">
                      <div className="col-md-6">
                        <h6 className="card-title mb-3">📞 Customer Choice</h6>
                        <div className="d-flex gap-4">
                          {['Good', 'Better', 'Best'].map((tierName) => (
                            <div key={tierName} className="form-check">
                              <input
                                className="form-check-input"
                                type="radio"
                                name="selectedTier"
                                id={`tier-${tierName}`}
                                checked={selectedTier === tierName}
                                onChange={() => setSelectedTier(tierName as 'Good' | 'Better' | 'Best')}
                              />
                              <label className="form-check-label fw-semibold" htmlFor={`tier-${tierName}`}>
                                {tierName}
                                {selectedTier === tierName && (
                                  <span className="badge badge-success ms-2">Selected</span>
                                )}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="col-md-6">
                        <p className="text-muted mb-0">
                          <strong>Selected:</strong> {selectedTier} tier
                          {selectedTier === 'Good' && ' - Basic solution'}
                          {selectedTier === 'Better' && ' - Enhanced solution (Recommended)'}
                          {selectedTier === 'Best' && ' - Premium solution'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Good, Better, Best Tiers */}
                <div className="row g-6">
                  {Array.isArray(estimateTiers) && estimateTiers.map((tier, tierIndex) => (
                    <div key={tier.tier_name} className="col-lg-4">
                      <div className={`card h-100 ${selectedTier === tier.tier_name ? 'border-success bg-light-success' : tier.tier_name === 'Better' ? 'border-primary' : ''}`}>
                        <div className="card-header">
                          <div className="d-flex justify-content-between align-items-center">
                            <h5 className={`card-title mb-0 ${selectedTier === tier.tier_name ? 'text-success' : tier.tier_name === 'Better' ? 'text-primary' : ''}`}>
                              {tier.tier_name}
                              {selectedTier === tier.tier_name && (
                                <span className="badge badge-success ms-2">Customer Choice</span>
                              )}
                              {tier.tier_name === 'Better' && selectedTier !== tier.tier_name && (
                                <span className="badge badge-primary ms-2">Recommended</span>
                              )}
                            </h5>
                          </div>
                          <input
                            type="text"
                            className="form-control form-control-sm mt-2"
                            placeholder="Tier description..."
                            value={tier.description}
                            onChange={(e) => {
                              const newTiers = [...estimateTiers]
                              newTiers[tierIndex].description = e.target.value
                              setEstimateTiers(newTiers)
                            }}
                          />
                        </div>
                        
                        <div className="card-body">
                          {/* Line Items */}
                          <div className="mb-4">
                            {tier.line_items.map((item, itemIndex) => (
                              <div key={itemIndex} className="border rounded p-3 mb-3">
                                <div className="d-flex align-items-center">
                                  <div className="flex-grow-1 me-2">
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      placeholder="Work item description"
                                      value={item.description}
                                      onChange={(e) => updateLineItem(tierIndex, itemIndex, 'description', e.target.value)}
                                    />
                                  </div>
                                  <button
                                    className="btn btn-sm btn-light-danger"
                                    onClick={() => removeLineItem(tierIndex, itemIndex)}
                                  >
                                    <KTIcon iconName="trash" className="fs-6" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            
                            <button
                              className="btn btn-light-primary btn-sm w-100"
                              onClick={() => addLineItem(tierIndex)}
                            >
                              <KTIcon iconName="plus" className="fs-6 me-1" />
                              Add Line Item
                            </button>
                          </div>
                        </div>
                        
                        <div className="card-footer">
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="fw-bold">Total:</span>
                            <span className={`fs-4 fw-bold ${selectedTier === tier.tier_name ? 'text-success' : 'text-primary'}`}>
                              ${tier.total_amount.toFixed(2)}
                              {customTotals[tier.tier_name] && (
                                <small className="text-muted d-block">Target: ${customTotals[tier.tier_name]!.toFixed(2)}</small>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Customer Display Options */}
                <div className="card mt-6">
                  <div className="card-body">
                    <h6 className="card-title mb-4">📋 Customer Display Options</h6>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="showLineItemPricing"
                        checked={showLineItemPricing}
                        onChange={(e) => setShowLineItemPricing(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="showLineItemPricing">
                        Show individual line item pricing to customer
                      </label>
                    </div>
                    <small className="text-muted">
                      When enabled, customers will see pricing for each work item. When disabled, only tier totals are shown.
                    </small>
                  </div>
                </div>

                {/* Notes */}
                <div className="card mt-4">
                  <div className="card-body">
                    <label className="form-label">Estimate Notes</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="Add any additional notes or terms..."
                      value={estimateNotes}
                      onChange={(e) => setEstimateNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Estimate Created Successfully */}
            {currentStep === 3 && (
              <div className="text-center py-10">
                <KTIcon iconName="check-circle" className="fs-3x text-success mb-6" />
                <h3 className="text-success mb-4">Estimate Created Successfully!</h3>
                <p className="text-muted mb-6">
                  Your Good, Better, Best estimate is ready to present to the customer.
                </p>
                <div className="d-flex justify-content-center gap-3">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      // This would open the estimate presentation modal
                      showToast.info('Estimate presentation feature coming next!')
                      onClose()
                    }}
                  >
                    <KTIcon iconName="screen" className="fs-6 me-1" />
                    Present to Customer
                  </button>
                  <button
                    className="btn btn-light"
                    onClick={handleClose}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {currentStep < 3 && (
            <div className="modal-footer">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setCurrentStep(currentStep - 1)}
                >
                  <KTIcon iconName="arrow-left" className="fs-6 me-1" />
                  Back
                </button>
              )}
              
              <button type="button" className="btn btn-light" onClick={handleClose}>
                Cancel
              </button>
              
              {currentStep === 2 && (
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={() => createEstimate('draft')}
                    disabled={loading}
                  >
                    {loading && <span className="spinner-border spinner-border-sm me-2" />}
                    <KTIcon iconName="save" className="fs-6 me-1" />
                    Save as Draft
                  </button>
                  
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => createEstimate('send')}
                    disabled={loading || !Array.isArray(estimateTiers) || estimateTiers.every(t => t.line_items && t.line_items.length === 0)}
                  >
                    {loading && <span className="spinner-border spinner-border-sm me-2" />}
                    <KTIcon iconName="send" className="fs-6 me-1" />
                    {mode === 'revise' ? `Send v${currentEstimateVersion}` : 'Send to Customer'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Manual Estimate Form Modal */}
    {showManualForm && (
      <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1080 }}>
        <div className="modal-dialog modal-fullscreen" style={{ margin: 0 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Create Manual Estimate</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setShowManualForm(false)}
              ></button>
            </div>
            <div className="modal-body">
              {/* Lead Info Banner */}
              {lead && (
                <div className="alert alert-primary d-flex align-items-center mb-4">
                  <KTIcon iconName="user" className="fs-2 me-3" />
                  <div>
                    <h6 className="mb-0">Creating estimate for: <strong>{lead.name}</strong></h6>
                    <p className="mb-0 text-muted small">
                      {lead.service_type} • {lead.contact?.phone || 'No phone'} • {lead.urgency} priority
                    </p>
                  </div>
                </div>
              )}
              <EstimateForm
                leadId={effectiveLeadId}
                estimateContext="journey"
                onSave={async (data) => {
                  try {
                    const result = await estimatesService.createEstimate(data)
                    return result // Return the saved estimate with id
                  } catch (error) {
                    console.error('Error saving estimate:', error)
                    showToast.error('Error saving estimate')
                    throw error
                  }
                }}
                onSuccess={(estimateId) => {
                  setShowManualForm(false)
                  onEstimateCreated(estimateId)
                  handleClose()
                }}
                onCancel={() => setShowManualForm(false)}
              />
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

export default CreateEstimateModal
