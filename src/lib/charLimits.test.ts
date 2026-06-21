import { describe, it, expect } from 'vitest';
import { countChars, checkFrontLimit, checkBackLimit, MAX_FRONT_CHARS, MAX_BACK_CHARS } from './charLimits';

describe('charLimits', () => {
  describe('countChars', () => {
    it('counts characters including spaces', () => {
      expect(countChars('hello world')).toBe(11);
      expect(countChars('a b c d')).toBe(7);
    });

    it('returns 0 for empty string', () => {
      expect(countChars('')).toBe(0);
    });

    it('counts punctuation as characters', () => {
      expect(countChars('hello!')).toBe(6);
      expect(countChars("don't worry")).toBe(11);
    });

    it('counts CJK characters as 1 each', () => {
      expect(countChars('你好')).toBe(2);
      expect(countChars('こんにちは')).toBe(5);
    });

    it('counts emoji as 1 (single code point)', () => {
      expect(countChars('👋')).toBe(1);
      expect(countChars('👋🌍')).toBe(2);
    });

    it('counts newlines and tabs', () => {
      expect(countChars('a\nb')).toBe(3);
      expect(countChars('a\tb\tc')).toBe(5);
    });

    it('counts Indonesian text with diacritics', () => {
      expect(countChars('café')).toBe(4);
    });

    it('handles long strings', () => {
      const longStr = 'a'.repeat(500);
      expect(countChars(longStr)).toBe(500);
    });
  });

  describe('checkFrontLimit', () => {
    it('returns ok=true for text under limit', () => {
      const result = checkFrontLimit('Apa itu fotosintesis?');
      expect(result.ok).toBe(true);
      expect(result.count).toBe(21);
      expect(result.max).toBe(MAX_FRONT_CHARS);
    });

    it('returns ok=true exactly at limit', () => {
      const text = 'a'.repeat(MAX_FRONT_CHARS);
      expect(checkFrontLimit(text).ok).toBe(true);
    });

    it('returns ok=false over limit', () => {
      const text = 'a'.repeat(MAX_FRONT_CHARS + 1);
      const result = checkFrontLimit(text);
      expect(result.ok).toBe(false);
      expect(result.count).toBe(MAX_FRONT_CHARS + 1);
    });
  });

  describe('checkBackLimit', () => {
    it('returns ok=true for text under limit', () => {
      const result = checkBackLimit('Fotosintesis adalah proses...');
      expect(result.ok).toBe(true);
      expect(result.max).toBe(MAX_BACK_CHARS);
    });

    it('returns ok=false for very long text', () => {
      const text = 'a'.repeat(MAX_BACK_CHARS + 1);
      expect(checkBackLimit(text).ok).toBe(false);
    });
  });

  describe('limit constants', () => {
    it('MAX_FRONT_CHARS = 120', () => {
      expect(MAX_FRONT_CHARS).toBe(120);
    });

    it('MAX_BACK_CHARS = 500', () => {
      expect(MAX_BACK_CHARS).toBe(500);
    });
  });
});
