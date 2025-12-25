/**
 * Shopify Inventory CSV Parser
 * Handles both "All states" and "Available" export formats
 */

import Papa from 'papaparse';
import type {
  ShopifyInventoryFile,
  ShopifyInventoryRow,
  ShopifyColumnMapping,
  ShopifyExportFormat,
  Issue,
} from '../types';

// Known Shopify inventory column names
const KNOWN_COLUMNS = {
  handle: 'Handle',
  title: 'Title',
  vendor: 'Vendor',
  sku: 'SKU',
  location: 'Location',
  onHandCurrent: 'On hand (current)',
  onHandNew: 'On hand (new)',
  available: 'Available',
  committed: 'Committed',
  incoming: 'Incoming',
  unavailable: 'Unavailable',
} as const;

// Option column patterns
const OPTION_NAME_PATTERN = /^Option(\d+) Name$/i;
const OPTION_VALUE_PATTERN = /^Option(\d+) Value$/i;

interface ParseResult {
  data: ShopifyInventoryFile | null;
  issues: Issue[];
  success: boolean;
}

/**
 * Detect the Shopify export format based on column headers
 */
export function detectShopifyFormat(headers: string[]): {
  format: ShopifyExportFormat | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
} {
  const headerSet = new Set(headers.map(h => h.toLowerCase().trim()));
  const hasLocation = headers.some(h => h.toLowerCase().trim() === 'location');
  const hasOnHandCurrent = headers.some(h => h.toLowerCase().trim() === 'on hand (current)');
  const hasOnHandNew = headers.some(h => h.toLowerCase().trim() === 'on hand (new)');
  const hasHandle = headerSet.has('handle');

  // All states format detection
  if (hasLocation && hasOnHandCurrent && hasOnHandNew) {
    return {
      format: 'all_states',
      confidence: 'high',
      reason: 'Found Location, On hand (current), and On hand (new) columns',
    };
  }

  // Available format detection - no Location column, but multiple columns that could be location names
  if (!hasLocation && hasHandle) {
    // Look for patterns typical of Available format
    // Exclude known non-location columns
    const knownNonLocationColumns = new Set([
      'handle', 'title', 'vendor', 'sku', 'option1 name', 'option1 value',
      'option2 name', 'option2 value', 'option3 name', 'option3 value',
      'on hand (current)', 'on hand (new)', 'available', 'committed',
      'incoming', 'unavailable',
    ]);

    const potentialLocationColumns = headers.filter(h => {
      const lower = h.toLowerCase().trim();
      return !knownNonLocationColumns.has(lower) &&
             !OPTION_NAME_PATTERN.test(h) &&
             !OPTION_VALUE_PATTERN.test(h);
    });

    if (potentialLocationColumns.length > 0) {
      return {
        format: 'available',
        confidence: 'medium',
        reason: `No Location column, found ${potentialLocationColumns.length} potential location columns: ${potentialLocationColumns.slice(0, 3).join(', ')}`,
      };
    }
  }

  // Fallback: try to guess based on available columns
  if (hasLocation) {
    return {
      format: 'all_states',
      confidence: 'low',
      reason: 'Has Location column but missing expected On hand columns',
    };
  }

  return {
    format: null,
    confidence: 'low',
    reason: 'Could not detect format from column headers',
  };
}

/**
 * Build column mapping from headers
 */
