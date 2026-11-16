// Gemini'nin yazdığı ayrıntılı kurgu JSON'u (veri/*-kurgu.json) ile çalışan esnek dikey ilan şablonu.
// Müzik, açılış biçimi, yazı stilleri/fontları/konumları, plan efektleri, geçişler ve geçiş sesleri JSON'dan gelir.
import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import {iris} from '@remotion/transitions/iris';
import {fade} from '@remotion/transitions/fade';
import {clockWipe} from '@remotion/transitions/clock-wipe';
import {pushCut} from '@remotion/transitions/push-cut';
import {none} from '@remotion/transitions/none';
import {loadFont as anton} from '@remotion/google-fonts/Anton';
import {loadFont as montserrat} from '@remotion/google-fonts/Montserrat';
import {loadFont as playfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as cinzel} from '@remotion/google-fonts/Cinzel';
import {loadFont as oswald} from '@remotion/google-fonts/Oswald';
import {loadFont as raleway} from '@remotion/google-fonts/Raleway';
import {whip, zoomPunch, donZoom, isikSizinti, bulanikKayma, perde, yakinCozulme} from './hizliGecisler';

const S = {subsets: ['latin', 'latin-ext']} as never;
const FONT: Record<string, string> = {
	Anton: anton('normal', S).fontFamily, Montserrat: montserrat('normal', {...(S as object), weights: ['600', '800']} as never).fontFamily,
	PlayfairDisplay: playfair('normal', {...(S as object), weights: ['700']} as never).fontFamily, Cinzel: cinzel('normal', {...(S as object), weights: ['700']} as never).fontFamily,
	Oswald: oswald('normal', {...(S as object), weights: ['600']} as never).fontFamily, Raleway: raleway('normal', {...(S as object), weights: ['300', '700']} as never).fontFamily,
};
export const FPS = 30;
const W = 1080, H = 1920;
const k = (sn: number) => Math.round(sn * FPS);
const golge = '0 0 28px rgba(0,0,0,.55), 0 3px 10px rgba(0,0,0,.75), 0 1px 2px rgba(0,0,0,.9)';

type Gecis = {ad: string; sure_sn: number; ses?: string};
type Yazi = {metin: string; alt?: string; stil: string; konum?: string; giris_sn?: number; font?: string};
type Plan = {videolar?: string[]; hiz?: number; video2?: string; giris?: string; video: string; kesit_bas_sn?: number; sure_sn: number; efekt?: {ad: string; an_sn?: number}; yazi?: Yazi | null; sonraki_gecis?: Gecis};
export type Kurgu = {
	muzik: {dosya: string; baslangic_sn?: number}; renk_tonu?: string; font?: {baslik?: string; alt?: string}; vurgu_rengi?: string;
	acilis: {stil: string; metin: string; sure_sn: number; ses?: string; teknik?: string; klipler?: {video: string; kesit_bas_sn?: number}[]};
	planlar: Plan[];
	kapanis: {logo: string; cagri: string; telefon: string; notlar: string[]; sure_sn: number; stil?: string; logo_animasyonu?: string};
};
// Açılış teknikleri (hook): planların başına ön planlar ekler ya da ilk planı değiştirir.
// sonucla_basla: en etkileyici kare 1.2 sn başta · kalip_kirma: 3 hızlı kesme (0.3 sn) sonra asıl tur ·
// bolunmus_giris: iki klip yan yana 1.4 sn · hizli_zoom_giris: ilk plan ani zoom-out ile açılır ·
// donusum: ilk plan siyah-beyaz/bulanıktan renge döner · sessizlik_vurus: müzik 0.7 sn susar, vuruşla girer
export const hazirla = (q: Kurgu): Kurgu => {
	const t = q.acilis.teknik ?? 'yok', kl = q.acilis.klipler ?? [];
	let on: Plan[] = [];
	if (t === 'sonucla_basla' && kl[0]) on = [{...kl[0], sure_sn: 1.4, sonraki_gecis: {ad: 'zoom_vurus', sure_sn: 0.3, ses: 'whoosh'}}];
	if (t === 'kalip_kirma') on = kl.slice(0, 3).map((c) => ({...c, sure_sn: 0.35, sonraki_gecis: {ad: 'kesme', sure_sn: 0.04, ses: 'vurus'}}));
	if (t === 'bolunmus_giris' && kl[1]) on = [{...kl[0], video2: kl[1].video, sure_sn: 1.6, sonraki_gecis: {ad: 'perde', sure_sn: 0.4, ses: 'perde'}}];
	const pl = [...on, ...q.planlar];
	if (t === 'hizli_zoom_giris' || t === 'donusum') pl[0] = {...pl[0], giris: t};
	return {...q, planlar: pl};
};
export const toplam = (q0: Kurgu) => { const q = hazirla(q0); return q.planlar.reduce((t, p, i) => t + k(p.sure_sn) - (i < q.planlar.length ? k(p.sonraki_gecis?.sure_sn ?? 0.4) : 0), 0) + k(q.kapanis.sure_sn); };

