import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.6'
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, rgb } from 'https://cdn.skypack.dev/pdf-lib?dts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FieldInput {
  fieldName: string
  fieldValue: string | boolean | number
  fieldType?: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature' | 'date'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { documentUrl, documentId, fields, bucket = 'business-documents', path } = await req.json()

    console.log(`Processing autofill for document: ${documentId}`)
    console.log(`Fields to fill:`, fields)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('Supabase client initialized')

    // 1. Download the PDF document
    let pdfBytes: Uint8Array

    if (documentUrl) {
      // Download from URL
      console.log(`Downloading PDF from URL: ${documentUrl}`)
      const response = await fetch(documentUrl)
      if (!response.ok) {
        throw new Error(`Failed to download document: ${response.statusText}`)
      }
      pdfBytes = new Uint8Array(await response.arrayBuffer())
    } else if (path) {
      // Download from Supabase storage
      console.log(`Downloading PDF from storage: ${bucket}/${path}`)
      const { data, error } = await supabase.storage.from(bucket).download(path)
      if (error) {
        throw new Error(`Failed to download from storage: ${error.message}`)
      }
      pdfBytes = new Uint8Array(await data.arrayBuffer())
    } else {
      throw new Error('Either documentUrl or path must be provided')
    }

    console.log(`PDF downloaded, size: ${pdfBytes.length} bytes`)

    // 2. Load the PDF and get the form
    const pdfDoc = await PDFDocument.load(pdfBytes, { throwOnInvalidObject: false })
    const form = pdfDoc.getForm()
    
    let fieldsProcessed = 0
    const fieldResults: any[] = []

    // 3. Fill each field based on its type
    for (const fieldInput of fields as FieldInput[]) {
      try {
        const field = form.getField(fieldInput.fieldName)
        const fieldType = fieldInput.fieldType || detectFieldType(field)
        
        console.log(`Processing field: ${fieldInput.fieldName}, type: ${fieldType}, value: ${fieldInput.fieldValue}`)

        switch (fieldType) {
          case 'text':
          case 'date':
            if (field instanceof PDFTextField) {
              field.setText(String(fieldInput.fieldValue))
              fieldsProcessed++
              fieldResults.push({
                fieldName: fieldInput.fieldName,
                status: 'filled',
                value: fieldInput.fieldValue
              })
            }
            break

          case 'checkbox':
            if (field instanceof PDFCheckBox) {
              if (fieldInput.fieldValue === true || fieldInput.fieldValue === 'true' || fieldInput.fieldValue === 'yes') {
                field.check()
              } else {
                field.uncheck()
              }
              fieldsProcessed++
              fieldResults.push({
                fieldName: fieldInput.fieldName,
                status: 'filled',
                value: fieldInput.fieldValue
              })
            }
            break

          case 'radio':
            if (field instanceof PDFRadioGroup) {
              field.select(String(fieldInput.fieldValue))
              fieldsProcessed++
              fieldResults.push({
                fieldName: fieldInput.fieldName,
                status: 'filled',
                value: fieldInput.fieldValue
              })
            }
            break

          case 'dropdown':
            if (field instanceof PDFDropdown) {
              field.select(String(fieldInput.fieldValue))
              fieldsProcessed++
              fieldResults.push({
                fieldName: fieldInput.fieldName,
                status: 'filled',
                value: fieldInput.fieldValue
              })
            }
            break

          case 'signature':
            // For signatures, we'll add a text representation for now
            // In production, you'd want to either:
            // 1. Accept base64 image data and embed it
            // 2. Use a signature service API
            // 3. Add a text representation with timestamp
            if (field instanceof PDFTextField) {
              const signatureText = `Signed by: ${fieldInput.fieldValue}\nDate: ${new Date().toISOString()}`
              field.setText(signatureText)
              fieldsProcessed++
              fieldResults.push({
                fieldName: fieldInput.fieldName,
                status: 'filled',
                value: signatureText,
                note: 'Text signature added'
              })
            }
            break

          default:
            console.warn(`Unknown field type for ${fieldInput.fieldName}`)
            fieldResults.push({
              fieldName: fieldInput.fieldName,
              status: 'skipped',
              reason: 'Unknown field type'
            })
        }
      } catch (fieldError: any) {
        console.error(`Error processing field ${fieldInput.fieldName}:`, fieldError)
        fieldResults.push({
          fieldName: fieldInput.fieldName,
          status: 'error',
          error: fieldError.message
        })
      }
    }

    // 4. Flatten the form (optional - makes fields non-editable)
    // form.flatten()

    // 5. Save the filled PDF
    const filledPdfBytes = await pdfDoc.save()
    
    // 6. Upload to storage
    const timestamp = Date.now()
    const originalName = documentId || 'document'
    const filledDocumentName = `filled_${timestamp}_${originalName}.pdf`
    const uploadPath = path ? 
      path.substring(0, path.lastIndexOf('/')) + '/' + filledDocumentName :
      `filled-documents/${filledDocumentName}`

    console.log(`Uploading filled PDF to: ${bucket}/${uploadPath}`)
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(uploadPath, filledPdfBytes, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Failed to upload filled document: ${uploadError.message}`)
    }

    // 7. Get public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadPath)

    console.log(`Document filled and uploaded successfully. Fields processed: ${fieldsProcessed}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        filledDocumentUrl: publicUrl,
        storagePath: uploadPath,
        documentId,
        filledAt: new Date().toISOString(),
        message: 'Document filled successfully',
        fieldsProcessed,
        fieldResults
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Autofill function error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        stack: error.stack,
        details: 'Check function logs for more information'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

// Helper function to detect field type from PDF field object
function detectFieldType(field: any): string {
  const className = field.constructor.name
  
  switch (className) {
    case 'PDFTextField':
      return 'text'
    case 'PDFCheckBox':
      return 'checkbox'
    case 'PDFRadioGroup':
      return 'radio'
    case 'PDFDropdown':
      return 'dropdown'
    default:
      return 'text'
  }
}