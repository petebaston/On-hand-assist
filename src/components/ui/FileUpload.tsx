'use client';

import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
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
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setLocalError(null);

      if (!file.name.endsWith('.csv')) {
        setLocalError('Please upload a CSV file');
        return;
      }

      if (file.size > maxSize) {
        setLocalError(
          `File too large. Maximum size is ${(maxSize / 1024 / 1024).toFixed(0)} MB`
        );
        return;
      }

      setIsLoading(true);
      setFileName(file.name);
      setFileSize(file.size);

      try {
        const content = await file.text();
        onFileSelect(file, content);
      } catch {
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const displayError = error || localError;

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-900 mb-1.5">
        {label}
      </label>
      {description && (
        <p className="text-sm text-gray-500 mb-3">{description}</p>
      )}

      <div
        className={`
          relative rounded-xl transition-all duration-200
          ${isDragging
            ? 'bg-gray-100 border-2 border-gray-900 border-dashed'
            : success
              ? 'bg-emerald-50 border border-emerald-200'
              : displayError
                ? 'bg-red-50 border border-red-200'
                : 'bg-gray-50 border border-gray-200 hover:border-gray-300 hover:bg-gray-100'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : fileName && (success || !displayError) ? (
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${success ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                {success ? (
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                ) : (
                  <FileText className="h-6 w-6 text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                <p className="text-xs text-gray-500">
                  {fileSize && formatFileSize(fileSize)}
                  {success && ' · Ready'}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFileName(null);
                  setFileSize(null);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${displayError ? 'bg-red-100' : 'bg-gray-100'}`}>
                {displayError ? (
                  <AlertCircle className="h-6 w-6 text-red-500" />
                ) : (
                  <Upload className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                {displayError || 'Drop your file here'}
              </p>
              <p className="text-xs text-gray-500">
                or click to browse
              </p>
            </div>
          )}
        </div>
      </div>

      {displayError && fileName && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {displayError}
        </p>
      )}
    </div>
  );
}
