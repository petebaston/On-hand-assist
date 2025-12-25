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
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = step.id === currentStep;
          const isPast = index < currentIndex;

          return (
            <li key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center">
                <div
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all
                    ${isCompleted
                      ? 'bg-gray-900 text-white'
                      : isCurrent
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-400'
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={`
                    ml-3 text-sm font-medium hidden sm:block
                    ${isCurrent || isCompleted ? 'text-gray-900' : 'text-gray-400'}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {index !== steps.length - 1 && (
                <div
                  className={`flex-1 h-px mx-4 sm:mx-6 ${
                    isPast || isCompleted ? 'bg-gray-900' : 'bg-gray-200'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
