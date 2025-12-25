/**
 * Supplier Feed Validation Rules
 * Validates the supplier/POS stock feed for common issues
 */

import type {
  SupplierFile,
  Issue,
} from '../types';
import { SUSPICIOUS_QTY_THRESHOLD } from '../types';

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
    id: `supplier-val-${++issueCounter}`,
    ...params,
  };
}

/**
 * Check for duplicate SKUs in supplier feed
 */
export function checkDuplicateSkus(file: SupplierFile): Issue[] {
  const issues: Issue[] = [];
  const skuCounts = new Map<string, { count: number; indices: number[] }>();

  for (const row of file.rows) {
    const normalizedSku = row.sku.toUpperCase().trim();
    const existing = skuCounts.get(normalizedSku);

    if (existing) {
      existing.count++;
      existing.indices.push(row.rowIndex);
    } else {
      skuCounts.set(normalizedSku, { count: 1, indices: [row.rowIndex] });
    }
  }

  for (const [sku, { count, indices }] of skuCounts.entries()) {
    if (count > 1) {
      issues.push(createIssue({
        severity: 'warning',
        file: 'supplier',
        rowIndex: indices[0],
        column: 'SKU',
        message: `Duplicate SKU "${sku}" appears ${count} times (rows: ${indices.map(i => i + 2).join(', ')})`,
        suggestedFix: 'Choose a duplicate handling strategy or remove duplicates',
        code: 'SUPPLIER_DUPLICATE_SKU',
        context: { sku, count, indices },
      }));
    }
  }

  return issues;
}

/**
 * Check for decimal quantities
 */
export function checkDecimalQuantities(file: SupplierFile): Issue[] {
  const issues: Issue[] = [];
  let decimalCount = 0;

  for (const row of file.rows) {
    if (row.qtyRaw && row.qtyRaw.includes('.')) {
      const parsed = parseFloat(row.qtyRaw);
      if (!isNaN(parsed) && !Number.isInteger(parsed)) {
        decimalCount++;
        if (decimalCount <= 5) { // Limit individual warnings
          issues.push(createIssue({
            severity: 'error',
            file: 'supplier',
            rowIndex: row.rowIndex,
            column: 'Quantity',
            message: `Decimal quantity "${row.qtyRaw}" not allowed. Shopify requires whole numbers.`,
            suggestedFix: `Will be rounded to ${Math.round(parsed)}`,
            code: 'SUPPLIER_DECIMAL_QTY',
          }));
        }
      }
    }
  }

  if (decimalCount > 5) {
    issues.push(createIssue({
      severity: 'warning',
      file: 'supplier',
      rowIndex: null,
      column: null,
      message: `${decimalCount} rows have decimal quantities that will be rounded`,
      suggestedFix: null,
      code: 'SUPPLIER_DECIMAL_QTY',
    }));
  }

  return issues;
}

/**
 * Check for negative quantities
 */
export function checkNegativeQuantities(file: SupplierFile): Issue[] {
  const issues: Issue[] = [];
  let negativeCount = 0;

  for (const row of file.rows) {
    if (row.qty < 0) {
      negativeCount++;
      if (negativeCount <= 5) {
        issues.push(createIssue({
          severity: 'warning',
          file: 'supplier',
          rowIndex: row.rowIndex,
          column: 'Quantity',
          message: `Negative quantity: ${row.qty}`,
          suggestedFix: 'Verify this is intentional',
          code: 'SUPPLIER_NEGATIVE_QTY',
        }));
      }
    }
  }

  if (negativeCount > 5) {
    issues.push(createIssue({
      severity: 'warning',
      file: 'supplier',
      rowIndex: null,
      column: null,
      message: `${negativeCount} rows have negative quantities`,
      suggestedFix: 'Verify these are intentional',
      code: 'SUPPLIER_NEGATIVE_QTY',
    }));
  }

  return issues;
}

/**
 * Check for suspiciously high quantities
 */
export function checkSuspiciousQuantities(file: SupplierFile): Issue[] {
  const issues: Issue[] = [];

  for (const row of file.rows) {
    if (row.qty > SUSPICIOUS_QTY_THRESHOLD) {
      issues.push(createIssue({
        severity: 'warning',
        file: 'supplier',
        rowIndex: row.rowIndex,
        column: 'Quantity',
        message: `Suspiciously high quantity: ${row.qty.toLocaleString()} for SKU "${row.sku}"`,
        suggestedFix: 'Verify this quantity is correct',
        code: 'SUPPLIER_SUSPICIOUS_QTY',
      }));
    }
  }

  return issues;
}

/**
 * Check SKU fill rate
 */
export function checkSkuFillRate(
  file: SupplierFile,
  totalParsedRows: number,
  minRate: number = 0.95
): Issue[] {
  const issues: Issue[] = [];
  const validSkuCount = file.rows.length;
  const fillRate = validSkuCount / totalParsedRows;

  if (fillRate < minRate) {
    issues.push(createIssue({
      severity: 'warning',
      file: 'supplier',
      rowIndex: null,
      column: 'SKU',
      message: `Only ${(fillRate * 100).toFixed(1)}% of rows have valid SKUs (${validSkuCount} of ${totalParsedRows})`,
      suggestedFix: 'Verify the correct SKU column is mapped',
      code: 'SUPPLIER_BLANK_SKU',
    }));
  }

  return issues;
}

/**
 * Check quantity fill rate
 */
export function checkQuantityFillRate(
  file: SupplierFile,
  minRate: number = 0.95
): Issue[] {
  const issues: Issue[] = [];
  let invalidQtyCount = 0;

  for (const row of file.rows) {
    if (row.qty === 0 && row.qtyRaw !== '0') {
      // This might indicate a parsing issue
      invalidQtyCount++;
    }
  }

  const validRate = (file.rows.length - invalidQtyCount) / file.rows.length;

  if (validRate < minRate) {
    issues.push(createIssue({
      severity: 'warning',
      file: 'supplier',
      rowIndex: null,
      column: 'Quantity',
      message: `Only ${(validRate * 100).toFixed(1)}% of rows have valid quantities`,
      suggestedFix: 'Verify the correct quantity column is mapped',
      code: 'INVALID_QUANTITY_FORMAT',
    }));
  }

  return issues;
}

/**
 * Run all validation rules
 */
export function validateSupplierFeed(
  file: SupplierFile,
  totalParsedRows?: number
): ValidationResult {
  const allIssues: Issue[] = [];

  // Run all checks
  allIssues.push(...checkDuplicateSkus(file));
  allIssues.push(...checkDecimalQuantities(file));
  allIssues.push(...checkNegativeQuantities(file));
  allIssues.push(...checkSuspiciousQuantities(file));

  if (totalParsedRows !== undefined) {
    allIssues.push(...checkSkuFillRate(file, totalParsedRows));
  }

  allIssues.push(...checkQuantityFillRate(file));

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
