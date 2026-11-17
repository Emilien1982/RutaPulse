import type { Bbox } from './catalogue';
import { nearZoom, openingPlan } from './opening';

// Testeur T3 (phase 8b), cas generaux avec des valeurs exterieures au code.
// Zone de Nancy (catalogue).
const bbox: Bbox = { lonMin: 5.84, latMin: 48.47, lonMax: 6.52, latMax: 48.92 };

describe('openingPlan avec de vraies villes (coordonnees OpenStreetMap)', () => {
  it('Nancy, Toul, Luneville : dans la zone', () => {
    expect(openingPlan(bbox, 6.1844, 48.6921).kind).toBe('inside');
    expect(openingPlan(bbox, 5.8916, 48.6753).kind).toBe('inside');
    expect(openingPlan(bbox, 6.4977, 48.5927).kind).toBe('inside');
  });

  it('Epinal (48,1735 N) est a plus de 33 km du bord sud : far', () => {
    // 48,47 - 48,1735 = 0,2965 degre de latitude = 32,97 km (111,195 km par degre).
    expect(openingPlan(bbox, 6.4494, 48.1735).kind).toBe('far');
  });

  it('Metz (49,1193 N) est a 22 km du bord nord : far', () => {
    expect(openingPlan(bbox, 6.1757, 49.1193).kind).toBe('far');
  });

  it('une position a 9,9 km a l est (lat 48,7) est near, a 10,1 km far', () => {
    // 1 degre de longitude = 111,195 km x cos(48,7 degres) = 73,25 km.
    const deg = (km: number) =>
      km / (111.195 * Math.cos((48.7 * Math.PI) / 180));
    expect(openingPlan(bbox, 6.52 + deg(9.9), 48.7).kind).toBe('near');
    expect(openingPlan(bbox, 6.52 + deg(10.1), 48.7).kind).toBe('far');
  });
});

describe('nearZoom : valeur de la maquette 90', () => {
  it('2,5 km a l est, carte 390 x 752 : environ 11,6', () => {
    const lon = 6.52 + 2.5 / (111.195 * Math.cos((48.7 * Math.PI) / 180));
    const zoom = nearZoom(
      [6.52, 48.7],
      [lon, 48.7],
      { width: 390, height: 752 },
      {
        side: 48,
        top: 140,
        bottom: 112,
      },
    );
    // log2((195 - 48) x 360 / (512 x 0,034065)) = 11,57.
    expect(zoom).toBeCloseTo(11.57, 1);
  });
});
