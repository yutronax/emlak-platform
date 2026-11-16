import React from 'react';
import {Composition} from 'remotion';
import {IlanDikey, ilanSemasi, toplamKare, FPS} from './IlanDikey';
import ornek from '../veri/gercek-ilan-1.json';
import {IlanYaratici, toplam} from './IlanYaratici';

export const Kok: React.FC = () => (<>
	<Composition id="IlanYaratici" component={IlanYaratici as never} width={1080} height={1920} fps={30} durationInFrames={300}
		defaultProps={{} as never} calculateMetadata={({props}: {props: never}) => ({durationInFrames: toplam(props)})} />
	<Composition
		id="IlanDikey"
		component={IlanDikey}
		schema={ilanSemasi}
		width={1080}
		height={1920}
		fps={FPS}
		durationInFrames={toplamKare(ornek as never)}
		defaultProps={ornek as never}
		calculateMetadata={({props}: {props: never}) => ({durationInFrames: toplamKare(props)})}
	/>
</>);
