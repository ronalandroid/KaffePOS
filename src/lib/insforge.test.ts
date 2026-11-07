import { describe, expect, it } from 'vitest';
import { INSFORGE_DEFAULT_HOST, insforge, insforgeBaseUrl } from './insforge';

describe('InsForge frontend SDK client', () => {
  it('initializes with the InsForge cloud host', () => {
    expect(insforgeBaseUrl).toBe(INSFORGE_DEFAULT_HOST);
    expect(insforge).toBeDefined();
    expect(insforge.database).toBeDefined();
    expect(insforge.functions).toBeDefined();
  });
});
