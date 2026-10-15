// Internal links must include the base path (e.g. "/repo-name" before a custom domain exists).
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** "/meetings" -> "/repo-name/meetings" (or "/meetings" when there is no base path) */
export function withBase(path: string): string {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Reverse of withBase, normalized without a trailing slash: "/repo-name/meetings/" -> "/meetings" */
export function stripBase(pathname: string): string {
  const rest = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return rest.replace(/\/$/, '') || '/';
}
