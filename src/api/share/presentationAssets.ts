import type { ApiSticker, ApiStickerSet } from '../types';
import type { GlobalState } from '../../global/types';
import type { ShareMediaEntry } from './types';

import GiftFallback from '../../assets/tgs/general/PartyPopper.tgs';

const SHARE_GIFT_STICKER_ID = '1';
const SHARE_GIFT_SET_ID = 'share-gifts';
const SHARE_GIFT_SIZE = 512;

const SHARE_GIFT_STICKER: ApiSticker = {
  mediaType: 'sticker',
  id: SHARE_GIFT_STICKER_ID,
  stickerSetInfo: { id: SHARE_GIFT_SET_ID, accessHash: '0' },
  isLottie: true,
  isVideo: false,
  width: SHARE_GIFT_SIZE,
  height: SHARE_GIFT_SIZE,
};

const SHARE_GIFT_SET: ApiStickerSet = {
  id: SHARE_GIFT_SET_ID,
  accessHash: '0',
  title: 'Share Gift Fallback',
  count: 1,
  stickers: [SHARE_GIFT_STICKER],
  shortName: SHARE_GIFT_SET_ID,
};

const SHARE_PRESENTATION_MEDIA: Record<string, ShareMediaEntry> = {
  [SHARE_GIFT_STICKER_ID]: {
    mime: 'application/x-tgsticker',
    size: undefined,
    width: SHARE_GIFT_SIZE,
    height: SHARE_GIFT_SIZE,
    hosted: true,
    retrievable: false,
    url: GiftFallback,
    thumbUrl: undefined,
  },
};

export function addSharePresentationMedia(media: Record<string, ShareMediaEntry>) {
  return { ...SHARE_PRESENTATION_MEDIA, ...media };
}

export function hydrateSharePresentationState(global: GlobalState): GlobalState {
  return {
    ...global,
    premiumGifts: global.premiumGifts || SHARE_GIFT_SET,
    tonGifts: global.tonGifts || SHARE_GIFT_SET,
  };
}
