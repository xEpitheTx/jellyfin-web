import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { UserItemDataDto } from '@jellyfin/sdk/lib/generated-client/models/user-item-data-dto';
import { describe, expect, it } from 'vitest';

import { mergeContinueWatching } from './continueWatchingOrder';

const playedAt = (date: string): UserItemDataDto => ({ Key: '', ItemId: '', LastPlayedDate: date });
const ids = (items: BaseItemDto[]) => items.map(item => item.Id);

describe('mergeContinueWatching', () => {
    it('orders resume items and next up episodes by when they were last watched', () => {
        const resume: BaseItemDto[] = [
            { Id: 'movie', UserData: playedAt('2026-09-20T00:00:00Z') }
        ];
        const nextUp: BaseItemDto[] = [
            { Id: 'showA-e2', SeriesId: 'showA' },
            { Id: 'showB-e5', SeriesId: 'showB' }
        ];
        const played: BaseItemDto[] = [
            { Id: 'showB-e4', SeriesId: 'showB', UserData: playedAt('2026-09-25T00:00:00Z') },
            { Id: 'showA-e1', SeriesId: 'showA', UserData: playedAt('2026-09-10T00:00:00Z') }
        ];

        expect(ids(mergeContinueWatching(resume, nextUp, played)))
            .toEqual([ 'showB-e5', 'movie', 'showA-e2' ]);
    });

    it('shows a series once, as its in-progress episode', () => {
        const resume: BaseItemDto[] = [
            { Id: 'showA-e3', SeriesId: 'showA', UserData: playedAt('2026-09-20T00:00:00Z') }
        ];
        const nextUp: BaseItemDto[] = [ { Id: 'showA-e4', SeriesId: 'showA' } ];

        expect(ids(mergeContinueWatching(resume, nextUp, []))).toEqual([ 'showA-e3' ]);
    });

    it('uses the most recent play of a series and keeps server order for unknown dates', () => {
        const nextUp: BaseItemDto[] = [
            { Id: 'x', SeriesId: 'showX' },
            { Id: 'y', SeriesId: 'showY' },
            { Id: 'z', SeriesId: 'showZ' }
        ];
        const played: BaseItemDto[] = [
            { SeriesId: 'showZ', UserData: playedAt('2026-01-01T00:00:00Z') },
            { SeriesId: 'showZ', UserData: playedAt('2026-03-01T00:00:00Z') }
        ];

        expect(ids(mergeContinueWatching([], nextUp, played))).toEqual([ 'z', 'x', 'y' ]);
    });

    it('removes duplicate items', () => {
        const item: BaseItemDto = { Id: 'dup', UserData: playedAt('2026-09-20T00:00:00Z') };
        expect(ids(mergeContinueWatching([ item ], [ { Id: 'dup' } ], []))).toEqual([ 'dup' ]);
    });
});
