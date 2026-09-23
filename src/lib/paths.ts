const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export function sitePath(path: string): string {
  if (!path || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(path)) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function prefixRootUrls(html: string): string {
  return html.replace(/(href|src)=("|')\/(?!\/)/g, `$1=$2${base}/`);
}
