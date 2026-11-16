// İNZA dikey ilan şablonu: veri dosyası (veri/*.json) ile doldurulur.
import React from 'react';
import {
	AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile,
	useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';
import {TransitionSeries, linearTiming, springTiming} from '@remotion/transitions';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import {iris} from '@remotion/transitions/iris';
import {pushCut} from '@remotion/transitions/push-cut';
import {clockWipe} from '@remotion/transitions/clock-wipe';
import {fade} from '@remotion/transitions/fade';
import {z} from 'zod';
import {whip, zoomPunch, donZoom, isikSizinti, bulanikKayma, perde, yakinCozulme} from './hizliGecisler';
import {loadFont as anton} from '@remotion/google-fonts/Anton';
import {loadFont as montserrat} from '@remotion/google-fonts/Montserrat';

const {fontFamily: BASLIK} = anton('normal', {subsets: ['latin', 'latin-ext']});
const {fontFamily: METIN} = montserrat('normal', {weights: ['600', '800'], subsets: ['latin', 'latin-ext']});

export const FPS = 30;
const W = 1080;
const H = 1920;
const gecisK = (p: {gecisSure?: number}) => Math.round((p.gecisSure ?? 0.33) * 30); // geçiş süresi (kare)
const ALTIN = '#F2B526';

const yaziTuru = z.enum(['carpma', 'kelime', 'cizgi', 'yay']);
export const ilanSemasi = z.object({
	planlar: z.array(z.object({
		video: z.string(), sure: z.number(), bas: z.number().optional(),
		baslik: z.string().optional(), altBaslik: z.string().optional(), yazi: yaziTuru.optional(), hiz: z.number().optional(),
	})),
	kanca: z.object({metin: z.string(), sure: z.number()}).optional(),
	seslendirme: z.string().optional(), seslendirmeBas: z.number().optional(), seslendirmeSure: z.number().optional(),
	sesler: z.array(z.object({dosya: z.string(), bas: z.number(), sure: z.number()})).optional(),
	muzik: z.string().optional(), muzikBas: z.number().optional(),
	kapanis: z.object({logo: z.string(), cagri: z.string(), telefon: z.string(), notlar: z.array(z.string()), sure: z.number()}),
	sesEfekti: z.boolean().optional(), gecisSeti: z.string().optional(), gecisSure: z.number().optional(),
});
type Ilan = z.infer<typeof ilanSemasi>;

const kare = (sn: number) => Math.round(sn * FPS);
export const toplamKare = (p: Ilan) =>
	p.planlar.reduce((t, x) => t + kare(x.sure), 0) + kare(p.kapanis.sure) - p.planlar.length * gecisK(p);

const golge = '0 4px 18px rgba(0,0,0,.55), 0 2px 4px rgba(0,0,0,.6)';

// ---------- yazı animasyonları ----------
const Carpma: React.FC<{metin: string; boyut: number}> = ({metin, boyut}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = spring({frame: f, fps, config: {damping: 11, stiffness: 180, mass: 0.7}});
	const olcek = interpolate(s, [0, 1], [2.6, 1]);
	const sarsinti = f > 4 && f < 10 ? Math.sin(f * 3.1) * (10 - f) * 2.2 : 0;
	const opak = interpolate(f, [0, 3], [0, 1], {extrapolateRight: 'clamp'});
	return (
		<div style={{fontFamily: BASLIK, fontSize: boyut, color: '#fff', lineHeight: 1, textAlign: 'center',
			transform: `scale(${olcek}) translate(${sarsinti}px, ${-sarsinti / 2}px)`, opacity: opak, textShadow: golge,
			letterSpacing: 2}}>
			{metin.split('|').map((satir, i) => (
				<div key={i} style={{color: i === 1 ? ALTIN : '#fff'}}>{satir}</div>
			))}
		</div>
	);
};

const Kelime: React.FC<{metin: string; boyut: number}> = ({metin, boyut}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	return (
		<div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 26px', maxWidth: 960}}>
			{metin.split(' ').map((k, i) => {
				const s = spring({frame: f - i * 5, fps, config: {damping: 14}});
				return (
					<span key={i} style={{fontFamily: BASLIK, fontSize: boyut, color: i === 0 ? ALTIN : '#fff', textShadow: golge,
						display: 'inline-block', transform: `translateY(${interpolate(s, [0, 1], [90, 0])}px)`,
						opacity: s, filter: `blur(${interpolate(s, [0, 1], [14, 0])}px)`}}>{k}</span>
				);
			})}
		</div>
	);
};

const Cizgi: React.FC<{metin: string; boyut: number}> = ({metin, boyut}) => {
	const f = useCurrentFrame();
	const cizgi = interpolate(f, [0, 14], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
	const acilis = interpolate(f, [6, 20], [100, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
	return (
		<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
			<div style={{overflow: 'hidden', padding: '0 10px'}}>
				<div style={{fontFamily: BASLIK, fontSize: boyut, color: '#fff', textShadow: golge, transform: `translateY(${acilis}%)`, lineHeight: 1.05}}>{metin}</div>
			</div>
			<div style={{height: 10, width: 720 * cizgi, background: ALTIN, borderRadius: 5, marginTop: 14, boxShadow: '0 0 18px rgba(242,181,38,.7)'}} />
		</div>
	);
};

const Yay: React.FC<{metin: string; boyut: number}> = ({metin, boyut}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = spring({frame: f, fps, config: {damping: 7, stiffness: 160}});
	return (
		<div style={{transform: `scale(${s}) rotate(${interpolate(s, [0, 1], [-8, 0])}deg)`, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
			<div style={{fontFamily: BASLIK, fontSize: boyut, color: '#fff', textShadow: golge, lineHeight: 1}}>{metin}</div>
			<div style={{height: 6, width: 140, background: ALTIN, marginTop: 16, borderRadius: 3}} />
		</div>
	);
};

const YAZI = {carpma: Carpma, kelime: Kelime, cizgi: Cizgi, yay: Yay};

const Cikis: React.FC<{sure: number; children: React.ReactNode}> = ({sure, children}) => {
	const f = useCurrentFrame();
	const o = interpolate(f, [sure - 8, sure], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const y = interpolate(f, [sure - 8, sure], [0, -40], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return <div style={{opacity: o, transform: `translateY(${y}px)`}}>{children}</div>;
};

// ---------- plan ----------
const Plan: React.FC<{p: Ilan['planlar'][number]; kanca?: Ilan['kanca']; ilk: boolean}> = ({p, kanca, ilk}) => {
	const f = useCurrentFrame();
	const n = kare(p.sure);
	const yakin = interpolate(f, [0, n], [1.0, 1.1], {easing: Easing.in(Easing.quad)}); // sona doğru hızlanan itme (geçişe ivme verir)
	const kancaN = ilk && kanca ? kare(kanca.sure) : 0;
	const Yazi = YAZI[p.yazi ?? 'cizgi'];
	const yaziBas = kancaN ? kancaN + 2 : 6;
	const yaziSure = n - yaziBas - 4;
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			<AbsoluteFill style={{transform: `scale(${yakin})`}}>
				<OffthreadVideo src={staticFile(p.video)} startFrom={kare(p.bas ?? 0)} muted playbackRate={p.hiz ?? 1}
					style={{width: W, height: H, objectFit: 'cover'}} />
			</AbsoluteFill>
			{/* okunurluk için alttan yumuşak gölge — bant değil */}
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 90% 30% at 50% 62%, rgba(0,0,0,.28), transparent 70%)'}} />
			{kancaN > 0 && (
				<Sequence durationInFrames={kancaN}>
					<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
						<Cikis sure={kancaN}><Carpma metin={kanca!.metin} boyut={190} /></Cikis>
					</AbsoluteFill>
				</Sequence>
			)}
			{p.baslik && yaziSure > 12 && (
				<Sequence from={yaziBas} durationInFrames={yaziSure}>
					<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', top: 260}}>
						<Cikis sure={yaziSure}>
							<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
								<Yazi metin={p.baslik} boyut={p.baslik.length > 14 ? 104 : 150} />
								{p.altBaslik && (
									<div style={{fontFamily: METIN, fontWeight: 800, fontSize: 46, color: '#fff', letterSpacing: 6,
										textShadow: golge, opacity: interpolate(f - yaziBas, [10, 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
										{p.altBaslik}
									</div>
								)}
							</div>
						</Cikis>
					</AbsoluteFill>
				</Sequence>
			)}
		</AbsoluteFill>
	);
};

// ---------- kapanış ----------
const Kapanis: React.FC<{k: Ilan['kapanis']}> = ({k}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = spring({frame: f - 4, fps, config: {damping: 12}});
	const sira = (i: number) => interpolate(f, [10 + i * 5, 20 + i * 5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill style={{background: 'linear-gradient(160deg,#16213E 0%,#0b1020 100%)', justifyContent: 'center', alignItems: 'center', padding: 80}}>
			<div style={{position: 'absolute', inset: 50, border: `2px solid ${ALTIN}`, opacity: 0.55 * s, borderRadius: 12}} />
			<Img src={staticFile(k.logo)} style={{width: 640, transform: `scale(${s})`}} />
			<div style={{fontFamily: BASLIK, fontSize: 120, color: '#fff', marginTop: 70, opacity: sira(0), transform: `translateY(${(1 - sira(0)) * 40}px)`}}>{k.cagri}</div>
			<div style={{fontFamily: METIN, fontWeight: 800, fontSize: 64, color: ALTIN, marginTop: 24, opacity: sira(1)}}>{k.telefon}</div>
			<div style={{position: 'absolute', bottom: 120, textAlign: 'center', opacity: sira(2)}}>
				{k.notlar.map((n, i) => (
					<div key={i} style={{fontFamily: METIN, fontWeight: 600, fontSize: 36, color: 'rgba(255,255,255,.8)', marginTop: 10}}>{n}</div>
				))}
			</div>
		</AbsoluteFill>
	);
};

// ---------- geçişler (sırayla dönen, iki aynısı arka arkaya gelmez) ----------
const SETLER: Record<string, Array<() => unknown>> = {
	hizli: [() => whip('sol'), () => zoomPunch(), () => whip('yukari'), () => donZoom(), () => whip('sag'), () => pushCut({flashColor: '#fff', flashOpacity: 0.9}), () => whip('asagi')],
	yumusak: [() => isikSizinti(), () => bulanikKayma(1), () => perde(), () => yakinCozulme(), () => bulanikKayma(-1), () => isikSizinti(), () => perde()],
};
const SESLER: Record<string, string[]> = {hizli: ['medya/whoosh.wav'], yumusak: ['medya/hava.wav', 'medya/parilti.wav', 'medya/hava.wav', 'medya/perde.wav']};

export const IlanDikey: React.FC<Ilan> = (p) => {
	const {durationInFrames} = useVideoConfig();
	const kesimler: number[] = [];
	let t = 0;
	p.planlar.forEach((x) => {
		t += kare(x.sure) - gecisK(p);
		kesimler.push(t);
	});
	const sesN = kare(p.seslendirmeBas ?? 0.8);
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			<TransitionSeries>
				{p.planlar.map((x, i) => (
					<React.Fragment key={i}>
						<TransitionSeries.Sequence durationInFrames={kare(x.sure)}>
							<Plan p={x} kanca={p.kanca} ilk={i === 0} />
						</TransitionSeries.Sequence>
						<TransitionSeries.Transition
							presentation={i === p.planlar.length - 1 ? fade() : (SETLER[p.gecisSeti ?? 'hizli'][i % SETLER[p.gecisSeti ?? 'hizli'].length]() as never)}
							timing={linearTiming({durationInFrames: gecisK(p)})}
						/>
					</React.Fragment>
				))}
				<TransitionSeries.Sequence durationInFrames={kare(p.kapanis.sure)}>
					<Kapanis k={p.kapanis} />
				</TransitionSeries.Sequence>
			</TransitionSeries>
			{(p.sesler ?? []).map((c, i) => (
				<Sequence key={'c' + i} from={kare(c.bas)}><Audio src={staticFile(c.dosya)} volume={1} /></Sequence>
			))}
			{p.seslendirme && <Sequence from={sesN}><Audio src={staticFile(p.seslendirme)} volume={1} /></Sequence>}
			{p.muzik && (
				<Audio src={staticFile(p.muzik)} startFrom={kare(p.muzikBas ?? 0)}
					volume={(f) => {
						const konusma = (p.seslendirme && f > sesN - 6 && f < sesN + kare(p.seslendirmeSure ?? 17)) || (p.sesler ?? []).some((c) => f > kare(c.bas) - 8 && f < kare(c.bas + c.sure) + 8);
						const kis = konusma ? 0.2 : 0.55;
						return kis * interpolate(f, [0, 10, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], {extrapolateRight: 'clamp'});
					}} />
			)}
			{p.sesEfekti !== false && kesimler.map((k, i) => (
				<Sequence key={i} from={Math.max(0, k - 4)} durationInFrames={20}>
					<Audio src={staticFile(i === 0 && (p.gecisSeti ?? 'hizli') === 'hizli' ? 'medya/vurus.wav' : SESLER[p.gecisSeti ?? 'hizli'][i % SESLER[p.gecisSeti ?? 'hizli'].length])} volume={0.5} />
				</Sequence>
			))}
			{p.sesEfekti !== false && p.kanca && <Sequence from={2} durationInFrames={20}><Audio src={staticFile('medya/vurus.wav')} volume={0.7} /></Sequence>}
		</AbsoluteFill>
	);
};
