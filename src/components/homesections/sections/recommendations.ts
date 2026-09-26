import type { Api } from '@jellyfin/sdk/lib/api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import type { RecommendationDto } from '@jellyfin/sdk/lib/generated-client/models/recommendation-dto';
import { RecommendationType } from '@jellyfin/sdk/lib/generated-client/models/recommendation-type';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getMovieApi } from '@jellyfin/sdk/lib/utils/api/movie-api';
import type { ApiClient } from 'jellyfin-apiclient';

import cardBuilder from 'components/cardbuilder/cardBuilder';
import { getPortraitShape } from 'components/cardbuilder/utils/shape';
import globalize from 'lib/globalize';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import { queryClient } from 'utils/query/queryClient';

import { interleaveRows, MAX_ROWS, type RecommendationRow } from './recommendationRows';
import type { SectionContainerElement, SectionOptions } from './section';

const MOVIE_CATEGORY_LIMIT = 3;
const SERIES_ROW_LIMIT = 2;
/** Recently watched shows to try, since some have no similar shows. */
const SERIES_CANDIDATE_LIMIT = 6;
const ITEMS_PER_ROW = 16;
const STALE_TIME = 5 * 60 * 1000;

function getMovieRowTitle(recommendation: RecommendationDto) {
    const name = recommendation.BaselineItemName ?? '';
    switch (recommendation.RecommendationType) {
        case RecommendationType.SimilarToRecentlyPlayed:
            return globalize.translate('RecommendationBecauseYouWatched', name);
        case RecommendationType.SimilarToLikedItem:
            return globalize.translate('RecommendationBecauseYouLike', name);
        case RecommendationType.HasDirectorFromRecentlyPlayed:
        case RecommendationType.HasLikedDirector:
            return globalize.translate('RecommendationDirectedBy', name);
        case RecommendationType.HasActorFromRecentlyPlayed:
        case RecommendationType.HasLikedActor:
            return globalize.translate('RecommendationStarring', name);
        default:
            return name;
    }
}

async function fetchMovieRows(api: Api, userId: string): Promise<RecommendationRow[]> {
    const response = await getMovieApi(api).getMovieRecommendations({
        userId,
        categoryLimit: MOVIE_CATEGORY_LIMIT,
        itemLimit: ITEMS_PER_ROW,
        fields: [ ItemFields.PrimaryImageAspectRatio ]
    });

    return response.data.map(recommendation => ({
        title: getMovieRowTitle(recommendation),
        items: recommendation.Items ?? []
    }));
}

/** "Because you watched <show>" rows for the most recently watched shows. */
async function fetchSeriesRows(api: Api, userId: string): Promise<RecommendationRow[]> {
    const libraryApi = getLibraryApi(api);
    const played = await libraryApi.getItems({
        userId,
        includeItemTypes: [ BaseItemKind.Episode ],
        recursive: true,
        filters: [ ItemFilter.IsPlayed ],
        sortBy: [ ItemSortBy.DatePlayed ],
        sortOrder: [ SortOrder.Descending ],
        limit: 50,
        enableImages: false,
        enableTotalRecordCount: false
    });

    const series = new Map<string, string>();
    for (const episode of played.data.Items ?? []) {
        if (series.size >= SERIES_CANDIDATE_LIMIT) break;
        if (episode.SeriesId && !series.has(episode.SeriesId)) {
            series.set(episode.SeriesId, episode.SeriesName ?? '');
        }
    }

    const rows = await Promise.all([ ...series ].map(async ([ seriesId, seriesName ]) => {
        const similar = await libraryApi.getSimilarItems({
            itemId: seriesId,
            userId,
            limit: ITEMS_PER_ROW,
            fields: [ ItemFields.PrimaryImageAspectRatio ]
        });
        return {
            title: globalize.translate('RecommendationBecauseYouWatched', seriesName),
            items: similar.data.Items ?? []
        };
    }));

    return rows.filter(row => row.items.length).slice(0, SERIES_ROW_LIMIT);
}

function getRecommendationRowsQuery(api: Api, userId: string) {
    return {
        queryKey: [ 'User', userId, 'HomeRecommendations' ],
        queryFn: async () => {
            const [ movieRows, seriesRows ] = await Promise.all([
                fetchMovieRows(api, userId).catch(err => {
                    console.error('[Recommendations] failed to fetch movie recommendations', err);
                    return [];
                }),
                fetchSeriesRows(api, userId).catch(err => {
                    console.error('[Recommendations] failed to fetch show recommendations', err);
                    return [];
                })
            ]);
            return interleaveRows(movieRows, seriesRows);
        },
        staleTime: STALE_TIME
    };
}

function getRowFetchFn(
    apiClient: ApiClient,
    rowIndex: number,
    titleElem: HTMLElement
) {
    return async function () {
        const api = ServerConnections.getApi(apiClient.serverId());
        if (!api) return [];

        const rows = await queryClient.fetchQuery(
            getRecommendationRowsQuery(api, apiClient.getCurrentUserId())
        );
        const row = rows[rowIndex];
        titleElem.textContent = row?.title ?? '';
        return row?.items ?? [];
    };
}

function getRowHtmlFn({ enableOverflow }: SectionOptions) {
    return function (items: BaseItemDto[]) {
        return cardBuilder.getCardsHtml({
            items,
            shape: getPortraitShape(enableOverflow),
            showTitle: true,
            showYear: true,
            centerText: true,
            overlayPlayButton: true,
            lazy: true,
            context: 'home',
            allowBottomPadding: !enableOverflow
        });
    };
}

export function loadRecommendations(
    elem: HTMLElement,
    apiClient: ApiClient,
    options: SectionOptions
) {
    elem.classList.remove('verticalSection');

    // The number of rows is only known once the data arrives, so render the
    // maximum and let empty rows hide themselves.
    for (let i = 0; i < MAX_ROWS; i++) {
        const row = document.createElement('div');
        row.classList.add('verticalSection', 'hide');

        let html = '<h2 class="sectionTitle sectionTitle-cards padded-left"></h2>';
        if (options.enableOverflow) {
            html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
            html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x" data-monitor="markplayed">';
            html += '</div>';
        } else {
            html += '<div is="emby-itemscontainer" class="itemsContainer padded-left padded-right vertical-wrap focuscontainer-x" data-monitor="markplayed">';
        }
        html += '</div>';

        row.innerHTML = html;
        elem.appendChild(row);

        const titleElem: HTMLElement | null = row.querySelector('.sectionTitle');
        const itemsContainer: SectionContainerElement | null = row.querySelector('.itemsContainer');
        if (!titleElem || !itemsContainer) continue;
        itemsContainer.fetchData = getRowFetchFn(apiClient, i, titleElem);
        itemsContainer.getItemsHtml = getRowHtmlFn(options);
        itemsContainer.parentContainer = row;
    }
}
