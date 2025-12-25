/**
 * Core types for OnHand Helper
 * Shopify Inventory CSV "preflight + supplier matcher" tool
 */

// ============================================================================
// Shopify Inventory Types
// ============================================================================

export type ShopifyExportFormat = 'all_states' | 'available';

export interface ShopifyInventoryRow {
  /** Product handle from Shopify */
  handle: string;
  /** Location name (for All states format) */
  location: string | null;
  /** Product SKU */
  sku: string;
  /** Title of the product */
  title: string | null;
  /** Vendor name */
  vendor: string | null;
  /** Option values for variant identification */
  options: Array<{ name: string; value: string }>;
  /** Raw On hand (current) value - could be number or "Not stocked" */
  onHandCurrentRaw: string | null;
  /** Parsed On hand (current) as number, null if "Not stocked" or missing */
  onHandCurrent: number | null;
  /** On hand (new) value to be set */
  onHandNewRaw: string | null;
  /** Available quantity (for Available format, per location) */
  availableByLocation: Record<string, string | null>;
  /** Original raw row data */
  rawRow: Record<string, string>;
  /** Row index in source file (0-based, excluding header) */
  rowIndex: number;
}

export interface ShopifyInventoryFile {
  format: ShopifyExportFormat;
  /** Detected locations from the file */
  locations: string[];
  /** All rows parsed from the file */
  rows: ShopifyInventoryRow[];
  /** Original column headers */
  headers: string[];
  /** Column indices for key fields */
  columnMapping: ShopifyColumnMapping;
}

export interface ShopifyColumnMapping {
  handle: number;
  sku: number;
  title: number | null;
  vendor: number | null;
  location: number | null;
  onHandCurrent: number | null;
  onHandNew: number | null;
  /** For Available format: location name -> column index */
  locationColumns: Record<string, number>;
  /** Option columns */
  options: Array<{ nameIndex: number; valueIndex: number }>;
}

// ============================================================================
// Supplier Feed Types
// ============================================================================

export interface SupplierRow {
  /** SKU from supplier feed */
  sku: string;
  /** Quantity from supplier feed */
  qty: number;
  /** Raw quantity string before parsing */
  qtyRaw: string;
  /** Optional location/warehouse identifier */
  location: string | null;
  /** Original raw row data */
  rawRow: Record<string, string>;
  /** Row index in source file (0-based, excluding header) */
  rowIndex: number;
}

export interface SupplierFile {
  rows: SupplierRow[];
  headers: string[];
  /** User-selected column mappings */
  columnMapping: SupplierColumnMapping;
}

export interface SupplierColumnMapping {
  sku: number;
  qty: number;
  location: number | null;
}

// ============================================================================
// Matching Types
// ============================================================================

export type MatchType = 'exact' | 'normalized' | 'fuzzy';

export type MatchStatus =
  | 'matched'           // Clean match
  | 'needs_review'      // Fuzzy match below threshold
  | 'ambiguous'         // Multiple candidates
  | 'unmatched'         // No match found
  | 'duplicate'         // Duplicate SKU in source
  | 'invalid';          // Invalid data (e.g., non-numeric qty)

export interface MatchResult {
  /** Supplier SKU that was matched */
  supplierSku: string;
  /** Supplier row index */
  supplierRowIndex: number;
  /** Matched Shopify row references (can be multiple for multi-location) */
  shopifyRowRefs: Array<{
    rowIndex: number;
    handle: string;
    location: string | null;
    sku: string;
  }>;
  /** Match confidence score (0-100) */
  score: number;
  /** Type of match */
  matchType: MatchType;
  /** Status of this match */
  status: MatchStatus;
  /** New quantity to set */
  newQuantity: number | null;
  /** Quantity change (delta) */
  delta: number | null;
  /** Reason for status if not matched */
  reason?: string;
}

export interface MatchConfig {
  /** Match strategies to use in order */
  strategies: MatchType[];
  /** Normalize SKUs (case, whitespace, separators) */
  normalizeSkus: boolean;
  /** Remove separators (-_.) during normalization */
  removeSeparators: boolean;
  /** Fuzzy match auto-accept threshold (0-100) */
  fuzzyAutoThreshold: number;
  /** Fuzzy match review threshold (0-100) */
  fuzzyReviewThreshold: number;
  /** Maximum candidates to consider for fuzzy matching */
  fuzzyMaxCandidates: number;
  /** Quantity mode */
  quantityMode: 'absolute' | 'delta';
  /** Locations to update (empty = all) */
  locationsToUpdate: string[];
  /** How to handle duplicate supplier SKUs */
  duplicateStrategy: 'last_wins' | 'max_qty' | 'sum_qty' | 'error';
}

// ============================================================================
// Validation Types
// ============================================================================

export type IssueSeverity = 'error' | 'warning' | 'info';
export type IssueFile = 'shopify' | 'supplier' | 'output';

export interface Issue {
  /** Unique ID for this issue */
  id: string;
  /** Severity level */
  severity: IssueSeverity;
  /** Which file the issue relates to */
  file: IssueFile;
  /** Row index in source file (null for file-level issues) */
  rowIndex: number | null;
  /** Column name if applicable */
  column: string | null;
  /** Human-readable message */
  message: string;
  /** Suggested fix */
  suggestedFix: string | null;
  /** Issue code for programmatic handling */
  code: IssueCode;
  /** Additional context data */
  context?: Record<string, unknown>;
}

