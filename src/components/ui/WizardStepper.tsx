'use client';

import { Check } from 'lucide-react';

interface Step {
  id: string;
  label: string;
  description?: string;
}

interface WizardStepperProps {
  steps: Step[];
  currentStep: string;
  completedSteps: string[];
}

export function WizardStepper({
  steps,
  currentStep,
  completedSteps,
}: WizardStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <nav aria-label="Progress">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = step.id === currentStep;
          const isPast = index < currentIndex;

          return (
            <li
              key={step.id}
              className={`relative flex-1 ${index !== steps.length - 1 ? 'pr-8' : ''}`}
            >
              {index !== steps.length - 1 && (
                <div
                  className={`absolute top-4 left-0 w-full h-0.5 ${
                    isPast || isCompleted ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                  style={{ left: '50%', width: '100%' }}
                />
              )}

              <div className="relative flex flex-col items-center group">
                <span
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                    transition-colors duration-200
                    ${isCompleted
                      ? 'bg-indigo-600 text-white'
                      : isCurrent
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                        : 'bg-gray-200 text-gray-500'
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>

                <span
                  className={`
                    mt-2 text-xs font-medium text-center
                    ${isCurrent ? 'text-indigo-600' : 'text-gray-500'}
                  `}
                >
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
