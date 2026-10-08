import React from 'react';
import {AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing, random} from 'remotion';
import type {Timeline, TimedScene, VisualStyleT} from './schema.ts';

// Brand text + asset file names come from the timeline (creative.json), never from component code.
type BrandCtxT = {assets: Record<string, string>; display: Timeline['display']};
const BrandCtx = React.createContext<BrandCtxT>({assets: {}, display: {brand_name: '', brand_tagline: '', product_title: '', product_subtitle: ''}});
const useBrand = () => React.useContext(BrandCtx);
const asset = (assets: Record<string, string>, key: string) => staticFile(assets[key] ?? `${key}.png`);

type S = TimedScene;
type P = {scene: S; style: VisualStyleT; light: boolean};

// ---------- layout constants (9:16 safe zones) ----------
// Platform UI (Reels/TikTok) covers roughly the bottom ~300px and a right rail ~140px from y≈900.
// Scene content lives in y∈[140,1440]; captions own y∈[1450,1600]; nothing critical below 1600.
const CAPTION_Y = 1470;

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);

function useBeatFrames(scene: S) {
  const {fps} = useVideoConfig();
  return scene.beats.map((b) => Math.round(b * fps));
}
function usePop(start: number, cfg = {damping: 13, stiffness: 190, mass: 0.7}) {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: f - start, fps, config: cfg});
}
function shake(f: number, start: number, amp = 18, dur = 9) {
  const t = f - start;
  if (t < 0 || t > dur) return {x: 0, y: 0};
  const k = (1 - t / dur) * amp;
  return {x: Math.sin(t * 2.9) * k, y: Math.cos(t * 3.7) * k * 0.7};
}

// ---------- typography ----------
const display = (style: VisualStyleT): React.CSSProperties => ({fontFamily: `'${style.font_display}', 'Arial Black', sans-serif`, fontWeight: 900, letterSpacing: -2, textTransform: 'uppercase', lineHeight: 0.95});
const strokeShadow = (dark = 'rgba(0,10,40,0.55)') => `0 6px 0 ${dark}, 0 14px 40px rgba(0,0,0,0.35)`;

function PopWords({text, start, size, color, accent, accentWords = [], style, align = 'center', stagger = 2, maxWidth = 960, light = false}: {
  text: string; start: number; size: number; color: string; accent: string; accentWords?: number[]; style: VisualStyleT; align?: 'center' | 'left'; stagger?: number; maxWidth?: number; light?: boolean;
}) {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = text.split(' ');
  return (
    <div style={{...display(style), fontSize: size, color, textAlign: align, maxWidth, display: 'flex', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: `0 ${size * 0.24}px`}}>
      {words.map((w, i) => {
        const s = spring({frame: f - start - i * stagger, fps, config: {damping: 12, stiffness: 210, mass: 0.6}});
        const o = interpolate(f - start - i * stagger, [0, 3], [0, 1], clamp);
        return (
          <span key={i} style={{display: 'inline-block', opacity: o, transform: `translateY(${(1 - s) * 60}px) scale(${1.5 - 0.5 * s})`, filter: `blur(${(1 - s) * 6}px)`,
            color: accentWords.includes(i) ? accent : color, textShadow: light ? '0 4px 0 rgba(255,255,255,0.8), 0 10px 30px rgba(6,22,79,0.18)' : strokeShadow()}}>{w}</span>
        );
      })}
    </div>
  );
}

// ---------- backdrop ----------
function Backdrop({style, light, intensity = 1}: {style: VisualStyleT; light: boolean; intensity?: number}) {
  const f = useCurrentFrame();
  const p = style.palette;
  const bx = 50 + Math.sin(f / 70) * 18, by = 30 + Math.cos(f / 90) * 10;
  const cx = 30 + Math.cos(f / 60) * 20, cy = 75 + Math.sin(f / 80) * 8;
  return (
    <AbsoluteFill style={{background: light
      ? `radial-gradient(circle at ${bx}% ${by}%, #ffffff 0%, ${p.bg0} 55%, #b9cdf7 100%)`
      : `radial-gradient(circle at ${bx}% ${by}%, ${p.bg1} 0%, #082a92 32%, ${p.bg0} 78%)`}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at ${cx}% ${cy}%, ${light ? 'rgba(10,63,194,0.18)' : 'rgba(80,170,255,0.35)'} 0%, transparent 45%)`, opacity: intensity}} />
      <Caustics light={light} />
      <Bubbles light={light} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,20,0.45) 100%)', opacity: light ? 0.25 : 1}} />
    </AbsoluteFill>
  );
}

function Caustics({light}: {light: boolean}) {
  const f = useCurrentFrame();
  const lines = Array.from({length: 7}, (_, i) => {
    const y0 = 200 + i * 260;
    let d = `M -50 ${y0}`;
    for (let x = -50; x <= 1130; x += 40) d += ` L ${x} ${y0 + Math.sin(x / 140 + f / 22 + i) * 34 + Math.sin(x / 61 - f / 15 + i * 2) * 10}`;
    return <path key={i} d={d} stroke={light ? 'rgba(10,63,194,0.08)' : 'rgba(160,215,255,0.13)'} strokeWidth={10 + (i % 3) * 6} fill="none" strokeLinecap="round" />;
  });
  return <svg width={1080} height={1920} style={{position: 'absolute', mixBlendMode: light ? 'multiply' : 'screen'}}>{lines}</svg>;
}

function Bubbles({light, count = 22, seed = 'b'}: {light: boolean; count?: number; seed?: string}) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      {Array.from({length: count}, (_, i) => {
        const r = 10 + random(`${seed}r${i}`) * 34, speed = 2 + random(`${seed}s${i}`) * 4;
        const x = random(`${seed}x${i}`) * 1080 + Math.sin(f / 18 + i) * 14;
        const y = 1980 - ((f * speed + random(`${seed}y${i}`) * 2200) % 2200);
        return <div key={i} style={{position: 'absolute', left: x, top: y, width: r * 2, height: r * 2, borderRadius: '50%',
          border: `2px solid ${light ? 'rgba(10,63,194,0.25)' : 'rgba(200,235,255,0.45)'}`,
          background: `radial-gradient(circle at 30% 30%, ${light ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'} 0%, transparent 35%)`}} />;
      })}
    </AbsoluteFill>
  );
}

