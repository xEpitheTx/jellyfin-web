import { describe, expect, it } from 'vitest';

import { interleaveRows, MAX_ROWS, type RecommendationRow } from './recommendationRows';

const row = (title: string, count = 1): RecommendationRow => ({
    title,
    items: Array.from({ length: count }, (_, i) => ({ Id: `${title}-${i}` }))
});

describe('interleaveRows', () => {
    it('alternates movie and show rows', () => {
        expect(interleaveRows([ row('m1'), row('m2'), row('m3') ], [ row('s1') ]).map(r => r.title))
            .toEqual([ 'm1', 's1', 'm2', 'm3' ]);
    });

    it('drops empty rows', () => {
        expect(interleaveRows([ row('m1', 0) ], [ row('s1') ]).map(r => r.title)).toEqual([ 's1' ]);
    });

    it('caps the number of rows', () => {
        const many = Array.from({ length: 10 }, (_, i) => row(`m${i}`));
        expect(interleaveRows(many, many)).toHaveLength(MAX_ROWS);
    });

    it('handles no recommendations', () => {
        expect(interleaveRows([], [])).toEqual([]);
    });
});
