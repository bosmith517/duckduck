import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvoiceReminder {
  id: string
  tenant_id: string
  invoice_id: string
  reminder_type: 'due_soon' | 'overdue_3' | 'overdue_15' | 'overdue_30' | 'final_notice'
  scheduled_for: string
  email_subject: string
  email_body: string
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
}

interface Invoice {
  id: string
  invoice_number: string
  project_title: string
  total_amount: number
  due_date: string
  payment_status: string
  accounts: {
    name: string
  }
  contacts: {
    email: string
    first_name: string
    last_name: string
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY')!

    if (!supabaseUrl || !supabaseServiceKey || !sendgridApiKey) {
      throw new Error('Missing required environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current date and time
    const now = new Date()
    const nowISO = now.toISOString()

    console.log('🔄 Starting automated invoice reminder check at:', nowISO)

    // Step 1: Find overdue invoices that need reminders
    await scheduleOverdueReminders(supabase, now)

    // Step 2: Send pending reminders that are due
    await sendPendingReminders(supabase, nowISO, sendgridApiKey)

    // Step 3: Schedule upcoming due date reminders
    await scheduleUpcomingReminders(supabase, now)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invoice reminders processed successfully',
        timestamp: nowISO
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in automated invoice reminders:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function scheduleOverdueReminders(supabase: any, now: Date) {
  console.log('🔍 Checking for overdue invoices...')

  // Find unpaid invoices that are overdue
  const { data: overdueInvoices, error } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      project_title,
      total_amount,
      due_date,
      payment_status,
      tenant_id,
      created_at,
      accounts!inner(name),
      contacts!inner(email, first_name, last_name)
    `)
    .in('payment_status', ['unpaid', 'partial'])
    .lt('due_date', now.toISOString().split('T')[0])

  if (error) {
    console.error('Error fetching overdue invoices:', error)
    return
  }

  console.log(`📋 Found ${overdueInvoices?.length || 0} overdue invoices`)

  for (const invoice of overdueInvoices || []) {
    const dueDate = new Date(invoice.due_date)
    const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    console.log(`📅 Invoice ${invoice.invoice_number} is ${daysPastDue} days overdue`)

    // Determine which reminder type to schedule
    let reminderType: string | null = null
    if (daysPastDue >= 3 && daysPastDue < 15) {
      reminderType = 'overdue_3'
    } else if (daysPastDue >= 15 && daysPastDue < 30) {
      reminderType = 'overdue_15'
    } else if (daysPastDue >= 30) {
      reminderType = 'overdue_30'
    }

    if (reminderType) {
      await scheduleReminder(supabase, invoice, reminderType, now)
    }
  }
}

async function scheduleUpcomingReminders(supabase: any, now: Date) {
  console.log('🔍 Checking for upcoming due dates...')

  // Find invoices due in 3 days that haven't been reminded
  const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000))
  
  const { data: upcomingInvoices, error } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      project_title,
      total_amount,
      due_date,
      payment_status,
      tenant_id,
      accounts!inner(name),
      contacts!inner(email, first_name, last_name)
    `)
    .in('payment_status', ['unpaid', 'partial'])
    .eq('due_date', threeDaysFromNow.toISOString().split('T')[0])

  if (error) {
    console.error('Error fetching upcoming invoices:', error)
    return
  }

  console.log(`📋 Found ${upcomingInvoices?.length || 0} invoices due in 3 days`)

  for (const invoice of upcomingInvoices || []) {
    await scheduleReminder(supabase, invoice, 'due_soon', now)
  }
}

async function scheduleReminder(supabase: any, invoice: any, reminderType: string, now: Date) {
  // Check if reminder already exists
  const { data: existingReminder } = await supabase
    .from('invoice_reminders')
    .select('id')
    .eq('invoice_id', invoice.id)
    .eq('reminder_type', reminderType)
    .single()

  if (existingReminder) {
    console.log(`⏭️ Reminder ${reminderType} already exists for invoice ${invoice.invoice_number}`)
    return
  }

  // Create reminder templates
  const templates = {
    due_soon: {
      subject: `Reminder: Invoice ${invoice.invoice_number} due in 3 days`,
      body: `Dear ${invoice.contacts.first_name},\n\nThis is a friendly reminder that invoice ${invoice.invoice_number} for "${invoice.project_title}" is due in 3 days.\n\nAmount Due: $${invoice.total_amount.toFixed(2)}\nDue Date: ${new Date(invoice.due_date).toLocaleDateString()}\n\nYou can view and pay this invoice securely through your customer portal.\n\nThank you for your business!\n\n${invoice.accounts.name}`
    },
    overdue_3: {
      subject: `Past Due: Invoice ${invoice.invoice_number} - 3 days overdue`,
      body: `Dear ${invoice.contacts.first_name},\n\nOur records show that invoice ${invoice.invoice_number} for "${invoice.project_title}" is now 3 days past due.\n\nAmount Due: $${invoice.total_amount.toFixed(2)}\nOriginal Due Date: ${new Date(invoice.due_date).toLocaleDateString()}\n\nPlease submit payment at your earliest convenience through your customer portal or contact us to discuss payment arrangements.\n\nThank you,\n${invoice.accounts.name}`
    },
    overdue_15: {
      subject: `URGENT: Invoice ${invoice.invoice_number} - 15 days overdue`,
      body: `Dear ${invoice.contacts.first_name},\n\nInvoice ${invoice.invoice_number} for "${invoice.project_title}" is now 15 days past due. Immediate attention is required.\n\nAmount Due: $${invoice.total_amount.toFixed(2)}\nOriginal Due Date: ${new Date(invoice.due_date).toLocaleDateString()}\n\nPlease contact us immediately to resolve this matter or submit payment through your customer portal.\n\nBest regards,\n${invoice.accounts.name}`
    },
    overdue_30: {
      subject: `FINAL NOTICE: Invoice ${invoice.invoice_number} - 30 days overdue`,
      body: `Dear ${invoice.contacts.first_name},\n\nThis is a FINAL NOTICE for invoice ${invoice.invoice_number} which is now 30 days past due.\n\nAmount Due: $${invoice.total_amount.toFixed(2)}\nOriginal Due Date: ${new Date(invoice.due_date).toLocaleDateString()}\n\nImmediate payment is required to avoid further action. Please contact us immediately.\n\n${invoice.accounts.name}`
    }
  }

  const template = templates[reminderType]
  if (!template) {
    console.error(`Unknown reminder type: ${reminderType}`)
    return
  }

  // Schedule reminder for immediate sending
  const scheduledFor = new Date(now.getTime() + (5 * 60 * 1000)) // 5 minutes from now

  const { error: insertError } = await supabase
    .from('invoice_reminders')
    .insert({
      tenant_id: invoice.tenant_id,
      invoice_id: invoice.id,
      reminder_type: reminderType,
      scheduled_for: scheduledFor.toISOString(),
      email_subject: template.subject,
      email_body: template.body,
      status: 'pending'
    })

  if (insertError) {
    console.error(`Error scheduling reminder for invoice ${invoice.invoice_number}:`, insertError)
  } else {
    console.log(`✅ Scheduled ${reminderType} reminder for invoice ${invoice.invoice_number}`)
  }
}

async function sendPendingReminders(supabase: any, nowISO: string, sendgridApiKey: string) {
  console.log('📧 Checking for pending reminders to send...')

  // Get reminders that are due to be sent
  const { data: pendingReminders, error } = await supabase
    .from('invoice_reminders')
    .select(`
      *,
      invoices!inner(
        invoice_number,
        accounts!inner(name),
        contacts!inner(email, first_name, last_name)
      )
    `)
    .eq('status', 'pending')
    .lt('scheduled_for', nowISO)

  if (error) {
    console.error('Error fetching pending reminders:', error)
    return
  }

  console.log(`📬 Found ${pendingReminders?.length || 0} reminders to send`)

  for (const reminder of pendingReminders || []) {
    try {
      await sendEmailReminder(reminder, sendgridApiKey)
      
      // Mark as sent
      await supabase
        .from('invoice_reminders')
        .update({ 
          status: 'sent', 
          sent_at: nowISO 
        })
        .eq('id', reminder.id)

      console.log(`✅ Sent ${reminder.reminder_type} reminder for invoice ${reminder.invoices.invoice_number}`)

    } catch (error) {
      console.error(`❌ Failed to send reminder ${reminder.id}:`, error)
      
      // Mark as failed
      await supabase
        .from('invoice_reminders')
        .update({ status: 'failed' })
        .eq('id', reminder.id)
    }
  }
}

async function sendEmailReminder(reminder: any, sendgridApiKey: string) {
  const email = {
    personalizations: [{
      to: [{
        email: reminder.invoices.contacts.email,
        name: `${reminder.invoices.contacts.first_name} ${reminder.invoices.contacts.last_name}`
      }]
    }],
    from: {
      email: 'noreply@tradeworkspro.com',
      name: reminder.invoices.accounts.name
    },
    subject: reminder.email_subject,
    content: [{
      type: 'text/plain',
      value: reminder.email_body
    }]
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sendgridApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(email)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`SendGrid API error: ${response.status} - ${errorText}`)
  }
}