// ---------- product (real packshot; scale/translate/shine only, never redrawn) ----------
function Product({size, x, y, rot = 0, shineAt, silhouette = 0, shadow = true}: {size: number; x: number; y: number; rot?: number; shineAt?: number; silhouette?: number; shadow?: boolean}) {
  const f = useCurrentFrame();
  const src = asset(useBrand().assets, 'product');
  const sweep = shineAt === undefined ? -1 : interpolate(f - shineAt, [0, 22], [-60, 160], clamp);
  return (
    <div style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, transform: `rotate(${rot}deg)`}}>
      <Img src={src} style={{width: size, height: size, filter: `${shadow ? 'drop-shadow(0 40px 50px rgba(0,8,40,0.55)) ' : ''}brightness(${1 - silhouette})`}} />
      {sweep > -60 && sweep < 160 && (
        <div style={{position: 'absolute', inset: 0, WebkitMaskImage: `url(${src})`, WebkitMaskSize: '100% 100%', maskImage: `url(${src})`, maskSize: '100% 100%',
          background: `linear-gradient(115deg, transparent ${sweep - 18}%, rgba(255,255,255,0.45) ${sweep}%, transparent ${sweep + 18}%)`, mixBlendMode: 'screen'}} />
      )}
    </div>
  );
}

// ---------- illustrations ----------
// Smooth organic blob (Catmull-Rom -> cubic bezier), seeded.
function smoothBlob(cx: number, cy: number, r: number, seed: string, n = 14) {
  const pts = Array.from({length: n}, (_, a) => { const ang = (a / n) * Math.PI * 2, rr = r * (0.72 + random(`${seed}${a}`) * 0.5); return [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr] as const; });
  let d = `M ${pts[0]![0]} ${pts[0]![1]} `;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!, p1 = pts[i]!, p2 = pts[(i + 1) % n]!, p3 = pts[(i + 2) % n]!;
    d += `C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]} `;
  }
  return d + 'Z';
}
const SHIRT = 'M128 46 L168 28 Q200 62 232 28 L272 46 L372 104 L336 176 L298 156 L298 372 L102 372 L102 156 L64 176 L28 104 Z';
function Shirt({w, color, stains = 0, sparkle = 0, glow = false}: {w: number; color: string; stains?: number; sparkle?: number; glow?: boolean}) {
  const f = useCurrentFrame();
  const blobs = [[170, 200, 34], [240, 270, 26], [150, 300, 22], [262, 190, 18], [205, 330, 16]];
  const blob = (cx: number, cy: number, r: number, k: number) => smoothBlob(cx, cy, r, `st${k}`);
  return (
    <svg width={w} height={w} viewBox="0 0 400 400" style={{overflow: 'visible', filter: glow ? 'drop-shadow(0 0 40px rgba(255,255,255,0.8))' : 'drop-shadow(0 30px 40px rgba(0,0,0,0.35))'}}>
      <defs>
        <pattern id="weave" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 4 H8 M4 0 V8" stroke="rgba(0,0,0,0.07)" strokeWidth="2" /></pattern>
      </defs>
      <path d={SHIRT} fill={color} stroke="rgba(0,0,0,0.18)" strokeWidth={4} strokeLinejoin="round" />
      <path d={SHIRT} fill="url(#weave)" />
      <path d="M168 28 Q200 62 232 28" stroke="rgba(0,0,0,0.2)" strokeWidth={6} fill="none" />
      {blobs.map(([cx, cy, r], k) => <path key={k} d={blob(cx!, cy!, r!, k)} fill="#7a5a33" opacity={0.6 * Math.min(1, Math.max(0, stains * 1.6 - k * 0.15))} transform={`translate(${cx} ${cy}) scale(${Math.min(1, stains * 1.4)}) translate(${-cx!} ${-cy!})`} />)}
      {sparkle > 0 && [[110, 80, 28], [320, 140, 22], [260, 330, 18], [90, 300, 14]].map(([x, y, s], k) => {
        const tw = 0.6 + 0.4 * Math.sin(f / 4 + k * 1.7);
        return <path key={k} transform={`translate(${x} ${y}) scale(${s! / 20 * sparkle * tw})`} d="M0 -20 Q2 -2 20 0 Q2 2 0 20 Q-2 2 -20 0 Q-2 -2 0 -20Z" fill="#fff" />;
      })}
    </svg>
  );
}

