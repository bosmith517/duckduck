// Password Reset System Configuration
// Set USE_CUSTOM_PASSWORD_RESET to true to use the advanced system with:
// - Rate limiting
// - Custom branded emails
// - Password reset tracking
// - Admin dashboard
// Set to false to use Supabase default password reset

export const USE_CUSTOM_PASSWORD_RESET = false; // Change to true after deploying Edge Functions

// Configuration for custom password reset system
export const PASSWORD_RESET_CONFIG = {
  // Token expiry in hours
  expiryHours: 1,
  
  // Rate limiting
  maxAttemptsPerHour: 3,
  maxAttemptsPerDay: 10,
  
  // Email settings
  fromName: 'TradeWorks Pro',
  supportEmail: 'support@tradeworkspro.com',
};