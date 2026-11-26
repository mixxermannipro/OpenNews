import ipaddr from 'ipaddr.js';

export function isPublicAddress(address: string): boolean {
  const parsed = ipaddr.process(address);
  return parsed.range() === 'unicast' &&
    (parsed.kind() === 'ipv4' || parsed.match(ipaddr.IPv6.parse('2000::'), 3));
}

const BLOCKED_PORTS = new Set([
  '22', '23', '25', '53', '110', '135', '139', '143', '445', '465', '587',
  '993', '995', '1433', '1521', '2375', '2376', '3306', '3389', '5432',
  '5900', '6379', '9200', '11211', '27017',
]);

export function isSafeHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    if (url.port && BLOCKED_PORTS.has(url.port)) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (!host) return false;
    if (ipaddr.isValid(host)) return isPublicAddress(host);
    return (
      host.includes('.')
      && !host.endsWith('.localhost')
      && !host.endsWith('.local')
      && !host.endsWith('.internal')
      && !host.endsWith('.home.arpa')
      && !host.endsWith('.localdomain')
    );
  } catch {
    return false;
  }
}
