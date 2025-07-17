// Centralized Form Schema Registry
// This defines all forms in the platform and their relationships

export type SyncBehavior = 'overwrite' | 'append' | 'ignore' | 'create_new'
export type FieldType = 'string' | 'number' | 'date' | 'boolean' | 'json' | 'array'

export interface FieldMapping {
  sourceField: string
  targetTable: string
  targetField: string
  syncBehavior: SyncBehavior
  transform?: (value: any) => any
  required?: boolean
}

export interface LinkedForm {
  formId: string
  triggerField?: string // Field that triggers the link
  prefillMapping: Record<string, string> // source field -> target field
}

export interface SyncRule {
  id: string
  name: string
  triggerEvent: 'create' | 'update' | 'delete'
  conditions?: Array<{
    field: string
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than'
    value: any
  }>
  actions: Array<{
    type: 'sync' | 'create' | 'update' | 'delete' | 'notify'
    targetTable?: string
    targetForm?: string
    fieldMappings?: FieldMapping[]
    notificationConfig?: any
  }>
}

export interface FormSchema {
  formId: string
  formName: string
  description: string
  primaryTable: string
  associatedTables: string[]
  linkedForms: LinkedForm[]
  fieldMappings: FieldMapping[]
  syncRules: SyncRule[]
  metadata: {
    version: string
    lastUpdated: string
    createdBy: string
  }
}

