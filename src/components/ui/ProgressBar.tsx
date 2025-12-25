'use client';

interface ProgressBarProps {
  percent: number;
  message?: string;
  stage?: string;
}

export function ProgressBar({ percent, message, stage }: ProgressBarProps) {
  return (
    <div className="w-full">
      {stage && (
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span className="font-medium capitalize">
            {stage.replace(/-/g, ' ')}
          </span>
          <span>{Math.round(percent)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      {message && (
        <p className="text-sm text-gray-500 mt-1">{message}</p>
      )}
    </div>
  );
}
