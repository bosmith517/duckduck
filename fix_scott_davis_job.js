// Simple script to update the Scott Davis job contract price
import { supabase } from './src/supabaseClient.js'

async function updateScottDavisJob() {
  try {
    // Find the Scott Davis job
    const { data: jobs, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .ilike('title', '%Scott Davis%')
      .ilike('title', '%Electrical Service%')
    
    if (fetchError) {
      console.error('Error fetching job:', fetchError)
      return
    }
    
    if (!jobs || jobs.length === 0) {
      console.log('Scott Davis job not found')
      return
    }
    
    const job = jobs[0]
    console.log('Found job:', job.title)
    console.log('Current contract_price:', job.contract_price)
    
    // Update the contract price to $1000
    const { error: updateError } = await supabase
      .from('jobs')
      .update({ 
        contract_price: 1000.00,
        estimated_cost: 300.00 
      })
      .eq('id', job.id)
    
    if (updateError) {
      console.error('Error updating job:', updateError)
      return
    }
    
    console.log('✅ Successfully updated Scott Davis job:')
    console.log('   Contract Price: $1000.00')
    console.log('   Estimated Cost: $300.00')
    console.log('   Expected Profit: $700.00 (70% margin)')
    
  } catch (error) {
    console.error('Script error:', error)
  }
}

updateScottDavisJob()