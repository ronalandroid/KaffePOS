import { describe, expect, it } from 'vitest';
import {
  INSFORGE_DEFAULT_HOST,
  getDatabaseProviderSummary,
  isInsforgeDatabaseTarget,
  resolveInsforgeHost,
} from './insforge';

describe('InsForge backend integration helpers', () => {
  it('identifies InsForge managed PostgreSQL hostnames', () => {
    expect(
      isInsforgeDatabaseTarget(
        'postgresql://postgres:secret@6x4q2bgn.ap-southeast.database.insforge.app:5432/insforge?sslmode=require',
      ),
    ).toBe(true);
    expect(isInsforgeDatabaseTarget('postgresql://kaffepos:secret@localhost:5432/kaffepos')).toBe(
      false,
    );
  });

  it('resolves the default InsForge host when INSFORGE_URL is unset', () => {
    expect(resolveInsforgeHost()).toBe(INSFORGE_DEFAULT_HOST);
  });

  it('reports provider metadata accurately', () => {
    const summary = getDatabaseProviderSummary();
    expect(['insforge', 'postgresql']).toContain(summary.provider);
    expect(typeof summary.tlsEnabled).toBe('boolean');
  });
});
