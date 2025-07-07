import { useState, useCallback, useEffect } from 'react'
import * as Yup from 'yup'
import { validateForm, validateField } from '../utils/validation'

interface FormState<T> {
  values: T
  errors: Record<string, string>
  touched: Record<string, boolean>
  isSubmitting: boolean
  isValid: boolean
  isDirty: boolean
}

interface UseFormValidationProps<T> {
  initialValues: T
  validationSchema: Yup.AnySchema
  onSubmit: (values: T) => Promise<void> | void
  validateOnChange?: boolean
  validateOnBlur?: boolean
  enableReinitialize?: boolean
}

export function useFormValidation<T extends Record<string, any>>({
  initialValues,
  validationSchema,
  onSubmit,
  validateOnChange = true,
  validateOnBlur = true,
  enableReinitialize = false
}: UseFormValidationProps<T>) {
  const [formState, setFormState] = useState<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
    isValid: true,
    isDirty: false
  })

  const [initialFormValues, setInitialFormValues] = useState(initialValues)

  // Re-initialize form when initialValues change (if enabled)
  useEffect(() => {
    if (enableReinitialize && JSON.stringify(initialValues) !== JSON.stringify(initialFormValues)) {
      setInitialFormValues(initialValues)
      setFormState({
        values: initialValues,
        errors: {},
        touched: {},
        isSubmitting: false,
        isValid: true,
        isDirty: false
      })
    }
  }, [initialValues, enableReinitialize, initialFormValues])

  // Validate entire form
  const validateAllFields = useCallback(async (values: T) => {
    const { isValid, errors } = await validateForm(validationSchema, values)
    return { isValid, errors }
  }, [validationSchema])

  // Validate single field
  const validateSingleField = useCallback(async (name: string, value: any) => {
    try {
      const fieldSchema = (validationSchema as any).fields?.[name] || validationSchema
      const error = await validateField(fieldSchema, value)
      return error
    } catch {
      return null
    }
  }, [validationSchema])

  // Handle field change
  const handleChange = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | 
    { name: string; value: any }
  ) => {
    const { name, value } = 'target' in e ? e.target : e
    
    const newValues = { ...formState.values, [name]: value }
    const isDirty = JSON.stringify(newValues) !== JSON.stringify(initialFormValues)
    
    let newErrors = { ...formState.errors }
    
    // Validate on change if enabled
    if (validateOnChange && formState.touched[name]) {
      const error = await validateSingleField(name, value)
      if (error) {
        newErrors[name] = error
      } else {
        delete newErrors[name]
      }
    }
    
    setFormState(prev => ({
      ...prev,
      values: newValues,
      errors: newErrors,
      isDirty,
      isValid: Object.keys(newErrors).length === 0
    }))
  }, [formState.values, formState.errors, formState.touched, initialFormValues, validateOnChange, validateSingleField])

  // Handle field blur
  const handleBlur = useCallback(async (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> |
    { name: string }
  ) => {
    const name = 'target' in e ? e.target.name : e.name
    
    const newTouched = { ...formState.touched, [name]: true }
    let newErrors = { ...formState.errors }
    
    // Validate on blur if enabled
    if (validateOnBlur) {
      const error = await validateSingleField(name, formState.values[name])
      if (error) {
        newErrors[name] = error
      } else {
        delete newErrors[name]
      }
    }
    
    setFormState(prev => ({
      ...prev,
      touched: newTouched,
      errors: newErrors,
      isValid: Object.keys(newErrors).length === 0
    }))
  }, [formState.values, formState.errors, formState.touched, validateOnBlur, validateSingleField])

  // Set field value programmatically
  const setFieldValue = useCallback(async (name: string, value: any) => {
    await handleChange({ name, value })
  }, [handleChange])

  // Set multiple field values
  const setValues = useCallback((values: Partial<T>) => {
    const newValues = { ...formState.values, ...values }
    const isDirty = JSON.stringify(newValues) !== JSON.stringify(initialFormValues)
    
    setFormState(prev => ({
      ...prev,
      values: newValues,
      isDirty
    }))
  }, [formState.values, initialFormValues])

  // Set field error programmatically
  const setFieldError = useCallback((name: string, error: string) => {
    setFormState(prev => ({
      ...prev,
      errors: { ...prev.errors, [name]: error },
      isValid: false
    }))
  }, [])

  // Set multiple errors
  const setErrors = useCallback((errors: Record<string, string>) => {
    setFormState(prev => ({
      ...prev,
      errors: { ...prev.errors, ...errors },
      isValid: Object.keys({ ...prev.errors, ...errors }).length === 0
    }))
  }, [])

  // Touch field programmatically
  const setFieldTouched = useCallback((name: string, touched = true) => {
    setFormState(prev => ({
      ...prev,
      touched: { ...prev.touched, [name]: touched }
    }))
  }, [])

  // Touch all fields
  const setTouched = useCallback((touched: Record<string, boolean>) => {
    setFormState(prev => ({
      ...prev,
      touched: { ...prev.touched, ...touched }
    }))
  }, [])

  // Reset form to initial values
  const resetForm = useCallback((newInitialValues?: T) => {
    const resetValues = newInitialValues || initialFormValues
    setFormState({
      values: resetValues,
      errors: {},
      touched: {},
      isSubmitting: false,
      isValid: true,
      isDirty: false
    })
    if (newInitialValues) {
      setInitialFormValues(newInitialValues)
    }
  }, [initialFormValues])

  // Handle form submission
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    // Touch all fields
    const allTouched = Object.keys(formState.values).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {} as Record<string, boolean>)
    
    // Validate all fields
    const { isValid, errors } = await validateAllFields(formState.values)
    
    setFormState(prev => ({
      ...prev,
      touched: allTouched,
      errors,
      isValid,
      isSubmitting: isValid
    }))
    
    if (isValid) {
      try {
        await onSubmit(formState.values)
        // Reset form after successful submission
        resetForm()
      } catch (error) {
        console.error('Form submission error:', error)
      } finally {
        setFormState(prev => ({
          ...prev,
          isSubmitting: false
        }))
      }
    }
  }, [formState.values, validateAllFields, onSubmit, resetForm])

  // Get field props helper
  const getFieldProps = useCallback((name: string) => ({
    name,
    value: formState.values[name] || '',
    onChange: handleChange,
    onBlur: handleBlur
  }), [formState.values, handleChange, handleBlur])

  // Get field meta helper
  const getFieldMeta = useCallback((name: string) => ({
    touched: formState.touched[name] || false,
    error: formState.errors[name],
    isInvalid: !!(formState.touched[name] && formState.errors[name])
  }), [formState.touched, formState.errors])

  // Check if form has unsaved changes
  const hasUnsavedChanges = formState.isDirty && !formState.isSubmitting

  return {
    // Form state
    values: formState.values,
    errors: formState.errors,
    touched: formState.touched,
    isSubmitting: formState.isSubmitting,
    isValid: formState.isValid,
    isDirty: formState.isDirty,
    hasUnsavedChanges,
    
    // Field helpers
    getFieldProps,
    getFieldMeta,
    
    // Actions
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setValues,
    setFieldError,
    setErrors,
    setFieldTouched,
    setTouched,
    resetForm,
    validateForm: () => validateAllFields(formState.values),
    validateField: (name: string) => validateSingleField(name, formState.values[name])
  }
}