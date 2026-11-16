from pathlib import Path
import subprocess,json,sys
import numpy as np
video=Path(sys.argv[1]);out=video.with_suffix('.olcum.json')
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]))
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(video),'-vf','fps=4,scale=270:480','-pix_fmt','gray','-f','rawvideo','-'])
frames=np.frombuffer(raw,dtype=np.uint8).reshape(-1,480,270).astype(float)
diff=np.mean(np.abs(frames[1:]-frames[:-1]),axis=(1,2))
result={'file':str(video),'duration':float(probe['format']['duration']),'streams':[{'type':x['codec_type'],'codec':x['codec_name'],'width':x.get('width'),'height':x.get('height'),'fps':x.get('r_frame_rate')} for x in probe['streams']], 'motion_sampling_fps':4,'quarter_second_mad':diff.round(4).tolist(),'min_quarter_second_mad':float(diff.min()),'max_quarter_second_mad':float(diff.max()),'identical_quarter_second_pairs':int((diff<0.01).sum()),'note':'Piksel değişimi durağanlığı sınar; hareketin anlamını veya estetik kalitesini kanıtlamaz.'}
out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k!='quarter_second_mad'},ensure_ascii=False))
