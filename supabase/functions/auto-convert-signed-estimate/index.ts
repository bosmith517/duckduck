// Automated job conversion when estimate is signed
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
};

serve(async (req) => {
  if (req.method === 'OPTIONS') { 
    return new Response('ok', { headers: corsHeaders }); 
  }
  
  try {
    console.log('🚀 Auto-converting signed estimate to job...');
    
    const { estimateId, signature, signedBy } = await req.json();
    
    if (!estimateId) {
      throw new Error('Estimate ID is required');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Step 1: Update estimate with signature
    const { data: estimate, error: estimateError } = await supabaseAdmin
      .from('estimates')
      .update({
        signature_status: 'signed',
        signed_at: new Date().toISOString(),
        signature_data: signature,
        signed_by: signedBy
      })
      .eq('id', estimateId)
      .select(`
        *,
        jobs (
          id,
          title,
          account_id,
          contact_id,
          tenant_id
        ),
        estimate_tiers (
          id,
          tier_name,
          total_amount,
          is_selected,
          estimate_line_items (*)
        )
      `)
      .single();

    if (estimateError) throw estimateError;

    console.log('✅ Estimate updated with signature');

    // Step 2: Update job status from "Needs Estimate" to "Scheduled"
    const { error: jobUpdateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'scheduled',
        estimated_cost: estimate.estimate_tiers?.find(t => t.is_selected)?.total_amount || estimate.total_amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', estimate.job_id);

    if (jobUpdateError) throw jobUpdateError;

    console.log('✅ Job status updated to scheduled');

    // Step 3: Create payment schedule milestones
    const selectedTier = estimate.estimate_tiers?.find(t => t.is_selected);
    const totalAmount = selectedTier?.total_amount || estimate.total_amount || 0;
    
    // Create standard payment milestones (customizable per business)
    const paymentMilestones = [
      {
        job_id: estimate.job_id,
        milestone_name: 'Deposit (50%)',
        milestone_description: 'Required deposit to begin work',
        amount: Math.round(totalAmount * 0.5 * 100) / 100, // 50% deposit
        due_date: new Date().toISOString(), // Due immediately
        status: 'pending',
        milestone_order: 1,
        is_deposit: true
      },
      {
        job_id: estimate.job_id,
        milestone_name: 'Final Payment (50%)',
        milestone_description: 'Final payment upon job completion',
        amount: Math.round(totalAmount * 0.5 * 100) / 100, // Remaining 50%
        due_date: null, // Set when job is marked complete
        status: 'pending',
        milestone_order: 2,
        is_final: true
      }
    ];

    const { data: createdMilestones, error: milestonesError } = await supabaseAdmin
      .from('job_payment_schedules')
      .insert(paymentMilestones)
      .select();

    if (milestonesError) throw milestonesError;

    console.log('✅ Payment milestones created:', createdMilestones?.length);

    // Step 4: Create initial invoice for deposit
    const depositMilestone = createdMilestones?.find(m => m.is_deposit);
    if (depositMilestone) {
      const invoiceNumber = `INV-${estimate.job_id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .insert({
          job_id: estimate.job_id,
          account_id: estimate.jobs.account_id,
          invoice_number: invoiceNumber,
          invoice_type: 'deposit',
          total_amount: depositMilestone.amount,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Due in 7 days
          status: 'draft',
          payment_schedule_id: depositMilestone.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice line items from selected estimate tier
      if (selectedTier?.estimate_line_items) {
        const invoiceItems = selectedTier.estimate_line_items.map((item: any) => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total_amount: item.total_price || 0,
          item_type: item.item_type || 'service'
        }));

        const { error: itemsError } = await supabaseAdmin
          .from('invoice_items')
          .insert(invoiceItems);

        if (itemsError) throw itemsError;
      }

      console.log('✅ Deposit invoice created:', invoiceNumber);

      // Step 5: Send deposit invoice to customer (call notification function)
      try {
        await supabaseAdmin.functions.invoke('send-invoice-notification', {
          body: {
            invoiceId: invoice.id,
            type: 'deposit_ready'
          }
        });
        console.log('✅ Deposit invoice notification sent');
      } catch (notificationError) {
        console.error('⚠️ Failed to send invoice notification:', notificationError);
        // Don't fail the whole process for notification errors
      }
    }

    // Step 6: Create work order and material list
    if (selectedTier?.estimate_line_items) {
      const materialItems = selectedTier.estimate_line_items.filter((item: any) => 
        item.item_type === 'material' || item.item_type === 'part'
      );

      if (materialItems.length > 0) {
        // Create purchase order for materials
        const poNumber = `PO-${estimate.job_id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        
        const { data: purchaseOrder, error: poError } = await supabaseAdmin
          .from('purchase_orders')
          .insert({
            job_id: estimate.job_id,
            po_number: poNumber,
            status: 'pending',
            total_amount: materialItems.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0),
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!poError && purchaseOrder) {
          // Add PO line items
          const poItems = materialItems.map((item: any) => ({
            purchase_order_id: purchaseOrder.id,
            description: item.description,
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            total_price: item.total_price || 0
          }));

          await supabaseAdmin
            .from('purchase_order_items')
            .insert(poItems);

          console.log('✅ Purchase order created:', poNumber);
        }
      }
    }

    // Step 7: Create job status update record
    await supabaseAdmin
      .from('job_status_updates')
      .insert({
        job_id: estimate.job_id,
        status: 'scheduled',
        notes: 'Job automatically scheduled after estimate was signed',
        created_at: new Date().toISOString()
      });

    // Step 8: Notify dispatch team
    try {
      await supabaseAdmin.functions.invoke('notify-dispatch-team', {
        body: {
          jobId: estimate.job_id,
          message: 'New job ready for scheduling - estimate signed'
        }
      });
      console.log('✅ Dispatch team notified');
    } catch (dispatchError) {
      console.error('⚠️ Failed to notify dispatch team:', dispatchError);
    }

    console.log('🎉 Estimate conversion completed successfully!');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Estimate successfully converted to job',
      data: {
        jobId: estimate.job_id,
        invoiceCreated: !!depositMilestone,
        milestonesCreated: createdMilestones?.length || 0,
        totalAmount: totalAmount,
        depositAmount: depositMilestone?.amount || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Error in auto-convert-signed-estimate:', error.message);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString(),
      function: 'auto-convert-signed-estimate'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});