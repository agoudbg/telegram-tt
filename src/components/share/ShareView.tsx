import '../../global/actions/all';

import {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import type { ShareLoadStatus } from '../../api/share/types';

import buildClassName from '../../util/buildClassName';
import { loadShare } from '../../api/share/loadShare';

import useAppLayout from '../../hooks/useAppLayout';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import MiddleColumn from '../middle/MiddleColumn';

import styles from './ShareView.module.scss';

type OwnProps = {
  shareId: string;
};

const ShareView = ({ shareId }: OwnProps) => {
  const { isMobile } = useAppLayout();
  const lang = useLang();
  const leftColumnRef = useRef<HTMLDivElement>();
  const [status, setStatus] = useState<ShareLoadStatus | 'loading'>('loading');

  useEffect(() => {
    let isCurrent = true;
    void loadShare(shareId).then((loadStatus) => {
      if (isCurrent) setStatus(loadStatus);
    });
    return () => {
      isCurrent = false;
    };
  }, [shareId]);

  const handlePlayerPaneStateChange = useLastCallback(() => undefined);

  function renderStatus() {
    if (status === 'loading' || status === 'ready') return undefined;
    const key = status === 'not_found' ? 'ShareNotFound' : status === 'revoked' ? 'ShareRevoked' : 'ShareError';
    return <span className={styles.status}>{lang(key)}</span>;
  }

  return (
    <div className={styles.root} data-share-id={shareId}>
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
    </div>
  );
};

export default memo(ShareView);
