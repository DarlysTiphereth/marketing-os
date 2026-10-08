import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FORMATS, contrast, customFormat, distance, enumerate, loadKit, loadProduct, selectDiverse, validateCopy} from '../src/core.ts';
import {heroSpotlight, catalogClean, fit, type Ctx} from '../src/templates.ts';

test('WCAG contrast matches reference values', () => {
  assert.equal(contrast('#ffffff', '#000000').toFixed(1), '21.0');
  assert.ok(Math.abs(contrast('#777777', '#ffffff') - 4.48) < 0.01);
});

test('brief space is 4 concepts × 3 headlines × 2 CTAs × 3 formats = 72', () => {
  const all = enumerate({concept: ['a', 'b', 'c', 'd'], headline: ['h1', 'h2', 'h3'], cta: ['c1', 'c2'], format: ['f1', 'f2', 'f3']});
  assert.equal(all.length, 72);
});

test('diverse selection covers every concept before repeating one', () => {
  const all = enumerate({concept: ['a', 'b', 'c', 'd'], headline: ['h1', 'h2', 'h3'], cta: ['c1', 'c2'], format: ['f1', 'f2', 'f3']});
  const pick = selectDiverse(all, 6);
  assert.equal(new Set(pick.slice(0, 4).map((p) => p.concept)).size, 4);
  for (let i = 0; i < pick.length; i++) for (let j = i + 1; j < pick.length; j++) assert.ok(distance(pick[i]!, pick[j]!) > 0);
});

test('copy referencing an unknown claim is rejected; label claims are reported as pending approval', () => {
  const product = loadProduct('grand', 'sabao-liquido-premium-5l');
  assert.equal(validateCopy([{id: 'x', text: 'Mata 99% dos germes', claim_refs: ['c-99-percent']}], product).ok, false);
  const ok = validateCopy([{id: 'h', text: 'Remove as sujeiras', claim_refs: ['c-remove']}], product);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.pending, ['c-remove']);
});

test('brand kit and formats are consistent', () => {
  const kit = loadKit('grand');
  assert.ok(kit.assets_private);
  assert.ok(Object.values(kit.palette.tokens).every((c) => /^#[0-9a-f]{6}$/i.test(c)));
  for (const f of Object.values(FORMATS)) assert.ok(f.safe.left + f.safe.right < f.w && f.safe.top + f.safe.bottom < f.h, f.id);
  assert.equal(FORMATS.marketplace!.text_allowed, false);
  assert.throws(() => customFormat(50, 50));
  assert.throws(() => loadKit('../etc'), /invalid id/);
});

test('marketplace template renders no text; long headlines step down in size', () => {
  const kit = loadKit('grand');
  const ctx: Ctx = {kit, fmt: FORMATS.marketplace!, files: {packshot: 'p.png', logo: 'l.png', font: 'f.woff2'}, display: {brand: 'B', tagline: 't', product: 'P', variant: '5 L'}};
  const html = catalogClean(ctx, {headline: 'Headline', cta: 'CTA', benefits: [{icon: 'logo', text: 'x'}]});
  assert.ok(!/data-qc="text"/.test(html) && !/data-qc="cta"/.test(html));
  assert.ok(fit('Roupas mais limpas e perfumadas.', 100) < 100);
  assert.equal(fit('Curto.', 100), 100);
  assert.match(heroSpotlight({...ctx, fmt: FORMATS.feed_4x5!}, {headline: 'A *b*', cta: 'C'}), /class="acc">b</);
});
