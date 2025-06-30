// supabase/functions/_shared/universal-logger.ts
// Universal logging system to capture all function data flow

export interface LogEntry {
  function_name: string;
  tenant_id?: string;
  user_id?: string;
  action: string;
  request_data?: any;
  response_data?: any;
  error_data?: any;
  external_api_calls?: Array<{
    service: string;
    endpoint: string;
    request: any;
    response: any;
    success: boolean;
    error?: string;
  }>;
  database_operations?: Array<{
    table: string;
    operation: 'insert' | 'update' | 'select' | 'delete' | 'upsert';
    data: any;
    result?: any;
    error?: string;
    success: boolean;
  }>;
  function_calls?: Array<{
    function_name: string;
    request: any;
    response: any;
    success: boolean;
    error?: string;
  }>;
  execution_time_ms?: number;
  success: boolean;
  timestamp: string;
  session_id?: string;
}

export class UniversalLogger {
  private supabaseAdmin: any;
  private logEntry: LogEntry;
  private startTime: number;

  constructor(supabaseAdmin: any, functionName: string, tenantId?: string, userId?: string) {
    this.supabaseAdmin = supabaseAdmin;
    this.startTime = Date.now();
    this.logEntry = {
      function_name: functionName,
      tenant_id: tenantId,
      user_id: userId,
      action: 'function_execution',
      external_api_calls: [],
      database_operations: [],
      function_calls: [],
      success: false,
      timestamp: new Date().toISOString(),
      session_id: this.generateSessionId()
    };
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setRequestData(data: any) {
    this.logEntry.request_data = data;
  }

  setResponseData(data: any) {
    this.logEntry.response_data = data;
  }

  setError(error: any) {
    this.logEntry.error_data = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      raw: error
    };
    this.logEntry.success = false;
  }

  logExternalApiCall(service: string, endpoint: string, request: any, response: any, success: boolean, error?: string) {
    this.logEntry.external_api_calls!.push({
      service,
      endpoint,
      request: this.sanitizeData(request),
      response: this.sanitizeData(response),
      success,
      error
    });
  }

  logDatabaseOperation(table: string, operation: 'insert' | 'update' | 'select' | 'delete' | 'upsert', data: any, result?: any, error?: string) {
    const success = !error;
    this.logEntry.database_operations!.push({
      table,
      operation,
      data: this.sanitizeData(data),
      result: this.sanitizeData(result),
      error,
      success
    });
  }

  logFunctionCall(functionName: string, request: any, response: any, success: boolean, error?: string) {
    this.logEntry.function_calls!.push({
      function_name: functionName,
      request: this.sanitizeData(request),
      response: this.sanitizeData(response),
      success,
      error
    });
  }

  setSuccess(success: boolean = true) {
    this.logEntry.success = success;
  }

  private sanitizeData(data: any): any {
    if (!data) return data;
    
    // Create a deep copy to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'api_key', 'secret', 'auth', 'authorization'];
    
    function sanitizeObject(obj: any): any {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
      return obj;
    }
    
    return sanitizeObject(sanitized);
  }

  async saveLog(): Promise<void> {
    try {
      this.logEntry.execution_time_ms = Date.now() - this.startTime;
      
      // Save to function_execution_logs table
      const { error } = await this.supabaseAdmin
        .from('function_execution_logs')
        .insert(this.logEntry);

      if (error) {
        console.error('Failed to save function log:', error);
        // Don't throw - logging failure shouldn't break the function
      }
    } catch (err) {
      console.error('Exception saving function log:', err);
      // Don't throw - logging failure shouldn't break the function
    }
  }

  // Get current log data for debugging
  getCurrentLog(): LogEntry {
    return { ...this.logEntry };
  }
}

// Helper function to wrap database operations with logging
export async function loggedDatabaseOperation<T>(
  logger: UniversalLogger,
  table: string,
  operation: 'insert' | 'update' | 'select' | 'delete' | 'upsert',
  dbOperation: () => Promise<{ data: T; error: any }>,
  data?: any
): Promise<{ data: T; error: any }> {
  try {
    const result = await dbOperation();
    logger.logDatabaseOperation(table, operation, data, result.data, result.error?.message);
    return result;
  } catch (error) {
    logger.logDatabaseOperation(table, operation, data, null, error.message);
    throw error;
  }
}

// Helper function to wrap external API calls with logging
export async function loggedExternalApiCall<T>(
  logger: UniversalLogger,
  service: string,
  endpoint: string,
  request: any,
  apiCall: () => Promise<T>
): Promise<T> {
  try {
    const response = await apiCall();
    logger.logExternalApiCall(service, endpoint, request, response, true);
    return response;
  } catch (error) {
    logger.logExternalApiCall(service, endpoint, request, null, false, error.message);
    throw error;
  }
}

// Helper function to wrap function calls with logging
export async function loggedFunctionCall<T>(
  logger: UniversalLogger,
  functionName: string,
  request: any,
  functionCall: () => Promise<T>
): Promise<T> {
  try {
    const response = await functionCall();
    logger.logFunctionCall(functionName, request, response, true);
    return response;
  } catch (error) {
    logger.logFunctionCall(functionName, request, null, false, error.message);
    throw error;
  }
}