import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

/**
 * Puts items in watchlist order (newest first) and drops anything already
 * watched or no longer in the library.
 */
export function orderWatchlistItems(ids: string[], items: BaseItemDto[]) {
    const byId = new Map(items.map(item => [ item.Id, item ]));
    return ids
        .map(id => byId.get(id))
        .filter((item): item is BaseItemDto => !!item && !item.UserData?.Played);
}
