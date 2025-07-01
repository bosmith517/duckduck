import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { showToast } from '../../utils/toast'
import { KTIcon } from '../../../_metronic/helpers'
import { marked } from 'marked'
import { jobActivityService } from '../../services/jobActivityService'

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
  jobId: string
  isOpen: boolean
  onClose: () => void
  onEstimateCreated: (estimateId: string) => void
}

export const CreateEstimateModal: React.FC<CreateEstimateModalProps> = ({
  jobId,
  isOpen,
  onClose,
  onEstimateCreated
}) => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [jobDetails, setJobDetails] = useState<any>(null)
  const [estimateNotes, setEstimateNotes] = useState('')
  const [currentStep, setCurrentStep] = useState(1)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiNarrative, setAiNarrative] = useState<string | null>(null)
  const [aiStage, setAiStage] = useState<AIStage>('idle')
  const [selectedTier, setSelectedTier] = useState<'Good' | 'Better' | 'Best'>('Better')
  const [customTotals, setCustomTotals] = useState<{Good?: number, Better?: number, Best?: number}>({})
  const [manuallySetTiers, setManuallySetTiers] = useState<{Good?: boolean, Better?: boolean, Best?: boolean}>({})
  const [showLineItemPricing, setShowLineItemPricing] = useState(false)
  
  // New pipeline state
  const [availablePhotos, setAvailablePhotos] = useState<JobPhoto[]>([])
  const [showPhotoSelector, setShowPhotoSelector] = useState(false)
  const [damageBullets, setDamageBullets] = useState<string[]>([])
  const [hazardParagraph, setHazardParagraph] = useState<string>('')
  const [basicRepairs, setBasicRepairs] = useState<BasicRepair[]>([])
  const [betterRepairs, setBetterRepairs] = useState<BasicRepair[]>([])
  const [bestRepairs, setBestRepairs] = useState<BasicRepair[]>([])
  const [pipelineError, setPipelineError] = useState<string | null>(null)

  
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
    if (isOpen && jobId) {
      loadJobDetails()
      loadAvailablePhotos()
      // Clear any existing stage notifications when modal opens
      cleanupStageNotifications()
    } else if (!isOpen) {
      // Clean up notifications when modal closes
      cleanupStageNotifications()
    }
  }, [isOpen, jobId])

  const loadJobDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          accounts (name, address_line1, city, state, zip_code),
          contacts (first_name, last_name, phone, email)
        `)
        .eq('id', jobId)
        .single()

      if (error) throw error
      setJobDetails(data)
    } catch (error) {
      console.error('Error loading job details:', error)
      showToast.error('Failed to load job details')
    }
  }

  const loadAvailablePhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('job_photos')
        .select('id, file_url, description, photo_type')
        .eq('job_id', jobId)
        .order('taken_at', { ascending: false })

      if (error) throw error
      
      const photos: JobPhoto[] = (data || []).map(photo => ({
        ...photo,
        selected: false,
        userNote: ''
      }))
      
      setAvailablePhotos(photos)
    } catch (error) {
      console.error('Error loading photos:', error)
      showToast.error('Failed to load photos')
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

  // Helper function to extract service type from job data
  const getServiceType = () => {
    if (!jobDetails) return 'general'
    
    // Extract service type from job title or description
    const jobText = `${jobDetails.title || ''} ${jobDetails.description || ''}`.toLowerCase()
    
    if (jobText.includes('electrical') || jobText.includes('electric') || jobText.includes('wiring')) return 'electrical'
    if (jobText.includes('hvac') || jobText.includes('heating') || jobText.includes('cooling') || jobText.includes('air conditioning')) return 'hvac'
    if (jobText.includes('plumbing') || jobText.includes('pipe') || jobText.includes('water') || jobText.includes('sewer')) return 'plumbing'
    if (jobText.includes('roof') || jobText.includes('shingle') || jobText.includes('gutter')) return 'roofing'
    if (jobText.includes('flooring') || jobText.includes('carpet') || jobText.includes('tile')) return 'flooring'
    if (jobText.includes('painting') || jobText.includes('paint')) return 'painting'
    if (jobText.includes('concrete') || jobText.includes('driveway') || jobText.includes('foundation')) return 'concrete'
    
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
          jobDetails: {
            title: jobDetails?.title || '',
            description: jobDetails?.description || '',
            location: `${jobDetails?.location_city || ''}, ${jobDetails?.location_state || ''}`,
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
            propertyAge: 25, // Could be extracted from job details
            location: `${jobDetails?.location_city || ''}, ${jobDetails?.location_state || ''}`,
            jobTitle: jobDetails?.title || '',
            jobDescription: jobDetails?.description || ''
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
            location: `${jobDetails?.location_city || ''}, ${jobDetails?.location_state || ''}`,
            complexity: 'standard',
            jobTitle: jobDetails?.title || '',
            jobDescription: jobDetails?.description || '',
            customerName: jobDetails?.accounts?.name || '',
            propertyAddress: jobDetails?.location_address || ''
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
    if (!jobDetails) return

    setAiGenerating(true)
    showToast.loading('AI is analyzing photos and job details...')

    try {
      // First, get photos for this job
      const { data: photos, error: photosError } = await supabase
        .from('job_photos')
        .select('file_url, description, photo_type')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (photosError) throw photosError

      console.log('🔍 Found photos for analysis:', photos?.length || 0)
      console.log('📷 Photo URLs:', photos?.map(p => p.file_url))
      console.log('📋 Job details for AI:', {
        title: jobDetails.title,
        description: jobDetails.description,
        serviceType: templateName
      })
      
      // Use Supabase Edge Function for comprehensive AI analysis with photos
      const { data, error } = await supabase.functions.invoke('generate-estimate', {
        body: {
          jobId,
          analysisType: 'comprehensive_pricing',
          jobDetails: {
            title: jobDetails.title,
            description: jobDetails.description,
            serviceType: templateName,
            location: `${jobDetails.location_city}, ${jobDetails.location_state}`,
            estimatedCost: jobDetails.estimated_cost,
            notes: jobDetails.notes
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

  const createEstimate = async () => {
    if (!jobDetails) {
      showToast.error('Job details not loaded')
      return
    }

    setLoading(true)
    try {
      // Get the selected tier's total (custom or calculated)
      const selectedTierData = estimateTiers.find(t => t.tier_name === selectedTier)
      const selectedTierTotal = customTotals[selectedTier] || selectedTierData?.total_amount || 0

      // Create main estimate record
      const { data: estimate, error: estimateError } = await supabase
        .from('estimates')
        .insert({
          account_id: jobDetails.account_id,
          tenant_id: userProfile?.tenant_id,
          estimate_number: `EST-${Date.now().toString().slice(-6)}`,
          project_title: `Estimate for ${jobDetails.title}`,
          description: estimateNotes,
          total_amount: selectedTierTotal,
          selected_tier: selectedTier.toLowerCase(),
          status: 'draft',
          // show_line_item_pricing: showLineItemPricing, // TODO: Add this column to database first
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

      // Log the estimate creation activity
      if (userProfile?.tenant_id && userProfile?.id) {
        await jobActivityService.logEstimateCreated(
          jobId,
          userProfile.tenant_id,
          userProfile.id,
          estimate.id,
          selectedTierTotal
        )
      }

      showToast.success('Estimate created successfully!')
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
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <div className="modal-dialog modal-fullscreen">
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title">
              <KTIcon iconName="document" className="fs-2 text-primary me-3" />
              Create Estimate - {jobDetails?.title}
            </h3>
            <button type="button" className="btn-close" onClick={handleClose}></button>
          </div>

          <div className="modal-body">
            {/* Progress Indicator */}
            <div className="d-flex justify-content-center mb-6">
              <div className="d-flex align-items-center">
                <div className={`rounded-circle d-flex align-items-center justify-content-center me-3 ${currentStep >= 1 ? 'bg-primary text-white' : 'bg-light text-muted'}`} style={{ width: '40px', height: '40px' }}>
                  {currentStep > 1 ? <KTIcon iconName="check" className="fs-6" /> : '1'}
                </div>
                <span className={`me-3 ${currentStep >= 1 ? 'text-primary' : 'text-muted'}`}>Choose Template</span>
                
                <div className={`border-top ${currentStep >= 2 ? 'border-primary' : 'border-muted'}`} style={{ width: '60px', height: '2px' }}></div>
                
                <div className={`rounded-circle d-flex align-items-center justify-content-center mx-3 ${currentStep >= 2 ? 'bg-primary text-white' : 'bg-light text-muted'}`} style={{ width: '40px', height: '40px' }}>
                  {currentStep > 2 ? <KTIcon iconName="check" className="fs-6" /> : '2'}
                </div>
                <span className={`me-3 ${currentStep >= 2 ? 'text-primary' : 'text-muted'}`}>Build Estimate</span>
                
                <div className={`border-top ${currentStep >= 3 ? 'border-primary' : 'border-muted'}`} style={{ width: '60px', height: '2px' }}></div>
                
                <div className={`rounded-circle d-flex align-items-center justify-content-center mx-3 ${currentStep >= 3 ? 'bg-primary text-white' : 'bg-light text-muted'}`} style={{ width: '40px', height: '40px' }}>
                  3
                </div>
                <span className={`${currentStep >= 3 ? 'text-primary' : 'text-muted'}`}>Present to Customer</span>
              </div>
            </div>

            {/* Step 1: 3-Stage AI Pipeline */}
            {currentStep === 1 && (
              <div>
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
                          onClick={() => setShowPhotoSelector(true)}
                          disabled={aiGenerating || availablePhotos.length === 0}
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

                {/* Photo Selector Modal */}
                {showPhotoSelector && (
                  <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1070 }}>
                    <div className="modal-dialog modal-lg">
                      <div className="modal-content">
                        <div className="modal-header">
                          <h5 className="modal-title">📸 Select Photos for Analysis</h5>
                          <button 
                            type="button" 
                            className="btn-close" 
                            onClick={() => setShowPhotoSelector(false)}
                          ></button>
                        </div>
                        <div className="modal-body">
                          {availablePhotos.length === 0 ? (
                            <div className="text-center py-4">
                              <KTIcon iconName="picture" className="fs-2x text-muted mb-3" />
                              <p className="text-muted">No photos available for this job</p>
                            </div>
                          ) : (
                            <div className="row g-3">
                              {availablePhotos.map(photo => (
                                <div key={photo.id} className="col-md-6">
                                  <div className={`card cursor-pointer ${photo.selected ? 'border-primary bg-light-primary' : ''}`} 
                                       onClick={() => togglePhotoSelection(photo.id)}>
                                    <div className="position-relative">
                                      <img 
                                        src={photo.file_url} 
                                        alt={photo.description}
                                        className="card-img-top"
                                        style={{ height: '150px', objectFit: 'cover' }}
                                      />
                                      {photo.selected && (
                                        <div className="position-absolute top-0 end-0 m-2">
                                          <div className="badge badge-primary">
                                            <KTIcon iconName="check" className="fs-8" />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="card-body p-3">
                                      <small className="text-muted d-block mb-2">{photo.photo_type}</small>
                                      <small>{photo.description || 'No description'}</small>
                                      {photo.selected && (
                                        <textarea
                                          className="form-control form-control-sm mt-2"
                                          placeholder="Add analysis notes..."
                                          value={photo.userNote}
                                          onChange={(e) => {
                                            e.stopPropagation()
                                            updatePhotoNote(photo.id, e.target.value)
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="modal-footer">
                          <div className="d-flex justify-content-between w-100">
                            <span className="text-muted">
                              {availablePhotos.filter(p => p.selected).length} photos selected
                            </span>
                            <div>
                              <button 
                                type="button" 
                                className="btn btn-light me-2" 
                                onClick={() => setShowPhotoSelector(false)}
                              >
                                Cancel
                              </button>
                              <button 
                                type="button" 
                                className="btn btn-primary"
                                onClick={() => {
                                  setShowPhotoSelector(false)
                                  runStage1AnalyzeDamage()
                                }}
                                disabled={availablePhotos.filter(p => p.selected).length === 0}
                              >
                                Analyze Selected Photos
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Build Good, Better, Best */}
            {currentStep === 2 && (
              <div>
                {/* Job Info Header */}
                {jobDetails && (
                  <div className="card mb-6">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-6">
                          <h5>{jobDetails.accounts?.name}</h5>
                          <p className="text-muted mb-0">
                            {jobDetails.accounts?.address_line1}<br/>
                            {jobDetails.accounts?.city}, {jobDetails.accounts?.state} {jobDetails.accounts?.zip_code}
                          </p>
                        </div>
                        <div className="col-md-6 text-end">
                          <p className="mb-0">
                            <strong>Contact:</strong> {jobDetails.contacts?.first_name} {jobDetails.contacts?.last_name}<br/>
                            <strong>Phone:</strong> {jobDetails.contacts?.phone}<br/>
                            <strong>Email:</strong> {jobDetails.contacts?.email}
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
        __html: typeof marked === 'function' 
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
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={createEstimate}
                  disabled={loading || !Array.isArray(estimateTiers) || estimateTiers.every(t => t.line_items && t.line_items.length === 0)}
                >
                  {loading && <span className="spinner-border spinner-border-sm me-2" />}
                  <KTIcon iconName="check" className="fs-6 me-1" />
                  Create Estimate
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreateEstimateModal
