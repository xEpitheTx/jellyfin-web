import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

function toTime(date: string | null | undefined) {
    const time = date ? Date.parse(date) : NaN;
    return Number.isNaN(time) ? 0 : time;
}

/**
 * Merges in-progress items and Next Up episodes into a single row, most
 * recently watched first, like Plex's Continue Watching. A show that has an
 * in-progress episode only appears once, as that episode.
 */
export function mergeContinueWatching(
    resumeItems: BaseItemDto[],
    nextUpItems: BaseItemDto[],
    recentlyPlayedEpisodes: BaseItemDto[]
): BaseItemDto[] {
    const lastPlayedBySeries = new Map<string, number>();
    for (const episode of recentlyPlayedEpisodes) {
        if (!episode.SeriesId) continue;
        const time = toTime(episode.UserData?.LastPlayedDate);
        if (time > (lastPlayedBySeries.get(episode.SeriesId) ?? 0)) {
            lastPlayedBySeries.set(episode.SeriesId, time);
        }
    }

    const seriesInProgress = new Set(
        resumeItems.map(item => item.SeriesId).filter(Boolean)
    );

    const entries = [
        ...resumeItems.map(item => ({
            item,
            time: toTime(item.UserData?.LastPlayedDate)
        })),
        ...nextUpItems
            .filter(item => !item.SeriesId || !seriesInProgress.has(item.SeriesId))
            .map(item => ({
                item,
                time: lastPlayedBySeries.get(item.SeriesId ?? '') ?? 0
            }))
    ];

    // Stable sort, so items without a play date keep the server's order.
    entries.sort((a, b) => b.time - a.time);

    const seenIds = new Set<string>();
    return entries
        .map(entry => entry.item)
        .filter(item => {
            if (!item.Id) return true;
            if (seenIds.has(item.Id)) return false;
            seenIds.add(item.Id);
            return true;
        });
}
