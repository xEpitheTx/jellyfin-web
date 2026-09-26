import type { UserItemDataDto } from '@jellyfin/sdk/lib/generated-client/models/user-item-data-dto';
import { describe, expect, it } from 'vitest';

import { orderWatchlistItems } from './watchlistItems';

const played = (isPlayed: boolean): UserItemDataDto => ({ Key: '', ItemId: '', Played: isPlayed });

describe('orderWatchlistItems', () => {
    it('keeps watchlist order and drops watched and missing items', () => {
        const items = [
            { Id: 'a', UserData: played(false) },
            { Id: 'b', UserData: played(true) },
            { Id: 'c' }
        ];
        expect(orderWatchlistItems([ 'c', 'missing', 'b', 'a' ], items).map(i => i.Id)).toEqual([ 'c', 'a' ]);
    });
});
