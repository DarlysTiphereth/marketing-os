// Content-addressed store: objects/<aa>/<sha256><ext>. Same bytes are stored once (dedup by SHA-256).
// The manifest records every reference (who stored it, why, retention class) and approval/pin state.
import {copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {managed} from '../config.ts';

export type RetentionClass = 'temp' | 'cache' | 'candidate' | 'approved';
export type ObjectRef = {name: string; class: RetentionClass; run_id?: string; created_at: string};
export type ObjectEntry = {sha256: string; ext: string; bytes: number; refs: ObjectRef[]; approved: boolean; pinned: boolean; created_at: string; last_access: string};
export type Manifest = {version: 1; objects: Record<string, ObjectEntry>};

export const sha256File = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

export class Cas {
  readonly root = managed('store');
  private file = path.join(this.root, 'manifest.json');

  load(): Manifest {
    if (!existsSync(this.file)) return {version: 1, objects: {}};
    return JSON.parse(readFileSync(this.file, 'utf8')) as Manifest;
  }
  private save(m: Manifest) {
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(m, null, 2) + '\n');
    renameSync(tmp, this.file); // atomic replace: a crash never leaves a half-written manifest
  }
  objectPath(sha: string, ext: string) {
    if (!/^[a-f0-9]{64}$/.test(sha)) throw new Error(`invalid sha256: ${sha}`);
    if (!/^(\.[a-z0-9]{1,8})?$/.test(ext)) throw new Error(`invalid extension: ${ext}`);
    return managed('store', 'objects', sha.slice(0, 2), sha + ext);
  }

  put(src: string, ref: Omit<ObjectRef, 'created_at'>): {sha256: string; path: string; deduplicated: boolean} {
    const sha = sha256File(src), ext = path.extname(src).toLowerCase();
    const dst = this.objectPath(sha, ext);
    const m = this.load();
    const now = new Date().toISOString();
    const existed = existsSync(dst);
    if (!existed) {
      mkdirSync(path.dirname(dst), {recursive: true});
      const tmp = `${dst}.${process.pid}.part`;
      copyFileSync(src, tmp);
      if (sha256File(tmp) !== sha) throw new Error('copy verification failed');
      renameSync(tmp, dst);
    }
    const e = m.objects[sha] ?? {sha256: sha, ext, bytes: statSync(dst).size, refs: [], approved: false, pinned: false, created_at: now, last_access: now};
    e.refs.push({...ref, created_at: now});
    e.last_access = now;
    if (ref.class === 'approved') e.approved = true;
    m.objects[sha] = e;
    this.save(m);
    return {sha256: sha, path: dst, deduplicated: existed};
  }

  // Materialize an object at a destination path (hardlink when possible = zero extra bytes on the same volume).
  materialize(sha: string, dest: string) {
    const m = this.load(), e = m.objects[sha];
    if (!e) throw new Error(`unknown object ${sha}`);
    const src = this.objectPath(sha, e.ext);
    mkdirSync(path.dirname(dest), {recursive: true});
    if (!existsSync(dest)) { try { linkSync(src, dest); } catch { copyFileSync(src, dest); } }
    e.last_access = new Date().toISOString();
    this.save(m);
    return dest;
  }

  approve(sha: string, name: string) {
    const m = this.load(), e = m.objects[sha];
    if (!e) throw new Error(`unknown object ${sha}`);
    e.approved = true;
    e.refs.push({name, class: 'approved', created_at: new Date().toISOString()});
    this.save(m);
  }
  pin(sha: string, pinned = true) { const m = this.load(); const e = m.objects[sha]; if (!e) throw new Error(`unknown object ${sha}`); e.pinned = pinned; this.save(m); }

  // Used by retention after an object was moved to quarantine.
  forget(sha: string) { const m = this.load(); delete m.objects[sha]; this.save(m); }
  restore(entry: ObjectEntry) { const m = this.load(); m.objects[entry.sha256] = entry; this.save(m); }
}
