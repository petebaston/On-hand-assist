import { describe, it, expect } from 'vitest';
import { runMatching } from '@/lib/match/matchEngine';
import type {
  ShopifyInventoryFile,
  SupplierFile,
  MatchConfig,
} from '@/lib/types';
import { DEFAULT_MATCH_CONFIG } from '@/lib/types';

// Helper to create mock Shopify file
function createShopifyFile(
  rows: Array<{ sku: string; location?: string; onHandCurrent?: number }>
): ShopifyInventoryFile {
  return {
    format: 'all_states',
    locations: [...new Set(rows.map((r) => r.location || 'Main'))],
    headers: ['Handle', 'SKU', 'Location', 'On hand (current)', 'On hand (new)'],
    columnMapping: {
      handle: 0,
      sku: 1,
      location: 2,
      title: null,
      vendor: null,
      onHandCurrent: 3,
      onHandNew: 4,
      locationColumns: {},
      options: [],
    },
    rows: rows.map((r, i) => ({
      handle: `product-${i + 1}`,
      location: r.location || 'Main',
      sku: r.sku,
      title: null,
      vendor: null,
      options: [],
      onHandCurrentRaw: r.onHandCurrent?.toString() || null,
      onHandCurrent: r.onHandCurrent ?? null,
      onHandNewRaw: null,
      availableByLocation: {},
      rawRow: {
        Handle: `product-${i + 1}`,
        SKU: r.sku,
        Location: r.location || 'Main',
        'On hand (current)': r.onHandCurrent?.toString() || '',
        'On hand (new)': '',
      },
      rowIndex: i,
    })),
  };
}

// Helper to create mock Supplier file
function createSupplierFile(
  rows: Array<{ sku: string; qty: number }>
): SupplierFile {
  return {
    headers: ['SKU', 'Qty'],
    columnMapping: { sku: 0, qty: 1, location: null },
    rows: rows.map((r, i) => ({
      sku: r.sku,
      qty: r.qty,
      qtyRaw: r.qty.toString(),
      location: null,
      rawRow: { SKU: r.sku, Qty: r.qty.toString() },
      rowIndex: i,
    })),
  };
}