function LoopArrow({size, color, frame}: {size: number; color: string; frame: number}) {
  const rot = frame * 4 + Math.pow(Math.max(0, frame), 1.6) * 0.15;
  return (
    <svg width={size} height={size} viewBox="-120 -120 240 240" style={{transform: `rotate(${rot}deg)`}}>
      <path d="M 0 -90 A 90 90 0 1 1 -88 -18" stroke={color} strokeWidth={22} fill="none" strokeLinecap="round" />
      <path d="M -118 -30 L -86 4 L -58 -36 Z" fill={color} />
    </svg>
  );
}

function Machine({size, f}: {size: number; f: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <rect x={20} y={10} width={160} height={180} rx={22} fill="#eaf1ff" stroke="#0a3fc2" strokeWidth={8} />
      <circle cx={42} cy={34} r={7} fill="#0a3fc2" /><rect x={110} y={28} width={50} height={12} rx={6} fill="#0a3fc2" />
      <circle cx={100} cy={115} r={58} fill="#0a3fc2" />
      <circle cx={100} cy={115} r={46} fill="#5fb3ff" />
      <path d={`M 54 ${120 + Math.sin(f / 4) * 6} Q 77 ${105 + Math.cos(f / 5) * 8} 100 ${120} T 146 ${118 + Math.sin(f / 3) * 6} L 146 160 L 54 160 Z`} fill="#1d6dff" opacity={0.9} clipPath="url(#door)" />
      <clipPath id="door"><circle cx={100} cy={115} r={46} /></clipPath>
      <circle cx={84} cy={98} r={10} fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}

function Basin({size, f}: {size: number; f: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <path d="M 20 90 L 180 90 L 160 180 L 40 180 Z" fill="#eaf1ff" stroke="#0a3fc2" strokeWidth={8} strokeLinejoin="round" />
      <path d={`M 28 112 Q 64 ${100 + Math.sin(f / 4) * 7} 100 112 T 172 112 L 160 172 L 40 172 Z`} fill="#5fb3ff" />
      <path d={`M 100 ${20 + ((f * 3) % 60)} q 12 18 0 26 q -12 -8 0 -26 Z`} fill="#1d6dff" />
    </svg>
  );
}

function Chip({icon, text, start, style, light}: {icon: string; text: string; start: number; style: VisualStyleT; light: boolean}) {
  const s = usePop(start);
  const f = useCurrentFrame();
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 26, padding: '18px 34px 18px 18px', borderRadius: 999,
      background: light ? '#ffffff' : 'rgba(4,18,74,0.82)', border: `4px solid ${style.palette.accent}`, boxShadow: '0 18px 40px rgba(0,0,30,0.35)',
      opacity: interpolate(f - start, [0, 3], [0, 1], clamp), transform: `translateX(${(1 - s) * -140}px) scale(${0.8 + 0.2 * s})`}}>
      <Img src={asset(useBrand().assets, icon)} style={{width: 132, height: 132, borderRadius: '50%'}} />
      <div style={{...display(style), fontSize: 60, letterSpacing: -1, color: light ? style.palette.ink : '#fff', maxWidth: 720}}>{text}</div>
    </div>
  );
}

function Band({text, style, start, size = 62}: {text: string; style: VisualStyleT; start: number; size?: number}) {
  const s = usePop(start);
  return (
    <div style={{padding: '22px 54px', borderRadius: 999, background: 'linear-gradient(180deg,#0b2f9a,#04124a)', border: `5px solid ${style.palette.accent}`,
      boxShadow: '0 16px 40px rgba(0,0,30,0.4)', transform: `scale(${0.6 + 0.4 * s})`, opacity: Math.min(1, s * 2)}}>
      <div style={{fontFamily: `'${style.font_body}', sans-serif`, fontWeight: 700, fontSize: size, color: '#fff', letterSpacing: size * 0.18, whiteSpace: 'nowrap'}}>{text}</div>
    </div>
  );
}

const Disclaimer = ({text}: {text: string}) => (
  <div style={{position: 'absolute', left: 60, top: 1405, fontFamily: 'Bahnschrift, sans-serif', fontSize: 30, color: 'rgba(255,255,255,0.85)', letterSpacing: 1}}>{text}</div>
);

