import React, { useState, useRef } from 'react'
import clsx from 'clsx'
import { parseCSVToLineItems, parseTSVToLineItems, downloadSampleCSV, ParseResult, ParsedLineItem } from '../../utils/lineItemParser'
import { LineItem } from '../../services/estimatesService'

interface LineItemUploaderProps {
  onLineItemsImported: (lineItems: LineItem[]) => void
  onCancel: () => void
}

export const LineItemUploader: React.FC<LineItemUploaderProps> = ({ onLineItemsImported, onCancel }) => {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList) => {
    if (files.length === 0) return

    const file = files[0]
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.tsv') && !file.name.toLowerCase().endsWith('.txt')) {
      alert('Please upload a CSV, TSV, or TXT file')
      return
    }

    setUploading(true)
    
    try {
      const content = await readFileContent(file)
      let result: ParseResult

      if (file.name.toLowerCase().endsWith('.tsv')) {
        result = parseTSVToLineItems(content)
      } else {
        result = parseCSVToLineItems(content)
      }

      setParseResult(result)
      
      // Pre-select all valid items
      const validIndexes = new Set<number>()
      result.lineItems.forEach((item, index) => {
        if (!item.errors || item.errors.length === 0) {
          validIndexes.add(index)
        }
      })
      setSelectedItems(validIndexes)

    } catch (error) {
      alert(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
    }
  }

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedItems(newSelected)
  }

  const selectAllValid = () => {
    if (!parseResult) return
    
    const validIndexes = new Set<number>()
    parseResult.lineItems.forEach((item, index) => {
      if (!item.errors || item.errors.length === 0) {
        validIndexes.add(index)
      }
    })
    setSelectedItems(validIndexes)
  }

  const deselectAll = () => {
    setSelectedItems(new Set())
  }

  const importSelectedItems = () => {
    if (!parseResult) return

    const selectedLineItems: LineItem[] = []
    parseResult.lineItems.forEach((item, index) => {
      if (selectedItems.has(index) && (!item.errors || item.errors.length === 0)) {
        selectedLineItems.push({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          item_type: item.item_type,
          sort_order: selectedLineItems.length
        })
      }
    })

    onLineItemsImported(selectedLineItems)
  }

  const resetUploader = () => {
    setParseResult(null)
    setSelectedItems(new Set())
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (parseResult) {
    return (
      <div className='modal fade show d-block' tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className='modal-dialog modal-xl'>
          <div className='modal-content'>
            <div className='modal-header'>
              <h3 className='modal-title'>Review Imported Line Items</h3>
              <button
                type='button'
                className='btn-close'
                onClick={onCancel}
              ></button>
            </div>
            
            <div className='modal-body'>
              {/* Summary */}
              <div className='alert alert-info d-flex align-items-center mb-5'>
                <i className='ki-duotone ki-information fs-2x text-info me-3'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                  <span className='path3'></span>
                </i>
                <div>
                  <div className='fw-bold'>Import Summary</div>
                  <div>Found {parseResult.totalItems} items, {parseResult.validItems} valid, {parseResult.totalItems - parseResult.validItems} with errors</div>
                </div>
              </div>

              {/* Global Errors */}
              {parseResult.errors.length > 0 && (
                <div className='alert alert-danger mb-5'>
                  <h6>File Errors:</h6>
                  <ul className='mb-0'>
                    {parseResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Selection Controls */}
              {parseResult.validItems > 0 && (
                <div className='d-flex justify-content-between align-items-center mb-5'>
                  <div>
                    <button className='btn btn-sm btn-light-primary me-2' onClick={selectAllValid}>
                      Select All Valid ({parseResult.validItems})
                    </button>
                    <button className='btn btn-sm btn-light-secondary' onClick={deselectAll}>
                      Deselect All
                    </button>
                  </div>
                  <div className='text-muted'>
                    {selectedItems.size} items selected
                  </div>
                </div>
              )}

              {/* Line Items Table */}
              <div className='table-responsive'>
                <table className='table table-row-bordered table-row-gray-100 align-middle gs-0 gy-3'>
                  <thead>
                    <tr className='fw-bold text-muted'>
                      <th className='w-25px'>
                        <div className='form-check form-check-sm form-check-custom form-check-solid'>
                          <input 
                            className='form-check-input' 
                            type='checkbox' 
                            checked={selectedItems.size === parseResult.validItems && parseResult.validItems > 0}
                            onChange={selectedItems.size === parseResult.validItems ? deselectAll : selectAllValid}
                          />
                        </div>
                      </th>
                      <th>Row</th>
                      <th>Description</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th>Line Total</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.lineItems.map((item, index) => {
                      const hasErrors = item.errors && item.errors.length > 0
                      const isSelected = selectedItems.has(index)
                      
                      return (
                        <tr key={index} className={clsx(hasErrors && 'table-danger')}>
                          <td>
                            <div className='form-check form-check-sm form-check-custom form-check-solid'>
                              <input 
                                className='form-check-input' 
                                type='checkbox'
                                checked={isSelected}
                                disabled={hasErrors}
                                onChange={() => toggleItemSelection(index)}
                              />
                            </div>
                          </td>
                          <td className='fw-bold'>{item.rowNumber}</td>
                          <td>
                            <div className='d-flex flex-column'>
                              <span className={clsx('fw-semibold', hasErrors && 'text-danger')}>{item.description || '<empty>'}</span>
                              {hasErrors && (
                                <div className='text-danger fs-7 mt-1'>
                                  {item.errors?.map((error, i) => (
                                    <div key={i}>• {error}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className={clsx(hasErrors && 'text-danger')}>{item.quantity || 0}</td>
                          <td className={clsx(hasErrors && 'text-danger')}>${(item.unit_price || 0).toFixed(2)}</td>
                          <td className='fw-bold'>${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}</td>
                          <td>
                            <span className={`badge badge-light-${item.item_type === 'service' ? 'primary' : item.item_type === 'material' ? 'success' : item.item_type === 'labor' ? 'warning' : 'info'}`}>
                              {item.item_type}
                            </span>
                          </td>
                          <td>
                            {hasErrors ? (
                              <span className='badge badge-light-danger'>Error</span>
                            ) : (
                              <span className='badge badge-light-success'>Valid</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className='modal-footer'>
              <button className='btn btn-light me-2' onClick={resetUploader}>
                Upload Different File
              </button>
              <button className='btn btn-secondary me-2' onClick={onCancel}>
                Cancel
              </button>
              <button 
                className='btn btn-primary'
                disabled={selectedItems.size === 0}
                onClick={importSelectedItems}
              >
                Import {selectedItems.size} Selected Item{selectedItems.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='modal fade show d-block' tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className='modal-dialog modal-lg'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h3 className='modal-title'>Import Line Items</h3>
            <button
              type='button'
              className='btn-close'
              onClick={onCancel}
            ></button>
          </div>
          
          <div className='modal-body'>
            {/* Upload Area */}
            <div
              className={clsx(
                'border border-dashed border-gray-300 rounded p-10 text-center mb-5',
                dragActive && 'border-primary bg-light-primary',
                uploading && 'opacity-50'
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div>
                  <div className='spinner-border text-primary mb-3' role='status'></div>
                  <div className='fw-bold text-gray-600'>Processing file...</div>
                </div>
              ) : (
                <div>
                  <i className='ki-duotone ki-file-up fs-3x text-primary mb-4'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  <div className='fw-bold fs-4 text-gray-900 mb-2'>
                    Drop your CSV/Excel file here or click to browse
                  </div>
                  <div className='text-gray-600 mb-4'>
                    Supported formats: .csv, .tsv, .txt
                  </div>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='.csv,.tsv,.txt'
                    onChange={handleFileSelect}
                    className='d-none'
                  />
                  <button 
                    className='btn btn-primary'
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </button>
                </div>
              )}
            </div>

            {/* Help Section */}
            <div className='card card-bordered'>
              <div className='card-header'>
                <h5 className='card-title'>File Format Requirements</h5>
              </div>
              <div className='card-body'>
                <div className='row'>
                  <div className='col-md-6'>
                    <h6>Required Columns:</h6>
                    <ul className='list-unstyled'>
                      <li>• <strong>Description</strong> - Item description</li>
                      <li>• <strong>Quantity</strong> - Number of items</li>
                      <li>• <strong>Unit Price</strong> - Price per item</li>
                    </ul>
                  </div>
                  <div className='col-md-6'>
                    <h6>Optional Columns:</h6>
                    <ul className='list-unstyled'>
                      <li>• <strong>Item Type</strong> - service, material, labor, other</li>
                    </ul>
                  </div>
                </div>
                
                <div className='separator border-gray-200 my-4'></div>
                
                <div className='d-flex justify-content-between align-items-center'>
                  <div>
                    <div className='text-muted fs-7'>
                      Need help formatting your file? Download our template:
                    </div>
                  </div>
                  <button 
                    className='btn btn-light-primary btn-sm'
                    onClick={downloadSampleCSV}
                  >
                    <i className='ki-duotone ki-download fs-2'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    Download Template
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className='modal-footer'>
            <button className='btn btn-secondary' onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}