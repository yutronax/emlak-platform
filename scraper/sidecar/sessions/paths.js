// EML-105 / AC-S3: Agent auth klasörü agent_id'den türetilir. Yalnız UUID kabul edilir,
// sonuç her zaman kök altında kalır ve izin 0700'dür (POSIX).
const fs = require('node:fs');
const path = require('node:path');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidAgentId(agentId) {
  return typeof agentId === 'string' && UUID_RE.test(agentId);
}

function resolveAgentDir(root, agentId) {
  if (!isValidAgentId(agentId)) {
    throw new Error('geçersiz agent_id');
  }
  const base = path.resolve(root);
  const dir = path.join(base, agentId);
  const rel = path.relative(base, dir);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('auth klasörü kök dışına çıkıyor');
  }
  return dir;
}

// Klasörü oluşturur (idempotent) ve yolu döner.
function agentAuthDir(root, agentId) {
  const dir = resolveAgentDir(root, agentId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') fs.chmodSync(dir, 0o700);
  return dir;
}

// Agent'ın auth klasörünü (ve içeriğini) siler. Yoksa sessizce döner.
function removeAgentAuth(root, agentId) {
  const dir = resolveAgentDir(root, agentId);
  fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = { agentAuthDir, removeAgentAuth, isValidAgentId };
