import { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './ShareView.module.scss';

type OwnProps = {
  shareId: string;
};

const ShareView = ({ shareId }: OwnProps) => {
  return (
    <div className={styles.root} data-share-id={shareId}>
      <div className={buildClassName(styles.middle, 'share-middle')} />
    </div>
  );
};

export default memo(ShareView);
