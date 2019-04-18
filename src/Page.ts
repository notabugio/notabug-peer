import * as R from 'ramda';
import { query, resolve } from 'gun-scope';
import { GunScope, ListingSpecType } from './types';
import { Config } from './Config';
import { Query } from './Query';
import { Listing, ListingSpec, ListingType, ListingQuery } from './Listing';

const wikiPage = R.mergeLeft({
  withMatch: ({
    params: { authorId = Config.owner, name }
  }: {
    params: { authorId: string; name: string };
  }) => ({
    preload: (scope: GunScope) => Query.wikiPage(scope, authorId, name)
  })
});

const withListingMatch = (path: string, params?: any) => {
  if (!path) {
    return {
      preload: query(R.always(resolve({}))),
      sidebar: query(R.always(resolve(''))),
      space: query(R.always(resolve(ListingSpec.fromSource('')))),
      ids: query(R.always(resolve([])))
    };
  }

  const view = new ListingQuery(path);
  const realQuery = query(view.ids.bind(view), `ids:${path}`);

  return {
    preload: (scope: GunScope) => preloadListing(scope, path, params),
    sidebar: query(scope => Listing.sidebarFromPath(scope, path), `sidebar:${path}`),
    space: query(scope => Listing.specFromPath(scope, path)),
    ids: query((scope, opts = {}) => realQuery(scope, R.mergeLeft(opts, params)))
  };
};

const preloadListing = async (scope: GunScope, path: string, params?: any) => {
  const match = withListingMatch(path, params);
  const promise = Promise.all([
    match.space(scope),
    match.ids(scope, {}),
    match.sidebar(scope)
  ] as Promise<any>[]);
  let [spec, ids]: [ListingSpecType, string[]] = (await promise) as [ListingSpecType, string[]];

  if (!spec) spec = ListingSpec.fromSource('');
  const opIds = R.pathOr([], ['filters', 'allow', 'ops'], spec);
  if (opIds.length) {
    await Promise.all(
      opIds.map((id: string) =>
        Query.thingForDisplay(scope, id, spec.tabulator || Config.tabulator)
      )
    );
  }

  await Promise.all(
    ids.map(id => Query.thingForDisplay(scope, id, spec.tabulator || Config.tabulator))
  );

  if (spec.chatTopic) {
    const chatPath = `/t/${spec.chatTopic}/chat`;

    if (chatPath !== path) await preloadListing(scope, `/t/${spec.chatTopic}/chat`, {});
  }

  return scope.getCache();
};

const listing = ({
  prefix: defaultPrefix = 't',
  identifier: defaultIdentifier = 'all',
  sort: defaultSort = 'hot',
  ...rest
} = {}) => ({
  ...rest,
  withMatch: ({
    params: { prefix = defaultPrefix, identifier = defaultIdentifier, sort = defaultSort },
    query: queryParams = {}
  }) => withListingMatch(`/${prefix}/${identifier}/${sort}`, queryParams)
});

const thingComments = ({
  prefix: defaultPrefix = 't',
  identifier: defaultIdentifier = 'all',
  sort: defaultSort = 'best',
  ...rest
} = {}) => ({
  ...rest,
  withMatch: ({ params: { opId = '' }, query: queryParams = {} }) =>
    withListingMatch(
      ListingType.CommentListing.route.reverse({
        thingId: opId,
        sort: R.propOr(defaultSort, 'sort', queryParams)
      }),
      R.assoc('limit', 1000, queryParams)
    )
});

const spaceListing = ({
  name: defaultName = 'default',
  authorId: defaultAuthorId = '',
  sort: defaultSort = 'default',
  ...rest
} = {}) => ({
  ...rest,
  withMatch: ({
    params: { authorId = defaultAuthorId, name = defaultName, sort = defaultSort },
    query: queryParams = {}
  }) =>
    withListingMatch(
      ListingType.SpaceListing.route.reverse({
        authorId: authorId || Config.owner,
        name,
        sort
      }),
      queryParams
    )
});

const spaceThingComments = ({
  name: defaultName = 'default',
  authorId: defaultAuthorId = '',
  sort: defaultSort = 'hot',
  ...rest
}) => ({
  ...rest,
  withMatch: ({
    params: { opId = '', authorId = defaultAuthorId, name = defaultName, sort = defaultSort },
    query: queryParams = {}
  }) => {
    const spacePath = ListingType.SpaceListing.route.reverse({
      authorId: authorId || Config.owner,
      name,
      sort
    });
    const listingPath = ListingType.CommentListing.route.reverse({
      thingId: opId,
      sort
    });

    const view = new ListingQuery(listingPath);
    const idsQuery = query(view.ids.bind(view), `ids:${listingPath}`);

    return {
      space: query(
        scope => Listing.specFromPath(scope, spacePath, queryParams),
        `spec:${spacePath}`
      ),
      ids: idsQuery,
      preload: query(scope => preloadListing(scope, listingPath, queryParams))
    };
  }
});

const profile = ({ sort: defaultSort = 'new', type: defaultType = 'overview', ...rest } = {}) => ({
  ...rest,
  withMatch: ({ params: { authorId = '', type = defaultType, sort = defaultSort }, query = {} }) =>
    withListingMatch(ListingType.ProfileListing.route.reverse({ authorId, type, sort }), query)
});

const inbox = ({ sort: defaultSort = 'new', type: defaultType = 'overview', ...rest } = {}) => ({
  ...rest,
  withMatch: ({ authorId = '', params: { type = defaultType, sort = defaultSort }, query = {} }) =>
    withListingMatch(ListingType.InboxListing.route.reverse({ authorId, type, sort }), query)
});

export const Page = {
  withListingMatch,
  preloadListing,
  wikiPage,
  thingComments,
  listing,
  spaceListing,
  spaceThingComments,
  profile,
  inbox
};
