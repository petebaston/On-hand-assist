'use client';

import { useState, useCallback } from 'react';
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
  MatchConfig,
  ProcessingResult,
  Issue,
  WizardStep,
} from '@/lib/types';
import { DEFAULT_MATCH_CONFIG } from '@/lib/types';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  MapPin,
  Settings2,
} from 'lucide-react';
import Papa from 'papaparse';

const WIZARD_STEPS = [
  { id: 'upload-shopify', label: 'Shopify' },
  { id: 'upload-supplier', label: 'Supplier' },
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

  const [shopifyData, setShopifyData] = useState<ShopifyFileData | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierFileData | null>(null);

  const [supplierMapping, setSupplierMapping] = useState<{
    sku: number | null;
    qty: number | null;
    location: number | null;
  }>({ sku: null, qty: null, location: null });

  const [matchConfig, setMatchConfig] = useState<MatchConfig>(DEFAULT_MATCH_CONFIG);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [emergencyConfirmation, setEmergencyConfirmation] = useState('');
  const [result, setResult] = useState<ProcessingResult | null>(null);

  const {
    parseShopify,
    parseSupplier,
    process,
    isProcessing,
    progress,
    error,
    clearError,
  } = useInventoryWorker();

  const handleShopifyFile = useCallback(
    async (file: File, content: string) => {
      clearError();
      const parseResult = await parseShopify(content);

      setShopifyData({
        file,
        content,
        format: parseResult.format,
        locations: parseResult.locations,
        rowCount: parseResult.rowCount,
        headers: parseResult.headers,
        issues: parseResult.issues,
      });
    },
    [parseShopify, clearError]
  );

  const handleSupplierFile = useCallback(
    async (file: File, content: string) => {
      clearError();

      const preview = Papa.parse<Record<string, string>>(content, {
        header: true,
        preview: 6,
        skipEmptyLines: true,
      });

      const fullParse = Papa.parse(content, { skipEmptyLines: true });
      const rowCount = fullParse.data.length - 1;
      const parseResult = await parseSupplier(content);

      setSupplierData({
        file,
        content,
        headers: preview.meta.fields || [],
        previewRows: preview.data.slice(0, 5),
        rowCount,
        issues: parseResult.issues,
      });

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

  const canProceedFromShopify = shopifyData && shopifyData.rowCount > 0;
  const canProceedFromSupplier =
    supplierData &&
    supplierData.rowCount > 0 &&
    supplierMapping.sku !== null &&
    supplierMapping.qty !== null;
  const canProcess = canProceedFromShopify && canProceedFromSupplier;
  const shopifyErrors = shopifyData?.issues.filter((i) => i.severity === 'error').length || 0;

  return (
    <div>
      <WizardStepper
        steps={WIZARD_STEPS}
        currentStep={currentStep}
        completedSteps={completedSteps}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {isProcessing && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <ProgressBar
            percent={progress.percent}
            message={progress.message}
            stage={progress.stage}
          />
        </div>
      )}

      <div className="min-h-[360px]">
        {/* Step 1: Shopify Upload */}
        {currentStep === 'upload-shopify' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Shopify Inventory Export</h2>
              <p className="text-sm text-gray-500">
                Export from Shopify Admin: Products → Inventory → Export (All states)
              </p>
            </div>

            <FileUpload
              label="Shopify CSV"
              onFileSelect={handleShopifyFile}
              success={!!(shopifyData && shopifyData.rowCount > 0)}
              error={shopifyErrors > 0 ? `${shopifyErrors} errors found` : undefined}
              disabled={isProcessing}
            />

            {shopifyData && shopifyData.rowCount > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-semibold text-gray-900">
                    {shopifyData.rowCount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Rows</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-semibold text-gray-900 capitalize">
                    {shopifyData.format.replace('_', ' ')}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Format</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-semibold text-gray-900">
                    {shopifyData.locations.length || 1}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Locations</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Supplier Upload */}
        {currentStep === 'upload-supplier' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Supplier Stock Feed</h2>
              <p className="text-sm text-gray-500">
                Upload your supplier's stock file with SKU and quantity columns
              </p>
            </div>

            <FileUpload
              label="Supplier CSV"
              onFileSelect={handleSupplierFile}
              success={!!(supplierData && supplierData.rowCount > 0 && canProceedFromSupplier)}
              disabled={isProcessing}
            />

            {supplierData && (
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl flex-1">
                    <div className="text-2xl font-semibold text-gray-900">
                      {supplierData.rowCount.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Rows</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl flex-1">
                    <div className="text-2xl font-semibold text-gray-900">
                      {supplierData.headers.length}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Columns</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Map columns</h3>
                  <ColumnMapper
                    headers={supplierData.headers}
                    previewRows={supplierData.previewRows}
                    mapping={supplierMapping}
                    onMappingChange={setSupplierMapping}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Configure */}
        {currentStep === 'configure' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Configure Matching</h2>
              <p className="text-sm text-gray-500">
                Fine-tune how SKUs are matched between files
              </p>
            </div>

            {/* File Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-900">Shopify</span>
                </div>
                <p className="text-xs text-emerald-700">
                  {shopifyData?.rowCount.toLocaleString()} rows · {shopifyData?.format} format
                </p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-900">Supplier</span>
                </div>
                <p className="text-xs text-emerald-700">
                  {supplierData?.rowCount.toLocaleString()} rows
                </p>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <Settings2 className="h-4 w-4" />
                <span>Options</span>
              </div>

              <div className="space-y-3 pl-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={matchConfig.normalizeSkus}
                    onChange={(e) =>
                      setMatchConfig({ ...matchConfig, normalizeSkus: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-sm text-gray-700">Normalize SKUs (ignore case & whitespace)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={matchConfig.removeSeparators}
                    onChange={(e) =>
                      setMatchConfig({ ...matchConfig, removeSeparators: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-sm text-gray-700">Remove separators (-, _, .)</span>
                </label>

                <div className="pt-2">
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Duplicate SKU handling
                  </label>
                  <select
                    value={matchConfig.duplicateStrategy}
                    onChange={(e) =>
                      setMatchConfig({
                        ...matchConfig,
                        duplicateStrategy: e.target.value as MatchConfig['duplicateStrategy'],
                      })
                    }
                    className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                  >
                    <option value="last_wins">Last row wins</option>
                    <option value="max_qty">Maximum quantity</option>
                    <option value="sum_qty">Sum quantities</option>
                    <option value="error">Report as error</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Location filter */}
            {shopifyData && shopifyData.locations.length > 1 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <MapPin className="h-4 w-4" />
                  <span>Locations</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pl-6">
                  {shopifyData.locations.map((loc) => (
                    <label key={loc} className="flex items-center gap-2 cursor-pointer">
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
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-700">{loc}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Emergency mode */}
            <div className="pt-4 border-t border-gray-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emergencyMode}
                  onChange={(e) => {
                    setEmergencyMode(e.target.checked);
                    if (!e.target.checked) setEmergencyConfirmation('');
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-600"
                />
                <div>
                  <span className="text-sm font-medium text-red-700">Emergency mode</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Skip safety validation. Use if stock changed since export.
                  </p>
                </div>
              </label>

              {emergencyMode && (
                <div className="mt-3 ml-7">
                  <label className="text-xs text-gray-600 block mb-1">
                    Type CONFIRM to enable:
                  </label>
                  <input
                    type="text"
                    value={emergencyConfirmation}
                    onChange={(e) => setEmergencyConfirmation(e.target.value)}
                    className="w-32 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-mono"
                    placeholder="CONFIRM"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {currentStep === 'results' && result && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Done!</h2>
                <p className="text-sm text-gray-500">Download your files below</p>
              </div>
              <button
                onClick={startOver}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Start over
              </button>
            </div>

            <ResultsDisplay result={result} />
          </div>
        )}
      </div>

      {/* Navigation */}
      {currentStep !== 'results' && (
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={goToPrev}
            disabled={currentStep === 'upload-shopify' || isProcessing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {currentStep === 'configure' ? (
            <button
              onClick={handleProcess}
              disabled={!canProcess || isProcessing || (emergencyMode && emergencyConfirmation !== 'CONFIRM')}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate files
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goToNext}
              disabled={
                (currentStep === 'upload-shopify' && !canProceedFromShopify) ||
                (currentStep === 'upload-supplier' && !canProceedFromSupplier) ||
                isProcessing
              }
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