// ---------- scenes ----------
function HookQuestion({scene, style}: P) {
  const f = useCurrentFrame();
  const [b0 = 0, b1 = 20] = useBeatFrames(scene);
  const punch = interpolate(f, [0, 7], [1.3, 1], {...clamp, easing: ease});
  const sk = shake(f, b1, 22);
  return (
    <AbsoluteFill style={{transform: `translate(${sk.x}px, ${sk.y}px)`}}>
      <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 45%, #4a5068 0%, #1a1d2b 70%)'}} />
      <Bubbles light={false} count={8} seed="hq" />
      <div style={{position: 'absolute', top: 170, width: '100%', display: 'flex', justifyContent: 'center'}}>
        <PopWords text={scene.on_screen_text[0]!} start={b0 - 8} size={112} color="#ffffff" accent={style.palette.accent} style={style} stagger={1} />
      </div>
      <div style={{position: 'absolute', left: 540 - 330, top: 430, transform: `scale(${punch}) rotate(${-5 + Math.sin(f / 9) * 2}deg)`}}>
        <Shirt w={700} color="#a8a08c" stains={interpolate(f, [0, 10], [0.4, 1], clamp)} />
        {[0, 1, 2].map((k) => (
          <svg key={k} width={80} height={220} style={{position: 'absolute', left: 230 + k * 90, top: -140}} viewBox="0 0 80 220">
            <path d="M40 210 C 0 170, 80 140, 40 100 S 0 30, 40 0" stroke="#9db36b" strokeWidth={10} fill="none" strokeLinecap="round"
              strokeDasharray="60 30" strokeDashoffset={-f * 3 - k * 20} opacity={0.75} />
          </svg>
        ))}
      </div>
      <div style={{position: 'absolute', top: 1110, width: '100%', display: 'flex', justifyContent: 'center'}}>
        <PopWords text={scene.on_screen_text[1]!} start={b1} size={128} color="#ffffff" accent={style.palette.accent} accentWords={[3]} style={style} maxWidth={1000} />
      </div>
    </AbsoluteFill>
  );
}

