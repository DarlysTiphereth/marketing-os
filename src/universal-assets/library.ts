import {readFileSync, realpathSync, statSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {AssetRecord, LocalRef} from './contracts.ts';
import type {AssetT} from './contracts.ts';

export const hashBytes = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
export function confinedFile(root: string, ref: string) {
  LocalRef.parse(ref);
  const base = realpathSync(root), file = realpathSync(path.resolve(base,ref));
  const relative = path.relative(base,file);
  if (!relative || relative === '..' || relative.startsWith('..'+path.sep) || path.isAbsolute(relative)) throw new Error('PATH_ESCAPE');
  if (!statSync(file).isFile()) throw new Error('REGULAR_FILE_REQUIRED');
  return file;
}
export function verifyRecord(root: string, input: unknown, maxBytes = 100_000_000): AssetT {
  const a = AssetRecord.parse(input), file = confinedFile(root,a.local_ref), proof = confinedFile(root,a.proof_ref);
  const size = statSync(file).size;
  if (size !== a.bytes || size > maxBytes || statSync(proof).size > 2_000_000) throw new Error('STORAGE_LIMIT_OR_SIZE_MISMATCH');
  if (hashBytes(readFileSync(file)) !== a.asset_hash || hashBytes(readFileSync(proof)) !== a.proof_hash) throw new Error('ASSET_OR_LICENSE_HASH_MISMATCH');
  if(a.evidence){const e=confinedFile(root,a.evidence.proof_ref);if(statSync(e).size>2_000_000 || hashBytes(readFileSync(e))!==a.evidence.proof_hash)throw new Error('EVIDENCE_HASH_MISMATCH');}
  return a;
}
export function loadLibrary(root: string, ref: string, maxBytes = 100_000_000) {
  const file = confinedFile(root,ref);
  if(statSync(file).size > 2_000_000) throw new Error('REGISTRY_TOO_LARGE');
  const raw: unknown = JSON.parse(readFileSync(file,'utf8'));
  if (!Array.isArray(raw) || raw.length > 5000) throw new Error('INVALID_REGISTRY');
  const records = raw.map(x => verifyRecord(root,x,maxBytes));
  if(new Set(records.map(a=>a.id)).size !== records.length) throw new Error('DUPLICATE_ASSET_ID');
  for(const a of records)if(a.derivation){
    if(a.derivation.input_hashes.some(h=>!records.some(x=>x.asset_hash===h&&x.asset_hash!==a.asset_hash)))throw new Error('DERIVATION_INPUT_MISSING');
    if(a.derivation.strategy==='PRODUCT_COMPOSITE'&&!records.some(x=>a.derivation!.input_hashes.includes(x.asset_hash)&&
      x.fidelity==='PRODUCT_VISUAL'&&!x.synthetic&&x.scope?.brand_id===a.scope?.brand_id&&
      x.scope?.product_id===a.scope?.product_id&&x.scope?.product_version===a.scope?.product_version))throw new Error('AUTHENTIC_PRODUCT_INPUT_REQUIRED');
  }
  return records;
}
