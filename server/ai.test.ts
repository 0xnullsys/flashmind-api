import { describe, it, expect } from 'vitest';
import { detectCategory } from './ai.js';

describe('detectCategory', () => {
  describe('Biologi', () => {
    it('returns "Biologi" for text containing "sel"', () => {
      expect(detectCategory('Sel adalah unit dasar kehidupan.')).toBe('Biologi');
    });

    it('returns "Biologi" for text containing "fotosintesis"', () => {
      expect(detectCategory('Fotosintesis terjadi di daun.')).toBe('Biologi');
    });

    it('returns "Biologi" for text containing "membran"', () => {
      expect(detectCategory('Membran sel bersifat semipermeabel.')).toBe('Biologi');
    });
  });

  describe('Fisika', () => {
    it('returns "Fisika" for text containing "gaya"', () => {
      expect(detectCategory('Gaya Newton kedua menyatakan F = ma.')).toBe('Fisika');
    });

    it('returns "Fisika" for text containing "energi"', () => {
      expect(detectCategory('Energi kinetik adalah 1/2 mv^2.')).toBe('Fisika');
    });
  });

  describe('Matematika', () => {
    it('returns "Matematika" for text containing "aljabar"', () => {
      expect(detectCategory('Aljabar linear membahas vektor dan matriks.')).toBe('Matematika');
    });

    it('returns "Matematika" for text containing "integral"', () => {
      expect(detectCategory('Integral tak tentu dari x^2 adalah x^3/3.')).toBe('Matematika');
    });
  });

  describe('case insensitivity', () => {
    it('matches keywords regardless of case', () => {
      expect(detectCategory('FOTOSINTESIS menghasilkan glukosa.')).toBe('Biologi');
      expect(detectCategory('GAYA adalah besaran vektor.')).toBe('Fisika');
    });
  });

  describe('no match', () => {
    it('returns undefined for text without any category keywords', () => {
      expect(detectCategory('Ini adalah kalimat random tanpa topik spesifik.')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(detectCategory('')).toBeUndefined();
    });
  });

  describe('priority order', () => {
    it('returns "Biologi" when text contains keywords from multiple categories (first match wins)', () => {
      // Biologi dicek duluan; "fotosintesis" muncul sebelum "energi"
      expect(detectCategory('Fotosintesis mengubah energi cahaya menjadi kimia.')).toBe('Biologi');
    });
  });
});