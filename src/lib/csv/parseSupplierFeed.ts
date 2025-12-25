/**
 * Supplier Feed CSV Parser
 * Handles various supplier/POS stock feed formats
 */

import Papa from 'papaparse';
import type {
  SupplierFile,
  SupplierRow,
  SupplierColumnMapping,
  Issue,
} from '../types';
import { SUSPICIOUS_QTY_THRESHOLD } from '../types';

interface ParseResult {
  data: SupplierFile | null;
  issues: Issue[];
  success: boolean;
}

interface ColumnDetection {
  skuColumn: number | null;
  qtyColumn: number | null;
  locationColumn: number | null;
  confidence: Record<string, 'high' | 'medium' | 'low'>;
}

// Common patterns for SKU columns
const SKU_PATTERNS = [
  /^sku$/i,
  /^product.?sku$/i,
  /^item.?sku$/i,
  /^article.?number$/i,
  /^article.?no$/i,
  /^item.?number$/i,
  /^item.?no$/i,
  /^item.?code$/i,
  /^product.?code$/i,
  /^part.?number$/i,
  /^part.?no$/i,
  /^upc$/i,
  /^ean$/i,
  /^barcode$/i,
  /^mpn$/i,
];

// Common patterns for quantity columns
const QTY_PATTERNS = [
  /^qty$/i,
  /^quantity$/i,
  /^stock$/i,
  /^stock.?qty$/i,
  /^stock.?quantity$/i,
  /^on.?hand$/i,
  /^available$/i,
  /^available.?qty$/i,
  /^available.?quantity$/i,
  /^inventory$/i,
  /^count$/i,
  /^units$/i,
];

// Common patterns for location columns
const LOCATION_PATTERNS = [
  /^location$/i,
  /^warehouse$/i,
  /^store$/i,
  /^site$/i,
  /^branch$/i,
  /^loc$/i,
  /^wh$/i,
];

/**
 * Auto-detect column mappings from headers
 */
