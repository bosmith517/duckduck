import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface JobContractPriceEditorProps {
  job: {
    id: string
    title: string
    contract_price: number
    estimated_cost: number
    actual_cost: number
  }
  onUpdate: () => void
}

export const JobContractPriceEditor: React.FC<JobContractPriceEditorProps> = ({ job, onUpdate }) => {
  const [editing, setEditing] = useState(false)
  const [contractPrice, setContractPrice] = useState(job.contract_price)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (contractPrice <= 0) {
      showToast.error('Contract price must be greater than 0')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ contract_price: contractPrice })
        .eq('id', job.id)

      if (error) throw error

      showToast.success('Contract price updated successfully')
      setEditing(false)
      onUpdate()
    } catch (error) {
      console.error('Error updating contract price:', error)
      showToast.error('Failed to update contract price')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setContractPrice(job.contract_price)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="d-flex align-items-center gap-2">
        <span className="text-muted">$</span>
        <input
          type="number"
          className="form-control form-control-sm"
          style={{ width: '120px' }}
          value={contractPrice}
          onChange={(e) => setContractPrice(parseFloat(e.target.value) || 0)}
          min="0"
          step="0.01"
          autoFocus
        />
        <button
          className="btn btn-sm btn-success"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? '...' : '✓'}
        </button>
        <button
          className="btn btn-sm btn-secondary"
          onClick={handleCancel}
          disabled={loading}
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="d-flex align-items-center gap-2">
      <span className="fw-bold">
        ${job.contract_price.toFixed(2)}
      </span>
      <button
        className="btn btn-sm btn-icon btn-light-primary"
        onClick={() => setEditing(true)}
        title="Edit contract price"
      >
        <i className="ki-duotone ki-pencil fs-6">
          <span className="path1"></span>
          <span className="path2"></span>
        </i>
      </button>
      {job.contract_price === 0 && (
        <span className="badge badge-light-warning">
          No contract price set
        </span>
      )}
    </div>
  )
}

export default JobContractPriceEditor