describe('runMatching', () => {
  describe('exact matching', () => {
    it('should match exact SKUs', () => {
      const shopify = createShopifyFile([
        { sku: 'SKU001', onHandCurrent: 10 },
        { sku: 'SKU002', onHandCurrent: 20 },
      ]);
      const supplier = createSupplierFile([
        { sku: 'SKU001', qty: 15 },
        { sku: 'SKU002', qty: 25 },
      ]);

      const result = runMatching(shopify, supplier, DEFAULT_MATCH_CONFIG);

      expect(result.stats.exactMatches).toBe(2);
      expect(result.stats.noMatches).toBe(0);
    });

    it('should not match case-different SKUs in exact mode only', () => {
      const shopify = createShopifyFile([{ sku: 'SKU001', onHandCurrent: 10 }]);
      const supplier = createSupplierFile([{ sku: 'sku001', qty: 15 }]);

      const config: MatchConfig = {
        ...DEFAULT_MATCH_CONFIG,
        strategies: ['exact'], // Only exact, no normalized
      };

      const result = runMatching(shopify, supplier, config);

      expect(result.stats.exactMatches).toBe(0);
      expect(result.stats.noMatches).toBe(1);
    });
  });

  describe('normalized matching', () => {
    it('should match case-insensitive SKUs', () => {
      const shopify = createShopifyFile([{ sku: 'SKU001', onHandCurrent: 10 }]);
      const supplier = createSupplierFile([{ sku: 'sku001', qty: 15 }]);

      const result = runMatching(shopify, supplier, DEFAULT_MATCH_CONFIG);

      expect(result.stats.normalizedMatches).toBe(1);
    });

    it('should match SKUs with different whitespace', () => {
      const shopify = createShopifyFile([{ sku: 'SKU 001', onHandCurrent: 10 }]);
      const supplier = createSupplierFile([{ sku: 'SKU  001', qty: 15 }]);

      const result = runMatching(shopify, supplier, DEFAULT_MATCH_CONFIG);

      expect(result.stats.normalizedMatches).toBe(1);
    });

    it('should match SKUs with removed separators when enabled', () => {
      const shopify = createShopifyFile([{ sku: 'SKU-001', onHandCurrent: 10 }]);
      const supplier = createSupplierFile([{ sku: 'SKU001', qty: 15 }]);

      const config: MatchConfig = {
        ...DEFAULT_MATCH_CONFIG,
        removeSeparators: true,
      };

      const result = runMatching(shopify, supplier, config);

      expect(result.stats.normalizedMatches).toBe(1);
    });
  });

  describe('multi-location handling', () => {
    it('should match SKU to all locations', () => {
      const shopify = createShopifyFile([
        { sku: 'SKU001', location: 'Warehouse A', onHandCurrent: 10 },
        { sku: 'SKU001', location: 'Warehouse B', onHandCurrent: 5 },
      ]);
      const supplier = createSupplierFile([{ sku: 'SKU001', qty: 20 }]);

      const result = runMatching(shopify, supplier, DEFAULT_MATCH_CONFIG);

      // Should create matches for both locations
      const matches = result.matches.filter(
        (m) => m.status === 'matched' && m.supplierSku === 'SKU001'
      );
      expect(matches.length).toBe(2);
    });

    it('should filter by location when specified', () => {
      const shopify = createShopifyFile([
        { sku: 'SKU001', location: 'Warehouse A', onHandCurrent: 10 },
        { sku: 'SKU001', location: 'Warehouse B', onHandCurrent: 5 },
      ]);
      const supplier = createSupplierFile([{ sku: 'SKU001', qty: 20 }]);

      const config: MatchConfig = {
        ...DEFAULT_MATCH_CONFIG,
        locationsToUpdate: ['Warehouse A'],
      };

      const result = runMatching(shopify, supplier, config);

      const matches = result.matches.filter((m) => m.status === 'matched');
      expect(matches.length).toBe(1);
      expect(matches[0].shopifyRowRefs[0].location).toBe('Warehouse A');
    });
  });

  describe('quantity calculations', () => {
    it('should calculate new quantity in absolute mode', () => {
      const shopify = createShopifyFile([{ sku: 'SKU001', onHandCurrent: 10 }]);
      const supplier = createSupplierFile([{ sku: 'SKU001', qty: 25 }]);

      const result = runMatching(shopify, supplier, DEFAULT_MATCH_CONFIG);

      const match = result.matches.find((m) => m.supplierSku === 'SKU001');
      expect(match?.newQuantity).toBe(25);
      expect(match?.delta).toBe(15);
    });

    it('should calculate delta in delta mode', () => {
      const shopify = createShopifyFile([{ sku: 'SKU001', onHandCurrent: 10 }]);
      const supplier = createSupplierFile([{ sku: 'SKU001', qty: 5 }]); // Add 5

      const config: MatchConfig = {
        ...DEFAULT_MATCH_CONFIG,
        quantityMode: 'delta',
      };

      const result = runMatching(shopify, supplier, config);

      const match = result.matches.find((m) => m.supplierSku === 'SKU001');
      expect(match?.newQuantity).toBe(15); // 10 + 5
      expect(match?.delta).toBe(5);
    });
  });

  describe('duplicate handling', () => {
    it('should use last_wins strategy by default', () => {
      const shopify = createShopifyFile([{ sku: 'SKU001', onHandCurrent: 10 }]);
      const supplier = createSupplierFile([
        { sku: 'SKU001', qty: 15 },
        { sku: 'SKU001', qty: 25 },
      ]);

      const result = runMatching(shopify, supplier, DEFAULT_MATCH_CONFIG);

      const match = result.matches.find((m) => m.supplierSku === 'SKU001');
      expect(match?.newQuantity).toBe(25);
    });

    it('should use max_qty strategy when configured', () => {
      const shopify = createShopifyFile([{ sku: 'SKU001', onHandCurrent: 10 }]);
      const supplier = createSupplierFile([
        { sku: 'SKU001', qty: 100 },
        { sku: 'SKU001', qty: 25 },
      ]);

      const config: MatchConfig = {
        ...DEFAULT_MATCH_CONFIG,
        duplicateStrategy: 'max_qty',
      };

      const result = runMatching(shopify, supplier, config);

      const match = result.matches.find((m) => m.supplierSku === 'SKU001');
      expect(match?.newQuantity).toBe(100);
    });

    it('should use sum_qty strategy when configured', () => {
      const shopify = createShopifyFile([{ sku: 'SKU001', onHandCurrent: 10 }]);
      const supplier = createSupplierFile([
        { sku: 'SKU001', qty: 15 },
        { sku: 'SKU001', qty: 25 },
      ]);

      const config: MatchConfig = {
        ...DEFAULT_MATCH_CONFIG,
        duplicateStrategy: 'sum_qty',
      };

      const result = runMatching(shopify, supplier, config);

      const match = result.matches.find((m) => m.supplierSku === 'SKU001');
      expect(match?.newQuantity).toBe(40); // 15 + 25
    });
  });

  describe('unmatched handling', () => {
    it('should report unmatched supplier SKUs', () => {
      const shopify = createShopifyFile([{ sku: 'SKU001', onHandCurrent: 10 }]);
      const supplier = createSupplierFile([
        { sku: 'SKU001', qty: 15 },
        { sku: 'SKU999', qty: 25 },
      ]);

      const result = runMatching(shopify, supplier, DEFAULT_MATCH_CONFIG);

      expect(result.stats.noMatches).toBe(1);
      const unmatched = result.matches.find((m) => m.status === 'unmatched');
      expect(unmatched?.supplierSku).toBe('SKU999');
    });

    it('should report unmatched Shopify SKUs in issues', () => {
      const shopify = createShopifyFile([
        { sku: 'SKU001', onHandCurrent: 10 },
        { sku: 'SKU002', onHandCurrent: 20 },
      ]);
      const supplier = createSupplierFile([{ sku: 'SKU001', qty: 15 }]);

      const result = runMatching(shopify, supplier, DEFAULT_MATCH_CONFIG);

      const unmatchedShopify = result.issues.find(
        (i) => i.file === 'shopify' && i.code === 'NO_MATCH'
      );
      expect(unmatchedShopify).toBeDefined();
    });
  });

  describe('danger checks', () => {
    it('should warn about large quantity drops', () => {
      const shopify = createShopifyFile([{ sku: 'SKU001', onHandCurrent: 100 }]);
      const supplier = createSupplierFile([{ sku: 'SKU001', qty: 5 }]);

      const result = runMatching(shopify, supplier, DEFAULT_MATCH_CONFIG);

      const largeDelta = result.issues.find((i) => i.code === 'LARGE_DELTA');
      expect(largeDelta).toBeDefined();
    });

    it('should warn when dropping to zero', () => {
      const shopify = createShopifyFile([{ sku: 'SKU001', onHandCurrent: 50 }]);
      const supplier = createSupplierFile([{ sku: 'SKU001', qty: 0 }]);

      const result = runMatching(shopify, supplier, DEFAULT_MATCH_CONFIG);

      const zeroWarning = result.issues.find((i) => i.code === 'DROPPING_TO_ZERO');
      expect(zeroWarning).toBeDefined();
    });

    it('should warn about negative results', () => {
      const shopify = createShopifyFile([{ sku: 'SKU001', onHandCurrent: 10 }]);
      const supplier = createSupplierFile([{ sku: 'SKU001', qty: -5 }]);

      const result = runMatching(shopify, supplier, DEFAULT_MATCH_CONFIG);

      const negativeWarning = result.issues.find(
        (i) => i.code === 'NEGATIVE_RESULT'
      );
      expect(negativeWarning).toBeDefined();
    });
  });
});
