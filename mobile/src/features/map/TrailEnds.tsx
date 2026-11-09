// Start and end markers of the circuit chosen on the map tab (mockup 12,
// "Règles d'affichage"): where the creation will start, and end. A loop has
// one marker; a circuit whose order is unknown has none.

import { Marker } from '@maplibre/maplibre-react-native';

import type { LonLat } from '@/core/routes/savedRoute';

import { PointMarker } from './DraftMarkers';

export function TrailEnds({
  ends,
}: {
  ends: { start: LonLat; end: LonLat | null } | null;
}) {
  if (!ends) return null;
  return (
    <>
      {ends.end && (
        <Marker id="trail-end" lngLat={ends.end}>
          <PointMarker
            role="end"
            number={0}
            chosen={false}
            testID="trail-end-marker"
          />
        </Marker>
      )}
      <Marker id="trail-start" lngLat={ends.start}>
        <PointMarker
          role="start"
          number={0}
          chosen={false}
          testID="trail-start-marker"
        />
      </Marker>
    </>
  );
}
