import { HomeSectionType } from 'constants/homeSectionType';
import type { UserSettings } from 'scripts/settings/userSettings';

/**
 * Home rows that only this client knows about. The server replaces unknown
 * values in the `homesectionN` preferences with its defaults, so the full
 * layout is stored in its own preference instead.
 */
export enum CustomHomeSectionType {
    ContinueWatching = 'continuewatching',
    Recommendations = 'recommendations'
}

export type HomeRowType = HomeSectionType | CustomHomeSectionType;

export const HOME_LAYOUT_KEY = 'homelayout';
export const HOME_LAYOUT_LENGTH = 10;

export const DEFAULT_HOME_LAYOUT: HomeRowType[] = [
    CustomHomeSectionType.ContinueWatching,
    HomeSectionType.LatestMedia,
    CustomHomeSectionType.Recommendations,
    HomeSectionType.ResumeAudio,
    HomeSectionType.ResumeBook,
    HomeSectionType.LiveTv,
    HomeSectionType.SmallLibraryTiles,
    HomeSectionType.None,
    HomeSectionType.None,
    HomeSectionType.None
];

const knownRowTypes = new Set<string>([
    ...Object.values(HomeSectionType),
    ...Object.values(CustomHomeSectionType)
]);

export function isHomeRowType(value: string): value is HomeRowType {
    return knownRowTypes.has(value);
}

function normalizeLayout(rows: string[]): HomeRowType[] {
    const layout = rows
        .slice(0, HOME_LAYOUT_LENGTH)
        .map(row => (isHomeRowType(row) ? row : HomeSectionType.None));

    while (layout.length < HOME_LAYOUT_LENGTH) {
        layout.push(HomeSectionType.None);
    }

    return layout;
}

export function parseHomeLayout(value: string | null | undefined): HomeRowType[] {
    if (!value) return [ ...DEFAULT_HOME_LAYOUT ];
    return normalizeLayout(value.split(',').map(row => row.trim()));
}

/**
 * Converts a layout to the server-compatible `homesectionN` values so other
 * Jellyfin clients still show a sensible home screen.
 */
export function toServerSections(layout: HomeRowType[]): HomeSectionType[] {
    const sections: HomeSectionType[] = [];

    for (const row of layout) {
        if (row === CustomHomeSectionType.ContinueWatching) {
            sections.push(HomeSectionType.Resume);
            if (!layout.includes(HomeSectionType.NextUp)) {
                sections.push(HomeSectionType.NextUp);
            }
        } else if (row === CustomHomeSectionType.Recommendations) {
            sections.push(HomeSectionType.None);
        } else {
            sections.push(row);
        }
    }

    return normalizeLayout(sections) as HomeSectionType[];
}

export function getHomeLayout(userSettings: UserSettings): HomeRowType[] {
    return parseHomeLayout(userSettings.get(HOME_LAYOUT_KEY));
}

export function saveHomeLayout(userSettings: UserSettings, rows: string[]) {
    const layout = normalizeLayout(rows);
    userSettings.set(HOME_LAYOUT_KEY, layout.join(','));

    toServerSections(layout).forEach((section, index) => {
        userSettings.set(`homesection${index}`, section);
    });
}