const TON: Record<string, string> = {
	dogal: 'none', sicak: 'sepia(.12) saturate(1.12) brightness(1.03)', soguk: 'saturate(.9) hue-rotate(-8deg) brightness(1.03)',
	sinematik: 'contrast(1.08) saturate(.92)', parlak: 'brightness(1.07) saturate(1.08)',
};

// ---------- yazı stilleri ----------
const YaziKutu: React.FC<{y: Yazi; sure: number; vurgu: string; bf: string; af: string; buyukAlt?: boolean}> = ({y, sure, vurgu, bf, af, buyukAlt}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const font = FONT[y.font ?? ''] ?? bf;
	const boyut = y.metin.length > 14 ? 100 : y.metin.length > 8 ? 130 : 170;
	const cikis = interpolate(f, [sure - 8, sure], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const s = spring({frame: f, fps, config: {damping: 13}});
	const lin = (a: number, b: number) => interpolate(f, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
	const harf = (fn: (i: number) => React.CSSProperties) => [...y.metin].map((c, i) => <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', ...fn(i)}}>{c}</span>);
	const temel: React.CSSProperties = {fontWeight: 700, fontFamily: font, fontSize: boyut, color: '#fff', textShadow: golge, lineHeight: 1.05, textAlign: 'center'};
	let ana: React.ReactNode;
	switch (y.stil) {
		case 'carpma': {
			const z = interpolate(s, [0, 1], [2.4, 1]);
			ana = <div style={{...temel, transform: `scale(${z})`, opacity: lin(0, 3)}}>{y.metin}</div>; break;
		}
		case 'kelime':
			ana = <div style={{...temel, display: 'flex', gap: '0 24px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 960}}>{y.metin.split(' ').map((w, i) => {
				const q = spring({frame: f - i * 5, fps, config: {damping: 14}});
				return <span key={i} style={{color: i === 0 ? vurgu : '#fff', transform: `translateY(${(1 - q) * 80}px)`, opacity: q, filter: `blur(${(1 - q) * 12}px)`}}>{w}</span>;
			})}</div>; break;
		case 'daktilo': {
			const n = Math.floor(interpolate(f, [0, y.metin.length * 2], [0, y.metin.length], {extrapolateRight: 'clamp'}));
			ana = <div style={temel}>{y.metin.slice(0, n)}<span style={{opacity: f % 16 < 8 ? 1 : 0, color: vurgu}}>|</span></div>; break;
		}
		case 'maske_yukari':
			ana = <div style={{overflow: 'hidden'}}><div style={{...temel, transform: `translateY(${(1 - lin(0, 14)) * 110}%)`}}>{y.metin}</div></div>; break;
		case 'harf_yagmuru':
			ana = <div style={temel}>{harf((i) => { const q = spring({frame: f - i * 2, fps, config: {damping: 12}}); return {transform: `translateY(${(1 - q) * -140}px)`, opacity: q}; })}</div>; break;
		case 'kontur': {
			const dol = lin(8, 22);
			ana = <div style={{...temel, color: `rgba(255,255,255,${dol})`, WebkitTextStroke: `3px ${vurgu}`, letterSpacing: interpolate(lin(0, 18), [0, 1], [30, 4])}}>{y.metin}</div>; break;
		}
		case 'yan_cizgi':
			ana = <div style={{display: 'flex', alignItems: 'stretch', gap: 24}}>
				<div style={{width: 10, background: vurgu, transform: `scaleY(${lin(0, 10)})`, transformOrigin: 'top', borderRadius: 4}} />
				<div style={{...temel, textAlign: 'left', fontSize: boyut * 0.85, transform: `translateX(${(1 - lin(4, 18)) * -60}px)`, opacity: lin(4, 14)}}>{y.metin}</div>
			</div>; break;
		case 'isik':
			ana = <div style={{...temel, filter: `blur(${(1 - lin(0, 16)) * 18}px) brightness(${1 + (1 - lin(0, 16)) * 1.5})`, textShadow: `0 0 ${30 * (1 - lin(6, 24))}px ${vurgu}, ${golge}`}}>{y.metin}</div>; break;
		case 'yay': {
			const q = spring({frame: f, fps, config: {damping: 7, stiffness: 160}});
			ana = <div style={{...temel, transform: `scale(${q}) rotate(${(1 - q) * -8}deg)`}}>{y.metin}</div>; break;
		}
		default: // cizgi
			ana = <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}><div style={{overflow: 'hidden'}}><div style={{...temel, transform: `translateY(${(1 - lin(6, 20)) * 100}%)`}}>{y.metin}</div></div>
				<div style={{height: 9, width: 700 * lin(0, 14), background: vurgu, borderRadius: 5, marginTop: 12}} /></div>;
	}
	const konum = y.konum === 'ust' ? {justifyContent: 'flex-start', paddingTop: 420} : y.konum === 'alt' ? {justifyContent: 'flex-end', paddingBottom: 380} : {justifyContent: 'center'};
	return (<>
		<AbsoluteFill style={{background: `radial-gradient(ellipse 85% 22% at 50% ${y.konum === 'ust' ? 28 : y.konum === 'alt' ? 72 : 50}%, rgba(0,0,0,.32), transparent 75%)`}} />
		<AbsoluteFill style={{paddingLeft: 60, paddingRight: 60, ...konum, alignItems: 'center', opacity: cikis, transform: `translateY(${(1 - cikis) * -30}px)`}}>
			<div style={{display: 'flex', flexDirection: 'column', alignItems: y.stil === 'yan_cizgi' ? 'flex-start' : 'center', gap: 16}}>
				{ana}
				{y.alt && <div style={{textAlign: 'center', maxWidth: 900, fontFamily: af, fontWeight: 700, fontSize: buyukAlt ? 120 : 46, letterSpacing: buyukAlt ? 2 : 6, color: buyukAlt ? vurgu : '#fff', textShadow: golge, opacity: lin(10, 22)}}>{y.alt}</div>}
			</div>
		</AbsoluteFill>
	</>);
};

// ---------- ızgara (2x2 / 3x3): hücreler sırayla açılır ----------
const Izgara: React.FC<{vs: string[]; vurgu: string}> = ({vs, vurgu}) => {
	const f = useCurrentFrame();
	const n = vs.length > 4 ? 3 : 2, cw = W / n, ch = H / n;
	return (
		<AbsoluteFill style={{backgroundColor: '#fff'}}>
			{vs.slice(0, n * n).map((v, i) => {
				const a = interpolate(f, [i * 2, i * 2 + 6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.6))});
				return (
					<div key={i} style={{position: 'absolute', left: (i % n) * cw + 3, top: Math.floor(i / n) * ch + 3, width: cw - 6, height: ch - 6, overflow: 'hidden', transform: `scale(${a})`, opacity: a}}>
						<OffthreadVideo src={staticFile(v)} muted style={{width: W, height: H, objectFit: 'cover', transform: `scale(${1 / n * 1.15})`, transformOrigin: '0 0', position: 'absolute', left: -(W / n) * 0.075, top: -(H / n) * 0.075}} />
					</div>
				);
			})}
		</AbsoluteFill>
	);
};

