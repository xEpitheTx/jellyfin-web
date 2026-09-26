import type { Api } from '@jellyfin/sdk/lib/api';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import type { QueryClient } from '@tanstack/react-query';

import { findFuzzyMatches } from '../utils/fuzzyMatch';
import { fetchItemsByType } from './fetchItemsByType';

/** Types worth matching by title; episodes and songs would flood the index. */
const FUZZY_ITEM_TYPES: BaseItemKind[] = [
    BaseItemKind.Movie,
    BaseItemKind.Series,
    BaseItemKind.BoxSet,
    BaseItemKind.MusicAlbum
];

const INDEX_STALE_TIME = 10 * 60 * 1000;

/**
 * Close title matches for a search that found nothing, like Plex's
 * typo-tolerant search. The title index is fetched once and cached.
 */
export async function fetchFuzzyMatches(
    queryClient: QueryClient,
    api: Api,
    userId: string,
    itemTypes: BaseItemKind[],
    parentId: string | undefined,
    searchTerm: string,
    signal?: AbortSignal
): Promise<BaseItemDto[]> {
    const types = itemTypes.filter(type => FUZZY_ITEM_TYPES.includes(type));
    if (!types.length) return [];

    const index = await queryClient.fetchQuery({
        queryKey: [ 'Search', 'FuzzyIndex', userId, parentId, types ],
        queryFn: async () => {
            const response = await getLibraryApi(api).getItems({
                userId,
                parentId,
                recursive: true,
                includeItemTypes: types,
                enableImages: false,
                enableUserData: false,
                enableTotalRecordCount: false
            });
            return (response.data.Items ?? []).map(item => ({ Id: item.Id, Name: item.Name }));
        },
        staleTime: INDEX_STALE_TIME
    });

    const ids = findFuzzyMatches(searchTerm, index);
    if (!ids.length) return [];

    const result = await fetchItemsByType(api, userId, { ids }, { signal });
    const order = new Map(ids.map((id, i) => [ id, i ]));
    return (result.Items ?? []).sort(
        (a, b) => (order.get(a.Id ?? '') ?? 0) - (order.get(b.Id ?? '') ?? 0)
    );
}

/** Like fetchFuzzyMatches, but a failure or missing input only means no suggestions. */
export async function fetchFuzzyMatchesSafely(
    queryClient: QueryClient,
    api: Api,
    userId: string | undefined,
    itemTypes: BaseItemKind[],
    parentId: string | undefined,
    searchTerm: string | undefined,
    signal?: AbortSignal
): Promise<BaseItemDto[]> {
    if (!userId || !searchTerm) return [];
    return fetchFuzzyMatches(queryClient, api, userId, itemTypes, parentId, searchTerm, signal).catch(err => {
        console.error('[Search] failed to find close matches', err);
        return [];
    });
}
