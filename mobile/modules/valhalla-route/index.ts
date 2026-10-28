import { requireNativeModule } from 'expo';

// Native error codes (error.code on a rejected promise). ADR 0015, section 5.
export const ERR_ENGINE_NOT_OPEN = 'ERR_ENGINE_NOT_OPEN';
export const ERR_ZONE_UNREADABLE = 'ERR_ZONE_UNREADABLE';
export const ERR_ENGINE = 'ERR_ENGINE';

// Valhalla JSON passes through as plain strings, in both directions. When
// Valhalla refuses a request, route(), height() and traceAttributes() still
// resolve, with {"code","message"}. height() and traceAttributes() are the raw
// versions (ADR 0017, section 1): the typed height() cannot return null.
type ValhallaRouteModule = {
  open(tarPath: string, elevationDir: string): Promise<void>;
  close(): Promise<void>;
  route(requestJson: string): Promise<string>;
  height(requestJson: string): Promise<string>;
  traceAttributes(requestJson: string): Promise<string>;
};

export default requireNativeModule<ValhallaRouteModule>('ValhallaRoute');
