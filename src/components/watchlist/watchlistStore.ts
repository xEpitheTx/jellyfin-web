import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';

/**
 * A Plex-style watchlist, stored as a per-user server preference so it
 * follows the user between browsers. Jellyfin playlists can't be used because
 * adding a show to one adds every episode.
 */
export const WATCHLIST_KEY = 'watchlist';
export const WATCHLIST_MAX_ITEMS = 500;

const SUPPORTED_TYPES = new Set<string>([ BaseItemKind.Movie, BaseItemKind.Series ]);

export function canWatchlist(item: { Type?: string | null } | null | undefined) {
    return !!item?.Type && SUPPORTED_TYPES.has(item.Type);
}

/** Item ids, newest first. Ignores anything that isn't an id and duplicates. */
export function parseWatchlist(value: string | null | undefined): string[] {
    if (!value) return [];
    const ids = value.split(',').map(id => id.trim()).filter(id => /^[0-9a-f]{32}$/i.test(id));
    return [ ...new Set(ids) ];
}

export function serializeWatchlist(ids: string[]) {
    return ids.slice(0, WATCHLIST_MAX_ITEMS).join(',');
}

export function addToWatchlist(ids: string[], id: string) {
    return [ id, ...ids.filter(existing => existing !== id) ].slice(0, WATCHLIST_MAX_ITEMS);
}

export function removeFromWatchlist(ids: string[], id: string) {
    return ids.filter(existing => existing !== id);
}

interface SettingsStore {
    get(name: string, enableOnServer?: boolean): string | null | undefined
    set(name: string, value: string, enableOnServer?: boolean): unknown
}

export function getWatchlist(settings: SettingsStore) {
    return parseWatchlist(settings.get(WATCHLIST_KEY));
}

export function isInWatchlist(settings: SettingsStore, id: string | null | undefined) {
    return !!id && getWatchlist(settings).includes(id);
}

/** Adds or removes an item; returns whether it is now on the watchlist. */
export function toggleWatchlist(settings: SettingsStore, id: string) {
    const ids = getWatchlist(settings);
    const isAdding = !ids.includes(id);
    const updated = isAdding ? addToWatchlist(ids, id) : removeFromWatchlist(ids, id);
    settings.set(WATCHLIST_KEY, serializeWatchlist(updated));
    return isAdding;
}
