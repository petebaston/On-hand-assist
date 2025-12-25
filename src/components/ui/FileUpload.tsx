'use client';

import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { MAX_FILE_SIZE_BYTES } from '@/lib/types';

interface FileUploadProps {
  accept?: string;
  maxSize?: number;
  onFileSelect: (file: File, content: string) => void;
  label: string;
  description?: string;
  error?: string;
  success?: boolean;
  disabled?: boolean;
}

export function FileUpload({
  accept = '.csv',
  maxSize = MAX_FILE_SIZE_BYTES,
  onFileSelect,
  label,
  description,
  error,
  success,
  disabled,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setLocalError(null);

      // Validate file type
      if (!file.name.endsWith('.csv')) {
        setLocalError('Please upload a CSV file');
        return;
      }

      // Validate file size
      if (file.size > maxSize) {
        setLocalError(
          `File too large. Maximum size is ${(maxSize / 1024 / 1024).toFixed(0)} MB`
        );
        return;
      }

      setIsLoading(true);
      setFileName(file.name);

      try {
        const content = await file.text();
        onFileSelect(file, content);
      } catch (err) {
        setLocalError('Failed to read file');
      } finally {
        setIsLoading(false);
      }
    },
    [maxSize, onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, handleFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const displayError = error || localError;

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      {description && (
        <p className="text-sm text-gray-500 mb-3">{description}</p>
      )}

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
          ${displayError ? 'border-red-300 bg-red-50' : ''}
          ${success ? 'border-green-300 bg-green-50' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled || isLoading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        <div className="flex flex-col items-center gap-3">
          {isLoading ? (
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          ) : success ? (
            <CheckCircle className="h-10 w-10 text-green-500" />
          ) : displayError ? (
            <AlertCircle className="h-10 w-10 text-red-500" />
          ) : fileName ? (
            <FileText className="h-10 w-10 text-indigo-500" />
          ) : (
            <Upload className="h-10 w-10 text-gray-400" />
          )}

          {fileName ? (
            <div>
              <p className="text-sm font-medium text-gray-700">{fileName}</p>
              <p className="text-xs text-gray-500 mt-1">
                {success ? 'File loaded successfully' : 'Click or drag to replace'}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-700">
                Drop your CSV file here
              </p>
              <p className="text-xs text-gray-500 mt-1">
                or click to browse
              </p>
            </div>
          )}
        </div>
      </div>

      {displayError && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {displayError}
        </p>
      )}
    </div>
  );
}
