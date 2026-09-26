import { DEFAULT_SECTIONS, HomeSectionType } from 'constants/homeSectionType';
import type { UserSettings } from 'scripts/settings/userSettings';

/**
 * Home rows that only this client knows about. The server replaces unknown
 * values in the `homesectionN` preferences with its defaults, so the full
 * layout is stored in its own preference instead.
 */
export enum CustomHomeSectionType {
    ContinueWatching = 'continuewatching',
    Recommendations = 'recommendations',
    Watchlist = 'watchlist'
}

export type HomeRowType = HomeSectionType | CustomHomeSectionType;

export const HOME_LAYOUT_KEY = 'homelayout';
export const HOME_LAYOUT_LENGTH = 10;

export const DEFAULT_HOME_LAYOUT: HomeRowType[] = [
    CustomHomeSectionType.ContinueWatching,
    CustomHomeSectionType.Watchlist,
    HomeSectionType.LatestMedia,
    CustomHomeSectionType.Recommendations,
    HomeSectionType.ResumeAudio,
    HomeSectionType.ResumeBook,
    HomeSectionType.LiveTv,
    HomeSectionType.SmallLibraryTiles,
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

/**
 * Saved layouts record the version they were saved with. Rows added in a
 * later version are slotted into older saved layouts once, so people who
 * customized their home screen still discover new rows; removing a row and
 * saving again keeps it removed.
 */
export const HOME_LAYOUT_VERSION = 2;

const ROWS_ADDED_IN_VERSION: [ HomeRowType, number ][] = [
    [ CustomHomeSectionType.Watchlist, 2 ]
];

function splitVersion(value: string) {
    const match = /^v(\d+):(.*)$/.exec(value);
    return match ?
        { version: Number(match[1]), rows: match[2] } :
        { version: 1, rows: value };
}

function addNewRows(layout: HomeRowType[], savedVersion: number) {
    const updated = [ ...layout ];

    for (const [ row, addedInVersion ] of ROWS_ADDED_IN_VERSION) {
        if (addedInVersion <= savedVersion || updated.includes(row)) continue;

        // Only use a free slot; a full layout is left alone.
        const freeSlot = updated.lastIndexOf(HomeSectionType.None);
        if (freeSlot === -1) continue;
        updated.splice(freeSlot, 1);

        const position = Math.min(DEFAULT_HOME_LAYOUT.indexOf(row), updated.length);
        updated.splice(position, 0, row);
    }

    return updated;
}

export function parseHomeLayout(value: string | null | undefined): HomeRowType[] {
    if (!value) return [ ...DEFAULT_HOME_LAYOUT ];

    const { version, rows } = splitVersion(value);
    const layout = normalizeLayout(rows.split(',').map(row => row.trim()));
    return addNewRows(layout, version);
}

export function serializeHomeLayout(layout: HomeRowType[]) {
    return `v${HOME_LAYOUT_VERSION}:${layout.join(',')}`;
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
        } else if (row === CustomHomeSectionType.Recommendations || row === CustomHomeSectionType.Watchlist) {
            sections.push(HomeSectionType.None);
        } else {
            sections.push(row);
        }
    }

    return normalizeLayout(sections) as HomeSectionType[];
}

/**
 * Picks the layout to show. Without a saved layout, a user who customized the
 * standard `homesectionN` rows keeps them; everyone else gets the new default.
 */
export function resolveHomeLayout(
    saved: string | null | undefined,
    legacySections: (string | null | undefined)[]
): HomeRowType[] {
    if (saved) return parseHomeLayout(saved);

    const legacy = Array.from({ length: HOME_LAYOUT_LENGTH }, (_, i) => {
        const serverDefault = DEFAULT_SECTIONS[i] ?? HomeSectionType.None;
        const value = legacySections[i];
        // Older clients saved '' for "default" and 'folders' for library tiles.
        if (!value) return serverDefault;
        if (value === 'folders') return DEFAULT_SECTIONS[0];
        return value;
    });

    const isCustomized = legacy.some((value, i) => value !== (DEFAULT_SECTIONS[i] ?? HomeSectionType.None));
    return isCustomized ? normalizeLayout(legacy) : [ ...DEFAULT_HOME_LAYOUT ];
}

export function getHomeLayout(userSettings: UserSettings): HomeRowType[] {
    const legacySections = Array.from(
        { length: HOME_LAYOUT_LENGTH },
        (_, i) => userSettings.get(`homesection${i}`)
    );
    return resolveHomeLayout(userSettings.get(HOME_LAYOUT_KEY), legacySections);
}

export function saveHomeLayout(userSettings: UserSettings, rows: string[]) {
    const layout = normalizeLayout(rows);
    userSettings.set(HOME_LAYOUT_KEY, serializeHomeLayout(layout));

    toServerSections(layout).forEach((section, index) => {
        userSettings.set(`homesection${index}`, section);
    });
}
