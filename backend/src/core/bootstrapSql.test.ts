import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The migration runner applies backend/bootstrap/*.sql on an empty database. Those files are
// copies of database/*.sql (the Docker build context is backend/ only), so keep them identical.
const repoRoot = join(__dirname, '..', '..', '..');
const pairs: Array<[string, string]> = [
  ['database/base-schema.sql', 'backend/bootstrap/0001_base-schema.sql'],
  ['database/production-bootstrap.sql', 'backend/bootstrap/0002_production-bootstrap.sql'],
];

describe('fresh-database bootstrap SQL', () => {
  it.each(pairs)('%s matches %s', (source, copy) => {
    const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');
    expect(read(copy)).toBe(read(source));
  });
});