function HookSlam({scene, style, light}: P) {
  const f = useCurrentFrame();
  const ink = light ? style.palette.ink : '#fff';
  const [, b1 = 30] = useBeatFrames(scene);
  const slam = interpolate(f, [0, 6], [3.2, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const drop = usePop(5, {damping: 11, stiffness: 160, mass: 0.9});
  const sk = shake(f, 6, 26);
  return (
    <AbsoluteFill style={{transform: `translate(${sk.x}px, ${sk.y}px)`}}>
      <Backdrop style={style} light={light} />
      <div style={{position: 'absolute', top: 120, width: '100%', textAlign: 'center', ...display(style), fontSize: 900, color: style.palette.accent,
        transform: `scale(${slam})`, opacity: 0.95, textShadow: '0 30px 80px rgba(0,0,0,0.45)'}}>5</div>
      <div style={{position: 'absolute', top: 1010, width: '100%', textAlign: 'center', ...display(style), fontSize: 150, color: ink, textShadow: light ? 'none' : strokeShadow(), transform: `scale(${slam})`}}>LITROS</div>
      <Product size={900} x={540} y={-500 + drop * 1080} rot={(1 - drop) * 12} shineAt={18} />
      <div style={{position: 'absolute', top: 1260, width: '100%', display: 'flex', justifyContent: 'center'}}>
        <Band text={scene.on_screen_text[1]!} style={style} start={b1} size={52} />
      </div>
    </AbsoluteFill>
  );
}

function HookSilhouette({scene, style, light}: P) {
  const f = useCurrentFrame();
  const ink = light ? style.palette.ink : '#fff';
  const {durationInFrames} = useVideoConfig();
  const [b0 = 0, b1 = 30] = useBeatFrames(scene);
  const reveal = interpolate(f, [b1 + 12, b1 + 26], [1, 0], clamp);
  return (
    <AbsoluteFill>
      <Backdrop style={style} light={light} intensity={0.5} />
      <div style={{position: 'absolute', top: 260, width: '100%', textAlign: 'center', ...display(style), fontSize: 1100, color: light ? 'rgba(6,22,79,0.06)' : 'rgba(255,255,255,0.07)',
        transform: `scale(${1 + Math.sin(f / 6) * 0.03})`}}>?</div>
      <Product size={1000} x={540} y={830} silhouette={reveal} shineAt={b1 + 14} />
      <div style={{position: 'absolute', top: 150, width: '100%', display: 'flex', justifyContent: 'center'}}>
        <PopWords text={scene.on_screen_text[0]!} start={b0 - 8} size={104} color={ink} accent={style.palette.accent} style={style} stagger={1} light={light} />
      </div>
      <div style={{position: 'absolute', top: 1250, width: '100%', display: 'flex', justifyContent: 'center'}}>
        <PopWords text={scene.on_screen_text[1]!} start={b1} size={104} color={ink} accent={style.palette.accent} accentWords={[3]} style={style} light={light} />
      </div>
      {durationInFrames < 0 && null}
    </AbsoluteFill>
  );
}

function ProblemStains({scene, style}: P) {
  const f = useCurrentFrame();
  const [b0 = 0, b1 = 40] = useBeatFrames(scene);
  const zoom = 1.15 + f * 0.0025;
  const second = f >= b1;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: '#cfc8b8'}}>
        <svg width={1080} height={1920} style={{transform: `scale(${zoom}) rotate(-4deg)`}}>
          <defs><pattern id="fabric" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill="#cfc8b8" /><path d="M0 4 H18 M0 13 H18" stroke="#b9b1a0" strokeWidth="5" /><path d="M4 0 V18 M13 0 V18" stroke="#c4bca9" strokeWidth="3" />
          </pattern></defs>
          <rect width={1080} height={1920} fill="url(#fabric)" />
          <defs><radialGradient id="stain"><stop offset="0%" stopColor="#5a3d1c" stopOpacity="0.45" /><stop offset="70%" stopColor="#6e4f2a" stopOpacity="0.6" /><stop offset="100%" stopColor="#4a3014" stopOpacity="0.8" /></radialGradient></defs>
          {[[300, 700, 150], [720, 900, 120], [480, 1180, 170], [820, 520, 90], [200, 1050, 80], [640, 640, 40], [380, 930, 34], [760, 1220, 46]].map(([cx, cy, r], k) => {
            const g = interpolate(f, [b0 + k * 2, b0 + k * 2 + 16], [0, 1], {...clamp, easing: ease});
            return g > 0 ? <path key={k} d={smoothBlob(cx!, cy!, r! * g, `ps${k}`, 16)} fill="url(#stain)" style={{filter: 'blur(2.5px)'}} /> : null;
          })}
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(10,12,30,0.7) 0%, transparent 35%, transparent 60%, rgba(10,12,30,0.75) 100%)'}} />
      {!second && <div style={{position: 'absolute', top: 210, width: '100%', display: 'flex', justifyContent: 'center'}}>
        <PopWords text={scene.on_screen_text[0]!} start={b0} size={118} color="#fff" accent={style.palette.danger} accentWords={[3]} style={style} />
      </div>}
      {second && <>
        {[0, 1, 2].map((k) => {
          const o = interpolate(f - b1, [0, 20], [0.9, 0], clamp);
          return <svg key={k} width={200} height={500} viewBox="0 0 80 220" style={{position: 'absolute', left: 300 + k * 170, top: 520 - (f - b1) * 4, opacity: o}}>
            <path d="M40 210 C 0 170, 80 140, 40 100 S 0 30, 40 0" stroke="#ffffff" strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray="40 30" strokeDashoffset={(f - b1) * 4} />
          </svg>;
        })}
        <div style={{position: 'absolute', top: 1180, width: '100%', display: 'flex', justifyContent: 'center'}}>
          <PopWords text={scene.on_screen_text[1]!} start={b1} size={118} color="#fff" accent={style.palette.danger} accentWords={[3]} style={style} />
        </div>
      </>}
    </AbsoluteFill>
  );
}

function TensionLoop({scene, style}: P) {
  const f = useCurrentFrame();
  const beats = useBeatFrames(scene);
  const rots = [-5, 4, -2];
  const tops = [300, 520, 1180];
  const last = [...beats].reverse().find((b) => f >= b) ?? beats[0]!;
  const sk = shake(f, last, 20);
  const count = beats.filter((b) => f >= b).length;
  return (
    <AbsoluteFill style={{transform: `translate(${sk.x}px, ${sk.y}px)`}}>
      <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 50%, #2a1530 0%, #0d0716 75%)'}} />
      <div style={{position: 'absolute', left: 540 - 330, top: 600, opacity: 0.9}}><LoopArrow size={660} color={style.palette.danger} frame={f} /></div>
      {scene.on_screen_text.map((t, i) => {
        const s = usePop(beats[i] ?? 0, {damping: 10, stiffness: 260, mass: 0.6});
        if (f < (beats[i] ?? 0)) return null;
        const dim = i < count - 1 ? 0.45 : 1;
        return <div key={i} style={{position: 'absolute', top: tops[i], width: '100%', display: 'flex', justifyContent: 'center', opacity: dim,
          transform: `rotate(${rots[i]}deg) scale(${2.2 - 1.2 * s})`}}>
          <div style={{...display(style), fontSize: i === 2 ? 112 : 140, color: '#fff', textAlign: 'center', maxWidth: 980, padding: '6px 30px',
            background: i === 2 ? style.palette.danger : 'transparent', textShadow: strokeShadow()}}>{t}</div>
        </div>;
      })}
      <div style={{position: 'absolute', top: 905, width: '100%', textAlign: 'center', fontFamily: `'${style.font_body}', sans-serif`, fontWeight: 700, fontSize: 64, color: '#fff', letterSpacing: 6}}>
        LAVAGEM #{Math.max(1, count)}
      </div>
    </AbsoluteFill>
  );
}

