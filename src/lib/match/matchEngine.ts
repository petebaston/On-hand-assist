/**
 * SKU Matching Engine
 * Handles exact, normalized, and fuzzy matching between supplier and Shopify SKUs
 */

import { distance as levenshteinDistance } from 'fastest-levenshtein';
import type {
  ShopifyInventoryFile,
  ShopifyInventoryRow,
  SupplierFile,
  SupplierRow,
  MatchResult,
  MatchConfig,
  MatchType,
  MatchStatus,
  Issue,
} from '../types';
import { LARGE_DELTA_PERCENT } from '../types';

// ============================================================================
// SKU Normalization
// ============================================================================

/**
 * Normalize a SKU for matching
 */
export function normalizeSku(
  sku: string,
  options: { removeSeparators?: boolean } = {}
): string {
  let normalized = sku
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' '); // Collapse multiple spaces

  if (options.removeSeparators) {
    normalized = normalized.replace(/[-_.\s]/g, '');
  }

  return normalized;
}

/**
 * Calculate string similarity score (0-100)
 */
export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 100;
  if (!a || !b) return 0;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;

  const dist = levenshteinDistance(a, b);
  return Math.round((1 - dist / maxLen) * 100);
}

/**
 * Calculate token overlap score (0-100)
 */
function tokenOverlapScore(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(t => t.length > 1));
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(t => t.length > 1));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let matches = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) matches++;
  }

  const unionSize = tokensA.size + tokensB.size - matches;
  return Math.round((matches / unionSize) * 100);
}

// ============================================================================
// Matching Index
// ============================================================================

interface ShopifyRowRef {
  rowIndex: number;
  handle: string;
  location: string | null;
  sku: string;
}

interface MatchIndex {
  /** Exact SKU -> row references */
  exact: Map<string, ShopifyRowRef[]>;
  /** Normalized SKU -> row references */
  normalized: Map<string, ShopifyRowRef[]>;
  /** All rows for fuzzy matching */
  allRows: Array<{
    ref: ShopifyRowRef;
    row: ShopifyInventoryRow;
    normalizedSku: string;
  }>;
}

/**
 * Build an index of Shopify rows for efficient matching
 */
function buildMatchIndex(
  shopifyFile: ShopifyInventoryFile,
  config: MatchConfig
): MatchIndex {
  const index: MatchIndex = {
    exact: new Map(),
    normalized: new Map(),
    allRows: [],
  };

  for (const row of shopifyFile.rows) {
    // Skip rows without SKU if we're matching by SKU
    if (!row.sku) continue;

    // Filter by location if specified
    if (config.locationsToUpdate.length > 0 && row.location) {
      if (!config.locationsToUpdate.includes(row.location)) {
        continue;
      }
    }

    const ref: ShopifyRowRef = {
      rowIndex: row.rowIndex,
      handle: row.handle,
      location: row.location,
      sku: row.sku,
    };

    // Exact index
    const exactKey = row.sku;
    if (!index.exact.has(exactKey)) {
      index.exact.set(exactKey, []);
    }
    index.exact.get(exactKey)!.push(ref);

    // Normalized index
    const normalizedKey = normalizeSku(row.sku, {
      removeSeparators: config.removeSeparators,
    });
    if (!index.normalized.has(normalizedKey)) {
      index.normalized.set(normalizedKey, []);
    }
    index.normalized.get(normalizedKey)!.push(ref);

    // All rows for fuzzy
    index.allRows.push({
      ref,
      row,
      normalizedSku: normalizedKey,
    });
  }

  return index;
}

// ============================================================================
// Matching Logic
// ============================================================================

/**
 * Try to find exact match
 */
function findExactMatch(
  supplierSku: string,
  index: MatchIndex
): ShopifyRowRef[] | null {
  const refs = index.exact.get(supplierSku);
  return refs && refs.length > 0 ? refs : null;
}

/**
 * Try to find normalized match
 */
function findNormalizedMatch(
  supplierSku: string,
  index: MatchIndex,
  config: MatchConfig
): ShopifyRowRef[] | null {
  const normalizedSku = normalizeSku(supplierSku, {
    removeSeparators: config.removeSeparators,
  });
  const refs = index.normalized.get(normalizedSku);
  return refs && refs.length > 0 ? refs : null;
}

/**
 * Try to find fuzzy match
 */
