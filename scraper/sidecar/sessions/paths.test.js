// EML-105 / AC-S3: Agent auth klasörü agent_id'den türetilir; path traversal yok; izin 0700.
// Arayüz: agentAuthDir(root, agentId) -> string (mutlak yol), klasörü oluşturur.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { agentAuthDir } = require('./paths');

const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000';

let root;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-paths-test-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test('geçerli UUID: dönen yol kök altında ve agent_id içerir', () => {
  const dir = agentAuthDir(root, VALID_UUID);

  const rel = path.relative(path.resolve(root), path.resolve(dir));
  assert.ok(rel.length > 0, 'yol kökün kendisi olmamalı');
  assert.ok(!rel.startsWith('..'), 'yol kökün dışına çıkmamalı');
  assert.ok(!path.isAbsolute(rel), 'göreli fark mutlak olmamalı');
  assert.ok(dir.includes(VALID_UUID), 'klasör adı agent_id’den türetilmeli');
});

test('geçerli UUID: klasörü oluşturur (idempotent — iki kez çağrılabilir)', () => {
  const dir1 = agentAuthDir(root, VALID_UUID);
  const dir2 = agentAuthDir(root, VALID_UUID);

  assert.strictEqual(dir1, dir2);
  assert.ok(fs.statSync(dir1).isDirectory());
});

test('AC-S3: oluşturulan klasör izni POSIX’te 0700 (Windows’ta atlanır)', { skip: process.platform === 'win32' }, () => {
  const dir = agentAuthDir(root, VALID_UUID);

  const mode = fs.statSync(dir).mode & 0o777;
  assert.strictEqual(mode, 0o700);
});

test('AC-S3: geçersiz agent_id değerleri throw eder ve kök dışında/içinde klasör oluşturmaz', () => {
  const invalidIds = [
    '../x',
    'abc',
    '',
    '00000000-0000-0000-0000-000000000000/../..',
    `${VALID_UUID}/../x`,
    '..\\..\\x',
    ` ${VALID_UUID}`,
    null,
    undefined,
    123,
  ];

  for (const id of invalidIds) {
    assert.throws(
      () => agentAuthDir(root, id),
      undefined,
      `agent_id ${JSON.stringify(id)} kabul edilmemeli`,
    );
  }

  assert.deepStrictEqual(fs.readdirSync(root), [], 'geçersiz id hiçbir klasör oluşturmamalı');
});
