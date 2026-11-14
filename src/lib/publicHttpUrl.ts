import ipaddr from 'ipaddr.js';

export function isPublicAddress(address: string): boolean {
  const parsed = ipaddr.process(address);
  return parsed.range() === 'unicast' &&
    (parsed.kind() === 'ipv4' || parsed.match(ipaddr.IPv6.parse('2000::'), 3));
}

export function isSafeHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (ipaddr.isValid(host)) return isPublicAddress(host);
    return host.includes('.') && !host.endsWith('.localhost') && !host.endsWith('.local');
  } catch {
    return false;
  }
}
