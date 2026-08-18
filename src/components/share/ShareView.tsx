import '../../global/actions/all';

import {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ShareLoadStatus } from '../../api/share/types';

import { selectIsMediaViewerOpen } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { loadShare } from '../../api/share/loadShare';
import { initializeMiniApp } from '../../api/share/miniApp';
import { clearShareContext } from '../../api/share/shareContext';
import { applyMiniAppTheme } from './miniAppTheme';

import useAppLayout from '../../hooks/useAppLayout';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Wallpaper from '../common/Wallpaper';
import MediaViewer from '../mediaViewer/MediaViewer.async';
import MiddleColumn from '../middle/MiddleColumn';

import styles from './ShareView.module.scss';

export type OwnProps = {
  shareId: string;
};

type StateProps = {
  isMediaViewerOpen: boolean;
};

const ShareView = ({ shareId, isMediaViewerOpen }: OwnProps & StateProps) => {
  const { isMobile } = useAppLayout();
  const lang = useLang();
  const leftColumnRef = useRef<HTMLDivElement>();
  const [status, setStatus] = useState<ShareLoadStatus | 'loading'>('loading');

  useEffect(() => {
    initializeMiniApp();
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const controller = new AbortController();
    void loadShare(shareId, controller.signal).then((loadStatus) => {
      if (isCurrent) {
        setStatus(loadStatus);
        if (loadStatus === 'ready') applyMiniAppTheme();
      }
    });
    return () => {
      isCurrent = false;
      controller.abort();
      clearShareContext();
    };
  }, [shareId]);

  const handlePlayerPaneStateChange = useLastCallback(() => undefined);

  function renderStatus() {
    if (status === 'loading' || status === 'ready') return undefined;
    const key = status === 'not_found' ? 'ShareNotFound' : status === 'revoked' ? 'ShareRevoked' : 'ShareError';
    return <span className={styles.status}>{lang(key)}</span>;
  }

  return (
    <Wallpaper className={styles.root} isStatic>
      {status === 'ready' ? (
        <MiddleColumn
          leftColumnRef={leftColumnRef}
          isMobile={isMobile}
          onPlayerPaneStateChange={handlePlayerPaneStateChange}
        />
      ) : (
        <div className={buildClassName(styles.middle, 'share-middle')}>
          {renderStatus()}
        </div>
      )}
      <MediaViewer isOpen={isMediaViewerOpen} />
    </Wallpaper>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => ({
  isMediaViewerOpen: selectIsMediaViewerOpen(global),
}))(ShareView));
