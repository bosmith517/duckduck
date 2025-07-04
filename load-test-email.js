// Load testing script for email system using Artillery
// Tests the send-email Edge Function under load

// artillery.yml configuration file
const artilleryConfig = `
config:
  target: 'https://your-project.supabase.co'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 100
      name: "Load test"
    - duration: 60
      arrivalRate: 200
      name: "Spike test"
    - duration: 120
      arrivalRate: 50
      name: "Cool down"
  environments:
    production:
      target: 'https://your-project.supabase.co'
    staging:
      target: 'https://your-staging-project.supabase.co'
  processor: "./load-test-processor.js"

scenarios:
  - name: "Send transactional email"
    weight: 70
    flow:
      - post:
          url: "/functions/v1/send-email"
          headers:
            Authorization: "Bearer {{ authToken }}"
            Content-Type: "application/json"
          json:
            to: "{{ randomEmail }}"
            subject: "Load Test Email {{ $randomString() }}"
            html: "<h1>Load Test</h1><p>This is email #{{ $randomInt(1, 10000) }}</p>"
            priority: "{{ randomPriority }}"
            tags:
              test: "load-test"
              batch: "{{ batchId }}"
          capture:
            - json: "$.queue_id"
              as: "queueId"
          expect:
            - statusCode: 200
            - hasProperty: "success"

  - name: "Send template email"
    weight: 20
    flow:
      - post:
          url: "/functions/v1/send-email"
          headers:
            Authorization: "Bearer {{ authToken }}"
            Content-Type: "application/json"
          json:
            to: "{{ randomEmail }}"
            subject: "Template Test {{ $randomString() }}"
            template_id: "{{ templateId }}"
            template_variables:
              name: "Load Test User"
              company: "Test Company"
              order_id: "{{ $randomInt(1000, 9999) }}"
            tags:
              test: "template-load-test"
          expect:
            - statusCode: 200

  - name: "Check system health"
    weight: 10
    flow:
      - function: "getSystemHealth"
      - think: 5

# Custom functions for load testing
functions:
  - getSystemHealth

`;

// Load test processor functions
const processorCode = `
'use strict';

// Load test processor for email system
module.exports = {
  setAuthToken,
  generateTestData,
  getSystemHealth,
  checkEmailHealth
};

// Set authentication token from environment
function setAuthToken(requestParams, context, ee, next) {
  // Get auth token from environment variable or login
  context.vars.authToken = process.env.SUPABASE_AUTH_TOKEN || 'your-jwt-token-here';
  context.vars.batchId = Date.now().toString();
  return next();
}

// Generate test data
function generateTestData(requestParams, context, ee, next) {
  const testEmails = [
    'load-test-1@example.com',
    'load-test-2@example.com', 
    'load-test-3@example.com',
    'bounce-test@example.com', // This will bounce for testing
    'success-test@example.com'
  ];
  
  context.vars.randomEmail = testEmails[Math.floor(Math.random() * testEmails.length)];
  context.vars.randomPriority = Math.floor(Math.random() * 10) + 1;
  context.vars.templateId = process.env.TEST_TEMPLATE_ID || 'uuid-of-test-template';
  
  return next();
}

// Check system health during load test
async function getSystemHealth(requestParams, context, ee, next) {
  try {
    const response = await fetch(\`\${context.vars.target}/rest/v1/rpc/get_email_system_health\`, {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': \`Bearer \${context.vars.authToken}\`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const health = await response.json();
      
      // Log critical metrics
      health.forEach(metric => {
        if (metric.status === 'critical') {
          console.warn(\`🚨 CRITICAL: \${metric.metric} = \${metric.value} - \${metric.description}\`);
        } else if (metric.status === 'warning') {
          console.log(\`⚠️  WARNING: \${metric.metric} = \${metric.value} - \${metric.description}\`);
        }
      });
      
      // Emit custom metrics to Artillery
      ee.emit('counter', 'email.health.checked', 1);
      
      const criticalCount = health.filter(m => m.status === 'critical').length;
      const warningCount = health.filter(m => m.status === 'warning').length;
      
      ee.emit('counter', 'email.health.critical', criticalCount);
      ee.emit('counter', 'email.health.warning', warningCount);
      
    } else {
      console.error('Failed to fetch system health:', response.status);
      ee.emit('counter', 'email.health.error', 1);
    }
  } catch (error) {
    console.error('Health check error:', error.message);
    ee.emit('counter', 'email.health.error', 1);
  }
  
  return next();
}

// Monitor email processing during test
async function checkEmailHealth(requestParams, context, ee, next) {
  try {
    // Check queue size
    const queueResponse = await fetch(\`\${context.vars.target}/rest/v1/email_queue?status=eq.pending&select=count\`, {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': \`Bearer \${context.vars.authToken}\`,
        'Range': '0-0'
      }
    });
    
    if (queueResponse.ok) {
      const queueSize = parseInt(queueResponse.headers.get('content-range')?.split('/')[1] || '0');
      ee.emit('histogram', 'email.queue.size', queueSize);
      
      if (queueSize > 1000) {
        console.warn(\`📫 Queue size high: \${queueSize} pending emails\`);
      }
    }
    
  } catch (error) {
    console.error('Queue check error:', error.message);
  }
  
  return next();
}
`;