function buildColumnMapping(headers: string[], format: ShopifyExportFormat): ShopifyColumnMapping {
  const mapping: ShopifyColumnMapping = {
    handle: -1,
    sku: -1,
    title: null,
    vendor: null,
    location: null,
    onHandCurrent: null,
    onHandNew: null,
    locationColumns: {},
    options: [],
  };

  // Map basic columns
  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().trim();

    switch (normalized) {
      case 'handle':
        mapping.handle = index;
        break;
      case 'sku':
        mapping.sku = index;
        break;
      case 'title':
        mapping.title = index;
        break;
      case 'vendor':
        mapping.vendor = index;
        break;
      case 'location':
        mapping.location = index;
        break;
      case 'on hand (current)':
        mapping.onHandCurrent = index;
        break;
      case 'on hand (new)':
        mapping.onHandNew = index;
        break;
    }
  });

  // Map option columns
  const optionNameIndices: Record<number, number> = {};
  const optionValueIndices: Record<number, number> = {};

  headers.forEach((header, index) => {
    const nameMatch = header.match(OPTION_NAME_PATTERN);
    if (nameMatch) {
      optionNameIndices[parseInt(nameMatch[1])] = index;
    }
    const valueMatch = header.match(OPTION_VALUE_PATTERN);
    if (valueMatch) {
      optionValueIndices[parseInt(valueMatch[1])] = index;
    }
  });

  // Combine option name/value pairs
  for (const optNum of Object.keys(optionNameIndices).map(Number).sort((a, b) => a - b)) {
    if (optionValueIndices[optNum] !== undefined) {
      mapping.options.push({
        nameIndex: optionNameIndices[optNum],
        valueIndex: optionValueIndices[optNum],
      });
    }
  }

  // For Available format, detect location columns
  if (format === 'available') {
    const knownColumns = new Set([
      mapping.handle,
      mapping.sku,
      mapping.title,
      mapping.vendor,
      mapping.location,
      mapping.onHandCurrent,
      mapping.onHandNew,
      ...mapping.options.flatMap(o => [o.nameIndex, o.valueIndex]),
    ].filter((i): i is number => i !== null && i !== -1));

    headers.forEach((header, index) => {
      if (!knownColumns.has(index)) {
        // This is likely a location column
        mapping.locationColumns[header] = index;
      }
    });
  }

  return mapping;
}

/**
 * Extract locations from parsed data
 */
function extractLocations(
  rows: Record<string, string>[],
  mapping: ShopifyColumnMapping,
  format: ShopifyExportFormat
): string[] {
  if (format === 'available') {
    return Object.keys(mapping.locationColumns);
  }

  if (mapping.location === null) {
    return [];
  }

  const locationSet = new Set<string>();
  for (const row of rows) {
    const headers = Object.keys(row);
    if (mapping.location < headers.length) {
      const location = row[headers[mapping.location]];
      if (location && location.trim()) {
        locationSet.add(location.trim());
      }
    }
  }
  return Array.from(locationSet).sort();
}

/**
 * Parse a single row into ShopifyInventoryRow
 */
function parseRow(
  rawRow: Record<string, string>,
  headers: string[],
  mapping: ShopifyColumnMapping,
  format: ShopifyExportFormat,
  rowIndex: number
): ShopifyInventoryRow {
  const getValue = (index: number | null): string | null => {
    if (index === null || index === -1) return null;
    return rawRow[headers[index]] ?? null;
  };

  const handle = getValue(mapping.handle) || '';
  const sku = getValue(mapping.sku) || '';
  const title = getValue(mapping.title);
  const vendor = getValue(mapping.vendor);
  const location = getValue(mapping.location);
  const onHandCurrentRaw = getValue(mapping.onHandCurrent);
  const onHandNewRaw = getValue(mapping.onHandNew);

  // Parse options
  const options: Array<{ name: string; value: string }> = [];
  for (const opt of mapping.options) {
    const name = rawRow[headers[opt.nameIndex]] || '';
    const value = rawRow[headers[opt.valueIndex]] || '';
    if (name || value) {
      options.push({ name, value });
    }
  }

  // Parse On hand (current)
  let onHandCurrent: number | null = null;
  if (onHandCurrentRaw !== null && onHandCurrentRaw.toLowerCase() !== 'not stocked') {
    const parsed = parseFloat(onHandCurrentRaw);
    if (!isNaN(parsed)) {
      onHandCurrent = Math.round(parsed);
    }
  }

  // Build available by location for Available format
  const availableByLocation: Record<string, string | null> = {};
  if (format === 'available') {
    for (const [locName, colIndex] of Object.entries(mapping.locationColumns)) {
      availableByLocation[locName] = rawRow[headers[colIndex]] ?? null;
    }
  }

  return {
    handle,
    location,
    sku,
    title,
    vendor,
    options,
    onHandCurrentRaw,
    onHandCurrent,
    onHandNewRaw,
    availableByLocation,
    rawRow,
    rowIndex,
  };
}

