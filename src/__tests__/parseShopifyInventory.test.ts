import { describe, it, expect } from 'vitest';
import {
  parseShopifyInventoryCsv,
  detectShopifyFormat,
} from '@/lib/csv/parseShopifyInventory';

describe('detectShopifyFormat', () => {
  it('should detect All states format with high confidence', () => {
    const headers = ['Handle', 'Title', 'SKU', 'Location', 'On hand (current)', 'On hand (new)'];
    const result = detectShopifyFormat(headers);

    expect(result.format).toBe('all_states');
    expect(result.confidence).toBe('high');
  });

  it('should detect Available format when no Location column', () => {
    const headers = ['Handle', 'Title', 'SKU', 'Warehouse A', 'Warehouse B'];
    const result = detectShopifyFormat(headers);

    expect(result.format).toBe('available');
    expect(result.confidence).toBe('medium');
  });

  it('should return null format when cannot detect', () => {
    const headers = ['Column1', 'Column2', 'Column3'];
    const result = detectShopifyFormat(headers);

    expect(result.format).toBe(null);
  });

  it('should be case-insensitive for column detection', () => {
    const headers = ['HANDLE', 'LOCATION', 'ON HAND (CURRENT)', 'ON HAND (NEW)'];
    const result = detectShopifyFormat(headers);

    expect(result.format).toBe('all_states');
  });
});

describe('parseShopifyInventoryCsv', () => {
  it('should parse valid All states CSV', () => {
    const csv = `Handle,Title,SKU,Location,On hand (current),On hand (new)
product-1,Product One,SKU001,Main Warehouse,10,
product-2,Product Two,SKU002,Main Warehouse,20,`;

    const result = parseShopifyInventoryCsv(csv);

    expect(result.success).toBe(true);
    expect(result.data).not.toBeNull();
    expect(result.data?.format).toBe('all_states');
    expect(result.data?.rows).toHaveLength(2);
    expect(result.data?.rows[0].sku).toBe('SKU001');
    expect(result.data?.rows[0].onHandCurrent).toBe(10);
    expect(result.data?.locations).toContain('Main Warehouse');
  });

  it('should handle "Not stocked" values', () => {
    const csv = `Handle,Title,SKU,Location,On hand (current),On hand (new)
product-1,Product One,SKU001,Main Warehouse,Not stocked,`;

    const result = parseShopifyInventoryCsv(csv);

    expect(result.success).toBe(true);
    expect(result.data?.rows[0].onHandCurrent).toBeNull();
    expect(result.data?.rows[0].onHandCurrentRaw).toBe('Not stocked');
  });

  it('should preserve leading zeros in SKUs', () => {
    const csv = `Handle,Title,SKU,Location,On hand (current),On hand (new)
product-1,Product One,00123,Main Warehouse,10,`;

    const result = parseShopifyInventoryCsv(csv);

    expect(result.data?.rows[0].sku).toBe('00123');
  });

  it('should handle quoted fields with commas', () => {
    const csv = `Handle,Title,SKU,Location,On hand (current),On hand (new)
"product-1","Product, with comma",SKU001,Main Warehouse,10,`;

    const result = parseShopifyInventoryCsv(csv);

    expect(result.data?.rows[0].handle).toBe('product-1');
  });

  it('should report error when Handle column is missing', () => {
    const csv = `Title,SKU,Location,On hand (current),On hand (new)
Product One,SKU001,Main Warehouse,10,`;

    const result = parseShopifyInventoryCsv(csv);

    const handleError = result.issues.find(
      (i) => i.code === 'MISSING_REQUIRED_COLUMN' && i.column === 'Handle'
    );
    expect(handleError).toBeDefined();
  });

  it('should warn when SKU column is missing', () => {
    const csv = `Handle,Title,Location,On hand (current),On hand (new)
product-1,Product One,Main Warehouse,10,`;

    const result = parseShopifyInventoryCsv(csv);

    const skuWarning = result.issues.find(
      (i) => i.code === 'MISSING_REQUIRED_COLUMN' && i.column === 'SKU'
    );
    expect(skuWarning).toBeDefined();
    expect(skuWarning?.severity).toBe('warning');
  });

  it('should detect invalid quantity formats', () => {
    const csv = `Handle,Title,SKU,Location,On hand (current),On hand (new)
product-1,Product One,SKU001,Main Warehouse,invalid,`;

    const result = parseShopifyInventoryCsv(csv);

    const qtyError = result.issues.find((i) => i.code === 'INVALID_QUANTITY_FORMAT');
    expect(qtyError).toBeDefined();
  });

  it('should extract multiple locations', () => {
    const csv = `Handle,Title,SKU,Location,On hand (current),On hand (new)
product-1,Product One,SKU001,Warehouse A,10,
product-1,Product One,SKU001,Warehouse B,5,`;

    const result = parseShopifyInventoryCsv(csv);

    expect(result.data?.locations).toContain('Warehouse A');
    expect(result.data?.locations).toContain('Warehouse B');
  });

  it('should use format override when provided', () => {
    const csv = `Handle,Title,SKU,Location,On hand (current),On hand (new)
product-1,Product One,SKU001,Main,10,`;

    const result = parseShopifyInventoryCsv(csv, 'available');

    expect(result.data?.format).toBe('available');
  });

  it('should parse option columns', () => {
    const csv = `Handle,Title,SKU,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Location,On hand (current),On hand (new)
product-1,Product One,SKU001,Size,Large,Color,Red,Main,10,`;

    const result = parseShopifyInventoryCsv(csv);

    expect(result.data?.rows[0].options).toHaveLength(2);
    expect(result.data?.rows[0].options[0]).toEqual({ name: 'Size', value: 'Large' });
    expect(result.data?.rows[0].options[1]).toEqual({ name: 'Color', value: 'Red' });
  });

  it('should handle empty file', () => {
    const csv = '';

    const result = parseShopifyInventoryCsv(csv);

    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.severity === 'error')).toBe(true);
  });
});
