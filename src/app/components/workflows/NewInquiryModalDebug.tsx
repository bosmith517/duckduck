// TEMPORARY DEBUG VERSION - Enhanced error logging
// Replace NewInquiryModal with this temporarily to debug the issue

import React from 'react';
import { toast } from 'react-hot-toast';

// Add this debug function to NewInquiryModal.tsx temporarily
export const debugLeadCreation = () => {
  // Add this at the beginning of handleSubmit in NewInquiryModal
  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError(...args);
    // Also show errors as toasts
    if (args[0] && typeof args[0] === 'string') {
      toast.error(`Console Error: ${args[0].substring(0, 100)}...`);
    }
  };

  // Add this wrapper around the entire try block
  const wrapPromise = async (promise: Promise<any>, label: string) => {
    try {
      console.log(`🔵 Starting: ${label}`);
      const result = await promise;
      console.log(`✅ Success: ${label}`, result);
      toast.success(`✅ ${label}`);
      return result;
    } catch (error: any) {
      console.error(`❌ Failed: ${label}`, error);
      toast.error(`❌ ${label}: ${error.message}`);
      throw error;
    }
  };

  return { wrapPromise };
};

// Add this to the handleSubmit function after getting userProfile:
/*
const { wrapPromise } = debugLeadCreation();

// Replace the lead creation with:
const { data: lead, error: leadError } = await wrapPromise(
  supabase.from('leads').insert(leadData).select().single(),
  'Creating Lead'
);

// Replace the contact creation with:
const { data: contact, error: contactError } = await wrapPromise(
  supabase.from('contacts').insert(contactData).select().single(),
  'Creating Contact'
);

// Replace the account creation with:
const { data: account, error: accountError } = await wrapPromise(
  supabase.from('accounts').insert(accountData).select().single(),
  'Creating Account'
);
*/