// Alternative k6 script
const k6Script = `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Histogram } from 'k6/metrics';

// Custom metrics
export let emailsSent = new Counter('emails_sent');
export let emailErrors = new Counter('email_errors');
export let emailDuration = new Histogram('email_duration');
export let errorRate = new Rate('error_rate');

// Test configuration
export let options = {
  stages: [
    { duration: '1m', target: 10 },   // Warm up
    { duration: '5m', target: 100 },  // Load test
    { duration: '2m', target: 200 },  // Spike test
    { duration: '2m', target: 50 },   // Cool down
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    error_rate: ['rate<0.05'],         // Error rate under 5%
    emails_sent: ['count>1000'],       // At least 1000 emails sent
  },
};

// Test data
const testEmails = [
  'load-test-1@example.com',
  'load-test-2@example.com',
  'load-test-3@example.com',
  'performance-test@example.com',
];

const authToken = __ENV.SUPABASE_AUTH_TOKEN || 'your-jwt-token-here';
const baseUrl = __ENV.SUPABASE_URL || 'https://your-project.supabase.co';

export default function() {
  const randomEmail = testEmails[Math.floor(Math.random() * testEmails.length)];
  const emailId = Math.random().toString(36).substring(7);
  
  const payload = JSON.stringify({
    to: randomEmail,
    subject: \`Load Test Email \${emailId}\`,
    html: \`<h1>Load Test</h1><p>Email ID: \${emailId}</p><p>VU: \${__VU}</p><p>Iteration: \${__ITER}</p>\`,
    priority: Math.floor(Math.random() * 5) + 1,
    tags: {
      test: 'k6-load-test',
      vu: __VU.toString(),
      iteration: __ITER.toString(),
      timestamp: Date.now().toString()
    }
  });

  const params = {
    headers: {
      'Authorization': \`Bearer \${authToken}\`,
      'Content-Type': 'application/json',
    },
  };

  // Send email
  const response = http.post(\`\${baseUrl}/functions/v1/send-email\`, payload, params);
  
  // Track metrics
  emailDuration.add(response.timings.duration);
  
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has success field': (r) => {
      try {
        return JSON.parse(r.body).success === true;
      } catch {
        return false;
      }
    },
    'has queue_id': (r) => {
      try {
        return JSON.parse(r.body).queue_id !== undefined;
      } catch {
        return false;
      }
    },
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  if (success) {
    emailsSent.add(1);
  } else {
    emailErrors.add(1);
    errorRate.add(1);
    console.error(\`Failed to send email: \${response.status} - \${response.body}\`);
  }

  // Check system health every 50 iterations
  if (__ITER % 50 === 0) {
    checkSystemHealth();
  }

  sleep(Math.random() * 2); // Random sleep 0-2 seconds
}

function checkSystemHealth() {
  const healthResponse = http.get(\`\${baseUrl}/rest/v1/rpc/get_email_system_health\`, {
    headers: {
      'apikey': __ENV.SUPABASE_ANON_KEY,
      'Authorization': \`Bearer \${authToken}\`,
    },
  });

  if (healthResponse.status === 200) {
    try {
      const health = JSON.parse(healthResponse.body);
      health.forEach(metric => {
        if (metric.status === 'critical') {
          console.warn(\`🚨 CRITICAL: \${metric.metric} = \${metric.value}\`);
        }
      });
    } catch (e) {
      console.error('Failed to parse health response');
    }
  }
}

// Teardown function to check final state
export function teardown(data) {
  console.log('\\n=== Load Test Summary ===');
  
  // Check final queue size
  const queueResponse = http.get(\`\${baseUrl}/rest/v1/email_queue?status=eq.pending&select=count\`, {
    headers: {
      'apikey': __ENV.SUPABASE_ANON_KEY,
      'Authorization': \`Bearer \${authToken}\`,
      'Range': '0-0'
    },
  });

  if (queueResponse.status === 200) {
    const queueSize = parseInt(queueResponse.headers['Content-Range']?.split('/')[1] || '0');
    console.log(\`Final queue size: \${queueSize} pending emails\`);
  }

  // Get system health
  const healthResponse = http.get(\`\${baseUrl}/rest/v1/rpc/get_email_system_health\`, {
    headers: {
      'apikey': __ENV.SUPABASE_ANON_KEY,
      'Authorization': \`Bearer \${authToken}\`,
    },
  });

  if (healthResponse.status === 200) {
    try {
      const health = JSON.parse(healthResponse.body);
      console.log('\\nSystem Health:');
      health.forEach(metric => {
        console.log(\`  \${metric.metric}: \${metric.value} (\${metric.status})\`);
      });
    } catch (e) {
      console.error('Failed to parse final health check');
    }
  }
}
`;