export function detectSupplierColumns(headers: string[]): ColumnDetection {
  const result: ColumnDetection = {
    skuColumn: null,
    qtyColumn: null,
    locationColumn: null,
    confidence: {},
  };

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim();

    // Check SKU patterns
    if (result.skuColumn === null) {
      for (const pattern of SKU_PATTERNS) {
        if (pattern.test(header)) {
          result.skuColumn = i;
          result.confidence.sku = SKU_PATTERNS.indexOf(pattern) < 3 ? 'high' : 'medium';
          break;
        }
      }
    }

    // Check QTY patterns
    if (result.qtyColumn === null) {
      for (const pattern of QTY_PATTERNS) {
        if (pattern.test(header)) {
          result.qtyColumn = i;
          result.confidence.qty = QTY_PATTERNS.indexOf(pattern) < 4 ? 'high' : 'medium';
          break;
        }
      }
    }

    // Check location patterns
    if (result.locationColumn === null) {
      for (const pattern of LOCATION_PATTERNS) {
        if (pattern.test(header)) {
          result.locationColumn = i;
          result.confidence.location = LOCATION_PATTERNS.indexOf(pattern) < 3 ? 'high' : 'medium';
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Parse a quantity value, handling various formats
 */
function parseQuantity(value: string): { qty: number | null; isDecimal: boolean; isNegative: boolean } {
  if (!value || value.trim() === '') {
    return { qty: null, isDecimal: false, isNegative: false };
  }

  // Remove common formatting
  let cleaned = value.trim()
    .replace(/,/g, '') // Remove thousand separators
    .replace(/\s/g, ''); // Remove whitespace

  // Check for negative
  const isNegative = cleaned.startsWith('-') || cleaned.startsWith('(');
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = cleaned.slice(1, -1);
  }

  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    return { qty: null, isDecimal: false, isNegative: false };
  }

  const isDecimal = !Number.isInteger(parsed);

  return {
    qty: isNegative && parsed > 0 ? -parsed : parsed,
    isDecimal,
    isNegative: parsed < 0,
  };
}

/**
 * Main parsing function for supplier feed CSV
 */
export function parseSupplierFeedCsv(
  csvContent: string,
  columnMapping?: Partial<SupplierColumnMapping>,
  options?: {
    delimiter?: string;
    encoding?: string;
  }
): ParseResult {
  const issues: Issue[] = [];
  let issueId = 0;

  // Parse CSV with PapaParse
  const parseResult = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    dynamicTyping: false,
    delimiter: options?.delimiter,
  });

  if (parseResult.errors.length > 0) {
    for (const error of parseResult.errors) {
      issues.push({
        id: `issue-${++issueId}`,
        severity: error.type === 'FieldMismatch' ? 'warning' : 'error',
        file: 'supplier',
        rowIndex: error.row ?? null,
        column: null,
        message: error.message,
        suggestedFix: 'Check the CSV file format',
        code: 'PARSE_ERROR',
      });
    }
  }

  const headers = parseResult.meta.fields || [];

  if (headers.length === 0) {
    issues.push({
      id: `issue-${++issueId}`,
      severity: 'error',
      file: 'supplier',
      rowIndex: null,
      column: null,
      message: 'No headers found in supplier CSV file',
      suggestedFix: 'Ensure the file is a valid CSV with headers in the first row',
      code: 'PARSE_ERROR',
    });
    return { data: null, issues, success: false };
  }

  // Detect or use provided column mapping
  let mapping: SupplierColumnMapping;

  if (columnMapping?.sku !== undefined && columnMapping?.qty !== undefined) {
    mapping = {
      sku: columnMapping.sku,
      qty: columnMapping.qty,
      location: columnMapping.location ?? null,
    };
  } else {
    const detected = detectSupplierColumns(headers);

    if (detected.skuColumn === null) {
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'error',
        file: 'supplier',
        rowIndex: null,
        column: null,
        message: 'Could not detect SKU column. Please map columns manually.',
        suggestedFix: 'Select the column containing product SKUs',
        code: 'SUPPLIER_MISSING_SKU_COLUMN',
      });
    }

    if (detected.qtyColumn === null) {
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'error',
        file: 'supplier',
        rowIndex: null,
        column: null,
        message: 'Could not detect quantity column. Please map columns manually.',
        suggestedFix: 'Select the column containing stock quantities',
        code: 'SUPPLIER_MISSING_QTY_COLUMN',
      });
    }

    if (detected.skuColumn === null || detected.qtyColumn === null) {
      return { data: null, issues, success: false };
    }

    mapping = {
      sku: detected.skuColumn,
      qty: detected.qtyColumn,
      location: detected.locationColumn,
    };
  }

  // Validate mapping indices
  if (mapping.sku < 0 || mapping.sku >= headers.length) {
    issues.push({
      id: `issue-${++issueId}`,
      severity: 'error',
      file: 'supplier',
      rowIndex: null,
      column: null,
      message: `Invalid SKU column index: ${mapping.sku}`,
      suggestedFix: 'Select a valid column for SKU',
      code: 'SUPPLIER_MISSING_SKU_COLUMN',
    });
    return { data: null, issues, success: false };
  }

  if (mapping.qty < 0 || mapping.qty >= headers.length) {
    issues.push({
      id: `issue-${++issueId}`,
      severity: 'error',
      file: 'supplier',
      rowIndex: null,
      column: null,
      message: `Invalid quantity column index: ${mapping.qty}`,
      suggestedFix: 'Select a valid column for quantity',
      code: 'SUPPLIER_MISSING_QTY_COLUMN',
    });
    return { data: null, issues, success: false };
  }

  // Parse all rows
  const rows: SupplierRow[] = [];
  const skuCounts = new Map<string, number>();
  let blankSkuCount = 0;
  let decimalQtyCount = 0;
  let negativeQtyCount = 0;
  let invalidQtyCount = 0;

  for (let i = 0; i < parseResult.data.length; i++) {
    const rawRow = parseResult.data[i];
    const skuValue = rawRow[headers[mapping.sku]] || '';
    const qtyRaw = rawRow[headers[mapping.qty]] || '';
    const locationValue = mapping.location !== null
      ? rawRow[headers[mapping.location]] || null
      : null;

    // Check for blank SKU
    if (!skuValue.trim()) {
      blankSkuCount++;
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'warning',
        file: 'supplier',
        rowIndex: i,
        column: headers[mapping.sku],
        message: 'Blank SKU in supplier feed',
        suggestedFix: 'Add SKU or remove row',
        code: 'SUPPLIER_BLANK_SKU',
      });
      continue; // Skip blank SKUs
    }

    // Track duplicate SKUs
    const normalizedSku = skuValue.trim();
    skuCounts.set(normalizedSku, (skuCounts.get(normalizedSku) || 0) + 1);

    // Parse quantity
    const { qty, isDecimal, isNegative } = parseQuantity(qtyRaw);

    if (qty === null) {
      invalidQtyCount++;
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'error',
        file: 'supplier',
        rowIndex: i,
        column: headers[mapping.qty],
        message: `Invalid quantity value: "${qtyRaw}"`,
        suggestedFix: 'Quantity must be a number',
        code: 'INVALID_QUANTITY_FORMAT',
      });
      continue;
    }

    if (isDecimal) {
      decimalQtyCount++;
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'error',
        file: 'supplier',
        rowIndex: i,
        column: headers[mapping.qty],
        message: `Decimal quantity not allowed: "${qtyRaw}". Shopify requires whole numbers.`,
        suggestedFix: 'Round the quantity to a whole number',
        code: 'SUPPLIER_DECIMAL_QTY',
      });
    }

    if (isNegative) {
      negativeQtyCount++;
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'warning',
        file: 'supplier',
        rowIndex: i,
        column: headers[mapping.qty],
        message: `Negative quantity: ${qty}`,
        suggestedFix: 'Verify this is intentional',
        code: 'SUPPLIER_NEGATIVE_QTY',
      });
    }

    if (qty > SUSPICIOUS_QTY_THRESHOLD) {
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'warning',
        file: 'supplier',
        rowIndex: i,
        column: headers[mapping.qty],
        message: `Suspiciously high quantity: ${qty.toLocaleString()}`,
        suggestedFix: 'Verify this quantity is correct',
        code: 'SUPPLIER_SUSPICIOUS_QTY',
      });
    }

    rows.push({
      sku: normalizedSku,
      qty: Math.round(qty),
      qtyRaw,
      location: locationValue?.trim() || null,
      rawRow,
      rowIndex: i,
    });
  }

  // Report duplicate SKUs
  for (const [sku, count] of skuCounts.entries()) {
    if (count > 1) {
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'warning',
        file: 'supplier',
        rowIndex: null,
        column: headers[mapping.sku],
        message: `Duplicate SKU "${sku}" appears ${count} times`,
        suggestedFix: 'Choose how to handle duplicates (last wins, max qty, sum qty)',
        code: 'SUPPLIER_DUPLICATE_SKU',
        context: { sku, count },
      });
    }
  }

  // Add summary issues
  if (blankSkuCount > 0) {
    issues.push({
      id: `issue-${++issueId}`,
      severity: 'info',
      file: 'supplier',
      rowIndex: null,
      column: null,
      message: `${blankSkuCount} rows skipped due to blank SKUs`,
      suggestedFix: null,
      code: 'SUPPLIER_BLANK_SKU',
    });
  }

  if (decimalQtyCount > 0) {
    issues.push({
      id: `issue-${++issueId}`,
      severity: 'info',
      file: 'supplier',
      rowIndex: null,
      column: null,
      message: `${decimalQtyCount} rows have decimal quantities that will be rounded`,
      suggestedFix: null,
      code: 'SUPPLIER_DECIMAL_QTY',
    });
  }

  // Check SKU fill rate
  const totalRows = parseResult.data.length;
  const validSkuRate = (rows.length / totalRows) * 100;
  if (validSkuRate < 95) {
    issues.push({
      id: `issue-${++issueId}`,
      severity: 'warning',
      file: 'supplier',
      rowIndex: null,
      column: null,
      message: `Only ${validSkuRate.toFixed(1)}% of rows have valid SKUs`,
      suggestedFix: 'Check if the correct SKU column is mapped',
      code: 'SUPPLIER_BLANK_SKU',
    });
  }

  const success = !issues.some(i => i.severity === 'error' && i.code !== 'SUPPLIER_DECIMAL_QTY');

  return {
    data: {
      rows,
      headers,
      columnMapping: mapping,
    },
    issues,
    success,
  };
}

/**
 * Get column options for UI dropdown
 */
export function getColumnOptions(headers: string[]): Array<{ value: number; label: string }> {
  return headers.map((header, index) => ({
    value: index,
    label: header || `Column ${index + 1}`,
  }));
}

/**
 * Preview first N rows of parsed data
 */
export function getPreviewRows(
  csvContent: string,
  limit: number = 5
): { headers: string[]; rows: Record<string, string>[]; totalRows: number } {
  const parseResult = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    dynamicTyping: false,
    preview: limit + 1, // +1 for header
  });

  // Get total rows from full parse metadata
  const fullParse = Papa.parse(csvContent, {
    skipEmptyLines: true,
  });

  return {
    headers: parseResult.meta.fields || [],
    rows: parseResult.data.slice(0, limit),
    totalRows: fullParse.data.length - 1, // -1 for header
  };
}
