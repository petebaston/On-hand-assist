import { describe, it, expect } from 'vitest';
import { normalizeSku, calculateSimilarity } from '@/lib/match/matchEngine';

describe('normalizeSku', () => {
  it('should trim whitespace', () => {
    expect(normalizeSku('  ABC123  ')).toBe('ABC123');
  });

  it('should convert to uppercase', () => {
    expect(normalizeSku('abc123')).toBe('ABC123');
    expect(normalizeSku('AbC123')).toBe('ABC123');
  });

  it('should collapse multiple spaces', () => {
    expect(normalizeSku('ABC  123')).toBe('ABC 123');
    expect(normalizeSku('ABC   DEF   123')).toBe('ABC DEF 123');
  });

  it('should preserve leading zeros', () => {
    expect(normalizeSku('00123')).toBe('00123');
    expect(normalizeSku('000ABC')).toBe('000ABC');
  });

  it('should remove separators when option is enabled', () => {
    expect(normalizeSku('ABC-123', { removeSeparators: true })).toBe('ABC123');
    expect(normalizeSku('ABC_123', { removeSeparators: true })).toBe('ABC123');
    expect(normalizeSku('ABC.123', { removeSeparators: true })).toBe('ABC123');
    expect(normalizeSku('ABC 123', { removeSeparators: true })).toBe('ABC123');
  });

  it('should keep separators when option is disabled', () => {
    expect(normalizeSku('ABC-123')).toBe('ABC-123');
    expect(normalizeSku('ABC_123')).toBe('ABC_123');
    expect(normalizeSku('ABC.123')).toBe('ABC.123');
  });

  it('should handle empty strings', () => {
    expect(normalizeSku('')).toBe('');
    expect(normalizeSku('   ')).toBe('');
  });

  it('should handle special characters', () => {
    expect(normalizeSku('ABC/123')).toBe('ABC/123');
    expect(normalizeSku('ABC#123')).toBe('ABC#123');
  });
});

describe('calculateSimilarity', () => {
  it('should return 100 for identical strings', () => {
    expect(calculateSimilarity('ABC123', 'ABC123')).toBe(100);
  });

  it('should return 0 for completely different strings', () => {
    expect(calculateSimilarity('AAAA', 'ZZZZ')).toBeLessThan(50);
  });

  it('should return 0 for empty strings', () => {
    expect(calculateSimilarity('', 'ABC')).toBe(0);
    expect(calculateSimilarity('ABC', '')).toBe(0);
  });

  it('should return 100 for two empty strings', () => {
    expect(calculateSimilarity('', '')).toBe(100);
  });

  it('should be symmetric', () => {
    const a = 'ABC123';
    const b = 'ABC124';
    expect(calculateSimilarity(a, b)).toBe(calculateSimilarity(b, a));
  });

  it('should give high score for similar strings', () => {
    expect(calculateSimilarity('ABC123', 'ABC124')).toBeGreaterThan(80);
    expect(calculateSimilarity('PRODUCT-001', 'PRODUCT-002')).toBeGreaterThan(80);
  });

  it('should give lower score for less similar strings', () => {
    expect(calculateSimilarity('ABC123', 'XYZ789')).toBeLessThan(50);
  });
});