// Package.json for Artillery setup
const packageJson = `{
  "name": "email-load-test",
  "version": "1.0.0",
  "description": "Load testing for TaurusTech email system",
  "scripts": {
    "test:artillery": "artillery run artillery.yml",
    "test:k6": "k6 run email-load-test.js",
    "test:quick": "artillery quick --count 10 --num 5 https://your-project.supabase.co/functions/v1/send-email",
    "monitor": "artillery run artillery.yml --output report.json && artillery report report.json"
  },
  "devDependencies": {
    "artillery": "^2.0.0"
  },
  "dependencies": {
    "node-fetch": "^3.3.0"
  }
}`;

// Environment setup script
const setupScript = `#!/bin/bash

# Load Test Environment Setup
echo "🚀 Setting up email system load test..."

# Check dependencies
if ! command -v artillery &> /dev/null; then
    echo "Installing Artillery..."
    npm install -g artillery
fi

if ! command -v k6 &> /dev/null; then
    echo "Installing k6..."
    # macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install k6
    # Ubuntu/Debian
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    fi
fi

# Environment variables check
echo "📋 Environment Check:"
echo "SUPABASE_URL: ${SUPABASE_URL:-❌ Not set}"
echo "SUPABASE_AUTH_TOKEN: ${SUPABASE_AUTH_TOKEN:-❌ Not set}"
echo "SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:-❌ Not set}"
echo "RESEND_API_KEY: ${RESEND_API_KEY:-❌ Not set}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_AUTH_TOKEN" ]; then
    echo "❌ Missing required environment variables"
    echo "Please set:"
    echo "  export SUPABASE_URL=https://your-project.supabase.co"
    echo "  export SUPABASE_AUTH_TOKEN=your-jwt-token"
    echo "  export SUPABASE_ANON_KEY=your-anon-key"
    exit 1
fi

echo "✅ Environment ready for load testing"

# Create test template if needed
echo "📧 Creating test email template..."
curl -X POST "$SUPABASE_URL/rest/v1/email_template_versions" \\
  -H "apikey: $SUPABASE_ANON_KEY" \\
  -H "Authorization: Bearer $SUPABASE_AUTH_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template_name": "load_test_template",
    "version": 1,
    "subject_template": "Load Test: {{subject}}",
    "html_template": "<h1>Load Test Email</h1><p>Hello {{name}}!</p><p>Order: {{order_id}}</p>",
    "text_template": "Load Test Email\\nHello {{name}}!\\nOrder: {{order_id}}",
    "variables": ["name", "subject", "order_id"],
    "is_active": true,
    "description": "Template for load testing"
  }' || echo "Template may already exist"

echo "🎯 Ready to run load tests!"
echo ""
echo "Quick Commands:"
echo "  npm run test:artillery  # Full Artillery test"
echo "  npm run test:k6        # k6 load test" 
echo "  npm run test:quick     # Quick Artillery test"
echo ""
echo "Monitor during test:"
echo "  - Supabase Dashboard: Logs & Performance"
echo "  - Database: SELECT * FROM get_email_system_health()"
echo "  - Queue size: SELECT count(*) FROM email_queue WHERE status = 'pending'"
`;

