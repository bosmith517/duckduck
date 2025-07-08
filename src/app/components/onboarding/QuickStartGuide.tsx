import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'react-bootstrap';

interface QuickStartGuideProps {
  show: boolean;
  onHide: () => void;
  userRole: string;
}

export const QuickStartGuide: React.FC<QuickStartGuideProps> = ({ show, onHide, userRole }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to TradeWorks Pro!',
      content: 'Let\'s get you set up in just 3 minutes.',
      action: null,
      icon: 'ki-home'
    },
    {
      title: 'Step 1: Create Your First Lead',
      content: 'Click "New Inquiry" to add your first customer lead. This tracks potential jobs.',
      action: () => {
        onHide();
        navigate('/dashboard');
        // Trigger new inquiry modal
        setTimeout(() => {
          document.querySelector('[data-action="new-inquiry"]')?.click();
        }, 500);
      },
      icon: 'ki-plus-circle'
    },
    {
      title: 'Step 2: Convert Lead to Job',
      content: 'After creating a lead, convert it to an active job to track work and payments.',
      action: () => {
        onHide();
        navigate('/app/leads');
      },
      icon: 'ki-arrow-right'
    },
    {
      title: 'Step 3: Track Your Work',
      content: 'Use the Jobs page to track progress, add photos, and manage payments.',
      action: () => {
        onHide();
        navigate('/app/jobs');
      },
      icon: 'ki-check-circle'
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onHide();
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

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Quick Start Guide</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="text-center py-10">
          <i className={`ki-duotone ${steps[currentStep].icon} fs-5x text-primary mb-5`}>
            <span className="path1"></span>
            <span className="path2"></span>
            <span className="path3"></span>
          </i>
          <h2 className="fs-2 fw-bold mb-5">{steps[currentStep].title}</h2>
          <p className="fs-4 text-gray-600 mb-10">{steps[currentStep].content}</p>
          
          <div className="d-flex justify-content-center gap-3 mb-5">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-10px h-10px rounded-circle ${
                  index === currentStep ? 'bg-primary' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-light" onClick={onHide}>
          Skip Tutorial
        </button>
        <button 
          className="btn btn-primary" 
          onClick={handleAction}
        >
          {steps[currentStep].action ? 'Try It Now' : 
           currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
        </button>
      </Modal.Footer>
    </Modal>
  );
};