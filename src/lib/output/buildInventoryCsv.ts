/**
 * Shopify Inventory Import CSV Builder
 * Generates a valid Shopify inventory import CSV from match results
 */

import Papa from 'papaparse';
import type {
  ShopifyInventoryFile,
  MatchResult,
  Issue,
} from '../types';

interface BuildResult {
  csv: string;
  updatedCount: number;
  unchangedCount: number;
  issues: Issue[];
}

let issueCounter = 0;

/**
 * Build the Shopify-ready import CSV
 */
export function buildShopifyImportCsv(
  shopifyFile: ShopifyInventoryFile,
  matches: MatchResult[],
  options: {
    emergencyMode?: boolean;
  } = {}
): BuildResult {
  const issues: Issue[] = [];
  let updatedCount = 0;
  let unchangedCount = 0;

  // Create a map of row index to new quantity
  const quantityUpdates = new Map<number, number>();

  for (const match of matches) {
    if (match.status !== 'matched' && match.status !== 'needs_review') {
      continue;
    }

    for (const ref of match.shopifyRowRefs) {
      if (match.newQuantity !== null) {
        quantityUpdates.set(ref.rowIndex, match.newQuantity);
      }
    }
  }

  // Build output rows
  const outputRows: Record<string, string>[] = [];

  for (const row of shopifyFile.rows) {
    const outputRow = { ...row.rawRow };

    if (shopifyFile.format === 'all_states') {
      // Handle All states format
      const newQty = quantityUpdates.get(row.rowIndex);

      if (newQty !== undefined) {
        const currentQty = row.onHandCurrent;

        if (currentQty !== null && newQty === currentQty) {
          // No change needed
          unchangedCount++;
          outputRow['On hand (new)'] = ''; // Leave blank for no change
        } else {
          // Set the new quantity
          outputRow['On hand (new)'] = String(newQty);
          updatedCount++;
        }

        // Handle emergency mode - clear On hand (current) to skip safety check
        if (options.emergencyMode) {
          outputRow['On hand (current)'] = '';

          issues.push({
            id: `output-${++issueCounter}`,
            severity: 'warning',
            file: 'output',
            rowIndex: row.rowIndex,
            column: 'On hand (current)',
            message: `Emergency mode: Cleared "On hand (current)" for SKU "${row.sku}" to bypass safety validation`,
            suggestedFix: null,
            code: 'EMERGENCY_MODE_ENABLED',
          });
        }
      } else {
        // No update for this row - leave On hand (new) blank
        outputRow['On hand (new)'] = '';
      }
    } else {
      // Handle Available format
      const newQty = quantityUpdates.get(row.rowIndex);

      if (newQty !== undefined) {
        // In Available format, we need to update the specific location column
        // The location columns are the ones that hold the quantities
        for (const [locName] of Object.entries(row.availableByLocation)) {
          // For now, update all location columns for this row
          // A more sophisticated version would track per-location updates
          outputRow[locName] = String(newQty);
        }
        updatedCount++;
      }
    }

    outputRows.push(outputRow);
  }

  // Preserve original column order
  const csv = Papa.unparse(outputRows, {
    columns: shopifyFile.headers,
    quotes: true,
    quoteChar: '"',
    escapeChar: '"',
    header: true,
    newline: '\r\n', // Shopify expects CRLF
  });

  return {
    csv,
    updatedCount,
    unchangedCount,
    issues,
  };
}

/**
 * Build the unmatched supplier SKUs report
 */
export function buildUnmatchedSupplierReport(
  matches: MatchResult[]
): string {
  const unmatchedRows: Array<{
    SupplierSKU: string;
    SupplierQty: string;
    Reason: string;
  }> = [];

  for (const match of matches) {
    if (match.status === 'unmatched' || match.status === 'invalid') {
      unmatchedRows.push({
        SupplierSKU: match.supplierSku,
        SupplierQty: match.newQuantity?.toString() || '',
        Reason: match.reason || 'No match found',
      });
    }
  }

  return Papa.unparse(unmatchedRows, {
    quotes: true,
    header: true,
    newline: '\r\n',
  });
}

/**
 * Build the unmatched Shopify SKUs report
 */
export function buildUnmatchedShopifyReport(
  shopifyFile: ShopifyInventoryFile,
  matches: MatchResult[]
): string {
  // Find all matched Shopify row indices
  const matchedIndices = new Set<number>();
  for (const match of matches) {
    if (match.status === 'matched' || match.status === 'needs_review') {
      for (const ref of match.shopifyRowRefs) {
        matchedIndices.add(ref.rowIndex);
      }
    }
  }

  // Build report of unmatched rows
  const unmatchedRows: Array<{
    ShopifySKU: string;
    Handle: string;
    Location: string;
    Reason: string;
  }> = [];

  for (const row of shopifyFile.rows) {
    if (!matchedIndices.has(row.rowIndex)) {
      unmatchedRows.push({
        ShopifySKU: row.sku || '',
        Handle: row.handle,
        Location: row.location || '',
        Reason: row.sku ? 'Not in supplier feed' : 'Blank SKU',
      });
    }
  }

  return Papa.unparse(unmatchedRows, {
    quotes: true,
    header: true,
    newline: '\r\n',
  });
}

/**
 * Build the issues report CSV
 */
export function buildIssuesReport(issues: Issue[]): string {
  const rows = issues.map(issue => ({
    Severity: issue.severity,
    File: issue.file,
    Row: issue.rowIndex !== null ? String(issue.rowIndex + 2) : '', // +2 for header and 0-index
    Column: issue.column || '',
    Code: issue.code,
    Message: issue.message,
    SuggestedFix: issue.suggestedFix || '',
  }));

  return Papa.unparse(rows, {
    quotes: true,
    header: true,
    newline: '\r\n',
  });
}

/**
 * Build the ambiguous matches report
 */
export function buildAmbiguousReport(matches: MatchResult[]): string {
  const rows: Array<{
    SupplierSKU: string;
    Score: string;
    CandidateHandles: string;
    CandidateSKUs: string;
    Status: string;
  }> = [];

  for (const match of matches) {
    if (match.status === 'ambiguous' || match.status === 'needs_review') {
      rows.push({
        SupplierSKU: match.supplierSku,
        Score: String(match.score),
        CandidateHandles: match.shopifyRowRefs.map(r => r.handle).join('; '),
        CandidateSKUs: match.shopifyRowRefs.map(r => r.sku).join('; '),
        Status: match.status,
      });
    }
  }

  return Papa.unparse(rows, {
    quotes: true,
    header: true,
    newline: '\r\n',
  });
}
