import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import type { LibraryApiGetItemsRequest } from '@jellyfin/sdk/lib/generated-client/api/library-api';

/**
 * Query for a TV library's "Recently Added" row: shows ordered by when they
 * last got a new episode, like Plex. The server's "latest" endpoint groups
 * every recent episode by show, which can take over a minute on large TV
 * libraries, so the row would silently disappear.
 */
export function getRecentlyAddedShowsRequest(
    userId: string | undefined,
    parentId: string | undefined,
    limit: number,
    hidePlayed: boolean
): LibraryApiGetItemsRequest {
    return {
        userId,
        parentId,
        limit,
        recursive: true,
        includeItemTypes: [ BaseItemKind.Series ],
        sortBy: [ ItemSortBy.DateLastContentAdded, ItemSortBy.SortName ],
        sortOrder: [ SortOrder.Descending, SortOrder.Ascending ],
        isPlayed: hidePlayed ? false : undefined,
        fields: [ ItemFields.PrimaryImageAspectRatio, ItemFields.Path ],
        imageTypeLimit: 1,
        enableImageTypes: [ ImageType.Primary, ImageType.Backdrop, ImageType.Thumb ],
        enableTotalRecordCount: false
    };
}
