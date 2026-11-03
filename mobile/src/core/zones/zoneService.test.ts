import type { Zone } from './catalogue';
import { makeZone } from './fakeZoneOps';
import type { ReadyMarker } from './zoneLayout';
import { createZoneService } from './zoneService';

const marker = (
  zone: Zone,
  installedAt = '2026-10-25T10:00:00Z',
): ReadyMarker => ({
  localFormat: 1,
  installedAt,
  zone,
});
const v3 = makeZone({ 'a.bin': 'AA' }, 'nancy', 3);
const v4 = makeZone({ 'a.bin': 'AAA' }, 'nancy', 4);

describe('zoneService', () => {
  it('is unknown before the first list', () => {
    expect(createZoneService().current()).toBeUndefined();
  });

  it('without a hold, switches at once and calls the listeners in order', () => {
    const service = createZoneService();
    const calls: string[] = [];
    service.subscribe(() => calls.push(`first:${service.current()?.version}`));
    service.subscribe(() => calls.push(`second:${service.current()?.version}`));

    service.update([marker(v3)]);
    service.update([marker(v3), marker(v4)]);

    expect(service.current()?.version).toBe(4);
    expect(calls).toEqual(['first:3', 'second:3', 'first:4', 'second:4']);
  });

  it('does not call the listeners when the zone is the same', () => {
    const service = createZoneService();
    const listener = jest.fn();
    service.update([marker(v3)]);
    service.subscribe(listener);
    service.update([marker(v3)]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('a stopped listener is not called any more', () => {
    const service = createZoneService();
    const listener = jest.fn();
    const stop = service.subscribe(listener);
    stop();
    service.update([marker(v3)]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('with a hold, keeps the zone; releasing it applies the last list', () => {
    const service = createZoneService();
    service.update([marker(v3)]);
    const listener = jest.fn();
    service.subscribe(listener);

    const hold = service.hold();
    expect(hold.zone?.version).toBe(3);
    service.update([marker(v3), marker(v4)]);
    expect(service.current()?.version).toBe(3);
    expect(listener).not.toHaveBeenCalled();

    hold.release();
    expect(service.current()?.version).toBe(4);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('with two holds, releasing one changes nothing', () => {
    const service = createZoneService();
    service.update([marker(v3)]);
    const first = service.hold();
    const second = service.hold();
    service.update([marker(v3), marker(v4)]);

    first.release();
    first.release();
    expect(service.current()?.version).toBe(3);
    second.release();
    expect(service.current()?.version).toBe(4);
  });

  it('take, release, take again (strict mode) keeps the count right', () => {
    const service = createZoneService();
    service.update([marker(v3)]);
    const first = service.hold();
    first.release();
    const again = service.hold();
    service.update([marker(v3), marker(v4)]);
    expect(service.current()?.version).toBe(3);
    again.release();
    expect(service.current()?.version).toBe(4);
  });
});