function findFuzzyMatch(
  supplierRow: SupplierRow,
  index: MatchIndex,
  config: MatchConfig
): { refs: ShopifyRowRef[]; score: number; needsReview: boolean } | null {
  const normalizedSupplierSku = normalizeSku(supplierRow.sku, {
    removeSeparators: config.removeSeparators,
  });

  // Calculate scores for all candidates
  const candidates: Array<{
    ref: ShopifyRowRef;
    row: ShopifyInventoryRow;
    score: number;
  }> = [];

  for (const item of index.allRows) {
    if (candidates.length >= config.fuzzyMaxCandidates) break;

    // SKU similarity (70% weight)
    const skuScore = calculateSimilarity(normalizedSupplierSku, item.normalizedSku);

    // Title similarity (20% weight) - if available
    let titleScore = 0;
    if (item.row.title) {
      titleScore = tokenOverlapScore(supplierRow.sku, item.row.title);
    }

    // Vendor similarity (10% weight) - if available
    let vendorScore = 0;
    if (item.row.vendor) {
      vendorScore = calculateSimilarity(
        supplierRow.sku.toLowerCase(),
        item.row.vendor.toLowerCase()
      );
    }

    const totalScore = Math.round(
      skuScore * 0.7 + titleScore * 0.2 + vendorScore * 0.1
    );

    if (totalScore >= config.fuzzyReviewThreshold) {
      candidates.push({
        ref: item.ref,
        row: item.row,
        score: totalScore,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  const bestScore = candidates[0].score;
  const bestCandidates = candidates.filter(c => c.score === bestScore);

  // If multiple candidates with same top score, or score below auto-threshold
  const needsReview =
    bestCandidates.length > 1 ||
    bestScore < config.fuzzyAutoThreshold;

  return {
    refs: bestCandidates.map(c => c.ref),
    score: bestScore,
    needsReview,
  };
}

// ============================================================================
// Duplicate Handling
// ============================================================================

/**
 * Consolidate duplicate supplier SKUs based on strategy
 */
function consolidateDuplicates(
  supplierFile: SupplierFile,
  strategy: MatchConfig['duplicateStrategy']
): { consolidated: Map<string, SupplierRow>; issues: Issue[] } {
  const grouped = new Map<string, SupplierRow[]>();
  const issues: Issue[] = [];
  let issueId = 0;

  // Group by normalized SKU
  for (const row of supplierFile.rows) {
    const key = row.sku.toUpperCase().trim();
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(row);
  }

  const consolidated = new Map<string, SupplierRow>();

  for (const [sku, rows] of grouped.entries()) {
    if (rows.length === 1) {
      consolidated.set(sku, rows[0]);
      continue;
    }

    // Handle duplicates
    let selectedRow: SupplierRow;

    switch (strategy) {
      case 'last_wins':
        selectedRow = rows[rows.length - 1];
        break;

      case 'max_qty':
        selectedRow = rows.reduce((max, row) =>
          row.qty > max.qty ? row : max
        );
        break;

      case 'sum_qty':
        const totalQty = rows.reduce((sum, row) => sum + row.qty, 0);
        selectedRow = {
          ...rows[0],
          qty: totalQty,
          qtyRaw: String(totalQty),
        };
        break;

      case 'error':
        issues.push({
          id: `dup-${++issueId}`,
          severity: 'error',
          file: 'supplier',
          rowIndex: rows[0].rowIndex,
          column: 'SKU',
          message: `Duplicate SKU "${rows[0].sku}" found ${rows.length} times (rows: ${rows.map(r => r.rowIndex + 2).join(', ')})`,
          suggestedFix: 'Remove duplicates or choose a different duplicate handling strategy',
          code: 'SUPPLIER_DUPLICATE_SKU',
        });
        selectedRow = rows[0]; // Still include it but mark as error
        break;
    }

    consolidated.set(sku, selectedRow);

    if (strategy !== 'error') {
      issues.push({
        id: `dup-${++issueId}`,
        severity: 'info',
        file: 'supplier',
        rowIndex: null,
        column: null,
        message: `Duplicate SKU "${rows[0].sku}" consolidated using "${strategy}" strategy (${rows.length} rows)`,
        suggestedFix: null,
        code: 'SUPPLIER_DUPLICATE_SKU',
      });
    }
  }

  return { consolidated, issues };
}

// ============================================================================
// Main Matching Engine
// ============================================================================

export interface MatchEngineResult {
  matches: MatchResult[];
  issues: Issue[];
  stats: {
    totalSupplier: number;
    totalShopify: number;
    exactMatches: number;
    normalizedMatches: number;
    fuzzyMatches: number;
    noMatches: number;
    ambiguous: number;
    needsReview: number;
  };
}

/**
 * Main matching function
 */
export function runMatching(
  shopifyFile: ShopifyInventoryFile,
  supplierFile: SupplierFile,
  config: MatchConfig,
  onProgress?: (processed: number, total: number) => void
): MatchEngineResult {
  const issues: Issue[] = [];
  let issueId = 0;
  const matches: MatchResult[] = [];

  // Consolidate duplicate supplier SKUs
  const { consolidated, issues: dupIssues } = consolidateDuplicates(
    supplierFile,
    config.duplicateStrategy
  );
  issues.push(...dupIssues);

  // Build match index
  const index = buildMatchIndex(shopifyFile, config);

  // Track which Shopify rows have been matched
  const matchedShopifyRows = new Set<number>();

  // Stats
  const stats = {
    totalSupplier: consolidated.size,
    totalShopify: shopifyFile.rows.length,
    exactMatches: 0,
    normalizedMatches: 0,
    fuzzyMatches: 0,
    noMatches: 0,
    ambiguous: 0,
    needsReview: 0,
  };

  let processed = 0;
  const total = consolidated.size;

  // Process each supplier row
  for (const [, supplierRow] of consolidated) {
    processed++;
    if (onProgress && processed % 100 === 0) {
      onProgress(processed, total);
    }

    let matchType: MatchType | null = null;
    let matchedRefs: ShopifyRowRef[] | null = null;
    let score = 0;
    let needsReview = false;

    // Try matching strategies in order
    for (const strategy of config.strategies) {
      if (matchedRefs) break;

      switch (strategy) {
        case 'exact':
          matchedRefs = findExactMatch(supplierRow.sku, index);
          if (matchedRefs) {
            matchType = 'exact';
            score = 100;
            stats.exactMatches++;
          }
          break;

        case 'normalized':
          matchedRefs = findNormalizedMatch(supplierRow.sku, index, config);
          if (matchedRefs) {
            matchType = 'normalized';
            score = 100;
            stats.normalizedMatches++;
          }
          break;

        case 'fuzzy':
          const fuzzyResult = findFuzzyMatch(supplierRow, index, config);
          if (fuzzyResult) {
            matchedRefs = fuzzyResult.refs;
            matchType = 'fuzzy';
            score = fuzzyResult.score;
            needsReview = fuzzyResult.needsReview;
            stats.fuzzyMatches++;
            if (needsReview) stats.needsReview++;
          }
          break;
      }
    }

    // Create match result
    if (!matchedRefs || matchedRefs.length === 0) {
      stats.noMatches++;
      matches.push({
        supplierSku: supplierRow.sku,
        supplierRowIndex: supplierRow.rowIndex,
        shopifyRowRefs: [],
        score: 0,
        matchType: 'exact', // Default
        status: 'unmatched',
        newQuantity: null,
        delta: null,
        reason: 'No matching SKU found in Shopify inventory',
      });

      issues.push({
        id: `match-${++issueId}`,
        severity: 'warning',
        file: 'supplier',
        rowIndex: supplierRow.rowIndex,
        column: 'SKU',
        message: `Supplier SKU "${supplierRow.sku}" has no match in Shopify`,
        suggestedFix: 'Verify SKU exists in Shopify or add the product',
        code: 'NO_MATCH',
      });
      continue;
    }

    // Handle ambiguous matches
    if (matchedRefs.length > 1 && matchType !== 'exact') {
      // For normalized matches, if they're the same product at different locations, it's OK
      const uniqueHandles = new Set(matchedRefs.map(r => r.handle));
      if (uniqueHandles.size > 1) {
        stats.ambiguous++;
        matches.push({
          supplierSku: supplierRow.sku,
          supplierRowIndex: supplierRow.rowIndex,
          shopifyRowRefs: matchedRefs,
          score,
          matchType: matchType!,
          status: 'ambiguous',
          newQuantity: null,
          delta: null,
          reason: `Multiple different products match this SKU: ${Array.from(uniqueHandles).slice(0, 3).join(', ')}`,
        });

        issues.push({
          id: `match-${++issueId}`,
          severity: 'warning',
          file: 'supplier',
          rowIndex: supplierRow.rowIndex,
          column: 'SKU',
          message: `Supplier SKU "${supplierRow.sku}" matches multiple different products`,
          suggestedFix: 'Review matches manually',
          code: 'AMBIGUOUS_MATCH',
          context: {
            candidates: matchedRefs.map(r => ({ handle: r.handle, sku: r.sku })),
          },
        });
        continue;
      }
    }

    // Calculate new quantity and delta for each matched row
    for (const ref of matchedRefs) {
      const shopifyRow = shopifyFile.rows[ref.rowIndex];
      matchedShopifyRows.add(ref.rowIndex);

      let newQuantity: number;
      let delta: number | null = null;

      if (config.quantityMode === 'delta') {
        // Delta mode: add supplier qty to current
        const current = shopifyRow.onHandCurrent ?? 0;
        newQuantity = current + supplierRow.qty;
        delta = supplierRow.qty;

        if (shopifyRow.onHandCurrent === null) {
          issues.push({
            id: `match-${++issueId}`,
            severity: 'warning',
            file: 'shopify',
            rowIndex: ref.rowIndex,
            column: 'On hand (current)',
            message: `SKU "${ref.sku}" is "Not stocked", treating as 0 for delta calculation`,
            suggestedFix: null,
            code: 'INVALID_QUANTITY_FORMAT',
          });
        }
      } else {
        // Absolute mode: set to supplier qty
        newQuantity = supplierRow.qty;
        if (shopifyRow.onHandCurrent !== null) {
          delta = newQuantity - shopifyRow.onHandCurrent;
        }
      }

      // Check for dangerous changes
      if (delta !== null) {
        // Large drop warning
        if (shopifyRow.onHandCurrent !== null && shopifyRow.onHandCurrent > 0) {
          const dropPercent = (delta / shopifyRow.onHandCurrent) * -100;
          if (dropPercent >= LARGE_DELTA_PERCENT) {
            issues.push({
              id: `match-${++issueId}`,
              severity: 'warning',
              file: 'output',
              rowIndex: ref.rowIndex,
              column: 'On hand (new)',
              message: `Large quantity drop for SKU "${ref.sku}": ${shopifyRow.onHandCurrent} → ${newQuantity} (${dropPercent.toFixed(0)}% decrease)`,
              suggestedFix: 'Verify this change is intentional',
              code: 'LARGE_DELTA',
            });
          }
        }

        // Dropping to zero
        if (newQuantity === 0 && shopifyRow.onHandCurrent !== null && shopifyRow.onHandCurrent > 0) {
          issues.push({
            id: `match-${++issueId}`,
            severity: 'warning',
            file: 'output',
            rowIndex: ref.rowIndex,
            column: 'On hand (new)',
            message: `SKU "${ref.sku}" will be set to 0 (was ${shopifyRow.onHandCurrent})`,
            suggestedFix: 'Verify this item should be out of stock',
            code: 'DROPPING_TO_ZERO',
          });
        }

        // Negative result
        if (newQuantity < 0) {
          issues.push({
            id: `match-${++issueId}`,
            severity: 'warning',
            file: 'output',
            rowIndex: ref.rowIndex,
            column: 'On hand (new)',
            message: `SKU "${ref.sku}" will have negative quantity: ${newQuantity}`,
            suggestedFix: 'Shopify allows negative quantities but verify this is intentional',
            code: 'NEGATIVE_RESULT',
          });
        }
      }

      const status: MatchStatus = needsReview ? 'needs_review' : 'matched';

      matches.push({
        supplierSku: supplierRow.sku,
        supplierRowIndex: supplierRow.rowIndex,
        shopifyRowRefs: [ref],
        score,
        matchType: matchType!,
        status,
        newQuantity,
        delta,
      });

      if (needsReview) {
        issues.push({
          id: `match-${++issueId}`,
          severity: 'info',
          file: 'supplier',
          rowIndex: supplierRow.rowIndex,
          column: 'SKU',
          message: `Fuzzy match needs review: "${supplierRow.sku}" → "${ref.sku}" (score: ${score})`,
          suggestedFix: 'Verify this match is correct',
          code: 'FUZZY_MATCH_REVIEW',
        });
      }
    }
  }

  // Report unmatched Shopify rows
  for (const row of shopifyFile.rows) {
    if (!matchedShopifyRows.has(row.rowIndex) && row.sku) {
      // Only if in selected locations
      if (config.locationsToUpdate.length > 0 && row.location) {
        if (!config.locationsToUpdate.includes(row.location)) {
          continue;
        }
      }

      issues.push({
        id: `match-${++issueId}`,
        severity: 'info',
        file: 'shopify',
        rowIndex: row.rowIndex,
        column: 'SKU',
        message: `Shopify SKU "${row.sku}" not in supplier feed (will remain unchanged)`,
        suggestedFix: null,
        code: 'NO_MATCH',
      });
    }
  }

  // Final progress callback
  if (onProgress) {
    onProgress(total, total);
  }

  return { matches, issues, stats };
}
