import { useRoutingEngine } from '@/shared-data/routing/useRoutingEngine';

// No display. Opens the calculation engine at start-up, whatever the tab
// (ADR 0015, section 4).
export function RoutingEngineStarter() {
  useRoutingEngine();
  return null;
}
