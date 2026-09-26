import { describe, expect, it } from 'vitest';

import {
    addToWatchlist,
    canWatchlist,
    isInWatchlist,
    parseWatchlist,
    removeFromWatchlist,
    serializeWatchlist,
    toggleWatchlist,
    WATCHLIST_KEY,
    WATCHLIST_MAX_ITEMS
} from './watchlistStore';

const id = (n: number) => n.toString(16).padStart(32, '0');

function memorySettings(initial?: string) {
    const values: Record<string, string> = {};
    if (initial !== undefined) values[WATCHLIST_KEY] = initial;
    return {
        values,
        get: (name: string) => values[name],
        set: (name: string, value: string) => { values[name] = value; }
    };
}

describe('parseWatchlist', () => {
    it('reads ids and drops junk and duplicates', () => {
        expect(parseWatchlist(`${id(1)}, nope,${id(2)},${id(1)}`)).toEqual([ id(1), id(2) ]);
        expect(parseWatchlist(null)).toEqual([]);
        expect(parseWatchlist('')).toEqual([]);
    });
});

describe('addToWatchlist / removeFromWatchlist', () => {
    it('adds to the front and moves existing items to the front', () => {
        expect(addToWatchlist([ id(1), id(2) ], id(3))).toEqual([ id(3), id(1), id(2) ]);
        expect(addToWatchlist([ id(1), id(2) ], id(2))).toEqual([ id(2), id(1) ]);
    });

    it('caps the list size', () => {
        const full = Array.from({ length: WATCHLIST_MAX_ITEMS }, (_, i) => id(i + 1));
        const updated = addToWatchlist(full, id(9999));
        expect(updated).toHaveLength(WATCHLIST_MAX_ITEMS);
        expect(updated[0]).toBe(id(9999));
    });

    it('removes items', () => {
        expect(removeFromWatchlist([ id(1), id(2) ], id(1))).toEqual([ id(2) ]);
        expect(removeFromWatchlist([ id(1) ], id(5))).toEqual([ id(1) ]);
    });

    it('round-trips through the stored format', () => {
        expect(parseWatchlist(serializeWatchlist([ id(1), id(2) ]))).toEqual([ id(1), id(2) ]);
    });
});

describe('toggleWatchlist', () => {
    it('adds then removes and saves each time', () => {
        const settings = memorySettings();
        expect(toggleWatchlist(settings, id(7))).toBe(true);
        expect(isInWatchlist(settings, id(7))).toBe(true);
        expect(toggleWatchlist(settings, id(7))).toBe(false);
        expect(isInWatchlist(settings, id(7))).toBe(false);
        expect(settings.values[WATCHLIST_KEY]).toBe('');
    });

    it('treats a missing id as not on the list', () => {
        expect(isInWatchlist(memorySettings(id(1)), undefined)).toBe(false);
    });
});

describe('canWatchlist', () => {
    it('supports movies and shows only', () => {
        expect(canWatchlist({ Type: 'Movie' })).toBe(true);
        expect(canWatchlist({ Type: 'Series' })).toBe(true);
        expect(canWatchlist({ Type: 'Episode' })).toBe(false);
        expect(canWatchlist(null)).toBe(false);
    });
});
