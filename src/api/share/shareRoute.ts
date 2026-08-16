// Share route parsing: the backend serves the share build at `/s/<shareId>`
// (docs/PLAN.md, Phase 4). Everything else falls through to the regular app.

const SHARE_PATH_PATTERN = /^\/s\/([\w-]+)\/?$/;

export function parseSharePath(pathname: string = window.location.pathname): string | undefined {
  const match = SHARE_PATH_PATTERN.exec(pathname);
  return match ? match[1] : undefined;
}