// Write all files
console.log('📁 Creating load test files...')

// Save files using Node.js (this would be run separately)
const fs = require('fs');

// Artillery config
fs.writeFileSync('artillery.yml', artilleryConfig.trim());
fs.writeFileSync('load-test-processor.js', processorCode.trim());

// k6 script  
fs.writeFileSync('email-load-test.js', k6Script.trim());

// Package.json
fs.writeFileSync('package.json', packageJson.trim());

// Setup script
fs.writeFileSync('setup-load-test.sh', setupScript.trim());
fs.chmodSync('setup-load-test.sh', '755');

console.log('✅ Load test files created!');
console.log('');
console.log('Next steps:');
console.log('1. Run: ./setup-load-test.sh');
console.log('2. Set environment variables');
console.log('3. Run: npm run test:artillery');
console.log('');
console.log('Monitor these during the test:');
console.log('- Supabase Edge Function logs');
console.log('- Database connections');
console.log('- Memory usage');
console.log('- Email queue size');
console.log('- Resend API rate limits');
`;

// Instructions comment
const instructions = `
/*
Email System Load Testing Setup

This script creates a comprehensive load testing suite for the email system.

Files Created:
- artillery.yml: Artillery load test configuration
- load-test-processor.js: Custom functions for Artillery
- email-load-test.js: k6 load testing script
- package.json: Dependencies and scripts
- setup-load-test.sh: Environment setup script

Load Test Scenarios:
1. Transactional emails (70% of traffic)
2. Template-based emails (20% of traffic)  
3. System health monitoring (10% of traffic)

Test Phases:
- Warm up: 10 RPS for 1 minute
- Load test: 100 RPS for 5 minutes
- Spike test: 200 RPS for 2 minutes
- Cool down: 50 RPS for 2 minutes

Metrics Monitored:
- Email send success rate
- Response time (p95 < 2s)
- Queue size growth
- System health status
- Error rates by type

Pre-Test Checklist:
□ Set environment variables
□ Verify Resend API limits
□ Check Supabase Edge Function concurrency limits
□ Monitor database connections
□ Set up log monitoring
□ Prepare test email addresses

During Test:
□ Watch Supabase logs for errors
□ Monitor memory usage
□ Check database CPU/connections
□ Watch queue processing speed
□ Monitor Resend rate limits

Post-Test Analysis:
□ Review Artillery/k6 reports
□ Check final queue size
□ Analyze error patterns
□ Review system health metrics
□ Document performance findings

Expected Results:
- 95% of requests under 2 seconds
- Error rate under 5%
- Queue processing keeps up with load
- No memory leaks or connection issues
- Graceful degradation under spike loads

Tuning Based on Results:
- Adjust Edge Function memory allocation
- Optimize database queries
- Tune queue processing batch sizes
- Configure appropriate rate limits
- Scale Supabase resources if needed
*/
`;