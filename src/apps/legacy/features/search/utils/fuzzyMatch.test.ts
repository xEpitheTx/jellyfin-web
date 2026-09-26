import { describe, expect, it } from 'vitest';

import { allowedTypos, editDistance, findFuzzyMatches, fuzzyScore, normalizeForSearch } from './fuzzyMatch';

describe('normalizeForSearch', () => {
    it('lowercases and strips accents and punctuation', () => {
        expect(normalizeForSearch('  Amélie: Le Fabuleux Destin!  ')).toBe('amelie le fabuleux destin');
        expect(normalizeForSearch('Fast & Furious')).toBe('fast and furious');
    });
});

describe('editDistance', () => {
    it('counts edits', () => {
        expect(editDistance('kitten', 'sitting')).toBe(3);
        expect(editDistance('', 'abc')).toBe(3);
        expect(editDistance('same', 'same')).toBe(0);
    });

    it('counts a swap of neighboring letters as one edit', () => {
        expect(editDistance('teh', 'the')).toBe(1);
    });
});

describe('allowedTypos', () => {
    it('allows more typos for longer queries', () => {
        expect(allowedTypos(2)).toBe(0);
        expect(allowedTypos(4)).toBe(1);
        expect(allowedTypos(8)).toBe(2);
        expect(allowedTypos(12)).toBe(3);
    });
});

describe('fuzzyScore', () => {
    it('matches typos in part of a title', () => {
        expect(fuzzyScore('godfathr', 'The Godfather')).toBe(1);
        expect(fuzzyScore('nosferatoo', 'Nosferatu')).toBe(2);
        expect(fuzzyScore('north by northwst', 'North by Northwest')).toBe(1);
    });

    it('matches swapped letters', () => {
        expect(fuzzyScore('charaed', 'Charade')).toBe(1);
    });

    it('returns 0 for substring matches', () => {
        expect(fuzzyScore('window', 'Rear Window')).toBe(0);
    });

    it('rejects unrelated titles and very short queries', () => {
        expect(fuzzyScore('godfathr', 'Metropolis')).toBeNull();
        expect(fuzzyScore('xy', 'xz')).toBeNull();
        expect(fuzzyScore('', 'Anything')).toBeNull();
    });
});

describe('findFuzzyMatches', () => {
    const entries = [
        { Id: '1', Name: 'The Godfather Part II' },
        { Id: '2', Name: 'The Godfather' },
        { Id: '3', Name: 'Metropolis' },
        { Id: '4', Name: 'Godfather' },
        { Name: 'No Id' },
        { Id: '5' }
    ];

    it('orders by closeness, then shorter titles', () => {
        expect(findFuzzyMatches('godfathr', entries)).toEqual([ '4', '2', '1' ]);
    });

    it('respects the limit', () => {
        expect(findFuzzyMatches('godfathr', entries, 1)).toEqual([ '4' ]);
    });
});