/**
 * Main parsing function for Shopify Inventory CSV
 */
export function parseShopifyInventoryCsv(
  csvContent: string,
  formatOverride?: ShopifyExportFormat
): ParseResult {
  const issues: Issue[] = [];
  let issueId = 0;

  // Parse CSV with PapaParse
  const parseResult = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    // Disable dynamic typing to preserve SKUs with leading zeros
    dynamicTyping: false,
  });

  if (parseResult.errors.length > 0) {
    for (const error of parseResult.errors) {
      issues.push({
        id: `issue-${++issueId}`,
        severity: error.type === 'FieldMismatch' ? 'warning' : 'error',
        file: 'shopify',
        rowIndex: error.row ?? null,
        column: null,
        message: error.message,
        suggestedFix: 'Check the CSV file format and ensure it was exported correctly from Shopify',
        code: 'PARSE_ERROR',
      });
    }
  }

  const headers = parseResult.meta.fields || [];

  if (headers.length === 0) {
    issues.push({
      id: `issue-${++issueId}`,
      severity: 'error',
      file: 'shopify',
      rowIndex: null,
      column: null,
      message: 'No headers found in CSV file',
      suggestedFix: 'Ensure the file is a valid CSV with headers in the first row',
      code: 'PARSE_ERROR',
    });
    return { data: null, issues, success: false };
  }

  // Detect or use override format
  let format: ShopifyExportFormat;
  if (formatOverride) {
    format = formatOverride;
  } else {
    const detection = detectShopifyFormat(headers);
    if (!detection.format) {
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'error',
        file: 'shopify',
        rowIndex: null,
        column: null,
        message: 'Could not determine Shopify export format. ' + detection.reason,
        suggestedFix: 'Please select the format manually or ensure the file was exported from Shopify Admin > Products > Inventory',
        code: 'UNKNOWN_FORMAT',
      });
      return { data: null, issues, success: false };
    }
    format = detection.format;

    if (detection.confidence !== 'high') {
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'warning',
        file: 'shopify',
        rowIndex: null,
        column: null,
        message: `Format detection confidence: ${detection.confidence}. ${detection.reason}`,
        suggestedFix: 'Verify the detected format is correct or select manually',
        code: 'UNKNOWN_FORMAT',
      });
    }
  }

  // Build column mapping
  const mapping = buildColumnMapping(headers, format);

  // Validate required columns
  if (mapping.handle === -1) {
    issues.push({
      id: `issue-${++issueId}`,
      severity: 'error',
      file: 'shopify',
      rowIndex: null,
      column: 'Handle',
      message: 'Required column "Handle" not found',
      suggestedFix: 'Ensure the file contains a "Handle" column',
      code: 'MISSING_REQUIRED_COLUMN',
    });
  }

  if (mapping.sku === -1) {
    issues.push({
      id: `issue-${++issueId}`,
      severity: 'warning',
      file: 'shopify',
      rowIndex: null,
      column: 'SKU',
      message: 'Column "SKU" not found. Will try to match using handle + options.',
      suggestedFix: 'Add SKUs to your products for reliable matching',
      code: 'MISSING_REQUIRED_COLUMN',
    });
  }

  // All states format specific validation
  if (format === 'all_states') {
    if (mapping.location === null) {
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'error',
        file: 'shopify',
        rowIndex: null,
        column: 'Location',
        message: 'Required column "Location" not found for All states format',
        suggestedFix: 'Ensure you exported using "Export > All states"',
        code: 'MISSING_REQUIRED_COLUMN',
      });
    }

    if (mapping.onHandCurrent === null || mapping.onHandNew === null) {
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'warning',
        file: 'shopify',
        rowIndex: null,
        column: mapping.onHandCurrent === null ? 'On hand (current)' : 'On hand (new)',
        message: 'Expected columns "On hand (current)" and "On hand (new)" not found',
        suggestedFix: 'This may be an older export format. Processing will continue but results may differ.',
        code: 'MISSING_REQUIRED_COLUMN',
      });
    }
  }

  // Check for critical errors before parsing rows
  const hasErrors = issues.some(i => i.severity === 'error');
  if (hasErrors && mapping.handle === -1) {
    return { data: null, issues, success: false };
  }

  // Parse all rows
  const rows: ShopifyInventoryRow[] = [];
  for (let i = 0; i < parseResult.data.length; i++) {
    const rawRow = parseResult.data[i];
    const row = parseRow(rawRow, headers, mapping, format, i);
    rows.push(row);

    // Validate each row
    if (!row.sku && !row.handle) {
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'warning',
        file: 'shopify',
        rowIndex: i,
        column: 'SKU',
        message: 'Row has no SKU and no Handle - cannot be matched',
        suggestedFix: 'Add a SKU or Handle to identify this row',
        code: 'BLANK_SKU',
      });
    }

    // Check for invalid quantity formats
    if (row.onHandCurrentRaw &&
        row.onHandCurrentRaw.toLowerCase() !== 'not stocked' &&
        isNaN(parseFloat(row.onHandCurrentRaw))) {
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'error',
        file: 'shopify',
        rowIndex: i,
        column: 'On hand (current)',
        message: `Invalid quantity format: "${row.onHandCurrentRaw}"`,
        suggestedFix: 'Quantities must be whole numbers or "Not stocked"',
        code: 'INVALID_QUANTITY_FORMAT',
      });
    }

    // Check if On hand (new) was already filled (might indicate edited wrong file)
    if (row.onHandNewRaw && row.onHandNewRaw.trim() !== '') {
      issues.push({
        id: `issue-${++issueId}`,
        severity: 'info',
        file: 'shopify',
        rowIndex: i,
        column: 'On hand (new)',
        message: `"On hand (new)" already has a value: "${row.onHandNewRaw}". This will be overwritten.`,
        suggestedFix: null,
        code: 'EDITED_WRONG_COLUMN',
      });
    }
  }

  // Extract locations
  const locations = extractLocations(parseResult.data, mapping, format);

  return {
    data: {
      format,
      locations,
      rows,
      headers,
      columnMapping: mapping,
    },
    issues,
    success: true,
  };
}

