import { describe, it, expect } from 'vitest';
import {
  parseSupplierFeedCsv,
  detectSupplierColumns,
  getPreviewRows,
} from '@/lib/csv/parseSupplierFeed';

describe('detectSupplierColumns', () => {
  it('should detect SKU column', () => {
    const headers = ['SKU', 'Quantity', 'Price'];
    const result = detectSupplierColumns(headers);

    expect(result.skuColumn).toBe(0);
    expect(result.confidence.sku).toBe('high');
  });

  it('should detect quantity column', () => {
    const headers = ['SKU', 'Qty', 'Price'];
    const result = detectSupplierColumns(headers);

    expect(result.qtyColumn).toBe(1);
    expect(result.confidence.qty).toBe('high');
  });

  it('should detect location column', () => {
    const headers = ['SKU', 'Qty', 'Warehouse'];
    const result = detectSupplierColumns(headers);

    expect(result.locationColumn).toBe(2);
  });

  it('should detect alternative SKU column names', () => {
    const headers1 = ['Product SKU', 'Qty'];
    expect(detectSupplierColumns(headers1).skuColumn).toBe(0);

    const headers2 = ['Item Number', 'Qty'];
    expect(detectSupplierColumns(headers2).skuColumn).toBe(0);

    const headers3 = ['UPC', 'Qty'];
    expect(detectSupplierColumns(headers3).skuColumn).toBe(0);

    const headers4 = ['Barcode', 'Qty'];
    expect(detectSupplierColumns(headers4).skuColumn).toBe(0);
  });

  it('should detect alternative quantity column names', () => {
    const headers1 = ['SKU', 'Quantity'];
    expect(detectSupplierColumns(headers1).qtyColumn).toBe(1);

    const headers2 = ['SKU', 'Stock'];
    expect(detectSupplierColumns(headers2).qtyColumn).toBe(1);

    const headers3 = ['SKU', 'Available'];
    expect(detectSupplierColumns(headers3).qtyColumn).toBe(1);

    const headers4 = ['SKU', 'On Hand'];
    expect(detectSupplierColumns(headers4).qtyColumn).toBe(1);
  });

  it('should return null when columns not found', () => {
    const headers = ['Column A', 'Column B', 'Column C'];
    const result = detectSupplierColumns(headers);

    expect(result.skuColumn).toBeNull();
    expect(result.qtyColumn).toBeNull();
  });
});

describe('parseSupplierFeedCsv', () => {
  it('should parse valid supplier CSV', () => {
    const csv = `SKU,Qty,Price
SKU001,10,19.99
SKU002,20,29.99
SKU003,5,9.99`;

    const result = parseSupplierFeedCsv(csv);

    expect(result.success).toBe(true);
    expect(result.data?.rows).toHaveLength(3);
    expect(result.data?.rows[0].sku).toBe('SKU001');
    expect(result.data?.rows[0].qty).toBe(10);
  });

  it('should preserve leading zeros in SKUs', () => {
    const csv = `SKU,Qty
00123,10
000ABC,20`;

    const result = parseSupplierFeedCsv(csv);

    expect(result.data?.rows[0].sku).toBe('00123');
    expect(result.data?.rows[1].sku).toBe('000ABC');
  });

  it('should handle comma-formatted quantities', () => {
    const csv = `SKU,Qty
SKU001,"1,000"
SKU002,"10,500"`;

    const result = parseSupplierFeedCsv(csv);

    expect(result.data?.rows[0].qty).toBe(1000);
    expect(result.data?.rows[1].qty).toBe(10500);
  });

  it('should report error for decimal quantities', () => {
    const csv = `SKU,Qty
SKU001,10.5
SKU002,20.25`;

    const result = parseSupplierFeedCsv(csv);

    const decimalErrors = result.issues.filter(
      (i) => i.code === 'SUPPLIER_DECIMAL_QTY'
    );
    expect(decimalErrors.length).toBeGreaterThan(0);
  });

  it('should warn about negative quantities', () => {
    const csv = `SKU,Qty
SKU001,-10
SKU002,20`;

    const result = parseSupplierFeedCsv(csv);

    const negativeWarning = result.issues.find(
      (i) => i.code === 'SUPPLIER_NEGATIVE_QTY'
    );
    expect(negativeWarning).toBeDefined();
    expect(negativeWarning?.severity).toBe('warning');
  });

  it('should warn about duplicate SKUs', () => {
    const csv = `SKU,Qty
SKU001,10
SKU001,20
SKU002,30`;

    const result = parseSupplierFeedCsv(csv);

    const dupWarning = result.issues.find(
      (i) => i.code === 'SUPPLIER_DUPLICATE_SKU'
    );
    expect(dupWarning).toBeDefined();
  });

  it('should skip blank SKUs and warn', () => {
    const csv = `SKU,Qty
SKU001,10
,20
SKU002,30`;

    const result = parseSupplierFeedCsv(csv);

    expect(result.data?.rows).toHaveLength(2); // Only 2 valid rows
    const blankWarning = result.issues.find((i) => i.code === 'SUPPLIER_BLANK_SKU');
    expect(blankWarning).toBeDefined();
  });

  it('should use provided column mapping', () => {
    const csv = `Product Code,Stock Level
SKU001,10
SKU002,20`;

    const result = parseSupplierFeedCsv(csv, { sku: 0, qty: 1 });

    expect(result.success).toBe(true);
    expect(result.data?.rows[0].sku).toBe('SKU001');
    expect(result.data?.rows[0].qty).toBe(10);
  });

  it('should fail when required columns cannot be detected', () => {
    const csv = `Column A,Column B
Value1,Value2`;

    const result = parseSupplierFeedCsv(csv);

    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.code === 'SUPPLIER_MISSING_SKU_COLUMN')).toBe(true);
  });

  it('should warn about suspiciously high quantities', () => {
    const csv = `SKU,Qty
SKU001,2000000`;

    const result = parseSupplierFeedCsv(csv);

    const suspiciousWarning = result.issues.find(
      (i) => i.code === 'SUPPLIER_SUSPICIOUS_QTY'
    );
    expect(suspiciousWarning).toBeDefined();
  });

  it('should handle parentheses for negative numbers', () => {
    const csv = `SKU,Qty
SKU001,(10)`;

    const result = parseSupplierFeedCsv(csv);

    expect(result.data?.rows[0].qty).toBe(-10);
  });
});

describe('getPreviewRows', () => {
  it('should return limited preview rows', () => {
    const csv = `SKU,Qty
SKU001,10
SKU002,20
SKU003,30
SKU004,40
SKU005,50
SKU006,60`;

    const result = getPreviewRows(csv, 3);

    expect(result.rows).toHaveLength(3);
    expect(result.totalRows).toBe(6);
  });

  it('should return headers', () => {
    const csv = `SKU,Qty,Price
SKU001,10,19.99`;

    const result = getPreviewRows(csv);

    expect(result.headers).toEqual(['SKU', 'Qty', 'Price']);
  });
});
