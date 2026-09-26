import { PersonKind } from '@jellyfin/sdk/lib/generated-client/models/person-kind';
import type { UserItemDataDto } from '@jellyfin/sdk/lib/generated-client/models/user-item-data-dto';
import { describe, expect, it } from 'vitest';

import { getFeaturedPeople, getResumeInfo, splitMinutes } from './detailsInfo';

const MINUTE = 600_000_000;
const userData = (positionTicks: number): UserItemDataDto => ({ Key: '', ItemId: '', PlaybackPositionTicks: positionTicks });

describe('getResumeInfo', () => {
    it('returns null when nothing has been watched', () => {
        expect(getResumeInfo({ RunTimeTicks: 90 * MINUTE })).toBeNull();
        expect(getResumeInfo({ RunTimeTicks: 90 * MINUTE, UserData: userData(0) })).toBeNull();
    });

    it('computes progress and minutes left', () => {
        expect(getResumeInfo({ RunTimeTicks: 100 * MINUTE, UserData: userData(25 * MINUTE) })).toEqual({
            positionTicks: 25 * MINUTE,
            progressPercent: 25,
            minutesLeft: 75
        });
    });

    it('rounds minutes left up and never shows zero', () => {
        expect(getResumeInfo({ RunTimeTicks: 10 * MINUTE, UserData: userData(9.9 * MINUTE) })?.minutesLeft).toBe(1);
        expect(getResumeInfo({ RunTimeTicks: 10 * MINUTE, UserData: userData(8.5 * MINUTE) })?.minutesLeft).toBe(2);
    });

    it('omits progress when the runtime is unknown or exceeded', () => {
        const unknown = getResumeInfo({ UserData: userData(5 * MINUTE) });
        expect(unknown).toEqual({ positionTicks: 5 * MINUTE, progressPercent: null, minutesLeft: null });
        expect(getResumeInfo({ RunTimeTicks: MINUTE, UserData: userData(2 * MINUTE) })?.minutesLeft).toBeNull();
    });
});

describe('splitMinutes', () => {
    it('splits into hours and minutes', () => {
        expect(splitMinutes(45)).toEqual({ hours: 0, minutes: 45 });
        expect(splitMinutes(125)).toEqual({ hours: 2, minutes: 5 });
    });
});

describe('getFeaturedPeople', () => {
    it('picks the first director and first actor', () => {
        const people = [
            { Id: 'w', Name: 'Writer', Type: PersonKind.Writer },
            { Id: 'a1', Name: 'Lead', Type: PersonKind.Actor },
            { Id: 'd', Name: 'Director', Type: PersonKind.Director },
            { Id: 'a2', Name: 'Support', Type: PersonKind.Actor }
        ];
        const { director, leadActor } = getFeaturedPeople(people);
        expect(director?.Id).toBe('d');
        expect(leadActor?.Id).toBe('a1');
    });

    it('skips people without an id and handles missing people', () => {
        expect(getFeaturedPeople([ { Name: 'No Id', Type: PersonKind.Director } ]).director).toBeUndefined();
        expect(getFeaturedPeople(undefined)).toEqual({ director: undefined, leadActor: undefined });
    });
});