/**
 * Validate that user hasn't edited non-editable columns
 */
export function checkForEditedNonEditableColumns(
  file: ShopifyInventoryFile
): Issue[] {
  const issues: Issue[] = [];
  let issueId = 0;

  if (file.format !== 'all_states') {
    return issues;
  }

  // In All states format, only On hand (new) should be edited
  // Check if Available, Committed, Incoming, Unavailable have been modified
  const nonEditableColumns = ['Available', 'Committed', 'Incoming', 'Unavailable'];

  for (const row of file.rows) {
    for (const colName of nonEditableColumns) {
      const value = row.rawRow[colName];
      // Can't know if it was "edited" without comparing to original,
      // but we can warn if non-numeric values are present
      if (value && isNaN(parseFloat(value)) && value.toLowerCase() !== 'not stocked') {
        issues.push({
          id: `issue-${++issueId}`,
          severity: 'warning',
          file: 'shopify',
          rowIndex: row.rowIndex,
          column: colName,
          message: `Column "${colName}" contains unexpected value "${value}". This column should not be edited manually.`,
          suggestedFix: 'Only edit the "On hand (new)" column. Other inventory columns are calculated by Shopify.',
          code: 'EDITED_WRONG_COLUMN',
        });
      }
    }
  }

  return issues;
}
