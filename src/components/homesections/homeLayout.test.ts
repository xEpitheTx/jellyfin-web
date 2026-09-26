import { describe, expect, it } from 'vitest';

import { DEFAULT_SECTIONS, HomeSectionType } from 'constants/homeSectionType';

import {
    CustomHomeSectionType,
    DEFAULT_HOME_LAYOUT,
    HOME_LAYOUT_LENGTH,
    HOME_LAYOUT_VERSION,
    parseHomeLayout,
    resolveHomeLayout,
    serializeHomeLayout,
    toServerSections
} from './homeLayout';

const current = (rows: string) => `v${HOME_LAYOUT_VERSION}:${rows}`;

describe('parseHomeLayout', () => {
    it('uses the default layout when nothing is saved', () => {
        expect(parseHomeLayout(null)).toEqual(DEFAULT_HOME_LAYOUT);
        expect(parseHomeLayout('')).toEqual(DEFAULT_HOME_LAYOUT);
    });

    it('pads short layouts and replaces unknown rows', () => {
        const layout = parseHomeLayout(current('continuewatching, bogus,latestmedia'));
        expect(layout).toHaveLength(HOME_LAYOUT_LENGTH);
        expect(layout.slice(0, 4)).toEqual([
            CustomHomeSectionType.ContinueWatching,
            HomeSectionType.None,
            HomeSectionType.LatestMedia,
            HomeSectionType.None
        ]);
    });

    it('truncates long layouts', () => {
        const saved = Array(15).fill(HomeSectionType.LatestMedia).join(',');
        expect(parseHomeLayout(saved)).toHaveLength(HOME_LAYOUT_LENGTH);
    });
});

describe('toServerSections', () => {
    it('maps custom rows to rows the server accepts', () => {
        const sections = toServerSections(parseHomeLayout(current('continuewatching,latestmedia,recommendations')));
        expect(sections.slice(0, 4)).toEqual([
            HomeSectionType.Resume,
            HomeSectionType.NextUp,
            HomeSectionType.LatestMedia,
            HomeSectionType.None
        ]);
        expect(sections).toHaveLength(HOME_LAYOUT_LENGTH);
    });

    it('drops rows other clients cannot show', () => {
        expect(toServerSections(parseHomeLayout(current('watchlist,recommendations'))).slice(0, 2))
            .toEqual([ HomeSectionType.None, HomeSectionType.None ]);
    });

    it('does not duplicate Next Up when it is already in the layout', () => {
        const sections = toServerSections(parseHomeLayout(current('continuewatching,nextup')));
        expect(sections.filter(s => s === HomeSectionType.NextUp)).toHaveLength(1);
    });

    it('keeps the length fixed when Next Up is inserted into a full layout', () => {
        const full = [ CustomHomeSectionType.ContinueWatching, ...Array(9).fill(HomeSectionType.LatestMedia) ];
        expect(toServerSections(full)).toHaveLength(HOME_LAYOUT_LENGTH);
    });
});

describe('resolveHomeLayout', () => {
    it('prefers the saved layout', () => {
        expect(resolveHomeLayout('latestmedia', [ HomeSectionType.Resume ])[0])
            .toBe(HomeSectionType.LatestMedia);
    });

    it('uses the new default for users on the server defaults', () => {
        expect(resolveHomeLayout(null, [ ...DEFAULT_SECTIONS ])).toEqual(DEFAULT_HOME_LAYOUT);
        expect(resolveHomeLayout(undefined, [])).toEqual(DEFAULT_HOME_LAYOUT);
        expect(resolveHomeLayout(null, [ 'folders', '' ].concat(DEFAULT_SECTIONS.slice(2)))
            .slice(0, 2)).toEqual(DEFAULT_HOME_LAYOUT.slice(0, 2));
    });

    it('keeps a layout the user customized before', () => {
        const legacy = [ HomeSectionType.LatestMedia, HomeSectionType.NextUp ];
        const layout = resolveHomeLayout(null, legacy);
        expect(layout.slice(0, 3)).toEqual([
            HomeSectionType.LatestMedia,
            HomeSectionType.NextUp,
            DEFAULT_SECTIONS[2]
        ]);
        expect(layout).toHaveLength(HOME_LAYOUT_LENGTH);
    });
});

describe('layout versions', () => {
    it('adds rows introduced after an old saved layout, in a free slot', () => {
        const layout = parseHomeLayout('continuewatching,latestmedia,recommendations');
        expect(layout.slice(0, 4)).toEqual([
            CustomHomeSectionType.ContinueWatching,
            CustomHomeSectionType.Watchlist,
            HomeSectionType.LatestMedia,
            CustomHomeSectionType.Recommendations
        ]);
        expect(layout).toHaveLength(HOME_LAYOUT_LENGTH);
    });

    it('does not re-add a row the user removed after it was introduced', () => {
        const saved = `v${HOME_LAYOUT_VERSION}:continuewatching,latestmedia`;
        expect(parseHomeLayout(saved)).not.toContain(CustomHomeSectionType.Watchlist);
    });

    it('leaves a full layout alone', () => {
        const full = Array(HOME_LAYOUT_LENGTH).fill(HomeSectionType.LatestMedia).join(',');
        expect(parseHomeLayout(full)).not.toContain(CustomHomeSectionType.Watchlist);
    });

    it('round-trips a saved layout', () => {
        const layout = parseHomeLayout('latestmedia,watchlist');
        expect(parseHomeLayout(serializeHomeLayout(layout))).toEqual(layout);
    });
});
