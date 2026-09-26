import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

export const MAX_ROWS = 5;

export interface RecommendationRow {
    title: string
    items: BaseItemDto[]
}

/** Alternates movie and show rows so neither dominates the home screen. */
export function interleaveRows(movieRows: RecommendationRow[], seriesRows: RecommendationRow[]) {
    const rows: RecommendationRow[] = [];
    const length = Math.max(movieRows.length, seriesRows.length);
    for (let i = 0; i < length; i++) {
        if (movieRows[i]) rows.push(movieRows[i]);
        if (seriesRows[i]) rows.push(seriesRows[i]);
    }
    return rows.filter(row => row.items.length).slice(0, MAX_ROWS);
}
