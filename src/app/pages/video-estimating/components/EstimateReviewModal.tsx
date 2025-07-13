import React, { useState, useEffect } from 'react'
import { VideoSession } from '../VideoEstimatingHub'
import { supabase } from '../../../../supabaseClient'
import { showToast } from '../../../utils/toast'

interface EstimateLineItem {
  id: string
  description: string
  sku?: string
  quantity: number
  unit_price: number
  total: number
  notes?: string
  ai_confidence?: number
}

interface GeneratedEstimate {
  id: string
  session_id: string
  line_items: EstimateLineItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  notes: string
  created_at: string
}

interface EstimateReviewModalProps {
  session: VideoSession
  onClose: () => void
  onSave: () => void
}

export const EstimateReviewModal: React.FC<EstimateReviewModalProps> = ({
  session,
  onClose,
  onSave
}) => {
  const [estimate, setEstimate] = useState<GeneratedEstimate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)

  useEffect(() => {
    loadGeneratedEstimate()
  }, [session.id])

  const loadGeneratedEstimate = async () => {
    try {
      setLoading(true)
      
      // Load the AI-generated estimate
      const { data, error } = await supabase
        .from('generated_estimates')
        .select('*')
        .eq('session_id', session.id)
        .single()

      if (error) {
        // If no estimate exists, generate one
        await generateEstimate()
        return
      }

      setEstimate(data)
    } catch (error) {
      console.error('Error loading estimate:', error)
      showToast.error('Failed to load estimate')
    } finally {
      setLoading(false)
    }
  }

  const generateEstimate = async () => {
    try {
      showToast.loading('Generating estimate from vision analysis...')
      
      const { data, error } = await supabase
        .functions.invoke('generate-video-estimate', {
          body: {
            session_id: session.id,
            vision_results: session.vision_results,
            trade_type: session.trade_type
          }
        })

      if (error) throw error
      
      setEstimate(data)
      showToast.success('Estimate generated successfully!')
    } catch (error) {
      console.error('Error generating estimate:', error)
      showToast.error('Failed to generate estimate')
    }
  }

  const updateLineItem = (itemId: string, updates: Partial<EstimateLineItem>) => {
    if (!estimate) return

    const updatedItems = estimate.line_items.map(item => 
      item.id === itemId 
        ? { ...item, ...updates, total: (updates.quantity || item.quantity) * (updates.unit_price || item.unit_price) }
        : item
    )

    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0)
    const taxAmount = subtotal * estimate.tax_rate
    const totalAmount = subtotal + taxAmount

    setEstimate({
      ...estimate,
      line_items: updatedItems,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount
    })
  }

  const removeLineItem = (itemId: string) => {
    if (!estimate) return

    const updatedItems = estimate.line_items.filter(item => item.id !== itemId)
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0)
    const taxAmount = subtotal * estimate.tax_rate
    const totalAmount = subtotal + taxAmount

    setEstimate({
      ...estimate,
      line_items: updatedItems,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount
    })
  }

  const addLineItem = () => {
    if (!estimate) return

    const newItem: EstimateLineItem = {
      id: `manual_${Date.now()}`,
      description: 'New Item',
      quantity: 1,
      unit_price: 0,
      total: 0
    }

    setEstimate({
      ...estimate,
      line_items: [...estimate.line_items, newItem]
    })
    
    setEditingItem(newItem.id)
  }

  const saveEstimate = async () => {
    if (!estimate) return

    try {
      setSaving(true)

      // Create formal estimate record
      const { data: estimateData, error: estimateError } = await supabase
        .from('estimates')
        .insert([{
          tenant_id: session.tenant_id,
          lead_id: session.lead_id,
          contact_id: session.contact_id,
          account_id: session.account_id,
          estimate_number: `EST-${Date.now()}`,
          subtotal: estimate.subtotal,
          tax_rate: estimate.tax_rate,
          tax_amount: estimate.tax_amount,
          total_amount: estimate.total_amount,
          status: 'draft',
          notes: estimate.notes,
          source: 'video_estimating'
        }])
        .select()
        .single()

      if (estimateError) throw estimateError

      // Create estimate line items
      const lineItemsToInsert = estimate.line_items.map(item => ({
        estimate_id: estimateData.id,
        description: item.description,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        notes: item.notes
      }))

      const { error: itemsError } = await supabase
        .from('estimate_line_items')
        .insert(lineItemsToInsert)

      if (itemsError) throw itemsError

      // Update video session with estimate reference
      await supabase
        .from('video_sessions')
        .update({ estimate_id: estimateData.id })
        .eq('id', session.id)

      showToast.success('Estimate saved successfully!')
      onSave()
    } catch (error) {
      console.error('Error saving estimate:', error)
      showToast.error('Failed to save estimate')
    } finally {
      setSaving(false)
    }
  }

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'secondary'
    if (confidence >= 0.8) return 'success'
    if (confidence >= 0.6) return 'warning'
    return 'danger'
  }

  if (loading) {
    return (
      <div className='modal fade show d-block' tabIndex={-1}>
        <div className='modal-dialog modal-dialog-centered modal-xl'>
          <div className='modal-content'>
            <div className='modal-body text-center py-10'>
              <div className='spinner-border text-primary mb-3' role='status'>
                <span className='visually-hidden'>Loading...</span>
              </div>
              <div>Loading estimate...</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!estimate) {
    return (
      <div className='modal fade show d-block' tabIndex={-1}>
        <div className='modal-dialog modal-dialog-centered'>
          <div className='modal-content'>
            <div className='modal-body text-center py-10'>
              <div className='text-muted mb-3'>No estimate available</div>
              <button className='btn btn-secondary' onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='modal fade show d-block' tabIndex={-1}>
      <div className='modal-dialog modal-dialog-centered modal-xl'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>Review AI-Generated Estimate</h5>
            <button
              type='button'
              className='btn-close'
              onClick={onClose}
            />
          </div>

          <div className='modal-body'>
            {/* Session Info */}
            <div className='row mb-5'>
              <div className='col-md-6'>
                <div className='d-flex align-items-center mb-2'>
                  <i className='ki-duotone ki-calendar fs-2 me-2 text-primary'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  <div>
                    <div className='fw-bold'>Session Date</div>
                    <div className='text-muted'>{new Date(session.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
              <div className='col-md-6'>
                <div className='d-flex align-items-center mb-2'>
                  <i className='ki-duotone ki-wrench fs-2 me-2 text-primary'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  <div>
                    <div className='fw-bold'>Trade Type</div>
                    <div className='text-muted'>{session.trade_type}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className='table-responsive mb-5'>
              <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                <thead>
                  <tr className='fw-bold text-muted'>
                    <th>Description</th>
                    <th>SKU</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th>AI Confidence</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.line_items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {editingItem === item.id ? (
                          <input
                            type='text'
                            className='form-control form-control-sm'
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                            onBlur={() => setEditingItem(null)}
                            autoFocus
                          />
                        ) : (
                          <div
                            className='cursor-pointer'
                            onClick={() => setEditingItem(item.id)}
                          >
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type='text'
                          className='form-control form-control-sm'
                          value={item.sku || ''}
                          onChange={(e) => updateLineItem(item.id, { sku: e.target.value })}
                          placeholder='SKU'
                        />
                      </td>
                      <td>
                        <input
                          type='number'
                          className='form-control form-control-sm'
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, { quantity: Number(e.target.value) })}
                          min='0'
                          step='0.01'
                        />
                      </td>
                      <td>
                        <input
                          type='number'
                          className='form-control form-control-sm'
                          value={item.unit_price}
                          onChange={(e) => updateLineItem(item.id, { unit_price: Number(e.target.value) })}
                          min='0'
                          step='0.01'
                        />
                      </td>
                      <td>
                        <div className='fw-bold'>${item.total.toFixed(2)}</div>
                      </td>
                      <td>
                        {item.ai_confidence && (
                          <span className={`badge badge-light-${getConfidenceColor(item.ai_confidence)}`}>
                            {Math.round(item.ai_confidence * 100)}%
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className='btn btn-sm btn-light-danger'
                          onClick={() => removeLineItem(item.id)}
                        >
                          <i className='ki-duotone ki-trash fs-3'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                            <span className='path3'></span>
                            <span className='path4'></span>
                            <span className='path5'></span>
                          </i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <button
                className='btn btn-light-primary btn-sm'
                onClick={addLineItem}
              >
                <i className='ki-duotone ki-plus fs-3 me-1'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                </i>
                Add Line Item
              </button>
            </div>

            {/* Totals */}
            <div className='row'>
              <div className='col-md-8'></div>
              <div className='col-md-4'>
                <div className='table-responsive'>
                  <table className='table'>
                    <tr>
                      <td className='border-0 text-end fw-bold'>Subtotal:</td>
                      <td className='border-0 text-end'>${estimate.subtotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className='border-0 text-end fw-bold'>Tax ({Math.round(estimate.tax_rate * 100)}%):</td>
                      <td className='border-0 text-end'>${estimate.tax_amount.toFixed(2)}</td>
                    </tr>
                    <tr className='border-top'>
                      <td className='text-end fw-bold fs-3'>Total:</td>
                      <td className='text-end fw-bold fs-3 text-primary'>${estimate.total_amount.toFixed(2)}</td>
                    </tr>
                  </table>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className='mb-5'>
              <label className='form-label fw-bold'>Notes</label>
              <textarea
                className='form-control'
                rows={3}
                value={estimate.notes}
                onChange={(e) => setEstimate({ ...estimate, notes: e.target.value })}
                placeholder='Additional notes for this estimate...'
              />
            </div>
          </div>

          <div className='modal-footer'>
            <button
              type='button'
              className='btn btn-light'
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type='button'
              className='btn btn-primary'
              onClick={saveEstimate}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                  Saving...
                </>
              ) : (
                <>
                  <i className='ki-duotone ki-check fs-2 me-1'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  Save Estimate
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}