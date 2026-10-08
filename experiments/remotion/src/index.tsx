import React from 'react';
// Open-source font bundled with the composition so renders match across Windows and Linux workers.
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
import '@fontsource/archivo/900.css';
import {Composition, registerRoot} from 'remotion';
import {Ad} from './Ad.tsx';
import {CinematicOverlay, type OverlayProps} from './Cinematic.tsx';
import type {Timeline} from './schema.ts';

const placeholder: Timeline = {
  variant_id: 'placeholder', creative_id: 'placeholder',
  selection: {hook: 'hook-a', body: 'body-1', cta: 'cta-a', style: 'deep-blue', voice: 'maria', music: 'pulse-116', pacing: 'standard', captions: 'off'},
  style: {style_id: 'deep-blue', palette: {bg0: '#020b33', bg1: '#0a3fc2', accent: '#f2c14e', ink: '#fff', paper: '#eef4ff', danger: '#ff4d4d'}, font_display: 'Segoe UI Black', font_body: 'Bahnschrift', palette_status: 'DESIGN_CHOICE'},
  fps: 30, width: 1080, height: 1920, duration: 1, scenes: [], assets: {},
  display: {brand_name: '', brand_tagline: '', product_title: '', product_subtitle: ''},
};

const overlayPlaceholder: OverlayProps = {duration: 1, shots: [], files: {product: 'product.png', logo: 'logo.png'}, display: {brand: '', tagline: '', product: '', variant: ''}, cta: ''};

const Root = () => (
  <>
  <Composition id="Ad" component={Ad as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={30}
    defaultProps={placeholder as unknown as Record<string, unknown>}
    calculateMetadata={({props}) => ({durationInFrames: Math.max(1, Math.round((props as unknown as Timeline).duration * 30))})} />
  <Composition id="CinematicOverlay" component={CinematicOverlay as unknown as React.FC<Record<string, unknown>>} width={1080} height={1920} fps={30} durationInFrames={30}
    defaultProps={overlayPlaceholder as unknown as Record<string, unknown>}
    calculateMetadata={({props}) => ({durationInFrames: Math.max(1, Math.round((props as unknown as OverlayProps).duration * 30))})} />
  </>
);
registerRoot(Root);