// Form Schema Definitions
export const formSchemas: Record<string, FormSchema> = {
  // Lead Creation Form
  leadCreation: {
    formId: 'lead-creation',
    formName: 'Lead Creation Form',
    description: 'Initial lead capture from calls, web, or walk-ins',
    primaryTable: 'leads',
    associatedTables: ['contacts', 'accounts', 'calendar_events', 'lead_sources'],
    linkedForms: [
      {
        formId: 'site-visit-scheduling',
        prefillMapping: {
          'name': 'customer_name',
          'phone_number': 'customer_phone',
          'email': 'customer_email',
          'service_address': 'visit_address'
        }
      },
      {
        formId: 'estimate-creation',
        prefillMapping: {
          'name': 'client_name',
          'phone_number': 'client_phone',
          'email': 'client_email',
          'service_address': 'job_address'
        }
      }
    ],
    fieldMappings: [
      {
        sourceField: 'name',
        targetTable: 'contacts',
        targetField: 'name',
        syncBehavior: 'create_new',
        required: true
      },
      {
        sourceField: 'phone_number',
        targetTable: 'contacts',
        targetField: 'phone',
        syncBehavior: 'overwrite',
        transform: (value: string) => value.replace(/\D/g, '') // Store just digits
      },
      {
        sourceField: 'email',
        targetTable: 'contacts',
        targetField: 'email',
        syncBehavior: 'overwrite'
      },
      {
        sourceField: 'company_name',
        targetTable: 'accounts',
        targetField: 'name',
        syncBehavior: 'create_new'
      }
    ],
    syncRules: [
      {
        id: 'create-contact-on-lead',
        name: 'Create Contact on Lead Creation',
        triggerEvent: 'create',
        actions: [
          {
            type: 'create',
            targetTable: 'contacts',
            fieldMappings: [
              {
                sourceField: 'name',
                targetTable: 'contacts',
                targetField: 'name',
                syncBehavior: 'create_new'
              },
              {
                sourceField: 'phone_number',
                targetTable: 'contacts',
                targetField: 'phone',
                syncBehavior: 'overwrite'
              }
            ]
          }
        ]
      },
      {
        id: 'sync-site-visit-to-calendar',
        name: 'Sync Site Visit to Calendar',
        triggerEvent: 'update',
        conditions: [
          {
            field: 'site_visit_date',
            operator: 'not_equals',
            value: null
          }
        ],
        actions: [
          {
            type: 'sync',
            targetTable: 'calendar_events',
            fieldMappings: [
              {
                sourceField: 'site_visit_date',
                targetTable: 'calendar_events',
                targetField: 'start_time',
                syncBehavior: 'overwrite'
              }
            ]
          }
        ]
      }
    ],
    metadata: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      createdBy: 'system'
    }
  },

  // Site Visit Scheduling Form
  siteVisitScheduling: {
    formId: 'site-visit-scheduling',
    formName: 'Site Visit Scheduling Form',
    description: 'Schedule site visits for leads',
    primaryTable: 'leads',
    associatedTables: ['calendar_events', 'notifications'],
    linkedForms: [
      {
        formId: 'estimate-creation',
        triggerField: 'visit_completed',
        prefillMapping: {
          'customer_name': 'client_name',
          'service_address': 'job_address',
          'visit_notes': 'site_notes'
        }
      }
    ],
    fieldMappings: [
      {
        sourceField: 'site_visit_date',
        targetTable: 'calendar_events',
        targetField: 'start_time',
        syncBehavior: 'overwrite',
        required: true
      },
      {
        sourceField: 'assigned_rep',
        targetTable: 'calendar_events',
        targetField: 'assigned_to',
        syncBehavior: 'overwrite'
      }
    ],
    syncRules: [
      {
        id: 'create-calendar-event',
        name: 'Create Calendar Event for Site Visit',
        triggerEvent: 'create',
        actions: [
          {
            type: 'create',
            targetTable: 'calendar_events',
            fieldMappings: [
              {
                sourceField: 'site_visit_date',
                targetTable: 'calendar_events',
                targetField: 'start_time',
                syncBehavior: 'create_new'
              }
            ]
          },
          {
            type: 'notify',
            notificationConfig: {
              type: 'sms',
              recipient: 'customer',
              template: 'site_visit_confirmation'
            }
          }
        ]
      }
    ],
    metadata: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      createdBy: 'system'
    }
  },

  // Estimate Creation Form
  estimateCreation: {
    formId: 'estimate-creation',
    formName: 'Estimate Creation Form',
    description: 'Create estimates for jobs',
    primaryTable: 'estimates',
    associatedTables: ['estimate_items', 'leads', 'jobs', 'contacts', 'accounts'],
    linkedForms: [
      {
        formId: 'job-creation',
        triggerField: 'estimate_accepted',
        prefillMapping: {
          'client_name': 'client_name',
          'job_address': 'job_location',
          'estimate_total': 'job_value',
          'scope_of_work': 'job_description'
        }
      },
      {
        formId: 'invoice-creation',
        prefillMapping: {
          'client_name': 'bill_to',
          'estimate_items': 'invoice_items',
          'estimate_total': 'invoice_total'
        }
      }
    ],
    fieldMappings: [
      {
        sourceField: 'lead_id',
        targetTable: 'leads',
        targetField: 'id',
        syncBehavior: 'overwrite'
      },
      {
        sourceField: 'total_amount',
        targetTable: 'leads',
        targetField: 'estimated_value',
        syncBehavior: 'overwrite'
      }
    ],
    syncRules: [
      {
        id: 'update-lead-status',
        name: 'Update Lead Status on Estimate',
        triggerEvent: 'create',
        actions: [
          {
            type: 'update',
            targetTable: 'leads',
            fieldMappings: [
              {
                sourceField: 'lead_id',
                targetTable: 'leads',
                targetField: 'status',
                syncBehavior: 'overwrite',
                transform: () => 'estimate_sent'
              }
            ]
          }
        ]
      },
      {
        id: 'convert-to-job',
        name: 'Convert Estimate to Job',
        triggerEvent: 'update',
        conditions: [
          {
            field: 'status',
            operator: 'equals',
            value: 'accepted'
          }
        ],
        actions: [
          {
            type: 'create',
            targetTable: 'jobs',
            fieldMappings: [
              {
                sourceField: 'id',
                targetTable: 'jobs',
                targetField: 'estimate_id',
                syncBehavior: 'create_new'
              },
              {
                sourceField: 'total_amount',
                targetTable: 'jobs',
                targetField: 'contract_value',
                syncBehavior: 'overwrite'
              }
            ]
          }
        ]
      }
    ],
    metadata: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      createdBy: 'system'
    }
  },

  // Job Creation Form
  jobCreation: {
    formId: 'job-creation',
    formName: 'Job Creation Form',
    description: 'Create and manage jobs',
    primaryTable: 'jobs',
    associatedTables: ['job_tasks', 'job_materials', 'calendar_events', 'invoices', 'payments'],
    linkedForms: [
      {
        formId: 'task-assignment',
        prefillMapping: {
          'job_id': 'job_id',
          'job_address': 'task_location',
          'client_name': 'client_reference'
        }
      },
      {
        formId: 'invoice-creation',
        prefillMapping: {
          'job_id': 'job_id',
          'client_name': 'bill_to',
          'job_address': 'service_address',
          'contract_value': 'invoice_amount'
        }
      }
    ],
    fieldMappings: [
      {
        sourceField: 'start_date',
        targetTable: 'calendar_events',
        targetField: 'start_time',
        syncBehavior: 'create_new'
      },
      {
        sourceField: 'assigned_crew',
        targetTable: 'calendar_events',
        targetField: 'assigned_to',
        syncBehavior: 'overwrite'
      }
    ],
    syncRules: [
      {
        id: 'create-job-calendar-events',
        name: 'Create Calendar Events for Job',
        triggerEvent: 'create',
        actions: [
          {
            type: 'create',
            targetTable: 'calendar_events',
            fieldMappings: [
              {
                sourceField: 'start_date',
                targetTable: 'calendar_events',
                targetField: 'start_time',
                syncBehavior: 'create_new'
              },
              {
                sourceField: 'title',
                targetTable: 'calendar_events',
                targetField: 'title',
                syncBehavior: 'overwrite',
                transform: (value: string) => `Job: ${value}`
              }
            ]
          }
        ]
      },
      {
        id: 'trigger-invoice-on-completion',
        name: 'Create Invoice on Job Completion',
        triggerEvent: 'update',
        conditions: [
          {
            field: 'status',
            operator: 'equals',
            value: 'completed'
          }
        ],
        actions: [
          {
            type: 'create',
            targetTable: 'invoices',
            fieldMappings: [
              {
                sourceField: 'id',
                targetTable: 'invoices',
                targetField: 'job_id',
                syncBehavior: 'create_new'
              },
              {
                sourceField: 'contract_value',
                targetTable: 'invoices',
                targetField: 'total_amount',
                syncBehavior: 'overwrite'
              }
            ]
          }
        ]
      }
    ],
    metadata: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      createdBy: 'system'
    }
  },

  // Invoice Creation Form
  invoiceCreation: {
    formId: 'invoice-creation',
    formName: 'Invoice Creation Form',
    description: 'Create and send invoices',
    primaryTable: 'invoices',
    associatedTables: ['invoice_items', 'payments', 'jobs', 'contacts'],
    linkedForms: [
      {
        formId: 'payment-recording',
        prefillMapping: {
          'invoice_id': 'invoice_id',
          'invoice_total': 'payment_amount',
          'client_name': 'payer_name'
        }
      }
    ],
    fieldMappings: [
      {
        sourceField: 'job_id',
        targetTable: 'jobs',
        targetField: 'latest_invoice_id',
        syncBehavior: 'overwrite'
      },
      {
        sourceField: 'status',
        targetTable: 'jobs',
        targetField: 'billing_status',
        syncBehavior: 'overwrite'
      }
    ],
    syncRules: [
      {
        id: 'update-job-billing-status',
        name: 'Update Job Billing Status',
        triggerEvent: 'create',
        actions: [
          {
            type: 'update',
            targetTable: 'jobs',
            fieldMappings: [
              {
                sourceField: 'job_id',
                targetTable: 'jobs',
                targetField: 'billing_status',
                syncBehavior: 'overwrite',
                transform: () => 'invoiced'
              }
            ]
          }
        ]
      },
      {
        id: 'notify-payment-due',
        name: 'Send Payment Reminder',
        triggerEvent: 'create',
        actions: [
          {
            type: 'notify',
            notificationConfig: {
              type: 'email',
              recipient: 'customer',
              template: 'invoice_created',
              schedule: 'immediate'
            }
          }
        ]
      }
    ],
    metadata: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      createdBy: 'system'
    }
  },

  // Payment Recording Form
  paymentRecording: {
    formId: 'payment-recording',
    formName: 'Payment Recording Form',
    description: 'Record customer payments',
    primaryTable: 'payments',
    associatedTables: ['invoices', 'jobs', 'payment_methods'],
    linkedForms: [],
    fieldMappings: [
      {
        sourceField: 'payment_amount',
        targetTable: 'invoices',
        targetField: 'paid_amount',
        syncBehavior: 'append'
      },
      {
        sourceField: 'payment_date',
        targetTable: 'invoices',
        targetField: 'last_payment_date',
        syncBehavior: 'overwrite'
      }
    ],
    syncRules: [
      {
        id: 'update-invoice-status',
        name: 'Update Invoice Status on Payment',
        triggerEvent: 'create',
        actions: [
          {
            type: 'update',
            targetTable: 'invoices',
            fieldMappings: [
              {
                sourceField: 'invoice_id',
                targetTable: 'invoices',
                targetField: 'status',
                syncBehavior: 'overwrite',
                transform: (value: any) => {
                  // Payment status will be determined by backend triggers
                  return 'partial'
                }
              }
            ]
          }
        ]
      },
      {
        id: 'update-job-payment-status',
        name: 'Update Job Payment Status',
        triggerEvent: 'create',
        actions: [
          {
            type: 'update',
            targetTable: 'jobs',
            fieldMappings: [
              {
                sourceField: 'job_id',
                targetTable: 'jobs',
                targetField: 'payment_status',
                syncBehavior: 'overwrite',
                transform: (value: any) => {
                  // Payment status will be determined by backend triggers
                  return 'partial'
                }
              }
            ]
          }
        ]
      }
    ],
    metadata: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      createdBy: 'system'
    }
  }
}

