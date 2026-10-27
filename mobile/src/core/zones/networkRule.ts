// "Wi-Fi only" rule: see ADR 0013, section 6.

export type NetworkInfo = { isConnected: boolean; type: string };

export type NetworkDecision = 'allowed' | 'no-wifi' | 'no-network';

export function networkRule(
  wifiOnly: boolean,
  network: NetworkInfo,
): NetworkDecision {
  if (!network.isConnected || network.type === 'NONE') return 'no-network';
  if (!wifiOnly) return 'allowed';
  return network.type === 'WIFI' || network.type === 'ETHERNET'
    ? 'allowed'
    : 'no-wifi';
}
