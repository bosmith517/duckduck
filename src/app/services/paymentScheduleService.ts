import { supabase } from '../../supabaseClient'

export interface PaymentSchedule {
  id: string
  job_id: string
  tenant_id: string
  invoice_id?: string
  milestone_name: string
  amount_due: number
  due_date: string
  status: string
  created_at: string
  updated_at: string
}

export interface PaymentScheduleWithInvoice extends PaymentSchedule {
  invoices?: {
    id: string
    status: string
    total_amount: number
  } | null
}

class PaymentScheduleService {
  async getPaymentSchedulesByJobId(jobId: string): Promise<PaymentScheduleWithInvoice[]> {
    try {
      const { data, error } = await supabase
        .from('job_payment_schedules')
        .select(`
          *,
          invoices(id, status, total_amount)
        `)
        .eq('job_id', jobId)
        .order('due_date', { ascending: true })

      if (error) {
        console.error('Error fetching payment schedules:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getPaymentSchedulesByJobId:', error)
      throw error
    }
  }

  async createPaymentSchedule(scheduleData: Partial<PaymentSchedule>): Promise<PaymentSchedule> {
    try {
      const { data, error } = await supabase
        .from('job_payment_schedules')
        .insert([scheduleData])
        .select()
        .single()

      if (error) {
        console.error('Error creating payment schedule:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in createPaymentSchedule:', error)
      throw error
    }
  }

  async updatePaymentSchedule(id: string, scheduleData: Partial<PaymentSchedule>): Promise<PaymentSchedule> {
    try {
      const { data, error } = await supabase
        .from('job_payment_schedules')
        .update({
          ...scheduleData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating payment schedule:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in updatePaymentSchedule:', error)
      throw error
    }
  }

  async deletePaymentSchedule(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('job_payment_schedules')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting payment schedule:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deletePaymentSchedule:', error)
      throw error
    }
  }

  async updateScheduleStatus(id: string, status: string, invoiceId?: string): Promise<PaymentSchedule> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      }

      if (invoiceId) {
        updateData.invoice_id = invoiceId
      }

      const { data, error } = await supabase
        .from('job_payment_schedules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating schedule status:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in updateScheduleStatus:', error)
      throw error
    }
  }

  // Placeholder for future invoice generation
  async generateInvoiceFromSchedule(scheduleId: string): Promise<any> {
    console.log('Generate invoice for schedule:', scheduleId)
    // This will be implemented in Task 3
    // For now, just log the action
    return Promise.resolve({ message: 'Invoice generation will be implemented in Task 3' })
  }
}

export const paymentScheduleService = new PaymentScheduleService()