export type IssueCode =
  // Shopify file issues
  | 'MISSING_REQUIRED_COLUMN'
  | 'INVALID_QUANTITY_FORMAT'
  | 'BLANK_SKU'
  | 'DUPLICATE_SKU_LOCATION'
  | 'EDITED_WRONG_COLUMN'
  | 'LOCATION_CASE_MISMATCH'
  | 'UNKNOWN_FORMAT'
  | 'FILE_TOO_LARGE'
  // Supplier file issues
  | 'SUPPLIER_MISSING_SKU_COLUMN'
  | 'SUPPLIER_MISSING_QTY_COLUMN'
  | 'SUPPLIER_DECIMAL_QTY'
  | 'SUPPLIER_DUPLICATE_SKU'
  | 'SUPPLIER_BLANK_SKU'
  | 'SUPPLIER_SUSPICIOUS_QTY'
  | 'SUPPLIER_NEGATIVE_QTY'
  // Matching issues
  | 'NO_MATCH'
  | 'AMBIGUOUS_MATCH'
  | 'FUZZY_MATCH_REVIEW'
  | 'LARGE_DELTA'
  | 'DROPPING_TO_ZERO'
  | 'NEGATIVE_RESULT'
  // General
  | 'PARSE_ERROR'
  | 'EMERGENCY_MODE_ENABLED';

// ============================================================================
// Output Types
// ============================================================================

export interface ProcessingResult {
  /** Generated Shopify import CSV content */
  shopifyImportCsv: string;
  /** Unmatched supplier SKUs report */
  unmatchedSupplierCsv: string;
  /** Unmatched Shopify SKUs report */
  unmatchedShopifyCsv: string;
  /** Issues report CSV */
  issuesCsv: string;
  /** Ambiguous matches CSV */
  ambiguousCsv: string;
  /** HTML summary report */
  summaryHtml: string;
  /** All issues found */
  issues: Issue[];
  /** Summary statistics */
  summary: ProcessingSummary;
  /** All match results */
  matches: MatchResult[];
}

export interface ProcessingSummary {
  /** Total Shopify rows */
  totalShopifyRows: number;
  /** Total supplier rows */
  totalSupplierRows: number;
  /** Number of successful matches */
  matchedCount: number;
  /** Number of rows that will be updated */
  updatedCount: number;
  /** Number of rows unchanged (same value) */
  unchangedCount: number;
  /** Number of unmatched supplier SKUs */
  unmatchedSupplierCount: number;
  /** Number of Shopify SKUs not in supplier feed */
  unmatchedShopifyCount: number;
  /** Number of ambiguous matches */
  ambiguousCount: number;
  /** Number of errors */
  errorCount: number;
  /** Number of warnings */
  warningCount: number;
  /** Match rate percentage */
  matchRate: number;
  /** Locations processed */
  locationsProcessed: string[];
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

// ============================================================================
// Worker Types (UI Thread <-> Worker Communication)
// ============================================================================

export type WorkerMessageType =
  | 'PARSE_SHOPIFY'
  | 'PARSE_SUPPLIER'
  | 'RUN_MATCHING'
  | 'PARSE_PROGRESS'
  | 'MATCH_PROGRESS'
  | 'RESULT'
  | 'ERROR';

export interface WorkerMessage {
  type: WorkerMessageType;
  payload: unknown;
}

export interface ParseProgressPayload {
  file: 'shopify' | 'supplier';
  rowsParsed: number;
  totalRows: number;
  percentComplete: number;
}

export interface MatchProgressPayload {
  matchedCount: number;
  processedCount: number;
  totalCount: number;
  percentComplete: number;
}

export interface WorkerResultPayload {
  result: ProcessingResult;
}

export interface WorkerErrorPayload {
  message: string;
  code: string;
  details?: unknown;
}

// ============================================================================
// UI State Types
// ============================================================================

export type WizardStep = 'upload-shopify' | 'upload-supplier' | 'configure' | 'results';

export interface WizardState {
  currentStep: WizardStep;
  shopifyFile: File | null;
  shopifyData: ShopifyInventoryFile | null;
  supplierFile: File | null;
  supplierData: SupplierFile | null;
  supplierColumnMapping: Partial<SupplierColumnMapping>;
  matchConfig: MatchConfig;
  result: ProcessingResult | null;
  isProcessing: boolean;
  progress: {
    stage: 'idle' | 'parsing-shopify' | 'parsing-supplier' | 'matching' | 'generating';
    percent: number;
    message: string;
  };
  error: string | null;
  /** Emergency mode (skip safety validation) */
  emergencyMode: boolean;
  /** User confirmation for emergency mode */
  emergencyModeConfirmed: boolean;
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  strategies: ['exact', 'normalized'],
  normalizeSkus: true,
  removeSeparators: false,
  fuzzyAutoThreshold: 92,
  fuzzyReviewThreshold: 80,
  fuzzyMaxCandidates: 50,
  quantityMode: 'absolute',
  locationsToUpdate: [],
  duplicateStrategy: 'last_wins',
};

export const SHOPIFY_REQUIRED_COLUMNS_ALL_STATES = ['Handle'] as const;
export const SHOPIFY_ID_COLUMNS = ['SKU', 'Handle'] as const;
export const SHOPIFY_INVENTORY_COLUMNS = ['On hand (current)', 'On hand (new)'] as const;

/** Maximum file size in bytes (15MB as per Shopify limit) */
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

/** Suspicious quantity threshold */
export const SUSPICIOUS_QTY_THRESHOLD = 1_000_000;

/** Large delta warning threshold (percentage) */
export const LARGE_DELTA_PERCENT = 90;
