import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { BaseItemPerson } from '@jellyfin/sdk/lib/generated-client/models/base-item-person';
import { PersonKind } from '@jellyfin/sdk/lib/generated-client/models/person-kind';

const TICKS_PER_MINUTE = 600_000_000;

export interface ResumeInfo {
    positionTicks: number
    /** Percent watched, or null when the runtime is unknown. */
    progressPercent: number | null
    /** Whole minutes left (at least 1), or null when the runtime is unknown. */
    minutesLeft: number | null
}

/** Details for a Plex-style "Resume from 12:34 · 40 min left" button. */
export function getResumeInfo(item: Pick<BaseItemDto, 'UserData' | 'RunTimeTicks'>): ResumeInfo | null {
    const positionTicks = item.UserData?.PlaybackPositionTicks ?? 0;
    if (positionTicks <= 0) return null;

    const runTimeTicks = item.RunTimeTicks ?? 0;
    if (runTimeTicks <= 0 || positionTicks >= runTimeTicks) {
        return { positionTicks, progressPercent: null, minutesLeft: null };
    }

    return {
        positionTicks,
        progressPercent: (positionTicks / runTimeTicks) * 100,
        minutesLeft: Math.max(1, Math.ceil((runTimeTicks - positionTicks) / TICKS_PER_MINUTE))
    };
}

export function splitMinutes(totalMinutes: number) {
    return {
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60
    };
}

export interface FeaturedPeople {
    director?: BaseItemPerson
    leadActor?: BaseItemPerson
}

/** The people Plex-style "Directed by" and "Starring" rows are built from. */
export function getFeaturedPeople(people: BaseItemPerson[] | null | undefined): FeaturedPeople {
    const withId = (people ?? []).filter(person => person.Id && person.Name);
    return {
        director: withId.find(person => person.Type === PersonKind.Director),
        leadActor: withId.find(person => person.Type === PersonKind.Actor)
    };
}
