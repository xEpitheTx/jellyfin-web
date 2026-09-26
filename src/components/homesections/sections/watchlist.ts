import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import type { ApiClient } from 'jellyfin-apiclient';

import cardBuilder from 'components/cardbuilder/cardBuilder';
import { getPortraitShape } from 'components/cardbuilder/utils/shape';
import { getWatchlist } from 'components/watchlist/watchlistStore';
import { orderWatchlistItems } from 'components/watchlist/watchlistItems';
import globalize from 'lib/globalize';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import type { UserSettings } from 'scripts/settings/userSettings';

import type { SectionContainerElement, SectionOptions } from './section';

const MAX_ITEMS = 24;

function getWatchlistFetchFn(apiClient: ApiClient, userSettings: UserSettings) {
    return async function () {
        const api = ServerConnections.getApi(apiClient.serverId());
        const ids = getWatchlist(userSettings);
        if (!api || !ids.length) return [];

        const response = await getLibraryApi(api).getItems({
            userId: apiClient.getCurrentUserId(),
            ids,
            fields: [ ItemFields.PrimaryImageAspectRatio ],
            enableTotalRecordCount: false
        });

        return orderWatchlistItems(ids, response.data.Items ?? []).slice(0, MAX_ITEMS);
    };
}

function getWatchlistHtmlFn({ enableOverflow }: SectionOptions) {
    return function (items: BaseItemDto[]) {
        return cardBuilder.getCardsHtml({
            items,
            shape: getPortraitShape(enableOverflow),
            showTitle: true,
            showYear: true,
            centerText: true,
            overlayPlayButton: true,
            showDetailsMenu: true,
            lazy: true,
            context: 'home',
            allowBottomPadding: !enableOverflow
        });
    };
}

export function loadWatchlist(
    elem: HTMLElement,
    apiClient: ApiClient,
    userSettings: UserSettings,
    options: SectionOptions
) {
    let html = '<h2 class="sectionTitle sectionTitle-cards padded-left">' + globalize.translate('Watchlist') + '</h2>';
    if (options.enableOverflow) {
        html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
        html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x" data-monitor="markplayed">';
        html += '</div>';
    } else {
        html += '<div is="emby-itemscontainer" class="itemsContainer padded-left padded-right vertical-wrap focuscontainer-x" data-monitor="markplayed">';
    }
    html += '</div>';

    elem.classList.add('hide');
    elem.innerHTML = html;

    const itemsContainer: SectionContainerElement | null = elem.querySelector('.itemsContainer');
    if (!itemsContainer) return;
    itemsContainer.fetchData = getWatchlistFetchFn(apiClient, userSettings);
    itemsContainer.getItemsHtml = getWatchlistHtmlFn(options);
    itemsContainer.parentContainer = elem;
}
