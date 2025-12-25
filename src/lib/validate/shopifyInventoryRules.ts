/**
 * Shopify Inventory CSV Validation Rules
 * Validates the Shopify inventory file for common issues
 */

import type {
  ShopifyInventoryFile,
  Issue,
} from '../types';
import { MAX_FILE_SIZE_BYTES } from '../types';

interface ValidationResult {
  isValid: boolean;
  issues: Issue[];
  warnings: Issue[];
  info: Issue[];
}

let issueCounter = 0;

function createIssue(
  params: Omit<Issue, 'id'>
): Issue {
  return {
    id: `shopify-val-${++issueCounter}`,
    ...params,
  };
}

/**
 * Validate file size
 */
export function validateFileSize(fileSize: number): Issue | null {
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return createIssue({
      severity: 'error',
      file: 'shopify',
      rowIndex: null,
      column: null,
      message: `File size (${(fileSize / 1024 / 1024).toFixed(2)} MB) exceeds Shopify's limit of 15 MB`,
      suggestedFix: 'Split the inventory into multiple files or remove unnecessary rows',
      code: 'FILE_TOO_LARGE',
    });
  }
  return null;
}

/**
 * Check for duplicate SKU+Location combinations
 */
export function checkDuplicateSkuLocations(file: ShopifyInventoryFile): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, number[]>();

  for (const row of file.rows) {
    if (!row.sku) continue;

    const key = `${row.sku}|${row.location || ''}`.toLowerCase();
    const existing = seen.get(key);

    if (existing) {
      existing.push(row.rowIndex);
    } else {
      seen.set(key, [row.rowIndex]);
    }
  }

  for (const [key, indices] of seen.entries()) {
    if (indices.length > 1) {
      const [sku, location] = key.split('|');
      issues.push(createIssue({
        severity: 'error',
        file: 'shopify',
        rowIndex: indices[0],
        column: 'SKU',
        message: `Duplicate SKU "${sku}"${location ? ` at location "${location}"` : ''} found on rows: ${indices.map(i => i + 2).join(', ')}`,
        suggestedFix: 'Each SKU should appear only once per location',
        code: 'DUPLICATE_SKU_LOCATION',
        context: { allRowIndices: indices },
      }));
    }
  }

  return issues;
}

/**
 * Validate quantity formats
 */
export function validateQuantityFormats(file: ShopifyInventoryFile): Issue[] {
  const issues: Issue[] = [];

  for (const row of file.rows) {
    // Check On hand (current)
    if (row.onHandCurrentRaw !== null && row.onHandCurrentRaw.trim() !== '') {
      const value = row.onHandCurrentRaw.trim();

      if (value.toLowerCase() !== 'not stocked') {
        const parsed = parseFloat(value);

        if (isNaN(parsed)) {
          issues.push(createIssue({
            severity: 'error',
            file: 'shopify',
            rowIndex: row.rowIndex,
            column: 'On hand (current)',
            message: `Invalid quantity format: "${value}"`,
            suggestedFix: 'Use a whole number or "Not stocked"',
            code: 'INVALID_QUANTITY_FORMAT',
          }));
        } else if (!Number.isInteger(parsed)) {
          issues.push(createIssue({
            severity: 'warning',
            file: 'shopify',
            rowIndex: row.rowIndex,
            column: 'On hand (current)',
            message: `Decimal quantity "${value}" should be a whole number`,
            suggestedFix: 'Shopify requires whole numbers for inventory quantities',
            code: 'INVALID_QUANTITY_FORMAT',
          }));
        }
      }
    }

    // Check On hand (new) if already has a value
    if (row.onHandNewRaw !== null && row.onHandNewRaw.trim() !== '') {
      const value = row.onHandNewRaw.trim();
      const parsed = parseFloat(value);

      if (!isNaN(parsed) && !Number.isInteger(parsed)) {
        issues.push(createIssue({
          severity: 'error',
          file: 'shopify',
          rowIndex: row.rowIndex,
          column: 'On hand (new)',
          message: `Decimal quantity "${value}" not allowed`,
          suggestedFix: 'Shopify requires whole numbers for inventory quantities',
          code: 'INVALID_QUANTITY_FORMAT',
        }));
      }
    }
  }

  return issues;
}

/**
 * Check for rows without identifiable SKU
 */
export function checkBlankSkus(file: ShopifyInventoryFile): Issue[] {
  const issues: Issue[] = [];
  let blankCount = 0;

  for (const row of file.rows) {
    if (!row.sku || row.sku.trim() === '') {
      blankCount++;
      if (blankCount <= 10) { // Limit individual warnings
        issues.push(createIssue({
          severity: 'warning',
          file: 'shopify',
          rowIndex: row.rowIndex,
          column: 'SKU',
          message: `Row has blank SKU (Handle: "${row.handle}")`,
          suggestedFix: 'Add SKUs to products for reliable matching',
          code: 'BLANK_SKU',
        }));
      }
    }
  }

  if (blankCount > 10) {
    issues.push(createIssue({
      severity: 'warning',
      file: 'shopify',
      rowIndex: null,
      column: 'SKU',
      message: `${blankCount} rows have blank SKUs (showing first 10)`,
      suggestedFix: 'Add SKUs to products for reliable matching',
      code: 'BLANK_SKU',
    }));
  }

  return issues;
}

/**
 * Check if user appears to have edited non-editable columns
 */
export function checkEditedWrongColumns(file: ShopifyInventoryFile): Issue[] {
  const issues: Issue[] = [];

  if (file.format !== 'all_states') {
    return issues;
  }

  // Check for patterns that suggest editing wrong columns
  // This is heuristic - we look for common mistakes

  const nonEditableColumns = ['Available', 'Committed', 'Incoming', 'Unavailable'];

  // Count how many rows have On hand (new) filled vs other columns modified
  let onHandNewFilledCount = 0;

  for (const row of file.rows) {
    if (row.onHandNewRaw && row.onHandNewRaw.trim() !== '') {
      onHandNewFilledCount++;
    }

    // Check if non-editable columns have unusual values
    for (const colName of nonEditableColumns) {
      const value = row.rawRow[colName];
      if (value !== undefined && value.trim() !== '') {
        // These columns should typically have numeric values or be empty
        // If they have text that's not a number, it might indicate editing
        if (isNaN(parseFloat(value)) && value.toLowerCase() !== 'not stocked') {
          issues.push(createIssue({
            severity: 'warning',
            file: 'shopify',
            rowIndex: row.rowIndex,
            column: colName,
            message: `Column "${colName}" has unexpected value "${value}". This column is calculated by Shopify.`,
            suggestedFix: 'Only edit "On hand (new)" column. Leave other inventory columns unchanged.',
            code: 'EDITED_WRONG_COLUMN',
          }));
        }
      }
    }
  }

  return issues;
}

/**
 * Run all validation rules
 */
export function validateShopifyInventory(
  file: ShopifyInventoryFile,
  fileSize?: number
): ValidationResult {
  const allIssues: Issue[] = [];

  // File size validation
  if (fileSize !== undefined) {
    const sizeIssue = validateFileSize(fileSize);
    if (sizeIssue) {
      allIssues.push(sizeIssue);
    }
  }

  // Run all checks
  allIssues.push(...checkDuplicateSkuLocations(file));
  allIssues.push(...validateQuantityFormats(file));
  allIssues.push(...checkBlankSkus(file));
  allIssues.push(...checkEditedWrongColumns(file));

  // Categorize issues
  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const info = allIssues.filter(i => i.severity === 'info');

  return {
    isValid: errors.length === 0,
    issues: errors,
    warnings,
    info,
  };
}
