import compose from "ramda/src/compose";
import filter from "ramda/src/filter";
import identity from "ramda/src/identity";
import lte from "ramda/src/lte";
import slice from "ramda/src/slice";

import { PREFIX } from "./etc";

export const getListingSouls = peer => params => {
  const { days, topics=["all"], replyToId, domain, url } = (params || {});
  let dayStrings;

  if (replyToId) {
    return [`${PREFIX}/things/${replyToId}/comments`];
  } else if (url) {
    return [`${PREFIX}/urls/${url}`];
  } else if (domain) {
    return [`${PREFIX}/domains/${domain}`];
  } else if (days) {
    const oneDay = (1000*60*60*24);
    const start = (new Date()).getTime() - oneDay * parseInt(days, 10);
    dayStrings = [];

    for (let i = 0; i <= (days + 1); i++) {
      dayStrings.push(peer.getDayStr(start + (i * oneDay)));
    }
  }

  return Object.keys(topics.reduce(
    (result, topicName) => dayStrings
      ? dayStrings.reduce(
        (topicResult, dayString) => ({
          ...topicResult,
          [`${PREFIX}/topics/${topicName}/days/${dayString}`]: true,
        }),
        result
      )
      : { ...result, [`${PREFIX}/topics/${topicName}`]: true },
    {}
  ));
};

export const getListingIds = peer => params => {
  const { limit, sort="hot", count=0, threshold=null } = (params || {});
  if (!peer.sorts[sort]) throw new Error(`Unknown sort: ${sort}`);

  return compose(
    limit ? slice(count, count+limit) : identity,
    peer.sorts[sort],
    threshold === null ? identity : filter(compose(lte(threshold), peer.getScore)),
    peer.getCollectionsArray,
    peer.getListingSouls
  )(params);
};

export const watchListing = peer => params =>
  peer.getListingSouls(params).map(peer.watchCollection);

export const unwatchListing = peer => params =>
  peer.getListingSouls(params).map(peer.unwatchCollection);