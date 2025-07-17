import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read environment variables
const envPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key] = value
    }
  })
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  try {
    // Check if tables exist and their structure
    const tables = ['leads', 'jobs', 'estimates', 'job_activity_log']
    
    for (const table of tables) {
      console.log(`\n=== ${table.toUpperCase()} ===`)
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1)
        
        if (error) {
          console.error(`Error querying ${table}:`, error.message)
        } else {
          if (data && data.length > 0) {
            console.log(`Columns in ${table}:`, Object.keys(data[0]).join(', '))
            console.log(`Sample data:`, JSON.stringify(data[0], null, 2))
          } else {
            console.log(`${table} exists but is empty`)
          }
        }
      } catch (err) {
        console.error(`Error with ${table}:`, err.message)
      }
    }
    
  } catch (error) {
    console.error('Error in schema check:', error)
  }
}

checkSchema()