'use client';

/**
 * React hook for using the inventory processing web worker
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ShopifyExportFormat,
  SupplierColumnMapping,
  MatchConfig,
  ProcessingResult,
  Issue,
} from '@/lib/types';

// Worker message types (must match worker file)
type WorkerRequest =
  | {
      type: 'PROCESS';
      payload: {
        shopifyCsv: string;
        supplierCsv: string;
        shopifyFormat?: ShopifyExportFormat;
        supplierMapping: SupplierColumnMapping;
        matchConfig: MatchConfig;
        emergencyMode?: boolean;
      };
    }
  | {
      type: 'PARSE_SHOPIFY';
      payload: {
        csv: string;
        format?: ShopifyExportFormat;
      };
    }
  | {
      type: 'PARSE_SUPPLIER';
      payload: {
        csv: string;
        mapping?: Partial<SupplierColumnMapping>;
      };
    };

type WorkerResponse =
  | {
      type: 'PROGRESS';
      payload: {
        stage: 'parsing-shopify' | 'parsing-supplier' | 'matching' | 'generating';
        percent: number;
        message: string;
      };
    }
  | {
      type: 'SHOPIFY_PARSED';
      payload: {
        format: ShopifyExportFormat;
        locations: string[];
        rowCount: number;
        headers: string[];
        issues: Issue[];
        success: boolean;
      };
    }
  | {
      type: 'SUPPLIER_PARSED';
      payload: {
        rowCount: number;
        headers: string[];
        detectedMapping: {
          sku: number | null;
          qty: number | null;
          location: number | null;
        };
        issues: Issue[];
        success: boolean;
      };
    }
  | {
      type: 'RESULT';
      payload: ProcessingResult;
    }
  | {
      type: 'ERROR';
      payload: {
        message: string;
        code: string;
        details?: unknown;
      };
    };

export interface Progress {
  stage: 'idle' | 'parsing-shopify' | 'parsing-supplier' | 'matching' | 'generating';
  percent: number;
  message: string;
}

export interface ShopifyParseResult {
  format: ShopifyExportFormat;
  locations: string[];
  rowCount: number;
  headers: string[];
  issues: Issue[];
  success: boolean;
}

export interface SupplierParseResult {
  rowCount: number;
  headers: string[];
  detectedMapping: {
    sku: number | null;
    qty: number | null;
    location: number | null;
  };
  issues: Issue[];
  success: boolean;
}

export function useInventoryWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    stage: 'idle',
    percent: 0,
    message: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Callbacks for different response types
  const shopifyCallbackRef = useRef<((result: ShopifyParseResult) => void) | null>(null);
  const supplierCallbackRef = useRef<((result: SupplierParseResult) => void) | null>(null);
  const processCallbackRef = useRef<((result: ProcessingResult) => void) | null>(null);

  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(
      new URL('../lib/worker/inventoryWorker.ts', import.meta.url)
    );

    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'PROGRESS':
          setProgress({
            stage: payload.stage,
            percent: payload.percent,
            message: payload.message,
          });
          break;

        case 'SHOPIFY_PARSED':
          setIsProcessing(false);
          setProgress({ stage: 'idle', percent: 0, message: '' });
          if (shopifyCallbackRef.current) {
            shopifyCallbackRef.current(payload);
            shopifyCallbackRef.current = null;
          }
          break;

        case 'SUPPLIER_PARSED':
          setIsProcessing(false);
          setProgress({ stage: 'idle', percent: 0, message: '' });
          if (supplierCallbackRef.current) {
            supplierCallbackRef.current(payload);
            supplierCallbackRef.current = null;
          }
          break;

        case 'RESULT':
          setIsProcessing(false);
          setProgress({ stage: 'idle', percent: 0, message: '' });
          if (processCallbackRef.current) {
            processCallbackRef.current(payload);
            processCallbackRef.current = null;
          }
          break;

        case 'ERROR':
          setIsProcessing(false);
          setProgress({ stage: 'idle', percent: 0, message: '' });
          setError(payload.message);
          // Reset all callbacks
          shopifyCallbackRef.current = null;
          supplierCallbackRef.current = null;
          processCallbackRef.current = null;
          break;
      }
    };

    workerRef.current.onerror = (event) => {
      setIsProcessing(false);
      setError(`Worker error: ${event.message}`);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const parseShopify = useCallback(
    (csv: string, format?: ShopifyExportFormat): Promise<ShopifyParseResult> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        setIsProcessing(true);
        setError(null);
        setProgress({ stage: 'parsing-shopify', percent: 0, message: 'Parsing Shopify file...' });

        shopifyCallbackRef.current = resolve;

        workerRef.current.postMessage({
          type: 'PARSE_SHOPIFY',
          payload: { csv, format },
        } as WorkerRequest);
      });
    },
    []
  );

  const parseSupplier = useCallback(
    (csv: string, mapping?: Partial<SupplierColumnMapping>): Promise<SupplierParseResult> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        setIsProcessing(true);
        setError(null);
        setProgress({ stage: 'parsing-supplier', percent: 0, message: 'Parsing supplier file...' });

        supplierCallbackRef.current = resolve;

        workerRef.current.postMessage({
          type: 'PARSE_SUPPLIER',
          payload: { csv, mapping },
        } as WorkerRequest);
      });
    },
    []
  );

  const process = useCallback(
    (params: {
      shopifyCsv: string;
      supplierCsv: string;
      shopifyFormat?: ShopifyExportFormat;
      supplierMapping: SupplierColumnMapping;
      matchConfig: MatchConfig;
      emergencyMode?: boolean;
    }): Promise<ProcessingResult> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        setIsProcessing(true);
        setError(null);
        setProgress({ stage: 'parsing-shopify', percent: 0, message: 'Starting...' });

        processCallbackRef.current = resolve;

        workerRef.current.postMessage({
          type: 'PROCESS',
          payload: params,
        } as WorkerRequest);
      });
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    parseShopify,
    parseSupplier,
    process,
    isProcessing,
    progress,
    error,
    clearError,
  };
}
