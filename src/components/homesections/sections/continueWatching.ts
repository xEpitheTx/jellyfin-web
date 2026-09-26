import type { Api } from '@jellyfin/sdk/lib/api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { MediaType } from '@jellyfin/sdk/lib/generated-client/models/media-type';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import type { ApiClient } from 'jellyfin-apiclient';

import { getNextUpQuery } from 'apps/legacy/features/libraries/api/useNextUp';
import { getResumeItemsQuery } from 'apps/legacy/features/libraries/api/useResumeItems';
import cardBuilder from 'components/cardbuilder/cardBuilder';
import { getBackdropShape } from 'components/cardbuilder/utils/shape';
import globalize from 'lib/globalize';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import type { UserSettings } from 'scripts/settings/userSettings';
import { toIsoDateOnlyString } from 'utils/date';
import { queryClient } from 'utils/query/queryClient';

import { mergeContinueWatching } from './continueWatchingOrder';
import type { SectionContainerElement, SectionOptions } from './section';

/** How many recently watched episodes to scan when ordering Next Up shows. */
const RECENTLY_PLAYED_EPISODE_LIMIT = 200;

async function fetchRecentlyPlayedEpisodes(api: Api, userId: string) {
    const response = await getLibraryApi(api).getItems({
        userId,
        includeItemTypes: [ BaseItemKind.Episode ],
        recursive: true,
        filters: [ ItemFilter.IsPlayed ],
        sortBy: [ ItemSortBy.DatePlayed ],
        sortOrder: [ SortOrder.Descending ],
        limit: RECENTLY_PLAYED_EPISODE_LIMIT,
        enableImages: false,
        enableTotalRecordCount: false
    });
    return response.data.Items ?? [];
}

function getContinueWatchingFetchFn(
    apiClient: ApiClient,
    userSettings: UserSettings,
    { enableOverflow }: SectionOptions
) {
    return async function () {
        const api = ServerConnections.getApi(apiClient.serverId());
        if (!api) return [];

        const userId = apiClient.getCurrentUserId();
        const limit = enableOverflow ? 24 : 12;

        const commonOptions = {
            userId,
            limit,
            fields: [
                ItemFields.PrimaryImageAspectRatio,
                ItemFields.DateCreated,
                ItemFields.Path,
                ItemFields.MediaSourceCount
            ],
            imageTypeLimit: 1,
            enableImageTypes: [
                ImageType.Primary,
                ImageType.Backdrop,
                ImageType.Thumb
            ],
            enableTotalRecordCount: false
        };

        const oldestDateForNextUp = new Date();
        oldestDateForNextUp.setDate(oldestDateForNextUp.getDate() - userSettings.maxDaysForNextUp());

        const [ resume, nextUp, recentlyPlayed ] = await Promise.all([
            queryClient.fetchQuery(getResumeItemsQuery(api, {
                ...commonOptions,
                mediaTypes: [ MediaType.Video ]
            })),
            queryClient.fetchQuery(getNextUpQuery(api, {
                ...commonOptions,
                nextUpDateCutoff: toIsoDateOnlyString(oldestDateForNextUp),
                enableResumable: false,
                enableRewatching: userSettings.enableRewatchingInNextUp()
            })),
            fetchRecentlyPlayedEpisodes(api, userId).catch(err => {
                // Ordering falls back to the server's Next Up order.
                console.error('[ContinueWatching] failed to fetch play history', err);
                return [];
            })
        ]);

        return mergeContinueWatching(
            resume.Items ?? [],
            nextUp.Items ?? [],
            recentlyPlayed
        ).slice(0, limit);
    };
}

function getContinueWatchingHtmlFn(
    useEpisodeImages: boolean,
    { enableOverflow }: SectionOptions
) {
    return function (items: BaseItemDto[]) {
        return cardBuilder.getCardsHtml({
            items,
            preferThumb: true,
            inheritThumb: !useEpisodeImages,
            shape: getBackdropShape(enableOverflow),
            overlayText: false,
            showTitle: true,
            showParentTitle: true,
            lazy: true,
            showDetailsMenu: true,
            overlayPlayButton: true,
            context: 'home',
            centerText: true,
            allowBottomPadding: false,
            cardLayout: false,
            showYear: true,
            lines: 2
        });
    };
}

export function loadContinueWatching(
    elem: HTMLElement,
    apiClient: ApiClient,
    userSettings: UserSettings,
    options: SectionOptions
) {
    let html = '';

    html += '<h2 class="sectionTitle sectionTitle-cards padded-left">' + globalize.translate('HeaderContinueWatching') + '</h2>';
    if (options.enableOverflow) {
        html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
        html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x" data-monitor="videoplayback,markplayed">';
    } else {
        html += '<div is="emby-itemscontainer" class="itemsContainer padded-left padded-right vertical-wrap focuscontainer-x" data-monitor="videoplayback,markplayed">';
    }

    if (options.enableOverflow) {
        html += '</div>';
    }
    html += '</div>';

    elem.classList.add('hide');
    elem.innerHTML = html;

    const itemsContainer: SectionContainerElement | null = elem.querySelector('.itemsContainer');
    if (!itemsContainer) return;
    itemsContainer.fetchData = getContinueWatchingFetchFn(apiClient, userSettings, options);
    itemsContainer.getItemsHtml = getContinueWatchingHtmlFn(userSettings.useEpisodeImagesInNextUpAndResume(), options);
    itemsContainer.parentContainer = elem;
}
