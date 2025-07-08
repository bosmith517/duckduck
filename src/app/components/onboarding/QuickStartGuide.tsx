import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'react-bootstrap';
import { supabase } from '../../../supabaseClient';

interface QuickStartGuideProps {
  show: boolean;
  onHide: () => void;
  userRole: string;
}

interface OnboardingStep {
  title: string;
  content: string;
  action: (() => void) | null;
  icon: string;
  roleRequired?: string[];
}

export const QuickStartGuide: React.FC<QuickStartGuideProps> = ({ show, onHide, userRole }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Check if user has completed onboarding
  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.onboarding_completed) {
      setHasCompletedOnboarding(true);
    }
  };

  // Role-based onboarding steps
  const adminSteps: OnboardingStep[] = [
    {
      title: 'Welcome to TradeWorks Pro!',
      content: 'As an administrator, you have full control over your business operations. Let\'s get you started.',
      action: null,
      icon: 'ki-shield-tick'
    },
    {
      title: 'Set Up Your Team',
      content: 'Start by inviting your team members. Assign roles like technicians, dispatchers, and office staff.',
      action: () => {
        onHide();
        navigate('/app/teams');
      },
      icon: 'ki-people'
    },
    {
      title: 'Configure Your Services',
      content: 'Set up your service offerings, pricing, and work order templates.',
      action: () => {
        onHide();
        navigate('/app/settings/services');
      },
      icon: 'ki-setting-2'
    },
    {
      title: 'Create Your First Lead',
      content: 'Add customer inquiries and convert them to jobs. Try the complete workflow.',
      action: () => {
        onHide();
        navigate('/dashboard');
        setTimeout(() => {
          const button = document.querySelector('[data-action="new-inquiry"]') as HTMLButtonElement;
          if (button) button.click();
        }, 500);
      },
      icon: 'ki-plus-circle'
    },
    {
      title: 'Explore Analytics',
      content: 'View real-time insights about your business performance and team productivity.',
      action: () => {
        onHide();
        navigate('/app/analytics');
      },
      icon: 'ki-chart-line-up'
    }
  ];

  const technicianSteps: OnboardingStep[] = [
    {
      title: 'Welcome to TradeWorks Pro!',
      content: 'As a technician, you\'ll manage your daily jobs and customer interactions here.',
      action: null,
      icon: 'ki-wrench'
    },
    {
      title: 'View Your Schedule',
      content: 'Check your assigned jobs and routes for the day. Everything is organized for efficiency.',
      action: () => {
        onHide();
        navigate('/app/schedule');
      },
      icon: 'ki-calendar'
    },
    {
      title: 'Track Your Jobs',
      content: 'Update job status, add photos, and complete work orders right from your device.',
      action: () => {
        onHide();
        navigate('/app/jobs');
      },
      icon: 'ki-briefcase'
    },
    {
      title: 'Customer Communication',
      content: 'Send updates to customers, get signatures, and handle payments on-site.',
      action: () => {
        onHide();
        navigate('/app/communications');
      },
      icon: 'ki-messages'
    }
  ];

  const officeSteps: OnboardingStep[] = [
    {
      title: 'Welcome to TradeWorks Pro!',
      content: 'You\'ll be managing customer inquiries, scheduling, and office operations.',
      action: null,
      icon: 'ki-office-bag'
    },
    {
      title: 'Handle New Inquiries',
      content: 'Process incoming calls and create leads. Convert qualified leads to jobs.',
      action: () => {
        onHide();
        navigate('/dashboard');
        setTimeout(() => {
          const button = document.querySelector('[data-action="new-inquiry"]') as HTMLButtonElement;
          if (button) button.click();
        }, 500);
      },
      icon: 'ki-call'
    },
    {
      title: 'Manage Scheduling',
      content: 'Assign jobs to technicians and optimize routes for maximum efficiency.',
      action: () => {
        onHide();
        navigate('/app/dispatch');
      },
      icon: 'ki-route'
    },
    {
      title: 'Track Invoices',
      content: 'Monitor payments, send invoices, and follow up on overdue accounts.',
      action: () => {
        onHide();
        navigate('/app/invoices');
      },
      icon: 'ki-bill'
    }
  ];

  // Select steps based on role
  const getStepsForRole = () => {
    switch (userRole.toLowerCase()) {
      case 'admin':
      case 'manager':
        return adminSteps;
      case 'technician':
      case 'field_worker':
        return technicianSteps;
      case 'dispatcher':
      case 'customer_service':
      case 'agent':
        return officeSteps;
      default:
        return [
          {
            title: 'Welcome to TradeWorks Pro!',
            content: 'Let\'s explore the key features available to you.',
            action: null,
            icon: 'ki-home'
          },
          {
            title: 'View Dashboard',
            content: 'See your daily tasks and important metrics at a glance.',
            action: () => {
              onHide();
              navigate('/dashboard');
            },
            icon: 'ki-element-11'
          },
          {
            title: 'Explore Features',
            content: 'Navigate through the menu to discover all available tools.',
            action: () => {
              onHide();
            },
            icon: 'ki-compass'
          }
        ];
    }
  };

  const steps = getStepsForRole();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAction = () => {
    const action = steps[currentStep].action;
    if (action) {
      action();
    } else {
      handleNext();
    }
  };

  const completeOnboarding = async () => {
    // Mark onboarding as completed
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.auth.updateUser({
        data: { 
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString()
        }
      });
    }
    onHide();
  };

  const skipTutorial = () => {
    if (window.confirm('Are you sure you want to skip the tutorial? You can access it later from the Help menu.')) {
      completeOnboarding();
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg" backdrop="static">
      <Modal.Header>
        <Modal.Title>
          <i className="ki-duotone ki-rocket fs-2 text-primary me-3">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          {hasCompletedOnboarding ? 'Feature Tour' : 'Welcome to TradeWorks Pro'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="text-center py-8">
          <div className="mb-5">
            <i className={`ki-duotone ${steps[currentStep].icon} fs-5x text-primary`}>
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
              <span className="path4"></span>
              <span className="path5"></span>
            </i>
          </div>
          
          <h2 className="fs-2 fw-bold mb-4">{steps[currentStep].title}</h2>
          <p className="fs-5 text-gray-700 mb-8 px-10">{steps[currentStep].content}</p>
          
          {/* Progress indicator */}
          <div className="d-flex justify-content-center align-items-center gap-2 mb-5">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`transition-all ${
                  index === currentStep 
                    ? 'w-30px h-8px rounded-pill bg-primary' 
                    : 'w-8px h-8px rounded-circle bg-gray-300'
                }`}
              />
            ))}
          </div>
          
          {/* Step counter */}
          <div className="text-muted fs-6">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="flex-between">
        <div>
          {!hasCompletedOnboarding && (
            <button className="btn btn-sm btn-light-danger" onClick={skipTutorial}>
              Skip Tutorial
            </button>
          )}
        </div>
        <div className="d-flex gap-2">
          {currentStep > 0 && (
            <button className="btn btn-light" onClick={handlePrevious}>
              <i className="ki-duotone ki-arrow-left fs-4 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Back
            </button>
          )}
          <button 
            className="btn btn-primary" 
            onClick={handleAction}
          >
            {steps[currentStep].action ? (
              <>
                Try It Now
                <i className="ki-duotone ki-arrow-right fs-4 ms-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </>
            ) : currentStep === steps.length - 1 ? (
              <>
                Get Started
                <i className="ki-duotone ki-check fs-4 ms-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </>
            ) : (
              <>
                Next
                <i className="ki-duotone ki-arrow-right fs-4 ms-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </>
            )}
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};