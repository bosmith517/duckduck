import { LineItem } from '../services/estimatesService'

export interface ParsedLineItem extends Omit<LineItem, 'id'> {
  rowNumber: number
  errors?: string[]
}

export interface ParseResult {
  success: boolean
  lineItems: ParsedLineItem[]
  errors: string[]
  totalItems: number
  validItems: number
}

// Expected CSV/Excel column mappings
export const COLUMN_MAPPINGS = {
  description: ['description', 'item', 'service', 'product', 'name', 'desc'],
  quantity: ['quantity', 'qty', 'amount', 'count'],
  unit_price: ['unit_price', 'price', 'unit price', 'cost', 'rate', 'unit cost'],
  item_type: ['item_type', 'type', 'category', 'service_type']
}

// Valid item types
const VALID_ITEM_TYPES = ['service', 'material', 'labor', 'other']

/**
 * Parse CSV content into line items
 */
export function parseCSVToLineItems(csvContent: string): ParseResult {
  const result: ParseResult = {
    success: false,
    lineItems: [],
    errors: [],
    totalItems: 0,
    validItems: 0
  }

  try {
    const lines = csvContent.trim().split('\n')
    
    if (lines.length < 2) {
      result.errors.push('CSV must contain at least a header row and one data row')
      return result
    }

    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    
    // Find column indexes
    const columnIndexes = findColumnIndexes(headers)
    
    if (!columnIndexes.description || !columnIndexes.quantity || !columnIndexes.unit_price) {
      result.errors.push('CSV must contain description, quantity, and unit_price columns')
      return result
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(cell => cell.trim().replace(/"/g, ''))
      const lineItem = parseLineItemRow(row, columnIndexes, i + 1)
      
      if (lineItem) {
        result.lineItems.push(lineItem)
        if (!lineItem.errors || lineItem.errors.length === 0) {
          result.validItems++
        }
      }
    }

    result.totalItems = result.lineItems.length
    result.success = result.validItems > 0

    if (result.validItems === 0) {
      result.errors.push('No valid line items found in CSV')
    }

  } catch (error) {
    result.errors.push(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return result
}

/**
 * Parse Excel-like TSV content (tab-separated values)
 */
export function parseTSVToLineItems(tsvContent: string): ParseResult {
  // Convert TSV to CSV by replacing tabs with commas
  const csvContent = tsvContent.replace(/\t/g, ',')
  return parseCSVToLineItems(csvContent)
}

/**
 * Find column indexes based on header names
 */
function findColumnIndexes(headers: string[]): Record<string, number | null> {
  const indexes: Record<string, number | null> = {
    description: null,
    quantity: null,
    unit_price: null,
    item_type: null
  }

  for (const [field, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]
      if (possibleNames.some(name => header.includes(name))) {
        indexes[field] = i
        break
      }
    }
  }

  return indexes
}

/**
 * Parse a single row into a line item
 */
function parseLineItemRow(
  row: string[], 
  columnIndexes: Record<string, number | null>, 
  rowNumber: number
): ParsedLineItem | null {
  const errors: string[] = []

  // Extract values
  const description = columnIndexes.description !== null ? row[columnIndexes.description]?.trim() : ''
  const quantityStr = columnIndexes.quantity !== null ? row[columnIndexes.quantity]?.trim() : ''
  const unitPriceStr = columnIndexes.unit_price !== null ? row[columnIndexes.unit_price]?.trim() : ''
  const itemTypeStr = columnIndexes.item_type !== null ? row[columnIndexes.item_type]?.trim().toLowerCase() : 'service'

  // Validate description
  if (!description) {
    errors.push('Description is required')
  } else if (description.length > 200) {
    errors.push('Description cannot exceed 200 characters')
  }

  // Validate and parse quantity
  let quantity = 0
  if (!quantityStr) {
    errors.push('Quantity is required')
  } else {
    quantity = parseFloat(quantityStr)
    if (isNaN(quantity) || quantity <= 0) {
      errors.push('Quantity must be a positive number')
    } else if (quantity > 9999) {
      errors.push('Quantity cannot exceed 9999')
    }
  }

  // Validate and parse unit price
  let unit_price = 0
  if (!unitPriceStr) {
    errors.push('Unit price is required')
  } else {
    // Remove currency symbols and parse
    const cleanPriceStr = unitPriceStr.replace(/[$,]/g, '')
    unit_price = parseFloat(cleanPriceStr)
    if (isNaN(unit_price) || unit_price < 0) {
      errors.push('Unit price must be a valid positive number')
    } else if (unit_price > 999999) {
      errors.push('Unit price cannot exceed $999,999')
    }
  }

  // Validate item type
  let item_type: 'service' | 'material' | 'labor' | 'other' = 'service'
  if (itemTypeStr && !VALID_ITEM_TYPES.includes(itemTypeStr)) {
    errors.push(`Item type must be one of: ${VALID_ITEM_TYPES.join(', ')}`)
  } else if (itemTypeStr) {
    item_type = itemTypeStr as 'service' | 'material' | 'labor' | 'other'
  }

  // Skip empty rows
  if (!description && !quantityStr && !unitPriceStr) {
    return null
  }

  return {
    description,
    quantity,
    unit_price,
    item_type,
    line_total: quantity * unit_price,
    sort_order: rowNumber - 2, // Adjust for header row
    rowNumber,
    errors: errors.length > 0 ? errors : undefined
  }
}

/**
 * Generate a sample CSV template for users
 */
export function generateSampleCSV(): string {
  const headers = ['Description', 'Quantity', 'Unit Price', 'Item Type']
  const sampleRows = [
    ['Plumbing Labor - Install Kitchen Sink', '4', '75.00', 'labor'],
    ['Kitchen Sink - Stainless Steel', '1', '299.99', 'material'],
    ['Pipe Fittings and Connectors', '1', '45.50', 'material'],
    ['Disposal Installation Service', '1', '125.00', 'service']
  ]

  const csvLines = [headers.join(',')]
  sampleRows.forEach(row => {
    csvLines.push(row.map(cell => `"${cell}"`).join(','))
  })

  return csvLines.join('\n')
}

/**
 * Download sample CSV file
 */
export function downloadSampleCSV(): void {
  const csvContent = generateSampleCSV()
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'estimate_line_items_template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}