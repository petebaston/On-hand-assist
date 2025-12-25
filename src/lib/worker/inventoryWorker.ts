/**
 * Inventory Processing Web Worker
 * Handles CSV parsing and matching in a separate thread
 */

import { parseShopifyInventoryCsv } from '../csv/parseShopifyInventory';
import { parseSupplierFeedCsv } from '../csv/parseSupplierFeed';
import { runMatching } from '../match/matchEngine';
import { validateShopifyInventory } from '../validate/shopifyInventoryRules';
import { validateSupplierFeed } from '../validate/supplierRules';
import { generateProcessingResult } from '../output/buildReports';
import type {
  ShopifyExportFormat,
  SupplierColumnMapping,
  MatchConfig,
  Issue,
  ProcessingResult,
} from '../types';

// Worker message types
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

function postMessage(message: WorkerResponse) {
  self.postMessage(message);
}

type ProgressStage = 'parsing-shopify' | 'parsing-supplier' | 'matching' | 'generating';

function postProgress(
  stage: ProgressStage,
  percent: number,
  message: string
) {
  postMessage({
    type: 'PROGRESS',
    payload: { stage, percent, message },
  });
}

/**
 * Handle full processing request
 */
async function handleProcess(payload: Extract<WorkerRequest, { type: 'PROCESS' }>['payload']) {
  const startTime = Date.now();
  const allIssues: Issue[] = [];

  try {
    // Parse Shopify CSV
    postProgress('parsing-shopify', 0, 'Parsing Shopify inventory file...');

    const shopifyResult = parseShopifyInventoryCsv(payload.shopifyCsv, payload.shopifyFormat);
    allIssues.push(...shopifyResult.issues);

    if (!shopifyResult.data) {
      throw new Error('Failed to parse Shopify inventory file');
    }

    postProgress('parsing-shopify', 50, `Parsed ${shopifyResult.data.rows.length} Shopify rows`);

    // Validate Shopify file
    const shopifyValidation = validateShopifyInventory(shopifyResult.data);
    allIssues.push(...shopifyValidation.issues, ...shopifyValidation.warnings, ...shopifyValidation.info);

    postProgress('parsing-shopify', 100, 'Shopify file validated');

    // Parse Supplier CSV
    postProgress('parsing-supplier', 0, 'Parsing supplier feed...');

    const supplierResult = parseSupplierFeedCsv(payload.supplierCsv, payload.supplierMapping);
    allIssues.push(...supplierResult.issues);

    if (!supplierResult.data) {
      throw new Error('Failed to parse supplier feed');
    }

    postProgress('parsing-supplier', 50, `Parsed ${supplierResult.data.rows.length} supplier rows`);

    // Validate Supplier file
    const supplierValidation = validateSupplierFeed(supplierResult.data);
    allIssues.push(...supplierValidation.issues, ...supplierValidation.warnings, ...supplierValidation.info);

    postProgress('parsing-supplier', 100, 'Supplier file validated');

    // Run matching
    postProgress('matching', 0, 'Matching SKUs...');

    const matchResult = runMatching(
      shopifyResult.data,
      supplierResult.data,
      payload.matchConfig,
      (processed, total) => {
        const percent = Math.round((processed / total) * 100);
        postProgress('matching', percent, `Matched ${processed} of ${total} SKUs`);
      }
    );

    allIssues.push(...matchResult.issues);
    postProgress('matching', 100, `Matched ${matchResult.stats.exactMatches + matchResult.stats.normalizedMatches} SKUs`);

    // Generate output
    postProgress('generating', 0, 'Generating output files...');

    const result = generateProcessingResult(
      shopifyResult.data,
      supplierResult.data,
      matchResult.matches,
      allIssues,
      startTime,
      { emergencyMode: payload.emergencyMode }
    );

    postProgress('generating', 100, 'Complete');

    postMessage({
      type: 'RESULT',
      payload: result,
    });
  } catch (error) {
    postMessage({
      type: 'ERROR',
      payload: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'PROCESSING_ERROR',
        details: error,
      },
    });
  }
}

/**
 * Handle Shopify parse request
 */
function handleParseShopify(payload: Extract<WorkerRequest, { type: 'PARSE_SHOPIFY' }>['payload']) {
  try {
    const result = parseShopifyInventoryCsv(payload.csv, payload.format);

    if (result.data) {
      postMessage({
        type: 'SHOPIFY_PARSED',
        payload: {
          format: result.data.format,
          locations: result.data.locations,
          rowCount: result.data.rows.length,
          headers: result.data.headers,
          issues: result.issues,
          success: result.success,
        },
      });
    } else {
      postMessage({
        type: 'SHOPIFY_PARSED',
        payload: {
          format: 'all_states',
          locations: [],
          rowCount: 0,
          headers: [],
          issues: result.issues,
          success: false,
        },
      });
    }
  } catch (error) {
    postMessage({
      type: 'ERROR',
      payload: {
        message: error instanceof Error ? error.message : 'Failed to parse Shopify file',
        code: 'PARSE_ERROR',
      },
    });
  }
}

/**
 * Handle Supplier parse request
 */
function handleParseSupplier(payload: Extract<WorkerRequest, { type: 'PARSE_SUPPLIER' }>['payload']) {
  try {
    const result = parseSupplierFeedCsv(payload.csv, payload.mapping);

    postMessage({
      type: 'SUPPLIER_PARSED',
      payload: {
        rowCount: result.data?.rows.length || 0,
        headers: result.data?.headers || [],
        detectedMapping: {
          sku: result.data?.columnMapping.sku ?? null,
          qty: result.data?.columnMapping.qty ?? null,
          location: result.data?.columnMapping.location ?? null,
        },
        issues: result.issues,
        success: result.success,
      },
    });
  } catch (error) {
    postMessage({
      type: 'ERROR',
      payload: {
        message: error instanceof Error ? error.message : 'Failed to parse supplier file',
        code: 'PARSE_ERROR',
      },
    });
  }
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'PROCESS':
      handleProcess(payload);
      break;
    case 'PARSE_SHOPIFY':
      handleParseShopify(payload);
      break;
    case 'PARSE_SUPPLIER':
      handleParseSupplier(payload);
      break;
  }
};

// Export for type checking (not used at runtime)
export type { WorkerRequest, WorkerResponse };