// Helper function to get form schema by ID
export const getFormSchema = (formId: string): FormSchema | undefined => {
  return formSchemas[formId]
}

// Helper function to get all linked forms for a given form
export const getLinkedForms = (formId: string): LinkedForm[] => {
  const schema = getFormSchema(formId)
  return schema?.linkedForms || []
}

// Helper function to get sync rules for a form and event
export const getSyncRules = (formId: string, event: 'create' | 'update' | 'delete'): SyncRule[] => {
  const schema = getFormSchema(formId)
  return schema?.syncRules.filter(rule => rule.triggerEvent === event) || []
}

// Helper function to get field mappings between forms
export const getFieldMappings = (sourceFormId: string, targetTable: string): FieldMapping[] => {
  const schema = getFormSchema(sourceFormId)
  return schema?.fieldMappings.filter(mapping => mapping.targetTable === targetTable) || []
}

// Helper function to validate required fields
export const validateRequiredFields = (formId: string, data: Record<string, any>): { isValid: boolean; missingFields: string[] } => {
  const schema = getFormSchema(formId)
  const missingFields: string[] = []
  
  schema?.fieldMappings.forEach(mapping => {
    if (mapping.required && !data[mapping.sourceField]) {
      missingFields.push(mapping.sourceField)
    }
  })
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  }
}