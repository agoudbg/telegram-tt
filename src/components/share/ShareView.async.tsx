import type { OwnProps } from './ShareView';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const ShareViewAsync = (props: OwnProps) => {
  const ShareView = useModuleLoader(Bundles.Share, 'ShareView');

  return ShareView ? <ShareView {...props} /> : undefined;
};

export default ShareViewAsync;
