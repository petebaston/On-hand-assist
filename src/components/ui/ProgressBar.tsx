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
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-gray-900 capitalize">
            {stage.replace(/-/g, ' ')}
          </span>
          <span className="text-gray-500 tabular-nums">{Math.round(percent)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gray-900 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      {message && (
        <p className="text-sm text-gray-500 mt-2">{message}</p>
      )}
    </div>
  );
}
