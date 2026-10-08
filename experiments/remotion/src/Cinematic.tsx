// Transparent overlay for the stock-footage cinematic cut: minimal typography + real packshot composite on the hero shot.
// Footage itself is edited and graded in FFmpeg; this layer never paints a background.
import React from 'react';
import {AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing} from 'remotion';

export type OverlayShot = {id: string; start: number; dur: number; text?: {label: string; line: string; at: number}; hero?: boolean};
export type OverlayProps = {duration: number; shots: OverlayShot[]; files: {product: string; logo: string}; display: {brand: string; tagline: string; product: string; variant: string}; cta: string};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const FONT = "'Archivo', 'Arial', sans-serif";
// Visible jug box inside the 800×800 packshot (ffmpeg alphaextract,bbox).
const PACK = {x1: 292, x2: 553, y1: 59, y2: 748};

function Caption({text, dur}: {text: NonNullable<OverlayShot['text']>; dur: number}) {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const at = Math.round(text.at * fps), end = Math.round(dur * fps);
  const s = spring({frame: f - at, fps, config: {damping: 200, stiffness: 90, mass: 0.9}});
  const out = interpolate(f, [end - 8, end], [1, 0], clamp);
  const o = Math.min(s, out);
  const track = interpolate(s, [0, 1], [0.34, 0.2]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, transparent 46%, rgba(2,8,30,0.62) 60%, rgba(2,8,30,0.7) 68%, transparent 80%)', opacity: o}} />
      <div style={{position: 'absolute', left: 84, right: 84, top: 1030, display: 'flex', flexDirection: 'column', gap: 14}}>
        {text.label && <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 25, letterSpacing: `${track}em`, textTransform: 'uppercase', color: 'rgba(255,255,255,0.88)', opacity: o}}>{text.label}</div>}
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 72, lineHeight: 1.02, letterSpacing: '-0.015em', color: '#ffffff', opacity: o,
          transform: `translateY(${(1 - s) * 26}px)`, textShadow: '0 4px 28px rgba(0,0,20,0.45)', textWrap: 'balance' as never, maxWidth: 860}}>{text.line}</div>
      </div>
    </AbsoluteFill>
  );
}

function Hero({p, dur}: {p: OverlayProps; dur: number}) {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const jugH = 740, S = jugH / ((PACK.y2 - PACK.y1 + 1) / 800), cx = 540, baseY = 1110;
  const left = cx - ((PACK.x1 + (PACK.x2 - PACK.x1) / 2) / 800) * S, top = baseY - ((PACK.y2 + 1) / 800) * S;
  const rise = spring({frame: f - 4, fps, config: {damping: 200, stiffness: 60, mass: 1.2}});
  const drift = interpolate(f, [0, dur * fps], [1.0, 1.035]);
  const sweep = interpolate(f, [30, 62], [-40, 140], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const darken = interpolate(f, [0, 18], [0, 1], clamp);
  const logoIn = spring({frame: f - 22, fps, config: {damping: 200, stiffness: 80}});
  const ctaIn = spring({frame: f - Math.round(1.6 * fps), fps, config: {damping: 16, stiffness: 140, mass: 0.7}});
  const end = interpolate(f, [dur * fps - 10, dur * fps], [1, 1], clamp);
  const src = staticFile(p.files.product);
  const sw = ((PACK.x2 - PACK.x1) / 800) * S * 1.3;
  return (
    <AbsoluteFill style={{opacity: end}}>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 70% 48% at 50% 46%, rgba(10,40,140,0.0) 0%, rgba(2,10,40,0.55) 62%, rgba(1,5,22,0.88) 100%)', opacity: darken}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: baseY - 2, height: 2, background: 'linear-gradient(90deg, transparent, rgba(170,210,255,0.5), transparent)', opacity: rise}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: baseY, bottom: 0, background: 'linear-gradient(180deg, rgba(4,18,74,0.35), rgba(1,6,24,0.72) 55%)', opacity: rise}} />
      <div style={{position: 'absolute', transform: `translateY(${(1 - rise) * 70}px) scale(${drift})`, transformOrigin: `${cx}px ${baseY}px`, left: 0, top: 0, width: 1080, height: 1920, opacity: rise}}>
        <div style={{position: 'absolute', left: cx - sw / 2, top: baseY - sw * 0.08, width: sw, height: sw * 0.16, borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(0,4,20,0.9), rgba(0,4,20,0.4) 55%, transparent)', filter: 'blur(7px)'}} />
        <Img src={src} style={{position: 'absolute', left, top: 2 * baseY - top - S, width: S, height: S, transform: 'scaleY(-1)', opacity: 0.32,
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent 20%)', maskImage: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent 20%)', filter: 'blur(1.2px)'}} />
        <Img src={src} style={{position: 'absolute', left, top, width: S, height: S, filter: 'drop-shadow(0 30px 40px rgba(0,6,30,0.5))'}} />
        <div style={{position: 'absolute', left, top, width: S, height: S, WebkitMaskImage: `url(${src})`, WebkitMaskSize: '100% 100%', maskImage: `url(${src})`, maskSize: '100% 100%',
          background: `linear-gradient(112deg, transparent ${sweep - 16}%, rgba(255,255,255,0.42) ${sweep}%, transparent ${sweep + 16}%)`, mixBlendMode: 'screen'}} />
      </div>
      <div style={{position: 'absolute', top: 120, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, opacity: logoIn, transform: `translateY(${(1 - logoIn) * -18}px)`}}>
        <Img src={staticFile(p.files.logo)} style={{width: 112, height: 116, borderRadius: 22, boxShadow: '0 12px 30px rgba(0,0,20,0.5)'}} />
        <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 24, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#e9bf63'}}>{p.display.brand} · {p.display.tagline}</div>
        <div style={{fontFamily: FONT, fontWeight: 600, fontSize: 30, letterSpacing: '0.02em', color: '#dbe8ff'}}>{p.display.product} · {p.display.variant}</div>
      </div>
      <div style={{position: 'absolute', top: 1152, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 52, color: '#04124a', background: '#e9bf63', borderRadius: 999, padding: '20px 54px',
          transform: `scale(${0.85 + 0.15 * ctaIn})`, opacity: Math.min(1, ctaIn * 1.4), boxShadow: '0 16px 40px rgba(233,191,99,0.28)'}}>{p.cta}</div>
      </div>
    </AbsoluteFill>
  );
}

export const CinematicOverlay: React.FC<OverlayProps> = (p) => {
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill>
      {p.shots.map((s) => (
        <Sequence key={s.id} from={Math.round(s.start * fps)} durationInFrames={Math.round(s.dur * fps)} name={s.id}>
          {s.hero ? <Hero p={p} dur={s.dur} /> : s.text ? <Caption text={s.text} dur={s.dur} /> : null}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
