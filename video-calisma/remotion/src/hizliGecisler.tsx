// Tanıtım temposu için hızlı geçişler: hareket bulanıklıklı whip, zoom-punch, hızlı dönme-zoom.
// Hepsi easeInOut ivmeli (yavaş başla → çok hızlı orta → yavaş otur) = hız rampası hissi.
import React from 'react';
import {AbsoluteFill, interpolate, Easing} from 'remotion';
import type {TransitionPresentation, TransitionPresentationComponentProps} from '@remotion/transitions';

type Yon = 'sol' | 'sag' | 'yukari' | 'asagi';
type WhipProps = {yon: Yon};

const ivme = Easing.bezier(0.7, 0, 0.3, 1);

const Whip: React.FC<TransitionPresentationComponentProps<WhipProps>> = ({children, presentationDirection, presentationProgress, passedProps}) => {
	const p = ivme(presentationProgress);
	const yatay = passedProps.yon === 'sol' || passedProps.yon === 'sag';
	const isaret = passedProps.yon === 'sol' || passedProps.yon === 'yukari' ? -1 : 1;
	const giren = presentationDirection === 'entering';
	// giren karşıdan gelir, çıkan aynı yöne kaçar
	const kayma = giren ? (1 - p) * -isaret * 100 : p * isaret * 100;
	const hiz = Math.sin(presentationProgress * Math.PI); // ortada en hızlı
	const bulanik = hiz * 38;
	return (
		<AbsoluteFill style={{
			transform: yatay ? `translateX(${kayma}%) scale(${1 + hiz * 0.08})` : `translateY(${kayma}%) scale(${1 + hiz * 0.08})`,
			filter: `blur(${bulanik}px) brightness(${1 + hiz * 0.25})`,
		}}>
			{children}
		</AbsoluteFill>
	);
};

const ZoomPunch: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({children, presentationDirection, presentationProgress}) => {
	const p = ivme(presentationProgress);
	const hiz = Math.sin(presentationProgress * Math.PI);
	const giren = presentationDirection === 'entering';
	const olcek = giren ? interpolate(p, [0, 1], [0.55, 1]) : interpolate(p, [0, 1], [1, 2.4]);
	const opak = giren ? interpolate(presentationProgress, [0.35, 0.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
	return (
		<AbsoluteFill style={{transform: `scale(${olcek})`, opacity: opak, filter: `blur(${hiz * 22}px) brightness(${1 + hiz * 0.6})`}}>
			{children}
		</AbsoluteFill>
	);
};

const DonZoom: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({children, presentationDirection, presentationProgress}) => {
	const p = ivme(presentationProgress);
	const hiz = Math.sin(presentationProgress * Math.PI);
	const giren = presentationDirection === 'entering';
	const aci = giren ? (1 - p) * -25 : p * 25;
	const olcek = giren ? interpolate(p, [0, 1], [1.8, 1]) : interpolate(p, [0, 1], [1, 1.8]);
	const opak = giren ? interpolate(presentationProgress, [0.4, 0.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
	return (
		<AbsoluteFill style={{transform: `rotate(${aci}deg) scale(${olcek})`, opacity: opak, filter: `blur(${hiz * 28}px)`}}>
			{children}
		</AbsoluteFill>
	);
};

export const whip = (yon: Yon): TransitionPresentation<WhipProps> => ({component: Whip, props: {yon}});
export const zoomPunch = (): TransitionPresentation<Record<string, never>> => ({component: ZoomPunch, props: {}});
export const donZoom = (): TransitionPresentation<Record<string, never>> => ({component: DonZoom, props: {}});

// --- yumuşak/uyumlu set: ışık sızıntısı, bulanık kayma, perde açılımı, yakınlaşarak çözülme ---
const IsikSizinti: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({children, presentationDirection, presentationProgress}) => {
	const p = ivme(presentationProgress);
	const giren = presentationDirection === 'entering';
	const hiz = Math.sin(presentationProgress * Math.PI);
	return (
		<AbsoluteFill style={{opacity: giren ? p : 1}}>
			<AbsoluteFill style={{filter: `brightness(${1 + hiz * 0.9}) saturate(${1 + hiz * 0.3})`}}>{children}</AbsoluteFill>
			<AbsoluteFill style={{background: `radial-gradient(ellipse 80% 60% at ${20 + p * 60}% 35%, rgba(255,190,110,${hiz * 0.75}), transparent 70%)`, mixBlendMode: 'screen'}} />
		</AbsoluteFill>
	);
};
const BulanikKayma: React.FC<TransitionPresentationComponentProps<{yon: number}>> = ({children, presentationDirection, presentationProgress, passedProps}) => {
	const p = ivme(presentationProgress);
	const giren = presentationDirection === 'entering';
	const x = (giren ? (1 - p) * 30 : -p * 30) * passedProps.yon;
	const hiz = Math.sin(presentationProgress * Math.PI);
	return <AbsoluteFill style={{transform: `translateX(${x}%)`, opacity: giren ? Math.min(1, p * 1.6) : 1 - p * 0.6, filter: `blur(${hiz * 16}px)`}}>{children}</AbsoluteFill>;
};
const Perde: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({children, presentationDirection, presentationProgress}) => {
	const p = ivme(presentationProgress);
	if (presentationDirection !== 'entering') return <AbsoluteFill style={{transform: `scale(${1 + p * 0.08})`}}>{children}</AbsoluteFill>;
	const a = (1 - p) * 50;
	return <AbsoluteFill style={{clipPath: `inset(0 ${a}% 0 ${a}%)`}}>{children}</AbsoluteFill>;
};
const YakinCozulme: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({children, presentationDirection, presentationProgress}) => {
	const p = ivme(presentationProgress);
	const giren = presentationDirection === 'entering';
	return <AbsoluteFill style={{opacity: giren ? p : 1, transform: `scale(${giren ? 1.12 - p * 0.12 : 1 + p * 0.1})`}}>{children}</AbsoluteFill>;
};
export const isikSizinti = (): TransitionPresentation<Record<string, never>> => ({component: IsikSizinti, props: {}});
export const bulanikKayma = (yon = 1): TransitionPresentation<{yon: number}> => ({component: BulanikKayma, props: {yon}});
export const perde = (): TransitionPresentation<Record<string, never>> => ({component: Perde, props: {}});
export const yakinCozulme = (): TransitionPresentation<Record<string, never>> => ({component: YakinCozulme, props: {}});
