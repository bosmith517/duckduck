import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import ShowcaseGallery from '../../components/public-portal/ShowcaseGallery'
import ShowcaseFilters from '../../components/public-portal/ShowcaseFilters'
import ShowcaseCard from '../../components/public-portal/ShowcaseCard'
import QuoteCalculator from '../../components/public-portal/QuoteCalculator'
import ShowcaseDetailModal from '../../components/public-portal/ShowcaseDetailModal'
import ReferralBanner from '../../components/public-portal/ReferralBanner'

interface ShowcaseItem {
  id: string
  title: string
  description: string
  category: string
  subcategory: string
  before_photos: any[]
  after_photos: any[]
  video_url?: string
  testimonial?: string
  customer_name?: string
  customer_title?: string
  budget_range?: string
  duration_days?: number
  completion_date: string
  tags: string[]
  view_count: number
  contractor_name: string
  contractor_logo?: string
}

interface FilterState {
  category: string
  search: string
  tags: string[]
  sortBy: 'recent' | 'popular' | 'duration'
}

const PublicShowcasePage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>()
  const navigate = useNavigate()
  
  const [showcases, setShowcases] = useState<ShowcaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShowcase, setSelectedShowcase] = useState<ShowcaseItem | null>(null)
  const [showQuoteCalculator, setShowQuoteCalculator] = useState(false)
  const [tenantInfo, setTenantInfo] = useState<any>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  
  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    search: '',
    tags: [],
    sortBy: 'recent'
  })

  // Check for referral code in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const ref = urlParams.get('ref')
    if (ref) {
      setReferralCode(ref)
      // Store in session for later use
      sessionStorage.setItem('referral_code', ref)
    }
  }, [])

  // Load tenant info and showcases
  useEffect(() => {
    loadTenantAndShowcases()
  }, [tenantSlug])

  const loadTenantAndShowcases = async () => {
    try {
      setLoading(true)

      // Get tenant info by slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', tenantSlug)
        .single()

      if (tenantError || !tenant) {
        navigate('/404')
        return
      }

      setTenantInfo(tenant)

      // Load published showcases for this tenant
      const { data: showcaseData, error: showcaseError } = await supabase
        .from('v_public_showcase')
        .select('*')
        .eq('tenant_id', tenant.id)

      if (!showcaseError && showcaseData) {
        setShowcases(showcaseData)
      }

    } catch (error) {
      console.error('Error loading showcase:', error)
    } finally {
      setLoading(false)
    }
  }

  // Apply filters and sorting
  const filteredShowcases = showcases
    .filter(showcase => {
      if (filters.category !== 'all' && showcase.category !== filters.category) {
        return false
      }
      if (filters.search && !showcase.title.toLowerCase().includes(filters.search.toLowerCase()) &&
          !showcase.description.toLowerCase().includes(filters.search.toLowerCase())) {
        return false
      }
      if (filters.tags.length > 0 && !filters.tags.some(tag => showcase.tags.includes(tag))) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      switch (filters.sortBy) {
        case 'popular':
          return b.view_count - a.view_count
        case 'duration':
          return (a.duration_days || 0) - (b.duration_days || 0)
        case 'recent':
        default:
          return new Date(b.completion_date).getTime() - new Date(a.completion_date).getTime()
      }
    })

  const handleShowcaseClick = async (showcase: ShowcaseItem) => {
    setSelectedShowcase(showcase)
    
    // Track view
    await supabase.rpc('increment_showcase_view_count', { p_showcase_id: showcase.id })
  }

  const handleInquiry = (showcaseId: string) => {
    // Navigate to inquiry form with showcase context
    navigate(`/showcase/${tenantSlug}/inquiry`, {
      state: { showcaseId, referralCode }
    })
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-vh-100 bg-light">
      {/* Hero Section */}
      <section className="bg-dark text-white py-10 position-relative overflow-hidden">
        <div className="container position-relative z-index-1">
          <div className="row align-items-center">
            <div className="col-lg-8">
              <div>
                <h1 className="display-4 fw-bold mb-4">
                  {tenantInfo?.company_name} Project Showcase
                </h1>
                <p className="lead mb-6">
                  Explore our portfolio of completed projects. See real transformations, 
                  read customer testimonials, and get inspired for your next project.
                </p>
                <div className="d-flex gap-3">
                  <button 
                    className="btn btn-primary btn-lg"
                    onClick={() => setShowQuoteCalculator(true)}
                  >
                    Get Instant Quote
                  </button>
                  <button 
                    className="btn btn-outline-light btn-lg"
                    onClick={() => document.getElementById('showcases')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    View Projects
                  </button>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              {tenantInfo?.logo_url && (
                <img
                  src={tenantInfo.logo_url}
                  alt={tenantInfo.company_name}
                  className="img-fluid"
                />
              )}
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="position-absolute top-0 end-0 w-50 h-100 opacity-10">
          <div className="bg-primary h-100" style={{ clipPath: 'polygon(25% 0%, 100% 0%, 100% 100%, 0% 100%)' }}></div>
        </div>
      </section>

      {/* Referral Banner */}
      {referralCode && <ReferralBanner referralCode={referralCode} />}

      {/* Stats Section */}
      <section className="py-6 bg-white border-bottom">
        <div className="container">
          <div className="row text-center">
            <div className="col-md-3">
              <h2 className="fw-bold text-primary">{showcases.length}</h2>
              <p className="text-muted mb-0">Completed Projects</p>
            </div>
            <div className="col-md-3">
              <h2 className="fw-bold text-success">98%</h2>
              <p className="text-muted mb-0">Customer Satisfaction</p>
            </div>
            <div className="col-md-3">
              <h2 className="fw-bold text-info">15+</h2>
              <p className="text-muted mb-0">Years Experience</p>
            </div>
            <div className="col-md-3">
              <h2 className="fw-bold text-warning">24/7</h2>
              <p className="text-muted mb-0">Emergency Service</p>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Grid */}
      <section id="showcases" className="py-8">
        <div className="container">
          <div className="row mb-6">
            <div className="col-lg-12">
              <h2 className="mb-4">Our Work</h2>
              <ShowcaseFilters 
                filters={filters}
                onFilterChange={setFilters}
                categories={[...new Set(showcases.map(s => s.category))]}
                tags={[...new Set(showcases.flatMap(s => s.tags))]}
              />
            </div>
          </div>

          {filteredShowcases.length > 0 ? (
            <ShowcaseGallery showcases={filteredShowcases}>
              {filteredShowcases.map((showcase) => (
                <ShowcaseCard
                  key={showcase.id}
                  project={showcase}
                  onClick={() => handleShowcaseClick(showcase)}
                />
              ))}
            </ShowcaseGallery>
          ) : (
            <div className="text-center py-10">
              <i className="ki-duotone ki-search-list fs-5x text-muted mb-4">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              <h3 className="text-muted">No projects match your criteria</h3>
              <p className="text-muted">Try adjusting your filters or search terms</p>
            </div>
          )}
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-10 bg-primary text-white">
        <div className="container text-center">
          <h2 className="mb-4">Ready to Start Your Project?</h2>
          <p className="lead mb-6">
            Get a free consultation and quote for your next home improvement project
          </p>
          <button 
            className="btn btn-light btn-lg"
            onClick={() => setShowQuoteCalculator(true)}
          >
            Get Your Free Quote
          </button>
        </div>
      </section>

      {/* Showcase Detail Modal */}
      {selectedShowcase && (
        <ShowcaseDetailModal
          showcase={selectedShowcase}
          isOpen={!!selectedShowcase}
          onClose={() => setSelectedShowcase(null)}
          onInquiry={() => handleInquiry(selectedShowcase.id)}
        />
      )}

      {/* Quote Calculator Modal */}
      {showQuoteCalculator && (
        <QuoteCalculator
          isOpen={showQuoteCalculator}
          onClose={() => setShowQuoteCalculator(false)}
          tenantId={tenantInfo?.id}
          referralCode={referralCode}
        />
      )}
    </div>
  )
}

export default PublicShowcasePage