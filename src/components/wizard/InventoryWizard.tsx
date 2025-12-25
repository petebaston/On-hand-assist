'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  FileUpload,
  ColumnMapper,
  ProgressBar,
  ResultsDisplay,
  WizardStepper,
} from '@/components/ui';
import { useInventoryWorker } from '@/hooks/useInventoryWorker';
import type {
  ShopifyExportFormat,
  SupplierColumnMapping,
  MatchConfig,
  ProcessingResult,
  Issue,
  WizardStep,
} from '@/lib/types';
import { DEFAULT_MATCH_CONFIG } from '@/lib/types';
import {
  ArrowLeft,
  ArrowRight,
  Play,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import Papa from 'papaparse';

const WIZARD_STEPS = [
  { id: 'upload-shopify', label: 'Shopify File' },
  { id: 'upload-supplier', label: 'Supplier Feed' },
  { id: 'configure', label: 'Configure' },
  { id: 'results', label: 'Results' },
];

interface ShopifyFileData {
  file: File;
  content: string;
  format: ShopifyExportFormat;
  locations: string[];
  rowCount: number;
  headers: string[];
  issues: Issue[];
}

interface SupplierFileData {
  file: File;
  content: string;
  headers: string[];
  previewRows: Record<string, string>[];
  rowCount: number;
  issues: Issue[];
}

export function InventoryWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload-shopify');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  // File data
  const [shopifyData, setShopifyData] = useState<ShopifyFileData | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierFileData | null>(null);

  // Configuration
  const [supplierMapping, setSupplierMapping] = useState<{
    sku: number | null;
    qty: number | null;
    location: number | null;
  }>({ sku: null, qty: null, location: null });

  const [matchConfig, setMatchConfig] = useState<MatchConfig>(DEFAULT_MATCH_CONFIG);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [emergencyConfirmation, setEmergencyConfirmation] = useState('');

  // Results
  const [result, setResult] = useState<ProcessingResult | null>(null);

  // Worker
  const {
    parseShopify,
    parseSupplier,
    process,
    isProcessing,
    progress,
    error,
    clearError,
  } = useInventoryWorker();

  // Handle Shopify file upload
  const handleShopifyFile = useCallback(
    async (file: File, content: string) => {
      clearError();
      const parseResult = await parseShopify(content);

      if (parseResult.success) {
        setShopifyData({
          file,
          content,
          format: parseResult.format,
          locations: parseResult.locations,
          rowCount: parseResult.rowCount,
          headers: parseResult.headers,
          issues: parseResult.issues,
        });
      } else {
        setShopifyData({
          file,
          content,
          format: parseResult.format,
          locations: [],
          rowCount: 0,
          headers: parseResult.headers,
          issues: parseResult.issues,
        });
      }
    },
    [parseShopify, clearError]
  );

  // Handle Supplier file upload
  const handleSupplierFile = useCallback(
    async (file: File, content: string) => {
      clearError();

      // Parse preview locally (quick)
      const preview = Papa.parse<Record<string, string>>(content, {
        header: true,
        preview: 6,
        skipEmptyLines: true,
      });

      // Get full row count
      const fullParse = Papa.parse(content, { skipEmptyLines: true });
      const rowCount = fullParse.data.length - 1; // -1 for header

      // Parse in worker for validation
      const parseResult = await parseSupplier(content);

      setSupplierData({
        file,
        content,
        headers: preview.meta.fields || [],
        previewRows: preview.data.slice(0, 5),
        rowCount,
        issues: parseResult.issues,
      });

      // Auto-detect mapping
      if (parseResult.detectedMapping.sku !== null) {
        setSupplierMapping({
          sku: parseResult.detectedMapping.sku,
          qty: parseResult.detectedMapping.qty,
          location: parseResult.detectedMapping.location,
        });
      }
    },
    [parseSupplier, clearError]
  );

  // Handle processing
  const handleProcess = useCallback(async () => {
    if (!shopifyData || !supplierData || supplierMapping.sku === null || supplierMapping.qty === null) {
      return;
    }

    clearError();

    const processingResult = await process({
      shopifyCsv: shopifyData.content,
      supplierCsv: supplierData.content,
      shopifyFormat: shopifyData.format,
      supplierMapping: {
        sku: supplierMapping.sku,
        qty: supplierMapping.qty,
        location: supplierMapping.location,
      },
      matchConfig,
      emergencyMode: emergencyMode && emergencyConfirmation === 'CONFIRM',
    });

    setResult(processingResult);
    setCurrentStep('results');
    setCompletedSteps((prev) => [...new Set([...prev, 'configure'])]);
  }, [
    shopifyData,
    supplierData,
    supplierMapping,
    matchConfig,
    emergencyMode,
    emergencyConfirmation,
    process,
    clearError,
  ]);

  // Navigation
  const goToNext = useCallback(() => {
    const steps: WizardStep[] = ['upload-shopify', 'upload-supplier', 'configure', 'results'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCompletedSteps((prev) => [...new Set([...prev, currentStep])]);
      setCurrentStep(steps[currentIndex + 1]);
    }
  }, [currentStep]);

  const goToPrev = useCallback(() => {
    const steps: WizardStep[] = ['upload-shopify', 'upload-supplier', 'configure', 'results'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }, [currentStep]);

  const startOver = useCallback(() => {
    setCurrentStep('upload-shopify');
    setCompletedSteps([]);
    setShopifyData(null);
    setSupplierData(null);
    setSupplierMapping({ sku: null, qty: null, location: null });
    setMatchConfig(DEFAULT_MATCH_CONFIG);
    setEmergencyMode(false);
    setEmergencyConfirmation('');
    setResult(null);
    clearError();
  }, [clearError]);

  // Validation
  const canProceedFromShopify = shopifyData && shopifyData.rowCount > 0;
  const canProceedFromSupplier =
    supplierData &&
    supplierData.rowCount > 0 &&
    supplierMapping.sku !== null &&
    supplierMapping.qty !== null;
  const canProcess = canProceedFromShopify && canProceedFromSupplier;

  // Count issues by severity
  const shopifyErrors = shopifyData?.issues.filter((i) => i.severity === 'error').length || 0;
  const supplierErrors = supplierData?.issues.filter((i) => i.severity === 'error').length || 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Stepper */}
      <div className="mb-8">
        <WizardStepper
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-700 font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      {isProcessing && (
        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <ProgressBar
            percent={progress.percent}
            message={progress.message}
            stage={progress.stage}
          />
        </div>
      )}

      {/* Step content */}
      <div className="bg-white rounded-xl border p-6 min-h-[400px]">
        {/* Step 1: Upload Shopify */}
        {currentStep === 'upload-shopify' && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Upload Shopify Inventory Export</h2>
            <p className="text-gray-600 mb-6">
              Export your inventory from Shopify Admin: Products → Inventory → Export
            </p>

            <FileUpload
              label="Shopify Inventory CSV"
              description="Upload the CSV file exported from Shopify Admin"
              onFileSelect={handleShopifyFile}
              success={!!(shopifyData && shopifyData.rowCount > 0)}
              error={shopifyErrors > 0 ? `${shopifyErrors} errors found` : undefined}
              disabled={isProcessing}
            />

            {shopifyData && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">File Summary</h3>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Format Detected</dt>
                    <dd className="font-medium">
                      {shopifyData.format === 'all_states' ? 'All states' : 'Available'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Rows</dt>
                    <dd className="font-medium">{shopifyData.rowCount.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Locations</dt>
                    <dd className="font-medium">
                      {shopifyData.locations.length > 0
                        ? shopifyData.locations.join(', ')
                        : 'N/A'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Issues</dt>
                    <dd className={`font-medium ${shopifyErrors > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {shopifyErrors > 0 ? `${shopifyErrors} errors` : 'None'}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Upload Supplier */}
        {currentStep === 'upload-supplier' && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Upload Supplier Feed</h2>
            <p className="text-gray-600 mb-6">
              Upload your supplier's stock file or POS export
            </p>

            <FileUpload
              label="Supplier/POS Stock CSV"
              description="CSV file with SKU and quantity columns"
              onFileSelect={handleSupplierFile}
              success={!!(supplierData && supplierData.rowCount > 0 && canProceedFromSupplier)}
              disabled={isProcessing}
            />

            {supplierData && (
              <div className="mt-6">
                <div className="p-4 bg-gray-50 rounded-lg mb-6">
                  <h3 className="font-medium mb-2">File Summary</h3>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Rows</dt>
                      <dd className="font-medium">{supplierData.rowCount.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Columns</dt>
                      <dd className="font-medium">{supplierData.headers.length}</dd>
                    </div>
                  </dl>
                </div>

                <h3 className="font-medium mb-3">Map Columns</h3>
                <ColumnMapper
                  headers={supplierData.headers}
                  previewRows={supplierData.previewRows}
                  mapping={supplierMapping}
                  onMappingChange={setSupplierMapping}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Configure */}
        {currentStep === 'configure' && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Configure Matching</h2>
            <p className="text-gray-600 mb-6">
              Review settings and start processing
            </p>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Shopify File
                </h3>
                <p className="text-sm text-gray-600">
                  {shopifyData?.rowCount.toLocaleString()} rows • {shopifyData?.format} format
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Supplier File
                </h3>
                <p className="text-sm text-gray-600">
                  {supplierData?.rowCount.toLocaleString()} rows
                </p>
              </div>
            </div>

            {/* Matching options */}
            <div className="space-y-4">
              <h3 className="font-medium">Matching Options</h3>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={matchConfig.normalizeSkus}
                  onChange={(e) =>
                    setMatchConfig({ ...matchConfig, normalizeSkus: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Normalize SKUs (ignore case/whitespace)</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={matchConfig.removeSeparators}
                  onChange={(e) =>
                    setMatchConfig({ ...matchConfig, removeSeparators: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Remove separators (-, _, .)</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duplicate Supplier SKU Handling
                </label>
                <select
                  value={matchConfig.duplicateStrategy}
                  onChange={(e) =>
                    setMatchConfig({
                      ...matchConfig,
                      duplicateStrategy: e.target.value as MatchConfig['duplicateStrategy'],
                    })
                  }
                  className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="last_wins">Last row wins</option>
                  <option value="max_qty">Maximum quantity</option>
                  <option value="sum_qty">Sum quantities</option>
                  <option value="error">Report as error</option>
                </select>
              </div>

              {/* Location filter */}
              {shopifyData && shopifyData.locations.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Locations to Update
                  </label>
                  <div className="space-y-2">
                    {shopifyData.locations.map((loc) => (
                      <label key={loc} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={
                            matchConfig.locationsToUpdate.length === 0 ||
                            matchConfig.locationsToUpdate.includes(loc)
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (matchConfig.locationsToUpdate.length === 0) {
                                // Already includes all
                              } else {
                                setMatchConfig({
                                  ...matchConfig,
                                  locationsToUpdate: [...matchConfig.locationsToUpdate, loc],
                                });
                              }
                            } else {
                              const current =
                                matchConfig.locationsToUpdate.length === 0
                                  ? shopifyData.locations
                                  : matchConfig.locationsToUpdate;
                              setMatchConfig({
                                ...matchConfig,
                                locationsToUpdate: current.filter((l) => l !== loc),
                              });
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm">{loc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Emergency mode */}
              <div className="pt-4 border-t">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={emergencyMode}
                    onChange={(e) => {
                      setEmergencyMode(e.target.checked);
                      if (!e.target.checked) {
                        setEmergencyConfirmation('');
                      }
                    }}
                    className="mt-1 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-red-600">
                      Emergency Mode (Skip Safety Validation)
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Clears "On hand (current)" values to bypass Shopify's safety check.
                      Use only if stock has changed since export.
                    </p>
                  </div>
                </label>

                {emergencyMode && (
                  <div className="mt-3 ml-6">
                    <label className="block text-sm text-gray-700 mb-1">
                      Type <strong>CONFIRM</strong> to enable emergency mode:
                    </label>
                    <input
                      type="text"
                      value={emergencyConfirmation}
                      onChange={(e) => setEmergencyConfirmation(e.target.value)}
                      className="w-40 rounded-md border border-gray-300 px-3 py-1 text-sm"
                      placeholder="CONFIRM"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {currentStep === 'results' && result && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">Processing Complete</h2>
                <p className="text-gray-600">
                  Download your files and review the results
                </p>
              </div>
              <button
                onClick={startOver}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <RefreshCw className="h-4 w-4" />
                Start Over
              </button>
            </div>

            <ResultsDisplay result={result} />
          </div>
        )}
      </div>

      {/* Navigation */}
      {currentStep !== 'results' && (
        <div className="mt-6 flex justify-between">
          <button
            onClick={goToPrev}
            disabled={currentStep === 'upload-shopify' || isProcessing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {currentStep === 'configure' ? (
            <button
              onClick={handleProcess}
              disabled={!canProcess || isProcessing || (emergencyMode && emergencyConfirmation !== 'CONFIRM')}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-4 w-4" />
              {isProcessing ? 'Processing...' : 'Process Files'}
            </button>
          ) : (
            <button
              onClick={goToNext}
              disabled={
                (currentStep === 'upload-shopify' && !canProceedFromShopify) ||
                (currentStep === 'upload-supplier' && !canProceedFromSupplier) ||
                isProcessing
              }
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
