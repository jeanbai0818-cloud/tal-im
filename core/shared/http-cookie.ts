/** Browser-style cookie-jar and redirect-follower for SSO chains. */

export type SimpleCookie = { name: string; value: string; domain: string };

export function parseCookies(headers: Headers, urlHost: string): SimpleCookie[] {
  const raws: string[] = [];
  const h = headers as unknown as { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') {
    raws.push(...h.getSetCookie());
  } else {
    const v = headers.get('set-cookie');
    if (v) raws.push(v);
  }
  return raws.flatMap((line) => {
    const first = (line.split(';')[0] ?? '').trim();
    const eq = first.indexOf('=');
    if (eq <= 0) return [];
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    const m = line.match(/domain=([^;]+)/i);
    const domain = m ? m[1]!.trim().replace(/^\./, '') : urlHost;
    return [{ name, value, domain }];
  });
}

export function mergeCookies(existing: SimpleCookie[], incoming: SimpleCookie[]): SimpleCookie[] {
  const map = new Map(existing.map((c) => [`${c.domain}::${c.name}`, c]));
  for (const c of incoming) map.set(`${c.domain}::${c.name}`, c);
  return [...map.values()];
}

export function buildCookieHeader(cookies: SimpleCookie[], host: string): string {
  return cookies
    .filter((c) => host === c.domain || host.endsWith(`.${c.domain}`))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

const BROWSER_HEADERS: Record<string, string> = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'User-Agent': 'Mozilla/5.0 Yach-TAL-IM/1.0',
};

export async function followRedirects(
  startUrl: string,
  cookies: SimpleCookie[] = [],
  options: {
    maxRedirects?: number;
    stopOn?: (url: URL) => boolean;
  } = {},
): Promise<{ finalUrl: string; cookies: SimpleCookie[]; body: string }> {
  const max = options.maxRedirects ?? 12;
  let url = startUrl;
  let jar = [...cookies];

  for (let i = 0; i < max; i++) {
    const parsed = new URL(url);
    const cookieStr = buildCookieHeader(jar, parsed.hostname);
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { ...BROWSER_HEADERS, ...(cookieStr ? { Cookie: cookieStr } : {}) },
    });
    jar = mergeCookies(jar, parseCookies(res.headers, parsed.hostname));

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) break;
      url = loc.startsWith('http') ? loc : new URL(loc, url).href;
      if (options.stopOn?.(new URL(url))) {
        return { finalUrl: url, cookies: jar, body: '' };
      }
      continue;
    }

    const body = await res.text();
    return { finalUrl: url, cookies: jar, body };
  }
  throw new Error(`Too many redirects from ${startUrl}`);
}
