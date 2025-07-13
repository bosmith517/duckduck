import React, { useState, useEffect } from 'react'
import { supabase } from '../../../../supabaseClient'

interface TradePrompt {
  id: string
  category: string
  prompt: string
  order: number
  conditions?: string[]
}

interface GuidedPromptsPanelProps {
  tradeType: 'ROOFING' | 'PLUMBING' | 'HVAC' | 'ELECTRICAL'
  currentPrompt: string
  onPromptSelect: (prompt: string) => void
}

export const GuidedPromptsPanel: React.FC<GuidedPromptsPanelProps> = ({
  tradeType,
  currentPrompt,
  onPromptSelect
}) => {
  const [prompts, setPrompts] = useState<TradePrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [completedPrompts, setCompletedPrompts] = useState<Set<string>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<string>('initial')

  useEffect(() => {
    loadTradePrompts()
  }, [tradeType])

  const loadTradePrompts = async () => {
    try {
      setLoading(true)
      
      // Load trade-specific prompts from toolkit configuration
      const { data, error } = await supabase
        .from('trade_toolkits')
        .select('prompts_config')
        .eq('trade_type', tradeType)
        .single()

      if (error) {
        // Fallback to default prompts if no custom toolkit found
        setPrompts(getDefaultPrompts(tradeType))
      } else {
        setPrompts(data.prompts_config || getDefaultPrompts(tradeType))
      }
    } catch (error) {
      console.error('Error loading trade prompts:', error)
      setPrompts(getDefaultPrompts(tradeType))
    } finally {
      setLoading(false)
    }
  }

  const getDefaultPrompts = (trade: string): TradePrompt[] => {
    const promptSets: Record<string, TradePrompt[]> = {
      ROOFING: [
        {
          id: 'roof-1',
          category: 'initial',
          prompt: 'Can you step outside and show me your roof? Start with a wide view of the entire house.',
          order: 1
        },
        {
          id: 'roof-2',
          category: 'inspection',
          prompt: 'Now walk around the house slowly so I can see all sides of the roof.',
          order: 2
        },
        {
          id: 'roof-3',
          category: 'details',
          prompt: 'Can you get closer to show me the shingles? I need to see the material and condition.',
          order: 3
        },
        {
          id: 'roof-4',
          category: 'features',
          prompt: 'Show me any vents, chimneys, or other roof features you can see.',
          order: 4
        },
        {
          id: 'roof-5',
          category: 'damage',
          prompt: 'Point out any areas where you see damage, missing shingles, or concerns.',
          order: 5
        }
      ],
      PLUMBING: [
        {
          id: 'plumb-1',
          category: 'initial',
          prompt: 'Can you show me where the plumbing issue is located?',
          order: 1
        },
        {
          id: 'plumb-2',
          category: 'water-pressure',
          prompt: 'Turn on the water and show me the flow rate and pressure.',
          order: 2
        },
        {
          id: 'plumb-3',
          category: 'pipes',
          prompt: 'Can you show me any visible pipes? I need to identify the material type.',
          order: 3
        },
        {
          id: 'plumb-4',
          category: 'water-heater',
          prompt: 'Show me your water heater and any labels or model numbers.',
          order: 4
        },
        {
          id: 'plumb-5',
          category: 'fixtures',
          prompt: 'Show me the affected fixtures - sinks, toilets, or faucets.',
          order: 5
        }
      ],
      HVAC: [
        {
          id: 'hvac-1',
          category: 'initial',
          prompt: 'Can you show me your thermostat and its current settings?',
          order: 1
        },
        {
          id: 'hvac-2',
          category: 'outdoor-unit',
          prompt: 'Go outside and show me your AC unit or heat pump.',
          order: 2
        },
        {
          id: 'hvac-3',
          category: 'indoor-unit',
          prompt: 'Show me your indoor unit, furnace, or air handler.',
          order: 3
        },
        {
          id: 'hvac-4',
          category: 'filter',
          prompt: 'Can you show me the air filter? Remove it so I can see the size and condition.',
          order: 4
        },
        {
          id: 'hvac-5',
          category: 'vents',
          prompt: 'Show me a few of your air vents and how the airflow feels.',
          order: 5
        }
      ],
      ELECTRICAL: [
        {
          id: 'elec-1',
          category: 'initial',
          prompt: 'Show me the electrical issue or the area where you need work done.',
          order: 1
        },
        {
          id: 'elec-2',
          category: 'panel',
          prompt: 'Can you show me your electrical panel? I need to see the breakers and any labels.',
          order: 2
        },
        {
          id: 'elec-3',
          category: 'outlets',
          prompt: 'Show me the specific outlets or switches involved.',
          order: 3
        },
        {
          id: 'elec-4',
          category: 'wiring',
          prompt: 'If you can see any wiring, show me the condition and type.',
          order: 4
        },
        {
          id: 'elec-5',
          category: 'testing',
          prompt: 'Test the switch or outlet for me - turn it on and off.',
          order: 5
        }
      ]
    }

    return promptSets[trade] || []
  }

  const categories = Array.from(new Set(prompts.map(p => p.category)))

  const handlePromptClick = (prompt: TradePrompt) => {
    onPromptSelect(prompt.prompt)
    setCompletedPrompts(prev => new Set([...prev, prompt.id]))
  }

  const getPromptIcon = (category: string) => {
    const iconMap: Record<string, string> = {
      'initial': 'ki-play',
      'inspection': 'ki-search-list',
      'details': 'ki-zoom-in',
      'features': 'ki-element-11',
      'damage': 'ki-warning',
      'water-pressure': 'ki-water',
      'pipes': 'ki-filter',
      'water-heater': 'ki-flame',
      'fixtures': 'ki-home',
      'outdoor-unit': 'ki-home-2',
      'indoor-unit': 'ki-home-1',
      'filter': 'ki-category',
      'vents': 'ki-wind',
      'panel': 'ki-electricity',
      'outlets': 'ki-socket',
      'wiring': 'ki-cable',
      'testing': 'ki-flash'
    }
    return iconMap[category] || 'ki-message-text-2'
  }

  if (loading) {
    return (
      <div className='p-4'>
        <h5 className='mb-4'>Guided Prompts</h5>
        <div className='text-center py-5'>
          <div className='spinner-border text-primary' role='status'>
            <span className='visually-hidden'>Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='p-4 border-bottom'>
      <h5 className='mb-4'>Guided Prompts</h5>
      
      {/* Trade Type Header */}
      <div className='d-flex align-items-center mb-4 p-3 bg-light-primary rounded'>
        <i className='ki-duotone ki-wrench fs-2 me-2 text-primary'>
          <span className='path1'></span>
          <span className='path2'></span>
        </i>
        <div>
          <div className='fw-bold text-primary'>{tradeType}</div>
          <div className='text-muted small'>Video Estimating Toolkit</div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className='nav nav-tabs nav-line-tabs mb-4'>
        {categories.map((category) => (
          <a
            key={category}
            className={`nav-link ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category)}
            style={{ cursor: 'pointer' }}
          >
            <i className={`ki-duotone ${getPromptIcon(category)} fs-2 me-1`}>
              <span className='path1'></span>
              <span className='path2'></span>
            </i>
            {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
          </a>
        ))}
      </div>

      {/* Current Prompt Display */}
      {currentPrompt && (
        <div className='alert alert-primary mb-4'>
          <div className='d-flex align-items-center'>
            <i className='ki-duotone ki-message-text-2 fs-2 me-2'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
            <div>
              <div className='fw-bold mb-1'>Current Prompt:</div>
              <div>{currentPrompt}</div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt List */}
      <div className='prompt-list'>
        {prompts
          .filter(p => p.category === selectedCategory)
          .sort((a, b) => a.order - b.order)
          .map((prompt) => {
            const isCompleted = completedPrompts.has(prompt.id)
            const isCurrent = currentPrompt === prompt.prompt

            return (
              <div
                key={prompt.id}
                className={`prompt-item p-3 mb-2 rounded border cursor-pointer transition-all ${
                  isCurrent ? 'border-primary bg-light-primary' :
                  isCompleted ? 'border-success bg-light-success' :
                  'border-gray-300 bg-white hover:bg-gray-50'
                }`}
                onClick={() => handlePromptClick(prompt)}
              >
                <div className='d-flex align-items-start'>
                  <div className='me-3'>
                    {isCompleted ? (
                      <i className='ki-duotone ki-check-circle fs-2 text-success'>
                        <span className='path1'></span>
                        <span className='path2'></span>
                      </i>
                    ) : isCurrent ? (
                      <i className='ki-duotone ki-arrow-right fs-2 text-primary'>
                        <span className='path1'></span>
                        <span className='path2'></span>
                      </i>
                    ) : (
                      <div
                        className='bg-gray-300 rounded-circle d-flex align-items-center justify-content-center'
                        style={{ width: '24px', height: '24px' }}
                      >
                        <span className='text-white fw-bold fs-7'>{prompt.order}</span>
                      </div>
                    )}
                  </div>
                  <div className='flex-grow-1'>
                    <div className={`fw-semibold ${isCurrent ? 'text-primary' : isCompleted ? 'text-success' : 'text-dark'}`}>
                      Step {prompt.order}
                    </div>
                    <div className='text-muted mt-1'>{prompt.prompt}</div>
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {/* Progress Indicator */}
      <div className='mt-4'>
        <div className='d-flex justify-content-between align-items-center mb-2'>
          <span className='text-muted small'>Progress</span>
          <span className='text-muted small'>
            {completedPrompts.size} of {prompts.filter(p => p.category === selectedCategory).length}
          </span>
        </div>
        <div className='progress' style={{ height: '4px' }}>
          <div
            className='progress-bar bg-success'
            style={{
              width: `${(completedPrompts.size / prompts.filter(p => p.category === selectedCategory).length) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  )
}