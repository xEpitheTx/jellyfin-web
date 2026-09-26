import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { describe, expect, it } from 'vitest';

import { getRecentlyAddedShowsRequest } from './recentlyAddedShows';

describe('getRecentlyAddedShowsRequest', () => {
    it('asks for shows in the library, newest episodes first', () => {
        const request = getRecentlyAddedShowsRequest('user', 'tvlib', 16, false);
        expect(request.parentId).toBe('tvlib');
        expect(request.includeItemTypes).toEqual([ BaseItemKind.Series ]);
        expect(request.sortBy?.[0]).toBe(ItemSortBy.DateLastContentAdded);
        expect(request.sortOrder?.[0]).toBe(SortOrder.Descending);
        expect(request.recursive).toBe(true);
        expect(request.limit).toBe(16);
        expect(request.isPlayed).toBeUndefined();
    });

    it('hides fully watched shows when the user hides watched content from latest', () => {
        expect(getRecentlyAddedShowsRequest('user', 'tvlib', 16, true).isPlayed).toBe(false);
    });
});