function ProductReveal({scene, style, light}: P) {
  const f = useCurrentFrame();
  const {display: brandText} = useBrand();
  const beats = useBeatFrames(scene);
  const wave = interpolate(f, [0, 12], [1920, -300], {...clamp, easing: Easing.out(Easing.quad)});
  const rise = usePop(4, {damping: 14, stiffness: 120, mass: 1});
  const float = Math.sin(f / 14) * 10;
  const titleIn = usePop(6);
  return (
    <AbsoluteFill>
      <Backdrop style={style} light={light} />
      <div style={{position: 'absolute', top: 140, width: '100%', textAlign: 'center', opacity: titleIn, transform: `translateY(${(1 - titleIn) * -40}px)`}}>
        <div style={{fontFamily: `'${style.font_body}', sans-serif`, fontWeight: 700, fontSize: 46, letterSpacing: 10, color: style.palette.accent}}>{brandText.brand_name}</div>
        <div style={{...display(style), fontSize: 76, color: light ? style.palette.ink : '#fff', letterSpacing: -1, textShadow: light ? 'none' : strokeShadow()}}>{brandText.product_title}</div>
      </div>
      <Product size={920} x={540} y={700 + (1 - rise) * 900 + float} shineAt={20} />
      <div style={{position: 'absolute', top: 1150, left: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
        {scene.on_screen_text.map((t, i) => {
          const s = usePop(beats[i] ?? 0);
          if (f < (beats[i] ?? 0)) return <div key={i} style={{height: i === 0 ? 92 : 78}} />;
          return <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18, transform: `translateY(${(1 - s) * 50}px)`, opacity: Math.min(1, s * 1.5)}}>
            {i > 0 && <div style={{width: 58, height: 58, borderRadius: '50%', background: style.palette.accent, color: light ? '#fff' : '#04124a', display: 'grid', placeItems: 'center', fontSize: 42, fontWeight: 900, fontFamily: `'${style.font_display}', sans-serif`}}>✓</div>}
            <div style={{...display(style), fontSize: i === 0 ? 92 : 70, color: i === 0 ? style.palette.accent : (light ? style.palette.ink : '#fff'), textShadow: light ? 'none' : strokeShadow()}}>{t}</div>
          </div>;
        })}
      </div>
      {scene.disclaimer && <Disclaimer text={scene.disclaimer} />}
      {wave > -300 && <svg width={1080} height={2400} style={{position: 'absolute', top: wave}} viewBox="0 0 1080 2400">
        <path d={`M0 120 Q 270 ${40 + Math.sin(f) * 20} 540 120 T 1080 120 V 2400 H 0 Z`} fill="#1d6dff" />
        <path d={`M0 170 Q 270 90 540 170 T 1080 170 V 2400 H 0 Z`} fill="#0a3fc2" />
      </svg>}
    </AbsoluteFill>
  );
}