// ---------- ilk plan giriş efekti ----------
const Giris: React.FC<{tur?: string; children: React.ReactNode}> = ({tur, children}) => {
	const f = useCurrentFrame();
	if (tur === 'hizli_zoom_giris') {
		const z = interpolate(f, [0, 12], [1.7, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
		return <AbsoluteFill style={{transform: `scale(${z})`, filter: `blur(${interpolate(f, [0, 10], [12, 0], {extrapolateRight: 'clamp'})}px)`}}>{children}</AbsoluteFill>;
	}
	if (tur === 'donusum') {
		const p = interpolate(f, [4, 24], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
		return <AbsoluteFill style={{filter: `grayscale(${1 - p}) blur(${(1 - p) * 8}px) brightness(${0.7 + 0.3 * p})`}}>{children}</AbsoluteFill>;
	}
	return <AbsoluteFill>{children}</AbsoluteFill>;
};

// ---------- plan efektleri ----------
const Efekt: React.FC<{ad: string; vurgu: string}> = ({ad, vurgu}) => {
	const f = useCurrentFrame();
	const {durationInFrames: n} = useVideoConfig();
	if (ad === 'isik_huzmesi') {
		const x = interpolate(f, [0, 40], [-60, 160], {extrapolateRight: 'clamp'});
		return <AbsoluteFill style={{background: `linear-gradient(105deg, transparent ${x - 20}%, rgba(255,230,180,.45) ${x}%, transparent ${x + 20}%)`, mixBlendMode: 'screen'}} />;
	}
	if (ad === 'mercek') {
		const o = Math.sin(Math.min(1, f / 45) * Math.PI);
		return <AbsoluteFill style={{background: `radial-gradient(circle at 80% 18%, rgba(255,210,140,${0.55 * o}), transparent 35%), radial-gradient(circle at 60% 40%, rgba(255,255,255,${0.15 * o}), transparent 12%)`, mixBlendMode: 'screen'}} />;
	}
	if (ad === 'vinyet') return <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.45) 100%)'}} />;
	if (ad === 'parilti_toz') {
		return <AbsoluteFill>{Array.from({length: 26}).map((_, i) => {
			const y = ((i * 137) % 100) - (f * (0.15 + (i % 5) * 0.05)) % 100;
			return <div key={i} style={{position: 'absolute', left: `${(i * 61) % 100}%`, top: `${(y + 100) % 100}%`, width: 6, height: 6, borderRadius: 3, background: vurgu, opacity: 0.35 + 0.3 * Math.sin(f / 8 + i), boxShadow: `0 0 12px ${vurgu}`}} />;
		})}</AbsoluteFill>;
	}
	return null;
};

// ---------- geçiş eşlemesi ----------
const G = (ad: string): unknown => ({
	whip_sol: whip('sol'), whip_sag: whip('sag'), whip_yukari: whip('yukari'), whip_asagi: whip('asagi'), zoom_vurus: zoomPunch(), don_zoom: donZoom(),
	flas_itme: pushCut({flashColor: '#fff', flashOpacity: 0.9}), isik_sizinti: isikSizinti(), bulanik_kayma_sag: bulanikKayma(1), bulanik_kayma_sol: bulanikKayma(-1),
	perde: perde(), yakin_cozulme: yakinCozulme(), kayma_sag: slide({direction: 'from-right'}), kayma_sol: slide({direction: 'from-left'}), kayma_alt: slide({direction: 'from-bottom'}),
	silme: wipe({direction: 'from-left'}), iris: iris({width: W, height: H}), saat: clockWipe({width: W, height: H}), cozulme: fade(), kesme: none(),
} as Record<string, unknown>)[ad] ?? fade();
const SES: Record<string, string> = {whoosh: 'medya/whoosh.wav', vurus: 'medya/vurus.wav', hava: 'medya/hava.wav', parilti: 'medya/parilti.wav', perde: 'medya/perde.wav'};

// ---------- logo animasyonu ----------
// parilti: bulanıktan netleşip ölçeklenerek gelir, üzerinden ışık süzülür, hafif altın hale atar
// maske: soldan sağa açılan maskeyle çizilir; yukselis: aşağıdan yükselip yaylanır; isik: karanlıktan parlayarak belirir
const LogoAnim: React.FC<{src: string; stil: string; vurgu: string}> = ({src, stil, vurgu}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const W0 = 640;
	const s = spring({frame: f - 2, fps, config: {damping: 14, stiffness: 90}});
	const lin = (a: number, b: number) => interpolate(f, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
	let st: React.CSSProperties = {};
	if (stil === 'maske') st = {clipPath: `inset(0 ${(1 - lin(2, 26)) * 100}% 0 0)`};
	else if (stil === 'yukselis') st = {transform: `translateY(${(1 - s) * 140}px)`, opacity: lin(0, 10)};
	else if (stil === 'isik') st = {opacity: lin(0, 20), filter: `brightness(${1 + (1 - lin(4, 30)) * 2.5}) blur(${(1 - lin(0, 18)) * 10}px)`};
	else st = {transform: `scale(${0.82 + 0.18 * s})`, opacity: lin(0, 12), filter: `blur(${(1 - lin(0, 16)) * 14}px)`};
	const sup = interpolate(f, [22, 46], [-60, 160], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const hale = 0.35 + 0.25 * Math.sin(Math.max(0, f - 30) / 9);
	const maske: React.CSSProperties = {WebkitMaskImage: `url(${src})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: `url(${src})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center'};
	return (
		<div style={{position: 'relative', width: W0, ...st}}>
			<div style={{position: 'absolute', inset: '-25%', background: `radial-gradient(ellipse at center, ${vurgu}55, transparent 60%)`, opacity: f > 20 ? hale : 0, filter: 'blur(20px)'}} />
			<Img src={src} style={{width: W0, display: 'block', position: 'relative'}} />
			<div style={{position: 'absolute', inset: 0, ...maske, background: `linear-gradient(110deg, transparent ${sup - 18}%, rgba(255,255,255,.95) ${sup}%, transparent ${sup + 18}%)`, mixBlendMode: 'screen'}} />
		</div>
	);
};

const Kapanis: React.FC<{q: Kurgu['kapanis']; vurgu: string; bf: string; af: string}> = ({q, vurgu, bf, af}) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	const s = spring({frame: f - 4, fps, config: {damping: 12}});
	const sira = (i: number) => interpolate(f, [10 + i * 5, 20 + i * 5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill style={{background: 'linear-gradient(160deg,#16213E 0%,#0b1020 100%)', justifyContent: 'center', alignItems: 'center'}}>
			<div style={{position: 'absolute', inset: 50, border: `2px solid ${vurgu}`, opacity: 0.55 * s, borderRadius: 12}} />
			<LogoAnim src={staticFile(q.logo)} stil={q.logo_animasyonu ?? 'yukselis'} vurgu={vurgu} />
			<div style={{fontFamily: bf, fontSize: 110, color: '#fff', marginTop: 70, opacity: sira(0)}}>{q.cagri}</div>
			<div style={{fontFamily: af, fontWeight: 800, fontSize: 64, color: vurgu, marginTop: 24, opacity: sira(1)}}>{q.telefon}</div>
			<div style={{position: 'absolute', bottom: 120, textAlign: 'center', opacity: sira(2)}}>{q.notlar.map((n, i) => <div key={i} style={{fontFamily: af, fontSize: 34, color: 'rgba(255,255,255,.8)', marginTop: 10}}>{n}</div>)}</div>
		</AbsoluteFill>
	);
};

export const IlanYaratici: React.FC<Kurgu> = (q0) => {
	const q = hazirla(q0);
	const sessiz = q.acilis.teknik === 'sessizlik_vurus' ? k(0.7) : 0;
	const vurgu = q.vurgu_rengi ?? '#F2B526';
	const bf = FONT[q.font?.baslik ?? 'Anton'] ?? FONT.Anton;
	const af = FONT[q.font?.alt ?? 'Montserrat'] ?? FONT.Montserrat;
	const {durationInFrames} = useVideoConfig();
	const gb = (i: number, p: Plan) => Math.max(p.yazi?.giris_sn ?? 0.4, i === 0 ? q.acilis.sure_sn + 0.3 : 0);
	let t = 0;
	const kesimler: {kare: number; ses?: string}[] = [];
	q.planlar.forEach((p) => { t += k(p.sure_sn) - k(p.sonraki_gecis?.sure_sn ?? 0.4); kesimler.push({kare: t, ses: p.sonraki_gecis?.ses}); });
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			<AbsoluteFill style={{filter: TON[q.renk_tonu ?? 'dogal'] ?? 'none'}}>
				<TransitionSeries>
					{q.planlar.map((p, i) => (
						<React.Fragment key={i}>
							<TransitionSeries.Sequence durationInFrames={k(p.sure_sn)}>
								<AbsoluteFill>
									<Giris tur={p.giris}>{p.videolar ? <Izgara vs={p.videolar} vurgu={vurgu} /> : p.video2 ? (<AbsoluteFill style={{flexDirection: 'row'}}>{[p.video, p.video2].map((v, j) => <div key={j} style={{width: W / 2, height: H, overflow: 'hidden', borderRight: j === 0 ? `4px solid ${vurgu}` : undefined}}><OffthreadVideo src={staticFile(v)} startFrom={k(p.kesit_bas_sn ?? 0)} muted style={{width: W, height: H, objectFit: 'cover', marginLeft: -W / 4}} /></div>)}</AbsoluteFill>) : <OffthreadVideo src={staticFile(p.video)} startFrom={k(p.kesit_bas_sn ?? 0)} playbackRate={p.hiz ?? 1} muted style={{width: W, height: H, objectFit: 'cover'}} />}</Giris>
									{p.efekt && p.efekt.ad !== 'yok' && <Sequence from={k(p.efekt.an_sn ?? 0)}><Efekt ad={p.efekt.ad} vurgu={vurgu} /></Sequence>}
									{p.yazi && (
										<Sequence from={k(gb(i, p))} durationInFrames={Math.max(15, k(p.sure_sn - gb(i, p)) - 6)}>
											<YaziKutu y={p.yazi} sure={Math.max(15, k(p.sure_sn - gb(i, p)) - 6)} vurgu={vurgu} bf={bf} af={af} />
										</Sequence>
									)}
								</AbsoluteFill>
							</TransitionSeries.Sequence>
							<TransitionSeries.Transition presentation={G(p.sonraki_gecis?.ad ?? 'cozulme') as never} timing={linearTiming({durationInFrames: k(p.sonraki_gecis?.sure_sn ?? 0.4)})} />
						</React.Fragment>
					))}
					<TransitionSeries.Sequence durationInFrames={k(q.kapanis.sure_sn)}><Kapanis q={q.kapanis} vurgu={vurgu} bf={bf} af={af} /></TransitionSeries.Sequence>
				</TransitionSeries>
			</AbsoluteFill>
			{/* açılış yazısı tüm ön kesmeler boyunca ekranda kalsın */}
			<Sequence durationInFrames={k(q.acilis.sure_sn)}>
				<YaziKutu y={{metin: q.acilis.metin.split('|')[0], alt: q.acilis.metin.split('|')[1], stil: q.acilis.stil, konum: 'orta'}} sure={k(q.acilis.sure_sn)} vurgu={vurgu} bf={bf} af={bf} buyukAlt />
			</Sequence>
			<Sequence from={sessiz}><Audio src={staticFile(q.muzik.dosya)} startFrom={k(q.muzik.baslangic_sn ?? 0)} volume={(f) => 0.6 * interpolate(f, [0, sessiz ? 1 : 10, durationInFrames - sessiz - 30, durationInFrames - sessiz], [0, 1, 1, 0], {extrapolateRight: 'clamp'})} /></Sequence>
			{sessiz > 0 && <Sequence from={sessiz - 2} durationInFrames={30}><Audio src={staticFile('medya/vurus.wav')} volume={0.9} /></Sequence>}
			{q.acilis.ses && SES[q.acilis.ses] && <Sequence from={2} durationInFrames={30}><Audio src={staticFile(SES[q.acilis.ses])} volume={0.6} /></Sequence>}
			{kesimler.map((c, i) => c.ses && SES[c.ses] ? <Sequence key={i} from={Math.max(0, c.kare - 6)} durationInFrames={36}><Audio src={staticFile(SES[c.ses])} volume={0.45} /></Sequence> : null)}
		</AbsoluteFill>
	);
};