function StepCards({scene, style, light}: P) {
  const f = useCurrentFrame();
  const [b0 = 0, b1 = 20, b2 = 40, b3 = 60] = useBeatFrames(scene);
  const c1 = usePop(b0), c2 = usePop(b2);
  const card = (s: number, from: number): React.CSSProperties => ({width: 960, padding: '44px 40px', minHeight: 300, borderRadius: 44, background: '#ffffff', display: 'flex', alignItems: 'center', gap: 34,
    boxShadow: '0 30px 60px rgba(0,0,40,0.35)', transform: `translateX(${(1 - s) * from}px) rotate(${(1 - s) * 6}deg)`, opacity: Math.min(1, s * 2)});
  const sub = (start: number) => ({fontFamily: `'${style.font_body}', sans-serif`, fontWeight: 700, fontSize: 60, color: '#0a3fc2', marginTop: 8, opacity: interpolate(f - start, [0, 5], [0, 1], clamp),
    transform: `translateY(${interpolate(f - start, [0, 6], [20, 0], clamp)}px)`});
  return (
    <AbsoluteFill>
      <Backdrop style={style} light={light} />
      <div style={{position: 'absolute', top: 230, left: 70, ...display(style), fontSize: 110, color: light ? style.palette.ink : '#fff', textShadow: light ? 'none' : strokeShadow()}}>COMO USAR</div>
      <Product size={600} x={810} y={400} rot={8} shineAt={b0 + 4} />
      <div style={{position: 'absolute', top: 680, left: 60, display: 'flex', flexDirection: 'column', gap: 44}}>
        <div style={card(c1, -1100)}>
          <Machine size={240} f={f} />
          <div><div style={{...display(style), fontSize: 92, color: '#04124a'}}>{scene.on_screen_text[0]}</div><div style={sub(b1)}>{scene.on_screen_text[1]}</div></div>
        </div>
        <div style={card(c2, 1100)}>
          <Basin size={240} f={f} />
          <div><div style={{...display(style), fontSize: 92, color: '#04124a'}}>{scene.on_screen_text[2]}</div><div style={sub(b3)}>{scene.on_screen_text[3]}</div></div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function BenefitStack({scene, style, light}: P) {
  const f = useCurrentFrame();
  const beats = useBeatFrames(scene);
  const icons = ['icon_sparkle', 'icon_shirt', 'icon_leaf'];
  return (
    <AbsoluteFill>
      <Backdrop style={style} light={light} />
      <Product size={800} x={540} y={470 + Math.sin(f / 12) * 8} rot={Math.sin(f / 20) * 2} shineAt={beats[1]} />
      <div style={{position: 'absolute', top: 860, left: 50, display: 'flex', flexDirection: 'column', gap: 24}}>
        {scene.on_screen_text.map((t, i) => (f >= (beats[i] ?? 0) ? <Chip key={i} icon={icons[i]!} text={t} start={beats[i] ?? 0} style={style} light={light} /> : <div key={i} style={{height: 176}} />))}
      </div>
    </AbsoluteFill>
  );
}

function Payoff({scene, style}: P) {
  const f = useCurrentFrame();
  const [b0 = 0, b1 = 30] = useBeatFrames(scene);
  const badge = usePop(b1, {damping: 9, stiffness: 220, mass: 0.6});
  const push = 1 + f * 0.0012;
  return (
    <AbsoluteFill style={{transform: `scale(${push})`}}>
      <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 42%, #ffffff 0%, #d7e6ff 45%, #2f6fe0 100%)'}} />
      <Bubbles light count={14} seed="po" />
      <div style={{position: 'absolute', left: 20, top: 560, transform: `rotate(-8deg) scale(${interpolate(f, [0, 10], [0.85, 1], {...clamp, easing: ease})})`}}>
        <Shirt w={520} color="#ffffff" sparkle={interpolate(f, [4, 14], [0, 1], clamp)} glow />
      </div>
      <Product size={940} x={680} y={760} shineAt={b0 + 2} />
      <div style={{position: 'absolute', left: 760, top: 980, width: 230, height: 230, borderRadius: '50%', background: style.palette.accent, display: 'grid', placeItems: 'center',
        transform: `scale(${badge}) rotate(${(1 - badge) * -90 - 10}deg)`, boxShadow: '0 20px 40px rgba(0,0,40,0.4)', border: '8px solid #fff'}}>
        <div style={{...display(style), fontSize: 110, color: style.style_id === 'clean-bright' ? '#fff' : '#04124a', letterSpacing: -4}}>{scene.on_screen_text[1]}</div>
      </div>
      <div style={{position: 'absolute', top: 210, width: '100%', display: 'flex', justifyContent: 'center'}}>
        <Band text={scene.on_screen_text[0]!} style={style} start={b0} size={60} />
      </div>
    </AbsoluteFill>
  );
}

function CtaCard({scene, style, light}: P) {
  const f = useCurrentFrame();
  const {display: brandText} = useBrand();
  const logo = usePop(0);
  const btn = usePop(8);
  const pulse = 1 + Math.max(0, Math.sin((f - 14) / 5)) * 0.05;
  const button = String((scene.layout.params as {button?: string}).button ?? scene.on_screen_text[0]);
  return (
    <AbsoluteFill>
      <Backdrop style={style} light={light} />
      <div style={{position: 'absolute', top: 120, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${logo})`}}>
        <Img src={asset(useBrand().assets, 'logo')} style={{width: 230, height: 238, borderRadius: 40, boxShadow: '0 16px 40px rgba(0,0,30,0.4)'}} />
        <div style={{...display(style), fontSize: 120, color: light ? style.palette.ink : '#fff', marginTop: 16, letterSpacing: 4, textShadow: light ? 'none' : strokeShadow()}}>{brandText.brand_name}</div>
        <div style={{fontFamily: `'${style.font_body}', sans-serif`, fontWeight: 600, fontSize: 44, color: light ? style.palette.ink : '#dbe8ff', marginTop: 4}}>{brandText.brand_tagline}</div>
      </div>
      <Product size={760} x={540} y={930 + Math.sin(f / 14) * 8} shineAt={10} />
      <div style={{position: 'absolute', top: 1255, width: '100%', display: 'flex', justifyContent: 'center'}}>
        <div style={{padding: '30px 70px', borderRadius: 999, background: style.palette.accent, boxShadow: light ? '0 20px 50px rgba(10,63,194,0.35)' : '0 20px 50px rgba(242,193,78,0.45)',
          transform: `scale(${btn * pulse})`, ...display(style), fontSize: 66, color: light ? '#ffffff' : '#04124a', letterSpacing: -1, display: 'flex', alignItems: 'center', gap: 22}}>
          {button} <span style={{fontSize: 60}}>→</span>
        </div>
      </div>
      <div style={{position: 'absolute', top: 1395, width: '100%', textAlign: 'center', fontFamily: `'${style.font_body}', sans-serif`, fontWeight: 600, fontSize: 38, color: light ? style.palette.ink : '#dbe8ff', opacity: btn}}>
        {brandText.product_subtitle}
      </div>
    </AbsoluteFill>
  );
}

const COMPONENTS: Record<string, React.FC<P>> = {HookQuestion, HookSlam, HookSilhouette, ProblemStains, TensionLoop, ProductReveal, StepCards, BenefitStack, Payoff, CtaCard};

// ---------- transitions (entry of the next scene is driven by the previous scene's `transition`) ----------
function SceneShell({enter, children}: {enter: string; children: React.ReactNode}) {
  const f = useCurrentFrame();
  let transform = '', filter = '';
  if (enter === 'whip') { const t = interpolate(f, [0, 7], [1, 0], {...clamp, easing: Easing.out(Easing.cubic)}); transform = `translateX(${t * 520}px)`; filter = t > 0.02 ? `blur(${t * 18}px)` : ''; }
  if (enter === 'zoom_punch') { const t = interpolate(f, [0, 8], [1, 0], {...clamp, easing: Easing.out(Easing.cubic)}); transform = `scale(${1 + t * 0.4})`; filter = t > 0.02 ? `blur(${t * 12}px)` : ''; }
  const flash = enter === 'flash' ? interpolate(f, [0, 6], [0.9, 0], clamp) : 0;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{transform, filter}}>{children}</AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{background: '#fff', opacity: flash}} />}
    </AbsoluteFill>
  );
}

// ---------- captions (karaoke, sound-off support) ----------
function Captions({tl}: {tl: Timeline}) {
  const f = useCurrentFrame();
  const t = f / tl.fps;
  const words = tl.scenes.flatMap((s, si) => s.words.map((w) => ({...w, si})));
  const idx = words.findIndex((w) => t >= w.start && t < w.end);
  if (idx < 0) return null;
  // chunk of up to 3 words / 22 chars, stable within the chunk
  const chunks: number[][] = [];
  let cur: number[] = [], len = 0;
  words.forEach((w, i) => {
    const gapBreak = i > 0 && (w.start - words[i - 1]!.end > 0.25 || w.si !== words[i - 1]!.si);
    if (cur.length && (cur.length >= 3 || len + w.text.length > 22 || gapBreak || /[.?!]$/.test(words[i - 1]!.text))) { chunks.push(cur); cur = []; len = 0; }
    cur.push(i); len += w.text.length + 1;
  });
  if (cur.length) chunks.push(cur);
  const chunk = chunks.find((c) => c.includes(idx))!;
  const startF = Math.round(words[chunk[0]!]!.start * tl.fps);
  const s = spring({frame: f - startF, fps: tl.fps, config: {damping: 14, stiffness: 240, mass: 0.5}});
  return (
    <div style={{position: 'absolute', top: CAPTION_Y, width: '100%', display: 'flex', justifyContent: 'center', transform: `scale(${0.85 + 0.15 * s})`}}>
      <div style={{display: 'flex', gap: 16, padding: '10px 26px', borderRadius: 22, background: 'rgba(2,8,30,0.55)'}}>
        {chunk.map((i) => (
          <span key={i} style={{fontFamily: `'${tl.style.font_display}', sans-serif`, fontWeight: 900, fontSize: 58, letterSpacing: -1,
            color: i === idx ? (tl.style.style_id === 'clean-bright' ? '#ffd84d' : tl.style.palette.accent) : '#ffffff', transform: i === idx ? 'scale(1.08)' : undefined, display: 'inline-block'}}>{words[i]!.text.replace(/[.,;:]$/, '')}</span>
        ))}
      </div>
    </div>
  );
}

export const Ad: React.FC<Timeline> = (tl) => {
  const light = tl.style.style_id === 'clean-bright';
  return (
    <BrandCtx.Provider value={{assets: tl.assets, display: tl.display}}>
    <AbsoluteFill style={{background: tl.style.palette.bg0}}>
      {tl.scenes.map((s, i) => {
        const Comp = COMPONENTS[s.layout.component];
        const enter = i === 0 ? 'none' : tl.scenes[i - 1]!.transition;
        return (
          <Sequence key={s.scene_id} from={Math.round(s.start * tl.fps)} durationInFrames={Math.round(s.duration * tl.fps)} name={s.scene_id}>
            <SceneShell enter={enter}>{Comp ? <Comp scene={s} style={tl.style} light={light} /> : <AbsoluteFill style={{background: 'red'}} />}</SceneShell>
          </Sequence>
        );
      })}
      {tl.selection.captions === 'karaoke' && <Captions tl={tl} />}
    </AbsoluteFill>
    </BrandCtx.Provider>
  );
};
