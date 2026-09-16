import { useState, useEffect, useRef, useCallback } from "react";

// ─── GOOGLE FONTS ─────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap";
document.head.appendChild(fontLink);

// Ensure proper iOS viewport
const vp = document.querySelector('meta[name="viewport"]');
if(vp) { vp.content = "width=device-width, initial-scale=1, viewport-fit=cover"; }
else {
  const m = document.createElement("meta");
  m.name = "viewport"; m.content = "width=device-width, initial-scale=1, viewport-fit=cover";
  document.head.appendChild(m);
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PROTOCOLS = [
  { id:"max-hang",  name:"Max Hang",      subtitle:"Pure strength",      description:"Heavy load, long rest. Best for raw finger strength gains.",   color:"#FF4D00", sets:5, hangSeconds:10, restBetweenHangs:3,  restBetweenSets:180, reps:1 },
  { id:"repeaters", name:"Repeaters",     subtitle:"7-3 Endurance",      description:"7s on / 3s off repeated. Classic strength-endurance builder.", color:"#00D4FF", sets:6, hangSeconds:7,  restBetweenHangs:3,  restBetweenSets:180, reps:6 },
  { id:"density",   name:"Density Hang",  subtitle:"Volume & endurance", description:"Continuous hanging for time. Builds lactic tolerance.",         color:"#A8FF3E", sets:4, hangSeconds:30, restBetweenHangs:0,  restBetweenSets:120, reps:1 },
  { id:"horst",     name:"7-53 Protocol", subtitle:"Eric Hörst method",  description:"7s hang, 53s rest per set. Maximizes strength adaptation.",     color:"#FFD600", sets:5, hangSeconds:7,  restBetweenHangs:53, restBetweenSets:180, reps:3 },
  { id:"custom",    name:"Custom",        subtitle:"Your protocol",      description:"Build your own. Full control over every parameter.",            color:"#FF2D78", sets:4, hangSeconds:7,  restBetweenHangs:7,  restBetweenSets:120, reps:7 },
];
const GRIPS = ["Half Crimp","Full Crimp","Open Hand","3-Finger Drag","2-Finger Pocket","Pinch","Sloper","Monodoigt"];
const EDGE_SIZES = ["8mm","10mm","12mm","14mm","18mm","20mm","25mm","30mm+"];
const GOAL_TYPES = [
  { id:"redpoint",    icon:"🎯", label:"Redpoint" },
  { id:"trip",        icon:"🏔",  label:"Climbing Trip" },
  { id:"competition", icon:"🏆", label:"Competition" },
  { id:"bouldering",  icon:"🪨", label:"Boulder Project" },
  { id:"endurance",   icon:"♾️",  label:"Route Endurance" },
  { id:"general",     icon:"📈", label:"General Strength" },
];
const DAYS_OF_WEEK = ["M","T","W","T","F","S","S"];
const DAY_FULL = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ─── AUDIO ────────────────────────────────────────────────────────────────────
function createAudioContext(){try{return new(window.AudioContext||window.webkitAudioContext)();}catch{return null;}}
function pt(ac,{freq=880,type="sine",gain=0.4,dur=0.12,atk=0.005,dec=0.05,sus=0.6,rel=0.05,delay=0,det=0}={}){
  if(!ac)return;const t=ac.currentTime+delay;
  const osc=ac.createOscillator(),env=ac.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.detune.setValueAtTime(det,t);
  env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(gain,t+atk);
  env.gain.linearRampToValueAtTime(gain*sus,t+atk+dec);env.gain.setValueAtTime(gain*sus,t+dur-rel);
  env.gain.linearRampToValueAtTime(0,t+dur);
  osc.connect(env);env.connect(ac.destination);osc.start(t);osc.stop(t+dur+0.02);
}
function pitchSweep(ac,{startFreq,endFreq,type="sawtooth",gain=0.45,dur=0.3,delay=0}){
  if(!ac)return;const t=ac.currentTime+delay;
  const osc=ac.createOscillator(),env=ac.createGain();
  osc.type=type;osc.frequency.setValueAtTime(startFreq,t);osc.frequency.exponentialRampToValueAtTime(endFreq,t+dur);
  env.gain.setValueAtTime(gain,t);env.gain.exponentialRampToValueAtTime(0.001,t+dur+0.02);
  osc.connect(env);env.connect(ac.destination);osc.start(t);osc.stop(t+dur+0.05);
}
// ─── VOICE CUES ───────────────────────────────────────────────────────────────
// Uses the device's speech synthesis. "Her" = best female English voice on the
// device. "Austrian" = a German/Austrian voice speaking English — thick accent.
let __voices=[];
function refreshVoices(){try{__voices=window.speechSynthesis?.getVoices()||[];}catch{__voices=[];}}
refreshVoices();
try{window.speechSynthesis?.addEventListener("voiceschanged",refreshVoices);}catch{/* no TTS */}
function pickVoice(kind){
  const vs=__voices.length?__voices:(window.speechSynthesis?.getVoices()||[]);
  if(!vs.length)return null;
  if(kind==="female"){
    const prefs=["Samantha","Karen","Ava","Allison","Susan","Zoe","Moira","Tessa","Martha","Serena","Victoria","Zira","Jenny","Google US English"];
    return vs.find(v=>v.lang?.startsWith("en")&&prefs.some(n=>v.name.includes(n)))
      ||vs.find(v=>v.lang?.startsWith("en")&&/female|woman/i.test(v.name))
      ||vs.find(v=>v.lang?.startsWith("en"))||vs[0];
  }
  // Deep male: English voices only (no German — it reads numbers as German words),
  // pitched down for a deep, masculine delivery
  const malePrefs=["Daniel","Alex","Aaron","Fred","Oliver","Reed","Rocko","Google UK English Male","Guy","David"];
  return vs.find(v=>v.lang?.startsWith("en")&&malePrefs.some(n=>v.name.includes(n)))
    ||vs.find(v=>v.lang?.startsWith("en")&&/male|man/i.test(v.name))
    ||vs.find(v=>v.lang?.startsWith("en"))||vs[0];
}
function speak(text,kind){
  try{
    const ss=window.speechSynthesis;if(!ss)return;
    const u=new SpeechSynthesisUtterance(text);
    const v=pickVoice(kind);if(v)u.voice=v;
    u.lang="en-US";
    if(kind==="austrian"){u.rate=0.85;u.pitch=0.5;} // deep + slow = masculine
    else{u.rate=1.05;u.pitch=1.0;}
    u.volume=1;ss.speak(u);
  }catch{/* speech unavailable — non-fatal */}
}
const NUM_WORDS={1:"one",2:"two",3:"three",4:"four",5:"five"};
function spokenDuration(secs){
  if(secs>=60){
    const m=Math.floor(secs/60),s=secs%60;
    return s===0?`${m} minute${m>1?"s":""}`:`${m} minute${m>1?"s":""} ${s} seconds`;
  }
  return `${secs} seconds`;
}
const COUNTDOWN_SOUNDS=[
  {id:"crisp-tick",name:"Crisp Tick",desc:"Sharp hi-pitched metronome click",color:"#00D4FF",play(ac){pt(ac,{freq:1320,type:"square",gain:0.25,dur:0.08,atk:0.002,dec:0.02,sus:0.1,rel:0.02});}},
  {id:"cave-pulse",name:"Cave Pulse",desc:"Low resonant bass thud",color:"#A8FF3E",play(ac){pt(ac,{freq:180,type:"sine",gain:0.6,dur:0.18,atk:0.01,dec:0.06,sus:0.3,rel:0.08});pt(ac,{freq:360,type:"sine",gain:0.2,dur:0.15});}},
  {id:"gym-blip",name:"Gym Blip",desc:"Short punchy buzzer blip",color:"#FFD600",play(ac){pt(ac,{freq:440,type:"sawtooth",gain:0.3,dur:0.07,atk:0.001,dec:0.01,sus:0.8,rel:0.01});}},
  {id:"soft-chime",name:"Soft Chime",desc:"Gentle triangle-wave bell",color:"#FF9ECD",play(ac){pt(ac,{freq:1047,type:"triangle",gain:0.35,dur:0.22,atk:0.003,dec:0.08,sus:0.4,rel:0.12});}},
  {id:"wood-knock",name:"Wood Knock",desc:"Percussive wooden knock",color:"#D4845A",play(ac){pt(ac,{freq:200,type:"triangle",gain:0.5,dur:0.05,atk:0.001,dec:0.01,sus:0.2,rel:0.02});pt(ac,{freq:100,type:"sine",gain:0.4,dur:0.07});}},
  {id:"voice-her",name:"Coach (Her)",desc:"A woman's voice counts three-two-one",color:"#FF9ECD",play(ac,o){speak(NUM_WORDS[o?.n]??"three","female");}},
  {id:"voice-austrian",name:"Coach (Him)",desc:"Deep male voice counts three-two-one",color:"#FF8C42",play(ac,o){speak(NUM_WORDS[o?.n]??"three","austrian");}},
];
const HANG_START_SOUNDS=[
  {id:"crisp-go",name:"Crisp Go",desc:"Two ascending sine tones",color:"#00D4FF",play(ac){pt(ac,{freq:880,type:"sine",gain:0.5,dur:0.1,atk:0.005,dec:0.03,sus:0.5,rel:0.03});pt(ac,{freq:1320,type:"sine",gain:0.5,dur:0.15,delay:0.12});}},
  {id:"cave-boom",name:"Cave Boom",desc:"Deep layered tribal bass hit",color:"#A8FF3E",play(ac){[55,110,220].forEach((f,i)=>pt(ac,{freq:f,type:"sine",gain:0.5-i*0.12,dur:0.6,atk:0.01,dec:0.15,sus:0.4,rel:0.3}));}},
  {id:"gym-buzz",name:"Gym Buzz",desc:"Aggressive start buzzer",color:"#FFD600",play(ac){pt(ac,{freq:330,type:"sawtooth",gain:0.45,dur:0.35,atk:0.002,dec:0.05,sus:0.85,rel:0.08});}},
  {id:"laser-fire",name:"Laser Fire",desc:"Sci-fi descending frequency sweep",color:"#FF2D78",play(ac){pitchSweep(ac,{startFreq:1200,endFreq:200,type:"sawtooth",gain:0.5,dur:0.25});}},
  {id:"power-chord",name:"Power Chord",desc:"Punchy synth power chord stab",color:"#FF8C42",play(ac){[110,165,220,330].forEach((f,i)=>pt(ac,{freq:f,type:"square",gain:0.22,dur:0.28,delay:i*0.02}));}},
  {id:"long-beep",name:"Long Beep",desc:"Sustained 1.8-second tone",color:"#A8FF3E",play(ac){pt(ac,{freq:880,type:"sine",gain:0.5,dur:1.8,atk:0.01,dec:0.1,sus:0.85,rel:0.2});}},
  {id:"voice-her",name:"Coach (Her)",desc:"She says “Hang!”",color:"#FF9ECD",play(){speak("Hang!","female");}},
  {id:"voice-austrian",name:"Coach (Him)",desc:"“Hang!” — deep male voice",color:"#FF8C42",play(){speak("Hang!","austrian");}},
];
const HANG_END_SOUNDS=[
  {id:"crisp-stop",name:"Crisp Stop",desc:"Two descending sine tones",color:"#00D4FF",play(ac){pt(ac,{freq:1100,type:"sine",gain:0.45,dur:0.1});pt(ac,{freq:660,type:"sine",gain:0.45,dur:0.15,delay:0.12});}},
  {id:"cave-fade",name:"Cave Fade",desc:"Reverberant deep bass fade",color:"#A8FF3E",play(ac){[110,165].forEach((f,i)=>pt(ac,{freq:f,type:"sine",gain:0.45,dur:0.8,atk:0.01,dec:0.2,sus:0.2,rel:0.5,delay:i*0.1}));}},
  {id:"gym-double",name:"Gym Double",desc:"Double buzzer stop signal",color:"#FFD600",play(ac){pt(ac,{freq:220,type:"sawtooth",gain:0.4,dur:0.12});pt(ac,{freq:220,type:"sawtooth",gain:0.4,dur:0.12,delay:0.18});}},
  {id:"drop-off",name:"Drop Off",desc:"Wobbly pitch drop — let go!",color:"#FF2D78",play(ac){pitchSweep(ac,{startFreq:600,endFreq:80,type:"triangle",gain:0.45,dur:0.35});}},
  {id:"thud",name:"Thud",desc:"Heavy low percussion hit",color:"#D4845A",play(ac){pt(ac,{freq:80,type:"sine",gain:0.7,dur:0.18});}},
  {id:"voice-her",name:"Coach (Her)",desc:"She says “Rest”",color:"#FF9ECD",play(){speak("Rest","female");}},
  {id:"voice-austrian",name:"Coach (Him)",desc:"“Rest” — deep male voice",color:"#FF8C42",play(){speak("Rest","austrian");}},
];
const COMPLETE_SOUNDS=[
  {id:"crisp-fanfare",name:"Crisp Fanfare",desc:"Bright ascending victory arpeggio",color:"#00D4FF",play(ac){[523.25,659.25,783.99,1046.5].forEach((f,i)=>pt(ac,{freq:f,type:"sine",gain:0.45,dur:0.18,delay:i*0.15}));}},
  {id:"triumph-brass",name:"Triumph Brass",desc:"Bold stadium brass fanfare burst",color:"#FFD600",play(ac){[220,277.18,329.63,415.30,440].forEach((f,i)=>pt(ac,{freq:f,type:"sawtooth",gain:0.3,dur:0.22,delay:i*0.12}));}},
  {id:"summit-bells",name:"Summit Bells",desc:"Cascading mountain chime bells",color:"#FF9ECD",play(ac){[1046.5,1318.5,1568,2093,1568,1318.5,1046.5,2093].forEach((f,i)=>pt(ac,{freq:f,type:"triangle",gain:0.38,dur:0.6+i*0.08,delay:i*0.16}));}},
  {id:"voice-her",name:"Coach (Her)",desc:"“Final set completed”",color:"#FF9ECD",play(){speak("Final set completed. Great work.","female");}},
  {id:"voice-austrian",name:"Coach (Him)",desc:"“Final set completed” — deep male voice",color:"#FF8C42",play(){speak("Final set completed. Great work.","austrian");}},
];
const REST_START_SOUNDS=[
  {id:"none",name:"None",desc:"No announcement",color:"#666680",play(){}},
  {id:"voice-her",name:"Coach (Her)",desc:"“Next set in 2 minutes”",color:"#FF9ECD",play(ac,o){speak(`Next set in ${spokenDuration(o?.secs??120)}`,"female");}},
  {id:"voice-austrian",name:"Coach (Him)",desc:"Same call, deep male voice",color:"#FF8C42",play(ac,o){speak(`Next set in ${spokenDuration(o?.secs??120)}`,"austrian");}},
];
const CUE_DEFS=[
  {key:"countdown",icon:"⏱",label:"Countdown",desc:"3 ticks before each hang",sounds:COUNTDOWN_SOUNDS,defaultId:"crisp-tick"},
  {key:"hangStart",icon:"🟢",label:"Hang Start",desc:"When hang phase begins",sounds:HANG_START_SOUNDS,defaultId:"crisp-go"},
  {key:"hangEnd",icon:"🔴",label:"Hang End",desc:"When hang phase ends",sounds:HANG_END_SOUNDS,defaultId:"crisp-stop"},
  {key:"restStart",icon:"⏲",label:"Rest Start",desc:"Announce the between-set rest",sounds:REST_START_SOUNDS,defaultId:"none"},
  {key:"complete",icon:"🏔",label:"Complete",desc:"All sets finished",sounds:COMPLETE_SOUNDS,defaultId:"crisp-fanfare"},
];
function getDefaultCueSelections(){return Object.fromEntries(CUE_DEFS.map(c=>[c.key,c.defaultId]));}

// ─── AUDIO UNLOCK ─────────────────────────────────────────────────────────────
// Silent 1s looping WAV played through an <audio> element. An actively-playing
// media element keeps the page's audio session alive through iOS auto-lock and
// long idle rests — a bare WebAudio oscillator does not. Without this, iOS kills
// audio during the between-set rest and cues go silent from set 2 onward.
function makeSilenceUrl(){
  const sr=8000,len=sr;
  const buf=new ArrayBuffer(44+len*2);const v=new DataView(buf);
  const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  ws(0,"RIFF");v.setUint32(4,36+len*2,true);ws(8,"WAVE");ws(12,"fmt ");
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);
  ws(36,"data");v.setUint32(40,len*2,true);
  return URL.createObjectURL(new Blob([buf],{type:"audio/wav"}));
}
function startSilenceLoop(){
  try{
    let a=window.__hangio_silence;
    if(!a){
      a=new Audio(makeSilenceUrl());
      a.loop=true;a.setAttribute("playsinline","");
      window.__hangio_silence=a;
    }
    a.play().catch(()=>{});
  }catch{/* media unavailable — non-fatal */}
}
function stopSilenceLoop(){try{window.__hangio_silence?.pause();}catch{/* noop */}}
function unlockAudio(){
  try{
    const ac=new(window.AudioContext||window.webkitAudioContext)();
    const buf=ac.createBuffer(1,1,22050);
    const src=ac.createBufferSource();
    src.buffer=buf;src.connect(ac.destination);src.start(0);
    if(ac.state==="suspended")ac.resume();
    window.__hangio_ac=ac;
  }catch(e){console.log("audio unlock failed",e);}
  startSilenceLoop();
  // Prime speech synthesis inside the gesture so voice cues can fire later
  try{
    const ss=window.speechSynthesis;
    if(ss){refreshVoices();const u=new SpeechSynthesisUtterance(" ");u.volume=0;ss.speak(u);}
  }catch{/* no TTS — non-fatal */}
}

// ─── SOUND ENGINE ─────────────────────────────────────────────────────────────
function useSoundEngine(cueSelections,muted){
  const ensureAC=useCallback(()=>{
    let ac=window.__hangio_ac;
    if(!ac||ac.state==="closed"){ac=createAudioContext();window.__hangio_ac=ac;}
    // iOS reports "interrupted" as well as "suspended" — resume on anything not running
    if(ac&&ac.state!=="running")ac.resume().catch(()=>{});
    return ac;
  },[]);
  const play=useCallback((cue,opts)=>{
    if(muted)return;const ac=ensureAC();if(!ac)return;
    const def=CUE_DEFS.find(c=>c.key===cue);if(!def)return;
    const id=cueSelections[cue]||def.defaultId;
    const snd=def.sounds.find(s=>s.id===id)||def.sounds[0];
    // If the context is suspended/interrupted, play AFTER resume resolves —
    // sounds scheduled on a frozen clock never fire.
    if(ac.state==="running")snd.play(ac,opts);
    else ac.resume().then(()=>snd.play(ac,opts)).catch(()=>{});
  },[cueSelections,muted,ensureAC]);
  const playPreview=useCallback((cue,soundId)=>{
    const ac=ensureAC();if(!ac)return;
    const def=CUE_DEFS.find(c=>c.key===cue);if(!def)return;
    (def.sounds.find(s=>s.id===soundId)||def.sounds[0]).play(ac,{n:3,secs:120});
  },[ensureAC]);
  return{play,playPreview};
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtTime(s){if(s>=60)return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;return `${s}s`;}
function useLocalStorage(key,init){
  const[val,setVal]=useState(()=>{try{const s=localStorage.getItem(key);return s?JSON.parse(s):init;}catch{return init;}});
  const set=useCallback((v)=>{
    const next=typeof v==="function"?v(val):v;setVal(next);
    try{localStorage.setItem(key,JSON.stringify(next));}catch{}
  },[key,val]);
  return[val,set];
}

// Parse program day detail text into a timer-compatible proto object
function dayDetailToProto(day) {
  const detail = (day.detail||"").toLowerCase();
  const tags = day.tags||[];
  // Start from a sensible default based on tag
  let base = {...PROTOCOLS[0]};
  if(tags.includes("rep")) base={...PROTOCOLS[1]};
  else if(tags.includes("vol")) base={...PROTOCOLS[2]};
  // Extract sets
  const setsM = detail.match(/(\d+)\s*[x×]\s*\d+s/) || detail.match(/(\d+)\s*sets?/i);
  if(setsM) base.sets = Math.min(parseInt(setsM[1]),12);
  // Extract hang seconds
  const hangM = detail.match(/(\d+)s\s*(hang|on)/i) || detail.match(/[x×]\s*(\d+)s/i) || detail.match(/(\d+)s\s*[,;]/);
  if(hangM) base.hangSeconds = Math.min(parseInt(hangM[1]),60);
  // Extract rest
  const restMinM = detail.match(/(\d+)\s*min\s*rest/i);
  const restSecM = detail.match(/rest.*?(\d+)s/i)||detail.match(/(\d+)s\s*rest/i);
  if(restMinM) base.restBetweenSets = parseInt(restMinM[1])*60;
  else if(restSecM) base.restBetweenSets = parseInt(restSecM[1]);
  base.name = day.workoutTitle || "Program Workout";
  base.color = "#e05c34";
  return base;
}

// ─── ADAPT PROGRAM FROM ANALYTICS ────────────────────────────────────────────
function currentProgramWeek(program){
  const start=program.startDate||program.formData?.startDate;
  if(!start)return 1;
  const w=Math.floor((Date.now()-new Date(start+"T00:00:00").getTime())/(7*24*3600*1000))+1;
  return Math.min(program.totalWeeks||1,Math.max(1,w));
}
function buildAdaptPrompt(program,sessions){
  const week=currentProgramWeek(program);
  const start=program.startDate||program.formData?.startDate;
  const startMs=start?new Date(start+"T00:00:00").getTime():0;
  const since=sessions.filter(s=>new Date(s.date).getTime()>=startMs).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const now=Date.now();
  const last14=since.filter(s=>(now-new Date(s.date).getTime())<=14*24*3600*1000);
  const daysSinceLast=since.length?Math.round((now-new Date(since[since.length-1].date).getTime())/(24*3600*1000)):null;
  const plannedPerWeek=program.formData?.trainingDays?.length||3;
  const weeksElapsed=Math.max(1,week-1)||1;
  const partials=since.filter(s=>s.partial).length;
  const half=Math.floor(since.length/2);
  const avg=arr=>arr.length?Math.round(arr.reduce((a,s)=>a+(s.totalHangs||0),0)/arr.length*10)/10:0;
  const earlyAvg=avg(since.slice(0,half)),recentAvg=avg(since.slice(half));
  const rows=since.slice(-20).map(s=>`${s.date?.split("T")[0]} | ${s.protocol} | ${s.sets} sets | ${s.totalHangs} hangs | ${s.duration}s${s.partial?" | QUIT EARLY":""}${s.fromProgram?" | program":""}`).join("\n");
  const {formData:_fd,...programCore}=program;
  return `You are an expert climbing coach. The athlete has an active periodized program and real logged training data. Today is ${new Date().toISOString().split("T")[0]} — program week ${week} of ${program.totalWeeks}. Rewrite the program from week ${week} onward based on actual performance.

CURRENT PROGRAM JSON:
${JSON.stringify(programCore)}

ACTUAL TRAINING DATA (since program start ${start||"unknown"}):
- Planned sessions/week: ${plannedPerWeek} — actual average: ${Math.round(since.length/weeksElapsed*10)/10} (${since.length} sessions over ~${weeksElapsed} week${weeksElapsed>1?"s":""})
- Sessions in last 14 days: ${last14.length}
- Days since last session: ${daysSinceLast??"no sessions logged"}
- Avg hangs/session — early half: ${earlyAvg}, recent half: ${recentAvg}
- Sessions quit early: ${partials} of ${since.length}
RECENT SESSIONS (oldest first):
${rows||"none"}

COACHING RULES:
- Strong adherence (at/near planned frequency) with stable or growing hang volume: progress the remaining weeks — modestly increase intensity/volume toward the goal.
- Poor adherence (well below planned frequency, long gaps, many early quits) or declining volume: reduce intensity, rebuild base first, and re-anchor progression so the peak date remains realistic.
- Weeks 1 through ${week-1} are in the past — reproduce them EXACTLY as given, unchanged.
- Keep programName, totalWeeks, startDate, and the JSON schema exactly the same. Keep every week number from 1 to ${program.totalWeeks} present.
- Only schedule training on the same weekdays used in the current program.
- Rewrite "summary" as 2 sentences explaining what you adjusted and why, prefixed "Adapted week ${week}:".
- Return ONLY valid JSON, no markdown fences, no commentary.`;
}
function parseProgramJson(rawText){
  let jsonStr=rawText.replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/i,"").trim();
  const fb=jsonStr.indexOf("{"),lb=jsonStr.lastIndexOf("}");
  if(fb===-1||lb===-1)throw new Error("No JSON found");
  jsonStr=jsonStr.slice(fb,lb+1);
  let parsed;
  try{parsed=JSON.parse(jsonStr);}catch{
    for(const sfx of["]}","]}]}","]}]}]}"]){try{parsed=JSON.parse(jsonStr+sfx);if(parsed)break;}catch{/* try next */}}
  }
  if(!parsed||!parsed.programName||!Array.isArray(parsed.phases)||!parsed.phases.length)throw new Error("Incomplete program");
  return parsed;
}

// ─── BUILD PROMPT ─────────────────────────────────────────────────────────────
function sanitize(s){return String(s||"").replace(/[-]/g," ").trim();}
function getStartDate(formData){
  if(formData.startDate)return formData.startDate;
  // Find next occurrence of first training day
  const today=new Date();
  const targetDay=formData.trainingDays[0]??0; // 0=Mon,6=Sun
  // Convert our Mon-based index to JS Sun-based (0=Sun)
  const jsTarget=(targetDay+1)%7;
  const todayJs=today.getDay();
  let daysUntil=(jsTarget-todayJs+7)%7;
  if(daysUntil===0)daysUntil=7; // Start next week if today is the day
  const start=new Date(today);
  start.setDate(today.getDate()+daysUntil);
  return start.toISOString().split("T")[0];
}
function buildPrompt(formData){
  const startDate=getStartDate(formData);
  const startDateObj=new Date(startDate+"T00:00:00");
  const peakDateObj=new Date(formData.peakDate+"T00:00:00");
  const weeksOut=Math.max(2,Math.round((peakDateObj-startDateObj)/(7*24*3600*1000)));
  const trainingDays=formData.trainingDays.map(i=>DAY_FULL[i]).join(", ");
  const goal=sanitize(formData.goalDescription);
  const current=sanitize(formData.currentGrade);
  const target=sanitize(formData.targetGrade);
  const injury=sanitize(formData.injuryNotes)||"None";
  const equipment=sanitize(formData.hangboardAccess);
  const numPhases=weeksOut<=4?1:weeksOut<=8?2:weeksOut<=14?3:weeksOut<=24?4:5;
  const startLabel=new Date(startDate+"T00:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  return `You are an expert climbing coach. Generate a periodized finger strength training program as JSON only.

ATHLETE:
- Goal: ${formData.goalType} - ${goal}
- Current level: ${current} to Target: ${target}
- Program start: ${startLabel} (${startDate})
- Peak date: ${formData.peakDate} (${weeksOut} weeks of training)
- Training days: ${trainingDays} (${formData.trainingDays.length} days/week)
- Session length: ${formData.hoursPerSession} hours
- Equipment: ${equipment}
- Injury notes: ${injury}

Return ONLY this JSON structure, no markdown, no explanation:
{"programName":"string","totalWeeks":${weeksOut},"startDate":"${startDate}","summary":"2 sentence overview","keyPrinciples":["p1","p2","p3"],"phases":[{"phaseNumber":1,"phaseName":"Base","startWeek":1,"endWeek":8,"durationWeeks":8,"intensity":55,"description":"Phase focus","weeks":[{"weekNumber":1,"weekTitle":"title","intensity":50,"focus":"focus","days":[{"dayIndex":0,"dayName":"Monday","type":"training","workoutTitle":"Max Hangs","detail":"5x10s on 20mm, 3min rest, 85% intensity","tags":["max"]},{"dayIndex":2,"dayName":"Wednesday","type":"rest","workoutTitle":"Rest","detail":"Active recovery","tags":["rest"]}]}]}]}

RULES:
- Create exactly ${numPhases} phases covering all ${weeksOut} weeks
- Phases must add up to exactly ${weeksOut} weeks total with NO gaps and NO skipped weeks
- Include EVERY week number from 1 to ${weeksOut} — do not skip any weeks
- For longer phases, weeks may repeat the same structure but must all be listed explicitly
- Program starts on ${startDate}. Week 1 begins on this date
- Only schedule training on: ${trainingDays}. All other days must be rest or active_recovery
- day type must be one of: training, rest, active_recovery, redpoint
- tags from: max, rep, vol, rest, peak, skill
- day detail: concise, under 20 words, include sets x seconds and rest time
- The final phase must end on week ${weeksOut} which ends around ${formData.peakDate}
- Return valid JSON only, no markdown fences`;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const css = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0A0A0F;--surface:#13131A;--surface2:#1C1C27;
    --border:rgba(255,255,255,0.08);--text:#F0F0F5;--muted:#666680;
    --accent:#FF4D00;--ember:#e05c34;--chalk:#f0ede6;
    --font-display:'Bebas Neue',sans-serif;--font-body:'DM Sans',sans-serif;--font-mono:'DM Mono',monospace;
    --r:16px;--r-sm:10px;
  }
  html,body{height:100%;background:var(--bg);overflow:hidden}
  .app{width:100%;max-width:430px;height:100dvh;margin:0 auto;background:var(--bg);display:flex;flex-direction:column;overflow:hidden;position:relative;font-family:var(--font-body);color:var(--text);padding-bottom:env(safe-area-inset-bottom,0px)}
  .scroll{flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
  .scroll::-webkit-scrollbar{display:none}
  /* LANDING */
  .landing{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}
  .landing-top{padding:clamp(28px,6dvh,52px) 24px 0;flex-shrink:0}
  .landing-logo-row{display:flex;align-items:center;gap:12px;margin-bottom:clamp(16px,3dvh,32px)}
  .landing-logo-mark{width:36px;height:36px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:20px;color:#fff;flex-shrink:0}
  .landing-logo-text{font-family:var(--font-display);font-size:26px;letter-spacing:5px;color:var(--chalk)}
  .landing-logo-sub{font-family:var(--font-mono);font-size:9px;color:var(--muted);letter-spacing:3px;text-transform:uppercase;margin-left:auto;padding:3px 8px;border:1px solid #2a2a2a;border-radius:2px}
  .landing-headline{font-family:var(--font-display);font-size:clamp(36px,10dvh,66px);letter-spacing:2px;line-height:0.9;color:var(--chalk);margin-bottom:clamp(8px,1.5dvh,14px)}
  .landing-headline em{color:var(--accent);font-style:normal}
  .landing-sub{font-size:13px;color:var(--muted);line-height:1.5;max-width:340px;margin-bottom:clamp(12px,2.5dvh,28px)}
  .landing-cards{padding:0 16px clamp(16px,4dvh,28px);display:flex;flex-direction:column;gap:8px;overflow-y:auto;flex:1;min-height:0;-webkit-overflow-scrolling:touch}
  .landing-cards::-webkit-scrollbar{display:none}
  .lcard{border-radius:12px;border:1px solid var(--border);padding:14px 16px;cursor:pointer;transition:transform 0.15s,border-color 0.2s,background 0.2s;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;background:var(--surface);min-height:0}
  .lcard:active{transform:scale(0.98)}
  .lcard.primary{border-color:rgba(255,77,0,0.4);background:rgba(255,77,0,0.06)}
  .lcard.primary:hover{border-color:rgba(255,77,0,0.7);background:rgba(255,77,0,0.1)}
  .lcard:not(.primary):hover{border-color:rgba(255,255,255,0.16);background:var(--surface2)}
  .lcard-icon{font-size:22px;flex-shrink:0;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:var(--surface2)}
  .lcard.primary .lcard-icon{background:rgba(255,77,0,0.15)}
  .lcard-body{flex:1;min-width:0}
  .lcard-title{font-family:var(--font-display);font-size:20px;letter-spacing:2px;color:var(--chalk);line-height:1}
  .lcard.primary .lcard-title{color:var(--accent)}
  .lcard-desc{font-size:11px;color:var(--muted);margin-top:3px;line-height:1.35;white-space:normal;overflow:visible}
  .lcard-arrow{font-size:18px;color:var(--muted);flex-shrink:0;transition:transform 0.15s,color 0.15s}
  .lcard:hover .lcard-arrow{transform:translateX(3px);color:var(--accent)}
  .lcard-badge{font-family:var(--font-mono);font-size:9px;letter-spacing:2px;text-transform:uppercase;padding:3px 8px;border-radius:3px;background:rgba(255,77,0,0.15);color:var(--accent);border:1px solid rgba(255,77,0,0.25);position:absolute;top:12px;right:12px}
  /* GOAL BUILDER */
  .goal-shell{flex:1;display:flex;flex-direction:column;overflow:hidden}
  .goal-header{padding:44px 24px 20px;border-bottom:1px solid #1a1a1a;flex-shrink:0;display:flex;align-items:center;gap:12px}
  .back-btn{width:36px;height:36px;border-radius:8px;border:1px solid #2a2a2a;background:var(--surface);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);font-size:16px;flex-shrink:0;transition:color 0.15s,border-color 0.15s}
  .back-btn:hover{color:var(--chalk);border-color:#444}
  .goal-header-title{font-family:var(--font-display);font-size:26px;letter-spacing:3px;color:var(--chalk)}
  .goal-header-sub{font-size:12px;color:var(--muted);margin-top:2px}
  .goal-scroll{flex:1;overflow-y:auto;padding:24px}
  .goal-scroll::-webkit-scrollbar{display:none}
  .form-section{margin-bottom:24px}
  .form-label{font-family:var(--font-mono);font-size:10px;letter-spacing:3px;color:var(--muted);text-transform:uppercase;margin-bottom:8px;display:block}
  .goal-type-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .goal-card{border:1px solid #2a2a2a;border-radius:8px;padding:12px 8px;cursor:pointer;transition:all 0.2s;background:var(--surface);text-align:center}
  .goal-card:hover{border-color:var(--ember);background:rgba(224,92,52,0.08)}
  .goal-card.selected{border-color:var(--ember);background:rgba(224,92,52,0.15)}
  .goal-card-icon{font-size:20px;margin-bottom:4px}
  .goal-card-label{font-family:var(--font-mono);font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase}
  .goal-card.selected .goal-card-label{color:var(--ember)}
  .goal-input{background:var(--surface);border:1px solid #2a2a2a;border-radius:8px;color:var(--chalk);font-family:var(--font-body);font-size:14px;padding:12px 14px;outline:none;transition:border-color 0.2s;width:100%;appearance:none}
  .goal-input:focus{border-color:var(--ember);box-shadow:0 0 0 3px rgba(224,92,52,0.1)}
  input[type="date"].goal-input{color-scheme:dark}
  .goal-input-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .days-grid{display:flex;gap:6px;flex-wrap:wrap}
  .day-btn{width:38px;height:38px;border:1px solid #2a2a2a;border-radius:50%;background:var(--surface);color:var(--muted);font-family:var(--font-mono);font-size:10px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center}
  .day-btn.active{background:var(--ember);border-color:var(--ember);color:white}
  .generate-btn{width:100%;padding:16px;background:var(--accent);border:none;border-radius:8px;color:white;font-family:var(--font-display);font-size:20px;letter-spacing:4px;cursor:pointer;transition:all 0.2s;margin-top:8px}
  .generate-btn:hover{background:#c94a26;transform:translateY(-1px);box-shadow:0 8px 30px rgba(255,77,0,0.35)}
  .generate-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
  .error-msg{color:#c0392b;font-family:var(--font-mono);font-size:11px;padding:10px 14px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);border-radius:6px;margin-top:8px}
  .loading-rings{display:inline-flex;gap:5px;align-items:center;margin-bottom:16px}
  .loading-ring{width:9px;height:9px;border-radius:50%;background:var(--ember);animation:pulse-dot 1.2s ease-in-out infinite}
  .loading-ring:nth-child(2){animation-delay:0.2s}
  .loading-ring:nth-child(3){animation-delay:0.4s}
  @keyframes pulse-dot{0%,80%,100%{transform:scale(0.7);opacity:0.5}40%{transform:scale(1.2);opacity:1}}
  /* PROGRAM */
  .program-summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#1a1a1a;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;margin-bottom:24px}
  .sum-cell{background:var(--surface);padding:16px}
  .sum-label{font-family:var(--font-mono);font-size:9px;letter-spacing:3px;color:var(--muted);text-transform:uppercase;margin-bottom:6px}
  .sum-val{font-family:var(--font-display);font-size:26px;color:var(--chalk);letter-spacing:1px;line-height:1}
  .sum-val.accent{color:var(--ember)}
  .phase-header-row{display:flex;align-items:center;gap:12px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #1a1a1a}
  .phase-num-badge{font-family:var(--font-display);font-size:10px;letter-spacing:3px;color:var(--ember);background:rgba(224,92,52,0.12);border:1px solid rgba(224,92,52,0.3);padding:3px 10px;border-radius:2px}
  .phase-name-text{font-family:var(--font-display);font-size:22px;letter-spacing:2px;color:var(--chalk)}
  .phase-weeks-text{font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-left:auto}
  .phase-desc-block{font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:14px;padding:10px 14px;background:rgba(255,255,255,0.03);border-left:2px solid var(--ember);border-radius:0 4px 4px 0}
  .program-section{margin-bottom:24px}
  .regen-btn{padding:10px 22px;background:transparent;border:1px solid #333;border-radius:6px;color:var(--muted);font-family:var(--font-mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all 0.2s}
  .regen-btn:hover{border-color:var(--ember);color:var(--ember)}
  /* clickable day card */
  .day-card{border-radius:6px;padding:12px;transition:all 0.2s;border:1px solid}
  .day-card.training{cursor:pointer;background:rgba(0,0,0,0.2)}
  .day-card.training:hover{border-color:var(--ember)!important;background:rgba(224,92,52,0.1)!important;transform:translateY(-1px)}
  .day-card.training:active{transform:scale(0.98)}
  .day-card-launch{font-family:var(--font-mono);font-size:9px;letter-spacing:2px;color:var(--ember);text-transform:uppercase;margin-top:6px;display:none}
  .day-card.training:hover .day-card-launch{display:block}
  /* SAVED */
  .saved-shell{flex:1;display:flex;flex-direction:column;overflow:hidden}
  .saved-list{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:10px}
  .saved-list::-webkit-scrollbar{display:none}
  .saved-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px;cursor:pointer;transition:border-color 0.2s}
  .saved-card:hover{border-color:rgba(255,77,0,0.4)}
  .saved-card-title{font-family:var(--font-display);font-size:20px;letter-spacing:1px;color:var(--chalk);margin-bottom:4px}
  .saved-card-meta{font-size:12px;color:var(--muted)}
  .saved-card-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
  .saved-tag{font-family:var(--font-mono);font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:3px;background:var(--surface2);color:var(--muted);border:1px solid var(--border)}
  .empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;gap:12px}
  .empty-state .icon{font-size:52px}
  .empty-state p{font-size:14px;color:var(--muted);max-width:260px;line-height:1.6}
  /* NAV */
  .nav{display:flex;border-top:1px solid var(--border);background:rgba(10,10,15,0.95);backdrop-filter:blur(20px);flex-shrink:0;z-index:10}
  .nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px 14px;background:none;border:none;cursor:pointer;color:var(--muted);transition:color 0.2s;font-family:var(--font-body);font-size:10px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase}
  .nav-btn.active{color:var(--text)}
  .nav-btn svg{width:22px;height:22px}
  .nav-dot{width:4px;height:4px;border-radius:50%;background:var(--accent);opacity:0;transition:opacity 0.2s}
  .nav-btn.active .nav-dot{opacity:1}
  .page-header{padding:52px 20px 20px}
  .page-title{font-family:var(--font-display);font-size:42px;letter-spacing:0.02em;line-height:1;color:var(--text)}
  .page-sub{font-size:13px;color:var(--muted);margin-top:4px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin:0 20px 12px}
  .protocol-card{margin:0 20px 10px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface);padding:16px;cursor:pointer;transition:transform 0.15s,border-color 0.15s;display:flex;align-items:center;gap:14px}
  .protocol-card:active{transform:scale(0.98)}
  .protocol-card.selected{border-color:var(--sel-color,var(--accent))}
  .proto-dot{width:12px;height:40px;border-radius:6px;flex-shrink:0}
  .proto-info{flex:1}
  .proto-name{font-size:17px;font-weight:600}
  .proto-sub{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-top:1px}
  .proto-desc{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.4}
  .proto-meta{font-family:var(--font-mono);font-size:11px;color:var(--muted);margin-top:6px}
  .start-btn{display:flex;align-items:center;justify-content:center;gap:10px;margin:4px 20px 20px;padding:18px;border-radius:var(--r);border:none;font-family:var(--font-display);font-size:24px;letter-spacing:0.06em;cursor:pointer;background:var(--accent);color:#fff;transition:opacity 0.2s,transform 0.1s}
  .start-btn:active{transform:scale(0.98);opacity:0.9}
  .setup-row{display:flex;gap:8px;margin:0 20px 10px}
  .setup-chip{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em}
  .setup-chip strong{display:block;font-size:16px;font-weight:600;color:var(--text);margin-top:2px;font-family:var(--font-mono)}
  .select-row{display:flex;gap:8px;flex-wrap:wrap;margin:0 20px 12px}
  .sel-chip{padding:8px 14px;border-radius:20px;border:1px solid var(--border);background:var(--surface2);font-size:13px;color:var(--muted);cursor:pointer;transition:all 0.15s}
  .sel-chip.active{background:var(--accent);border-color:var(--accent);color:#fff}
  .stepper{display:flex;align-items:center;gap:12px}
  .step-btn{width:36px;height:36px;border-radius:50%;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .section-title{font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);padding:0 20px;margin-bottom:8px}
  /* WORKOUT */
  .workout-screen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:48px 24px 32px;background:var(--bg);position:relative;overflow:hidden}
  .phase-label{font-family:var(--font-display);font-size:20px;letter-spacing:0.15em;text-transform:uppercase}
  .timer-ring{position:relative;width:260px;height:260px}
  .timer-ring svg{position:absolute;top:0;left:0;transform:rotate(-90deg)}
  .timer-ring-track{fill:none;stroke:var(--surface2);stroke-width:8}
  .timer-ring-prog{fill:none;stroke-width:8;stroke-linecap:round;transition:stroke-dashoffset 0.95s linear,stroke 0.3s}
  .timer-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
  .timer-num{font-family:var(--font-display);font-size:88px;line-height:1;letter-spacing:-0.02em}
  .timer-phase-sub{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em}
  .workout-meta{display:flex;gap:32px;text-align:center}
  .wm-item label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em}
  .wm-item span{display:block;font-family:var(--font-mono);font-size:20px;font-weight:600;margin-top:2px}
  .workout-grip{font-size:13px;color:var(--muted);text-align:center}
  .workout-grip strong{color:var(--text);display:block;font-size:17px;margin-top:2px}
  .control-row{display:flex;gap:12px;width:100%}
  .ctrl-btn{flex:1;padding:16px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:var(--font-body);font-size:15px;font-weight:500;cursor:pointer}
  .ctrl-btn.primary{background:var(--accent);border-color:var(--accent)}
  .glow{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;z-index:0;opacity:0.12}
  @keyframes pulse-ring{0%{transform:scale(1);opacity:0.5}100%{transform:scale(1.08);opacity:0}}
  .pulse-ring{position:absolute;inset:-8px;border-radius:50%;border:2px solid currentColor;animation:pulse-ring 1.2s ease-out infinite;pointer-events:none}
  /* COMPLETE */
  .complete-screen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 24px;text-align:center;gap:16px;overflow-y:auto}
  .complete-screen::-webkit-scrollbar{display:none}
  .complete-icon{font-size:64px}
  .complete-title{font-family:var(--font-display);font-size:52px;letter-spacing:0.04em}
  .complete-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}
  .complete-stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:14px}
  .complete-stat label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em}
  .complete-stat span{display:block;font-family:var(--font-mono);font-size:22px;font-weight:600;margin-top:3px}
  /* SESSION NOTES */
  .notes-area{width:100%;background:var(--surface);border:1px solid #2a2a2a;border-radius:10px;color:var(--chalk);font-family:var(--font-body);font-size:14px;padding:12px 14px;outline:none;resize:none;line-height:1.5;transition:border-color 0.2s}
  .notes-area:focus{border-color:var(--ember);box-shadow:0 0 0 3px rgba(224,92,52,0.1)}
  /* HISTORY */
  .history-empty{text-align:center;padding:60px 20px;color:var(--muted);font-size:15px}
  .history-empty .icon{font-size:48px;display:block;margin-bottom:12px}
  .session-card{margin:0 20px 10px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px}
  .session-header{display:flex;justify-content:space-between;align-items:flex-start}
  .session-name{font-weight:600;font-size:16px}
  .session-date{font-size:12px;color:var(--muted);text-align:right}
  .session-stats{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap}
  .stat-pill{background:var(--surface2);border-radius:6px;padding:5px 10px;font-size:12px;font-family:var(--font-mono)}
  .session-notes-preview{font-size:12px;color:var(--muted);margin-top:8px;font-style:italic;line-height:1.4;border-top:1px solid var(--border);padding-top:8px}
  /* PROGRESS */
  .progress-stat{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 20px 12px}
  .ps-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:14px}
  .ps-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.07em}
  .ps-val{font-family:var(--font-display);font-size:32px;margin-top:2px}
  .ps-unit{font-size:12px;color:var(--muted)}
  .bar-chart{padding:0 20px 20px}
  .bar-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  .bar-label{font-size:11px;color:var(--muted);width:70px;flex-shrink:0;font-family:var(--font-mono)}
  .bar-track{flex:1;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden}
  .bar-fill{height:100%;border-radius:4px;transition:width 0.5s ease}
  .bar-val{font-size:11px;color:var(--muted);width:32px;text-align:right;font-family:var(--font-mono)}
  /* SETTINGS */
  .settings-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:100;backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;animation:sov-in 0.2s ease}
  @keyframes sov-in{from{opacity:0}to{opacity:1}}
  .settings-sheet{width:100%;max-width:430px;background:#131320;border-top:1px solid rgba(255,255,255,0.1);border-radius:24px 24px 0 0;padding:0 0 36px;animation:sheet-up 0.28s cubic-bezier(0.34,1.2,0.64,1);max-height:92dvh;overflow-y:auto}
  @keyframes sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}
  .settings-handle{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,0.14);margin:12px auto 0}
  .settings-title{font-family:var(--font-display);font-size:30px;letter-spacing:0.06em;padding:16px 20px 2px;color:var(--text)}
  .settings-subtitle{font-size:12px;color:var(--muted);padding:0 20px 12px}
  .mute-bar{display:flex;align-items:center;justify-content:space-between;margin:0 20px 16px;padding:14px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm)}
  .mute-bar-left{font-size:14px;font-weight:500}
  .mute-bar-sub{font-size:11px;color:var(--muted);margin-top:2px}
  .toggle-sw{width:46px;height:26px;border-radius:13px;background:var(--surface2);border:1px solid var(--border);position:relative;cursor:pointer;transition:background 0.2s,border-color 0.2s;flex-shrink:0}
  .toggle-sw.on{background:var(--accent);border-color:var(--accent)}
  .toggle-knob{width:20px;height:20px;border-radius:50%;background:var(--muted);position:absolute;top:2px;left:2px;transition:transform 0.2s,background 0.2s}
  .toggle-sw.on .toggle-knob{transform:translateX(20px);background:#fff}
  .cue-list{padding:0 20px}
  .cue-item{border:1px solid var(--border);border-radius:12px;background:var(--surface);margin-bottom:8px;overflow:hidden}
  .cue-item.open{border-color:rgba(255,255,255,0.18)}
  .cue-header{display:flex;align-items:center;gap:11px;padding:14px 16px;cursor:pointer;user-select:none}
  .cue-icon-wrap{font-size:19px;width:26px;text-align:center;flex-shrink:0}
  .cue-header-info{flex:1;min-width:0}
  .cue-header-name{font-size:14px;font-weight:600;line-height:1.2}
  .cue-header-desc{font-size:11px;color:var(--muted);margin-top:1px}
  .cue-selected-badge{font-family:var(--font-mono);font-size:10px;padding:3px 8px;border-radius:4px;border:1px solid;white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}
  .cue-chevron{font-size:10px;color:var(--muted);transition:transform 0.2s;flex-shrink:0;margin-left:2px}
  .cue-item.open .cue-chevron{transform:rotate(180deg)}
  .sound-list{padding:2px 12px 14px}
  .sound-opt{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:9px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;margin-bottom:6px;transition:border-color 0.15s}
  .sound-opt.picked{border-color:var(--opt-col,var(--accent));background:rgba(255,255,255,0.035)}
  .sound-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;opacity:0.45}
  .sound-opt.picked .sound-dot{opacity:1;transform:scale(1.25)}
  .sound-opt-info{flex:1;min-width:0}
  .sound-opt-name{font-size:13px;font-weight:600}
  .sound-opt-desc{font-size:11px;color:var(--muted);margin-top:1px}
  .play-btn{font-size:10px;font-family:var(--font-mono);padding:5px 9px;border-radius:5px;border:1px solid var(--border);background:none;color:var(--muted);cursor:pointer}
  .play-btn:hover{color:var(--opt-col,var(--accent));border-color:var(--opt-col,var(--accent))}
  .done-btn{width:calc(100% - 40px);margin:14px 20px 0;padding:16px;border-radius:var(--r);border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:var(--font-display);font-size:20px;letter-spacing:0.06em;cursor:pointer}
  .mute-badge{position:absolute;top:16px;right:16px;z-index:20;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:11px;font-family:var(--font-mono);color:var(--muted);cursor:pointer;display:flex;align-items:center;gap:5px}
  /* ANIMATIONS */
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  .fade-up{animation:fadeUp 0.4s ease}
  /* PROGRAM SESSION LAUNCH MODAL */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:50;display:flex;align-items:flex-end;justify-content:center;animation:sov-in 0.2s ease}
  .modal-sheet{width:100%;max-width:430px;background:#131320;border-top:1px solid rgba(255,255,255,0.1);border-radius:24px 24px 0 0;padding:24px 24px 40px;animation:sheet-up 0.28s cubic-bezier(0.34,1.2,0.64,1);max-height:88dvh;overflow-y:auto}
  .modal-sheet::-webkit-scrollbar{display:none}
  .modal-title{font-family:var(--font-display);font-size:26px;letter-spacing:3px;color:var(--chalk);margin-bottom:4px}
  .modal-sub{font-size:13px;color:var(--muted);margin-bottom:20px}
`;

const styleEl = document.createElement("style");
styleEl.textContent = css;
document.head.appendChild(styleEl);

// ─── NAV ICONS ────────────────────────────────────────────────────────────────
const icons = {
  train:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 10V5M16 10V5"/></svg>),
  history: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 8v4l3 3"/><path d="M3.05 11a9 9 0 1 0 .5-3M3 4v4h4"/></svg>),
  chart:   (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-6 4 4 4-7"/></svg>),
  settings:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>),
};

// ─── INTENSITY BAR ─────────────────────────────────────────────────────────────
function IntensityBar({value}){
  const color=value<55?"#74b9ff":value<70?"#6ab04c":value<82?"#d4a843":"#e74c3c";
  return(<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:80,height:4,background:"#333",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${value}%`,background:color,borderRadius:2,transition:"width 0.6s ease"}}/></div><span style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"#555",width:35}}>{value}%</span></div>);
}

// ─── WEEK ROW (clickable training days) ──────────────────────────────────────
function getWeekStartDate(programStartDate, weekNumber){
  if(!programStartDate)return null;
  const start=new Date(programStartDate+"T00:00:00");
  start.setDate(start.getDate()+(weekNumber-1)*7);
  return start;
}

function formatWeekRange(programStartDate, weekNumber){
  const start=getWeekStartDate(programStartDate,weekNumber);
  if(!start)return null;
  const end=new Date(start);
  end.setDate(start.getDate()+6);
  const opts={month:"short",day:"numeric"};
  return `${start.toLocaleDateString("en-US",opts)} - ${end.toLocaleDateString("en-US",opts)}`;
}

function WeekRow({week, onLaunchDay, programStartDate}){
  const[open,setOpen]=useState(false);
  const activeDays=week.days?.filter(d=>d.type!=="rest"&&d.type!=="active_recovery")||[];
  const tagColor={max:"#e74c3c",rep:"#6ab04c",vol:"#74b9ff",peak:"#d4a843",skill:"#a8c4c0",rest:"#6b6b6b"};
  const tagBg={max:"rgba(192,57,43,0.2)",rep:"rgba(74,103,65,0.25)",vol:"rgba(52,152,219,0.2)",peak:"rgba(212,168,67,0.2)",skill:"rgba(168,196,192,0.2)",rest:"rgba(107,107,107,0.2)"};
  const dateRange=formatWeekRange(programStartDate,week.weekNumber);

  // Calculate actual date for each training day
  function getDayDate(dayIndex){
    const weekStart=getWeekStartDate(programStartDate,week.weekNumber);
    if(!weekStart)return null;
    // dayIndex is 0=Mon...6=Sun, JS getDay is 0=Sun...6=Sat
    const jsDay=weekStart.getDay(); // day of week of week start
    // Find how many days from weekStart to reach dayIndex (Mon=0)
    const weekStartMonBased=(jsDay+6)%7; // convert to Mon=0
    let diff=dayIndex-weekStartMonBased;
    if(diff<0)diff+=7;
    const d=new Date(weekStart);
    d.setDate(weekStart.getDate()+diff);
    return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
  }

  return(
    <div style={{background:"#2c2c2c",border:"1px solid #2a2a2a",borderRadius:6,overflow:"hidden",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",padding:"12px 16px",gap:12,cursor:"pointer",userSelect:"none"}} onClick={()=>setOpen(o=>!o)}>
        <span style={{fontFamily:"DM Mono,monospace",fontSize:11,letterSpacing:2,color:"#6b6b6b",textTransform:"uppercase",minWidth:70}}>Wk {week.weekNumber}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,color:"#f0ede6",fontWeight:600}}>{week.weekTitle}</div>
          {dateRange&&<div style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"#555",marginTop:2}}>{dateRange}</div>}
        </div>
        <IntensityBar value={week.intensity}/>
        <span style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"#555",marginLeft:8}}>{activeDays.length}d</span>
        <span style={{fontSize:12,color:"#555",transition:"transform 0.2s",transform:open?"rotate(180deg)":"none"}}>v</span>
      </div>
      {open&&(
        <div style={{padding:"0 16px 16px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:8}}>
          {week.days?.map((day,i)=>{
            const isTraining=day.type==="training"||day.type==="redpoint";
            const isSpecial=day.type==="redpoint";
            const dayDate=getDayDate(day.dayIndex);
            return(
              <div key={i}
                className={`day-card ${isTraining?"training":""}`}
                style={{borderColor:isSpecial?"rgba(212,168,67,0.4)":"#333",background:isSpecial?"rgba(212,168,67,0.05)":"rgba(0,0,0,0.2)",opacity:!isTraining?0.5:1,borderStyle:!isTraining?"dashed":"solid"}}
                onClick={()=>isTraining&&onLaunchDay&&onLaunchDay(day)}
              >
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{fontFamily:"DM Mono,monospace",fontSize:10,letterSpacing:2,color:isSpecial?"#d4a843":"#6b6b6b",textTransform:"uppercase"}}>{day.dayName}</div>
                  {dayDate&&<div style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"#555"}}>{dayDate}</div>}
                </div>
                <div style={{fontSize:13,color:"#f0ede6",fontWeight:600,marginBottom:4}}>{day.workoutTitle}</div>
                <div style={{fontSize:12,color:"#6b6b6b",lineHeight:1.5}}>{day.detail}</div>
                <div style={{marginTop:6}}>
                  {day.tags?.map(t=>(
                    <span key={t} style={{display:"inline-block",fontFamily:"DM Mono,monospace",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",padding:"2px 7px",borderRadius:2,marginTop:4,marginRight:4,background:tagBg[t]||tagBg.rest,color:tagColor[t]||tagColor.rest}}>{t}</span>
                  ))}
                </div>
                {isTraining&&<div className="day-card-launch">START SESSION</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ─── SESSION LAUNCH MODAL (program day → timer setup) ────────────────────────
function ProgramSessionModal({day, onStart, onClose}){
  const proto = dayDetailToProto(day);
  const[grip,setGrip]=useState(0);
  const[edge,setEdge]=useState("14mm");
  const[weight,setWeight]=useState(0);
  const totalTime=proto.sets*(proto.reps*proto.hangSeconds+(proto.reps-1)*proto.restBetweenHangs+proto.restBetweenSets);
  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal-sheet">
        <div className="settings-handle" style={{marginBottom:16}}/>
        <div className="modal-title">{day.workoutTitle}</div>
        <div className="modal-sub">{day.detail}</div>
        {/* Parsed proto preview */}
        <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
          {[{l:"Sets",v:proto.sets},{l:"Hang",v:`${proto.hangSeconds}s`},{l:"Rest/set",v:fmtTime(proto.restBetweenSets)},{l:"Est.",v:fmtTime(totalTime)}].map(({l,v})=>(
            <div key={l} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 14px",flex:1,minWidth:70}}>
              <div style={{fontFamily:"DM Mono,monospace",fontSize:9,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase",marginBottom:4}}>{l}</div>
              <div style={{fontFamily:"DM Mono,monospace",fontSize:16,color:"var(--chalk)",fontWeight:600}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:14}}>
          <span className="form-label">Grip Type</span>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {GRIPS.map((g,i)=><button key={g} className={`sel-chip ${grip===i?"active":""}`} style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setGrip(i)}>{g}</button>)}
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <span className="form-label">Edge Size</span>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {EDGE_SIZES.map(e=><button key={e} className={`sel-chip ${edge===e?"active":""}`} style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setEdge(e)}>{e}</button>)}
          </div>
        </div>
        <div style={{marginBottom:24}}>
          <span className="form-label">Added Weight / Assistance</span>
          <div style={{display:"flex",alignItems:"center",gap:16,paddingLeft:4}}>
            <button className="step-btn" onClick={()=>setWeight(w=>Math.round((w-2.5)*10)/10)}>−</button>
            <span style={{fontFamily:"DM Mono,monospace",fontSize:18,fontWeight:600,minWidth:60,textAlign:"center"}}>{weight>0?"+":""}{weight} kg</span>
            <button className="step-btn" onClick={()=>setWeight(w=>Math.round((w+2.5)*10)/10)}>+</button>
          </div>
        </div>
        <button className="start-btn" style={{margin:0,width:"100%"}} onClick={()=>{unlockAudio();onStart({proto,grip:GRIPS[grip],edge,weight,day});}}>
          START SESSION
        </button>
        <button onClick={onClose} style={{width:"100%",marginTop:10,padding:14,background:"none",border:"1px solid var(--border)",borderRadius:"var(--r)",color:"var(--muted)",fontFamily:"var(--font-mono)",fontSize:11,letterSpacing:2,cursor:"pointer",textTransform:"uppercase"}}>Cancel</button>
      </div>
    </div>
  );
}

// ─── SETTINGS SHEET ──────────────────────────────────────────────────────────
function SettingsSheet({cueSelections,setCueSelections,muted,setMuted,onClose}){
  const[openCue,setOpenCue]=useState("countdown");
  const{playPreview}=useSoundEngine(cueSelections,false);
  return(
    <div className="settings-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="settings-sheet">
        <div className="settings-handle"/>
        <div className="settings-title">SOUND SETTINGS</div>
        <div className="settings-subtitle">Pick a sound for each workout cue</div>
        <div className="mute-bar">
          <div><div className="mute-bar-left">Sound Cues {muted?"🔇":"🔊"}</div><div className="mute-bar-sub">Audible alerts during workout</div></div>
          <div className={`toggle-sw ${!muted?"on":""}`} onClick={()=>setMuted(m=>!m)}><div className="toggle-knob"/></div>
        </div>
        <div className="cue-list">
          {CUE_DEFS.map(cue=>{
            const isOpen=openCue===cue.key;
            const selId=cueSelections[cue.key]||cue.defaultId;
            const selSound=cue.sounds.find(s=>s.id===selId)||cue.sounds[0];
            return(
              <div key={cue.key} className={`cue-item ${isOpen?"open":""}`}>
                <div className="cue-header" onClick={()=>setOpenCue(isOpen?null:cue.key)}>
                  <span className="cue-icon-wrap">{cue.icon}</span>
                  <div className="cue-header-info"><div className="cue-header-name">{cue.label}</div><div className="cue-header-desc">{cue.desc}</div></div>
                  <span className="cue-selected-badge" style={{borderColor:selSound.color+"66",color:selSound.color,background:selSound.color+"18"}}>{selSound.name}</span>
                  <span className="cue-chevron">▼</span>
                </div>
                {isOpen&&(
                  <div className="sound-list">
                    {cue.sounds.map(sound=>{
                      const picked=selId===sound.id;
                      return(
                        <div key={sound.id} className={`sound-opt ${picked?"picked":""}`} style={{"--opt-col":sound.color}} onClick={()=>setCueSelections(prev=>({...prev,[cue.key]:sound.id}))}>
                          <div className="sound-dot" style={{background:sound.color}}/>
                          <div className="sound-opt-info"><div className="sound-opt-name" style={{color:picked?sound.color:"var(--text)"}}>{sound.name}</div><div className="sound-opt-desc">{sound.desc}</div></div>
                          <button className="play-btn" style={{"--opt-col":sound.color}} onClick={e=>{e.stopPropagation();playPreview(cue.key,sound.id);}}>Play</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="done-btn" onClick={onClose}>DONE</button>
      </div>
    </div>
  );
}

// ─── LANDING SCREEN ──────────────────────────────────────────────────────────
function LandingScreen({onSelect,savedPrograms}){
  const hasPrograms=savedPrograms&&savedPrograms.length>0;
  return(
    <div className="landing fade-up">
      <div className="landing-top">
        <div className="landing-logo-row">
          <div className="landing-logo-mark">H</div>
          <div className="landing-logo-text">HANG.io</div>
          <div className="landing-logo-sub">Training OS</div>
        </div>
        <div className="landing-headline">TRAIN<br/><em>SMARTER.</em><br/>SEND IT.</div>
        <p className="landing-sub">Structured finger strength training for climbers who are serious about their next project.</p>
      </div>
      <div className="landing-cards">
        <div className="lcard primary" onClick={()=>onSelect("new-program")}>
          <div className="lcard-icon">🎯</div>
          <div className="lcard-body"><div className="lcard-title">BUILD A PROGRAM</div><div className="lcard-desc">AI-generated periodized plan around your goal, timeline & schedule</div></div>
          <div className="lcard-arrow">›</div>
          <div className="lcard-badge">AI</div>
        </div>
        <div className="lcard" onClick={()=>onSelect("saved-programs")} style={{opacity:hasPrograms?1:0.5}}>
          <div className="lcard-icon">📋</div>
          <div className="lcard-body"><div className="lcard-title">MY PROGRAMS</div><div className="lcard-desc">{hasPrograms?`${savedPrograms.length} saved program${savedPrograms.length>1?"s":""} — pick up where you left off`:"No saved programs yet — build one above"}</div></div>
          <div className="lcard-arrow">›</div>
        </div>
        <div className="lcard" onClick={()=>onSelect("free-hang")}>
          <div className="lcard-icon">🪝</div>
          <div className="lcard-body"><div className="lcard-title">FREE HANG</div><div className="lcard-desc">Jump straight into a session — pick a protocol and go</div></div>
          <div className="lcard-arrow">›</div>
        </div>
        <div className="lcard" onClick={()=>onSelect("analytics")}>
          <div className="lcard-icon">📊</div>
          <div className="lcard-body"><div className="lcard-title">ANALYTICS</div><div className="lcard-desc">Charts & trends — volume, load, protocol breakdown & session notes</div></div>
          <div className="lcard-arrow">›</div>
        </div>
        <div className="lcard" onClick={()=>onSelect("settings")}>
          <div className="lcard-icon">🔊</div>
          <div className="lcard-body"><div className="lcard-title">SETTINGS</div><div className="lcard-desc">Customize sound cues for countdown, hang start, hang end & completion</div></div>
          <div className="lcard-arrow">›</div>
        </div>
      </div>
    </div>
  );
}

// ─── GOAL BUILDER ─────────────────────────────────────────────────────────────
function GoalBuilder({onBack,onSave}){
  const[step,setStep]=useState("form");
  const[formData,setFormData]=useState({goalType:"redpoint",goalDescription:"",currentGrade:"",targetGrade:"",peakDate:"",trainingDays:[0,2,4],hoursPerSession:"1",hangboardAccess:"Yes - wooden edges",injuryNotes:""});
  const[program,setProgram]=useState(null);
  const[streamText,setStreamText]=useState("");
  const[error,setError]=useState("");
  const minDate=new Date();minDate.setDate(minDate.getDate()+14);
  const minDateStr=minDate.toISOString().split("T")[0];
  const weeksUntilPeak=formData.peakDate?Math.round((new Date(formData.peakDate+"T00:00:00")-new Date(getStartDate(formData)+"T00:00:00"))/(7*24*3600*1000)):null;
  const toggleDay=i=>setFormData(f=>({...f,trainingDays:f.trainingDays.includes(i)?f.trainingDays.filter(d=>d!==i):[...f.trainingDays,i].sort()}));
  const validate=()=>{
    if(!formData.goalDescription.trim())return"Please describe your goal";
    if(!formData.currentGrade.trim())return"Please enter your current level";
    if(!formData.targetGrade.trim())return"Please enter your target level";
    if(!formData.peakDate)return"Please select a peak performance date";
    if(formData.trainingDays.length<2)return"Please select at least 2 training days";
    return null;
  };
  const generate=async()=>{
    const err=validate();if(err){setError(err);return;}
    setError("");setStep("loading");setStreamText("");
    const dots=["Building your program","Building your program.","Building your program..","Building your program..."];
    let di=0;const dInt=setInterval(()=>setStreamText(dots[di++%dots.length]),600);
    try{
      const requestBody=JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:8000,messages:[{role:"user",content:buildPrompt(formData)}]});
      const response=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:requestBody});
      clearInterval(dInt);
      if(!response.ok){let m=`API error ${response.status}`;try{const b=await response.json();m+=": "+(b?.error?.message||"").slice(0,200);}catch{}throw new Error(m);}
      const data=await response.json();
      const rawText=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
      if(!rawText)throw new Error("Empty response");
      setStep("streaming");
      let jsonStr=rawText.replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/i,"").trim();
      const fb=jsonStr.indexOf("{"),lb=jsonStr.lastIndexOf("}");
      if(fb===-1||lb===-1)throw new Error("No JSON found. Please try again.");
      jsonStr=jsonStr.slice(fb,lb+1);
      let parsed;
      try{parsed=JSON.parse(jsonStr);}catch{
        for(const sfx of["]}","]}]}","]}]}]}"]){try{parsed=JSON.parse(jsonStr+sfx);if(parsed)break;}catch{}}
        if(!parsed)throw new Error("Could not parse program. Please try again.");
      }
      if(!parsed.programName||!Array.isArray(parsed.phases)||!parsed.phases.length)throw new Error("Incomplete program. Please try again.");
      setProgram(parsed);setStep("program");
    }catch(e){clearInterval(dInt);setError("Failed to generate program: "+e.message);setStep("form");}
  };
  const handleSave=()=>{if(program)onSave({...program,formData,savedAt:new Date().toISOString()});};
  return(
    <div className="goal-shell fade-up">
      <div className="goal-header">
        <button className="back-btn" onClick={onBack}>Back</button>
        <div><div className="goal-header-title">BUILD A PROGRAM</div><div className="goal-header-sub">AI-powered periodization engine</div></div>
      </div>
      <div className="goal-scroll">
        {(step==="form"||step==="loading"||step==="streaming")&&(
          <>
            <div className="form-section">
              <span className="form-label">Goal Type</span>
              <div className="goal-type-grid">{GOAL_TYPES.map(g=><div key={g.id} className={`goal-card ${formData.goalType===g.id?"selected":""}`} onClick={()=>setFormData(f=>({...f,goalType:g.id}))}><div className="goal-card-icon">{g.icon}</div><div className="goal-card-label">{g.label}</div></div>)}</div>
            </div>
            <div className="form-section"><span className="form-label">Describe Your Goal</span><textarea className="goal-input" rows={3} placeholder="e.g. Send 'The Mandala' V12 at Bishop..." value={formData.goalDescription} onChange={e=>setFormData(f=>({...f,goalDescription:e.target.value}))} style={{resize:"vertical"}}/></div>
            <div className="goal-input-grid form-section" style={{marginBottom:16}}>
              <div><span className="form-label">Current Grade</span><input className="goal-input" placeholder="e.g. V8 / 5.12a" value={formData.currentGrade} onChange={e=>setFormData(f=>({...f,currentGrade:e.target.value}))}/></div>
              <div><span className="form-label">Target Grade</span><input className="goal-input" placeholder="e.g. V10 / 5.13a" value={formData.targetGrade} onChange={e=>setFormData(f=>({...f,targetGrade:e.target.value}))}/></div>
            </div>
            <div className="goal-input-grid form-section" style={{marginBottom:16}}>
              <div>
                <span className="form-label">Peak Date</span>
                <input type="date" className="goal-input" min={minDateStr} value={formData.peakDate} onChange={e=>setFormData(f=>({...f,peakDate:e.target.value}))}/>
                {weeksUntilPeak&&<span style={{fontFamily:"DM Mono,monospace",fontSize:10,color:weeksUntilPeak<4?"#e74c3c":"#6ab04c",display:"block",marginTop:4}}>{weeksUntilPeak} weeks out</span>}
              </div>
              <div><span className="form-label">Hours/Session</span>
                <select className="goal-input" value={formData.hoursPerSession} onChange={e=>setFormData(f=>({...f,hoursPerSession:e.target.value}))}>
                  <option value="0.5">30 min</option><option value="1">1 hr</option><option value="1.5">1.5 hr</option><option value="2">2 hr</option><option value="2.5">2.5+ hr</option>
                </select>
              </div>
            </div>
            <div className="form-section">
              <span className="form-label">Start Date <span style={{color:"var(--muted)",fontWeight:300,letterSpacing:1}}>(optional)</span></span>
              <input type="date" className="goal-input" min={new Date().toISOString().split("T")[0]} max={formData.peakDate||undefined} value={formData.startDate} onChange={e=>setFormData(f=>({...f,startDate:e.target.value}))}/>
              <span style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"var(--muted)",display:"block",marginTop:4}}>
                {formData.startDate
                  ? `Starting ${new Date(formData.startDate+"T00:00:00").toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}`
                  : `Leave blank to start on your next ${DAY_FULL[formData.trainingDays[0]]||"training day"}`}
              </span>
            </div>
            <div className="form-section"><span className="form-label">Training Days</span><div className="days-grid">{DAYS_OF_WEEK.map((d,i)=><button key={i} className={`day-btn ${formData.trainingDays.includes(i)?"active":""}`} onClick={()=>toggleDay(i)}>{d}</button>)}</div></div>
            <div className="goal-input-grid form-section" style={{marginBottom:16}}>
              <div><span className="form-label">Hangboard</span>
                <select className="goal-input" value={formData.hangboardAccess} onChange={e=>setFormData(f=>({...f,hangboardAccess:e.target.value}))}>
                  <option>Yes - wooden edges</option><option>Yes - plastic campus rungs</option><option>Yes - full hangboard setup</option><option>No - gym only</option><option>No - bodyweight only</option>
                </select>
              </div>
              <div><span className="form-label">Injury Notes</span><input className="goal-input" placeholder="e.g. A2 pulley..." value={formData.injuryNotes} onChange={e=>setFormData(f=>({...f,injuryNotes:e.target.value}))}/></div>
            </div>
            {error&&<div className="error-msg">{error}</div>}
            {step==="form"&&<button className="generate-btn" onClick={generate}>Generate Program</button>}
            {(step==="loading"||step==="streaming")&&(
              <div style={{textAlign:"center",padding:"28px 0"}}>
                <div className="loading-rings"><div className="loading-ring"/><div className="loading-ring"/><div className="loading-ring"/></div>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:11,letterSpacing:3,color:"#6b6b6b",textTransform:"uppercase",marginTop:12}}>{streamText||"Building your program..."}</div>
              </div>
            )}
          </>
        )}
        {step==="program"&&program&&(
          <ProgramOutput program={program} formData={formData} onEdit={()=>setStep("form")} onSave={handleSave}/>
        )}
      </div>
    </div>
  );
}

// ─── PROGRAM OUTPUT ──────────────────────────────────────────────────────────
function ProgramOutput({program,formData,onEdit,onSave,onUpdateProgram,cueSelections,muted,setMuted,sessions,setSessions}){
  const[launchDay,setLaunchDay]=useState(null);
  const[runSession,setRunSession]=useState(null);
  const[completedSession,setCompletedSession]=useState(null);
  const[adaptState,setAdaptState]=useState("idle"); // idle | confirm | loading | error
  const[adaptErr,setAdaptErr]=useState("");
  const adaptWeek=currentProgramWeek(program);
  const loggedCount=(sessions||[]).length;
  const runAdapt=async()=>{
    setAdaptState("loading");setAdaptErr("");
    try{
      const body=JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:16000,messages:[{role:"user",content:buildAdaptPrompt(program,sessions||[])}]});
      const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body});
      if(!res.ok){let m=`API error ${res.status}`;try{const b=await res.json();m+=": "+(b?.error?.message||"").slice(0,200);}catch{/* no body */}throw new Error(m);}
      const data=await res.json();
      const rawText=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
      const parsed=parseProgramJson(rawText);
      onUpdateProgram({...parsed,formData:program.formData,savedAt:program.savedAt,adaptedAt:new Date().toISOString()});
      setAdaptState("idle");
    }catch(e){setAdaptErr(e.message);setAdaptState("error");}
  };

  const handleLaunchDay=day=>setLaunchDay(day);
  const handleModalStart=({proto,grip,edge,weight,day})=>{
    unlockAudio(); // must happen inside the tap gesture or iOS blocks all cues
    setLaunchDay(null);
    setRunSession({proto,grip,edge,weight,day});
  };
  const handleSessionComplete=session=>{
    // Not saved yet — CompleteScreen is an approval step; save happens on approve
    const s={...session,protocol:session.proto?.name||"Program Workout",grip:runSession?.grip,edge:runSession?.edge,addedWeight:runSession?.weight||0,date:new Date().toISOString(),fromProgram:program.programName,programDay:runSession?.day?.workoutTitle};
    setCompletedSession(s);setRunSession(null);
  };

  if(runSession)return(
    <div className="app">
      <WorkoutScreen proto={runSession.proto} grip={runSession.grip} edge={runSession.edge} addedWeight={runSession.weight||0}
        cueSelections={cueSelections||getDefaultCueSelections()} muted={muted||false} setMuted={setMuted||(_=>{})}
        onComplete={handleSessionComplete} onExit={()=>setRunSession(null)}/>
    </div>
  );
  if(completedSession)return(
    <div className="app">
      <CompleteScreen session={completedSession} onDone={()=>setCompletedSession(null)} setSessions={setSessions}/>
    </div>
  );

  return(
    <>
      {launchDay&&<ProgramSessionModal day={launchDay} onStart={handleModalStart} onClose={()=>setLaunchDay(null)}/>}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div>
          <div style={{fontFamily:"DM Mono,monospace",fontSize:10,letterSpacing:3,color:"#e05c34",textTransform:"uppercase",marginBottom:4}}>Your Program</div>
          <div style={{fontFamily:"Bebas Neue,sans-serif",fontSize:32,letterSpacing:2,color:"#f0ede6"}}>{program.programName}</div>
        </div>
        {(onEdit||onSave)&&<div style={{display:"flex",gap:8}}>
          {onEdit&&<button className="regen-btn" onClick={onEdit}>Back</button>}
          {onSave&&<button className="regen-btn" style={{background:"rgba(255,77,0,0.1)",borderColor:"rgba(255,77,0,0.4)",color:"#FF4D00"}} onClick={onSave}>Save ✓</button>}
        </div>}
      </div>
      <div style={{background:"rgba(224,92,52,0.08)",border:"1px solid rgba(224,92,52,0.25)",borderRadius:8,padding:"10px 14px",marginBottom:20,display:"flex",gap:8,alignItems:"center"}}>
        <span style={{fontSize:16}}>👆</span>
        <span style={{fontSize:12,color:"#e05c34"}}>Tap any training day to launch its session directly in the timer</span>
      </div>
      {onUpdateProgram&&(
        <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px",marginBottom:20}}>
          {adaptState==="idle"&&(
            <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"space-between",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--chalk)"}}>⟳ Adapt from analytics</div>
                <div style={{fontSize:12,color:"var(--muted)",marginTop:3}}>{loggedCount?`Rebuilds week ${adaptWeek} onward from your ${loggedCount} logged session${loggedCount!==1?"s":""}. Past weeks stay unchanged.`:"Log some sessions first — there's no training data to adapt from yet."}</div>
                {program.adaptedAt&&<div style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"var(--muted)",marginTop:4}}>Last adapted {new Date(program.adaptedAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>}
              </div>
              <button onClick={()=>loggedCount&&setAdaptState("confirm")} style={{background:loggedCount?"rgba(224,92,52,0.12)":"var(--surface2)",border:`1px solid ${loggedCount?"rgba(224,92,52,0.4)":"var(--border)"}`,borderRadius:8,color:loggedCount?"#e05c34":"var(--muted)",padding:"10px 14px",fontFamily:"Bebas Neue,sans-serif",fontSize:14,letterSpacing:"0.05em",cursor:loggedCount?"pointer":"default"}}>ADAPT</button>
            </div>
          )}
          {adaptState==="confirm"&&(
            <div>
              <div style={{fontSize:13,color:"var(--chalk)",lineHeight:1.5,marginBottom:12}}>The AI coach will review your session history — consistency, volume trend, early quits — and rewrite week {adaptWeek} onward: progressing the plan if you're training well, dialing it back if you've missed sessions. Weeks already behind you don't change.</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={runAdapt} style={{flex:1,background:"var(--accent)",border:"none",borderRadius:8,color:"#fff",padding:"10px 14px",fontFamily:"Bebas Neue,sans-serif",fontSize:15,letterSpacing:"0.05em",cursor:"pointer"}}>ADAPT NOW</button>
                <button onClick={()=>setAdaptState("idle")} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,color:"var(--muted)",padding:"10px 14px",fontFamily:"Bebas Neue,sans-serif",fontSize:15,letterSpacing:"0.05em",cursor:"pointer"}}>CANCEL</button>
              </div>
            </div>
          )}
          {adaptState==="loading"&&<div style={{fontFamily:"DM Mono,monospace",fontSize:12,color:"#e05c34",letterSpacing:1}}>⟳ Re-coaching your program from session data…</div>}
          {adaptState==="error"&&(
            <div>
              <div style={{fontSize:12,color:"#e74c3c",marginBottom:8}}>Adapt failed: {adaptErr}</div>
              <button onClick={runAdapt} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",padding:"8px 12px",fontSize:12,cursor:"pointer"}}>Retry</button>
            </div>
          )}
        </div>
      )}
      <div className="program-summary-grid">
        <div className="sum-cell"><div className="sum-label">Weeks</div><div className="sum-val accent">{program.totalWeeks}</div></div>
        <div className="sum-cell"><div className="sum-label">Phases</div><div className="sum-val">{program.phases?.length}</div></div>
        <div className="sum-cell"><div className="sum-label">Goal</div><div className="sum-val" style={{fontSize:16,paddingTop:4}}>{GOAL_TYPES.find(g=>g.id===formData?.goalType)?.icon} {GOAL_TYPES.find(g=>g.id===formData?.goalType)?.label}</div></div>
        <div className="sum-cell"><div className="sum-label">Peak Date</div><div className="sum-val" style={{fontSize:14,paddingTop:6}}>{formData?.peakDate?new Date(formData.peakDate+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"-"}</div></div>
      </div>
      {program.summary&&<div style={{fontSize:13,color:"#6b6b6b",lineHeight:1.6,marginBottom:20,padding:"10px 14px",background:"rgba(255,255,255,0.03)",borderLeft:"2px solid #e05c34",borderRadius:"0 4px 4px 0"}}>{program.summary}</div>}
      {program.phases?.map((phase,pi)=>(
        <div key={pi} className="program-section">
          <div className="phase-header-row">
            <span className="phase-num-badge">Phase {phase.phaseNumber}</span>
            <span className="phase-name-text">{phase.phaseName}</span>
            <span className="phase-weeks-text">Wk {phase.startWeek}–{phase.endWeek}</span>
          </div>
          {phase.description&&<div className="phase-desc-block">{phase.description}</div>}
          {phase.weeks?.map((week,wi)=><WeekRow key={wi} week={week} onLaunchDay={handleLaunchDay} programStartDate={program.startDate||program.formData?.startDate}/>)}
        </div>
      ))}
      {program.keyPrinciples?.length>0&&(
        <div style={{background:"#2c2c2c",border:"1px solid #2a2a2a",borderRadius:8,padding:20,marginBottom:24}}>
          <div style={{fontFamily:"Bebas Neue,sans-serif",fontSize:18,letterSpacing:2,color:"#f0ede6",marginBottom:12}}>Program Principles</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {program.keyPrinciples.map((p,i)=><div key={i} style={{display:"flex",gap:8,fontSize:12,color:"var(--muted)",lineHeight:1.5}}><div style={{width:5,height:5,borderRadius:"50%",background:"var(--ember)",flexShrink:0,marginTop:5}}/><span>{p}</span></div>)}
          </div>
        </div>
      )}
    </>
  );
}

// ─── SAVED PROGRAMS ───────────────────────────────────────────────────────────
function SavedProgramsView({programs,onBack,onOpen,onDelete}){
  return(
    <div className="saved-shell fade-up">
      <div className="goal-header">
        <button className="back-btn" onClick={onBack}>Back</button>
        <div><div className="goal-header-title">MY PROGRAMS</div><div className="goal-header-sub">{programs.length} saved program{programs.length!==1?"s":""}</div></div>
      </div>
      {programs.length===0?(
        <div className="empty-state"><span className="icon">📋</span><p>No saved programs yet. Build a goal-based program to see it here.</p></div>
      ):(
        <div className="saved-list">
          {programs.map((p,i)=>(
            <div key={i} className="saved-card" onClick={()=>onOpen(p)}>
              <div className="saved-card-title">{p.programName}</div>
              <div className="saved-card-meta">Saved {new Date(p.savedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
              <div className="saved-card-tags">
                <span className="saved-tag">{p.totalWeeks} weeks</span>
                <span className="saved-tag">{p.phases?.length} phases</span>
                {p.formData&&<span className="saved-tag">{GOAL_TYPES.find(g=>g.id===p.formData.goalType)?.icon} {GOAL_TYPES.find(g=>g.id===p.formData.goalType)?.label}</span>}
                {p.formData?.peakDate&&<span className="saved-tag">Peak {new Date(p.formData.peakDate+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
              </div>
              <button onClick={e=>{e.stopPropagation();onDelete(i);}} style={{marginTop:10,background:"none",border:"1px solid #2a2a2a",color:"#555",padding:"4px 10px",borderRadius:5,fontSize:11,cursor:"pointer",fontFamily:"DM Mono,monospace",letterSpacing:1}}>DELETE</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SavedProgramDetail({program,onBack,onUpdateProgram,cueSelections,muted,setMuted,sessions,setSessions}){
  return(
    <div className="saved-shell fade-up">
      <div className="goal-header">
        <button className="back-btn" onClick={onBack}>Back</button>
        <div><div className="goal-header-title" style={{fontSize:18}}>{program.programName}</div><div className="goal-header-sub">{program.totalWeeks} weeks · {program.phases?.length} phases</div></div>
      </div>
      <div className="goal-scroll">
        <ProgramOutput program={program} formData={program.formData} onUpdateProgram={onUpdateProgram} cueSelections={cueSelections} muted={muted} setMuted={setMuted} sessions={sessions} setSessions={setSessions}/>
      </div>
    </div>
  );
}

// ─── FREE HANG VIEW ──────────────────────────────────────────────────────────
function FreeHangView({onBack,cueSelections,muted,setMuted,sessions,setSessions}){
  const[tab,setTab]=useState("train");
  const[workoutState,setWorkoutState]=useState("idle");
  const[selectedProto,setSelectedProto]=useState(0);
  const[selectedGrip,setSelectedGrip]=useState(0);
  const[selectedEdge,setSelectedEdge]=useLocalStorage("hb_edge","12mm");
  const[customEdges,setCustomEdges]=useLocalStorage("hb_custom_edges",[]);
  const[addedWeight,setAddedWeight]=useState(0);
  const[customProto,setCustomProto]=useLocalStorage("hb_custom",{sets:4,hangSeconds:7,restBetweenHangs:7,restBetweenSets:120,reps:7});
  const[savedProtos,setSavedProtos]=useLocalStorage("hb_saved_protos",[]);
  const[setsOverride,setSetsOverride]=useState(null);
  const[repsOverride,setRepsOverride]=useState(null);
  const[completedSession,setCompletedSession]=useState(null);
  const allProtos=[...PROTOCOLS,...savedProtos]; // indexes 0-4 built-in (4=custom), 5+ saved customs
  const baseProto=selectedProto===4?{...PROTOCOLS[4],...customProto}:(allProtos[selectedProto]||PROTOCOLS[0]);
  const proto=selectedProto!==4?{...baseProto,...(setsOverride!=null?{sets:setsOverride}:{}),...(repsOverride!=null?{reps:repsOverride}:{})}:baseProto;
  const clearOverrides=()=>{setSetsOverride(null);setRepsOverride(null);};
  const saveProto=name=>{
    const n=name.trim();if(!n)return;
    const palette=["#B07CFF","#00D4FF","#A8FF3E","#FFD600","#FF8C42"];
    setSavedProtos(prev=>{
      const p={id:`saved-${Date.now()}`,name:n,subtitle:"Saved protocol",description:"",color:palette[prev.length%palette.length],...customProto};
      const existing=prev.findIndex(sp=>sp.name.toLowerCase()===n.toLowerCase());
      if(existing>=0){const next=[...prev];next[existing]={...next[existing],...customProto,name:n};setSelectedProto(5+existing);return next;}
      setSelectedProto(5+prev.length);
      return[...prev,p];
    });
    clearOverrides();
  };
  const deleteSavedProto=i=>{ // i = index within savedProtos
    setSavedProtos(prev=>prev.filter((_,j)=>j!==i));
    if(selectedProto===5+i)setSelectedProto(0);
    else if(selectedProto>5+i)setSelectedProto(s=>s-1);
    clearOverrides();
  };

  const handleSessionComplete=session=>{
    // Not saved yet — CompleteScreen is an approval step; save happens on approve
    const s={...session,protocol:proto.name,grip:GRIPS[selectedGrip],edge:selectedEdge,addedWeight,date:new Date().toISOString()};
    setCompletedSession(s);setWorkoutState("complete");
  };
  if(workoutState==="running")return(<div className="app"><WorkoutScreen proto={proto} grip={GRIPS[selectedGrip]} edge={selectedEdge} addedWeight={addedWeight} cueSelections={cueSelections} muted={muted} setMuted={setMuted} onComplete={handleSessionComplete} onExit={()=>setWorkoutState("idle")}/></div>);
  if(workoutState==="complete"&&completedSession)return(<div className="app"><CompleteScreen session={completedSession} onDone={()=>{setWorkoutState("idle");setTab("history");}} setSessions={setSessions}/></div>);
  return(
    <div className="app fade-up">
      <div className="scroll">
        <div className="page-header" style={{paddingBottom:8}}>
          <button className="back-btn" onClick={onBack} style={{marginBottom:12}}>Back</button>
          <div className="page-title">FREE<br/>HANG</div>
          <div className="page-sub">Single session — no program needed</div>
        </div>
        {tab==="train"&&<TrainTab protocols={allProtos} selectedProto={selectedProto} setSelectedProto={i=>{setSelectedProto(i);clearOverrides();}} onAdjustSets={d=>setSetsOverride(v=>Math.max(1,Math.min(12,(v??allProtos[selectedProto].sets)+d)))} onAdjustReps={d=>setRepsOverride(v=>Math.max(1,Math.min(12,(v??allProtos[selectedProto].reps)+d)))} onSaveProto={saveProto} onDeleteProto={deleteSavedProto} selectedGrip={selectedGrip} setSelectedGrip={setSelectedGrip} selectedEdge={selectedEdge} setSelectedEdge={setSelectedEdge} customEdges={customEdges} setCustomEdges={setCustomEdges} addedWeight={addedWeight} setAddedWeight={setAddedWeight} customProto={customProto} setCustomProto={setCustomProto} proto={proto} onStart={()=>{unlockAudio();setWorkoutState("running");}}/>}
        {tab==="history"&&<HistoryTab sessions={sessions} onClear={()=>setSessions([])}/>}
        {tab==="progress"&&<ProgressTab sessions={sessions}/>}
      </div>
      <nav className="nav">
        {[{id:"train",label:"Train",icon:icons.train},{id:"history",label:"History",icon:icons.history},{id:"progress",label:"Progress",icon:icons.chart}].map(n=>(
          <button key={n.id} className={`nav-btn ${tab===n.id?"active":""}`} onClick={()=>setTab(n.id)}>{n.icon}{n.label}<div className="nav-dot"/></button>
        ))}
      </nav>
    </div>
  );
}

// ─── TRAIN TAB ───────────────────────────────────────────────────────────────
// Graduated seconds ladder: 3–20s by 1s, 20–60s by 10s, 60–300s by 30s
function stepSeconds(v,d){
  return d>0
    ?(v<20?v+1:v<60?Math.min(60,v+10):v+30)
    :(v>60?Math.max(60,v-30):v>20?Math.max(20,v-10):v-1);
}
function TrainTab({protocols,selectedProto,setSelectedProto,onAdjustSets,onAdjustReps,onSaveProto,onDeleteProto,selectedGrip,setSelectedGrip,selectedEdge,setSelectedEdge,customEdges,setCustomEdges,addedWeight,setAddedWeight,customProto,setCustomProto,proto,onStart}){
  const[showCustom,setShowCustom]=useState(false);
  const[customInput,setCustomInput]=useState("");
  const[customErr,setCustomErr]=useState("");
  const[protoName,setProtoName]=useState("");
  const allEdges=[...EDGE_SIZES,...customEdges];
  const totalTime=proto.sets*(proto.reps*proto.hangSeconds+(proto.reps-1)*proto.restBetweenHangs+proto.restBetweenSets);
  const addEdge=()=>{
    const raw=customInput.trim();if(!raw){setCustomErr("Enter a size");return;}
    const n=/^\d+(\.\d+)?$/.test(raw)?`${raw}mm`:raw;
    if(allEdges.includes(n)){setSelectedEdge(n);setShowCustom(false);setCustomInput("");return;}
    setCustomEdges(prev=>[...prev,n]);setSelectedEdge(n);setShowCustom(false);setCustomInput("");setCustomErr("");
  };
  return(
    <>
      <p className="section-title">Protocol</p>
      {protocols.map((p,i)=>(
        <div key={p.id} className={`protocol-card ${selectedProto===i?"selected":""}`} style={{"--sel-color":p.color}} onClick={()=>setSelectedProto(i)}>
          <div className="proto-dot" style={{background:p.color}}/>
          <div className="proto-info">
            <div className="proto-name">{p.name}</div>
            <div className="proto-sub">{p.subtitle}</div>
            {p.description&&<div className="proto-desc">{p.description}</div>}
            {i!==4&&<div className="proto-meta">{p.sets} sets · {p.reps}×{p.hangSeconds}s hang · {p.restBetweenSets}s rest</div>}
          </div>
          {i>=5?(
            <span onClick={ev=>{ev.stopPropagation();onDeleteProto(i-5);}} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:"50%",background:"var(--surface2)",color:"var(--muted)",fontSize:10,cursor:"pointer",flexShrink:0}}>✕</span>
          ):(
            <span style={{fontSize:20,color:"var(--muted)"}}>›</span>
          )}
        </div>
      ))}
      {selectedProto===4&&(
        <><p className="section-title" style={{marginTop:4}}>Custom Settings</p>
        <div className="card">
          {[{label:"Hang Time (s)",key:"hangSeconds",min:3,max:20,ladder:false},{label:"Rest Time (s)",key:"restBetweenHangs",min:3,max:300,ladder:true},{label:"Reps/set",key:"reps",min:1,max:12,ladder:false},{label:"Sets",key:"sets",min:1,max:12,ladder:false},{label:"Rest/set (s)",key:"restBetweenSets",min:30,max:300,ladder:true}].map(({label,key,min,max,ladder})=>(
            <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <span style={{fontSize:14,color:"var(--muted)"}}>{label}</span>
              <div className="stepper">
                <button className="step-btn" onClick={()=>setCustomProto(p=>({...p,[key]:Math.max(min,Math.min(max,ladder?stepSeconds(p[key],-1):p[key]-1))}))}>−</button>
                <span style={{fontFamily:"DM Mono,monospace",fontSize:18,fontWeight:600,minWidth:48,textAlign:"center"}}>{customProto[key]}</span>
                <button className="step-btn" onClick={()=>setCustomProto(p=>({...p,[key]:Math.max(min,Math.min(max,ladder?stepSeconds(p[key],1):p[key]+1))}))}>+</button>
              </div>
            </div>
          ))}
          <div style={{borderTop:"1px solid var(--border)",paddingTop:14,marginTop:2}}>
            <div style={{fontSize:12,color:"var(--muted)",marginBottom:8}}>Save this protocol to the menu:</div>
            <div style={{display:"flex",gap:8}}>
              <input type="text" value={protoName} onChange={e=>setProtoName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&protoName.trim()){onSaveProto(protoName);setProtoName("");}}} placeholder="Protocol name" style={{flex:1,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 14px",color:"var(--text)",fontFamily:"DM Mono,monospace",fontSize:14,outline:"none",minWidth:0}}/>
              <button onClick={()=>{if(protoName.trim()){onSaveProto(protoName);setProtoName("");}}} style={{background:protoName.trim()?"var(--accent)":"var(--surface2)",border:"none",borderRadius:10,color:protoName.trim()?"#fff":"var(--muted)",padding:"10px 16px",fontFamily:"Bebas Neue,sans-serif",fontSize:15,letterSpacing:"0.05em",cursor:"pointer"}}>SAVE</button>
            </div>
          </div>
        </div></>
      )}
      <p className="section-title" style={{marginTop:8}}>Grip Type</p>
      <div className="select-row">{GRIPS.map((g,i)=><button key={g} className={`sel-chip ${selectedGrip===i?"active":""}`} onClick={()=>setSelectedGrip(i)}>{g}</button>)}</div>
      <p className="section-title" style={{marginTop:8}}>Edge Size</p>
      <div className="select-row">
        {EDGE_SIZES.map(e=><button key={e} className={`sel-chip ${selectedEdge===e?"active":""}`} onClick={()=>{setSelectedEdge(e);setShowCustom(false);}}>{e}</button>)}
        {customEdges.map(e=>(
          <button key={e} className={`sel-chip ${selectedEdge===e?"active":""}`} onClick={()=>{setSelectedEdge(e);setShowCustom(false);}} style={{display:"flex",alignItems:"center",gap:5}}>
            {e}<span onClick={ev=>{ev.stopPropagation();setCustomEdges(prev=>prev.filter(ce=>ce!==e));if(selectedEdge===e)setSelectedEdge(EDGE_SIZES[2]);}} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:14,height:14,borderRadius:"50%",background:selectedEdge===e?"rgba(255,255,255,0.3)":"var(--muted)",color:"#fff",fontSize:9,cursor:"pointer"}}>✕</span>
          </button>
        ))}
        <button className={`sel-chip ${showCustom?"active":""}`} onClick={()=>{setShowCustom(v=>!v);setCustomErr("");setCustomInput("");}} style={{borderStyle:"dashed"}}>+ Custom</button>
      </div>
      {showCustom&&(
        <div style={{margin:"0 20px 12px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--r)",padding:"14px 16px"}}>
          <div style={{fontSize:12,color:"var(--muted)",marginBottom:10}}>Enter a number (auto-adds "mm") or any label</div>
          <div style={{display:"flex",gap:8}}>
            <input type="text" value={customInput} onChange={e=>{setCustomInput(e.target.value);setCustomErr("");}} onKeyDown={e=>{if(e.key==="Enter")addEdge();if(e.key==="Escape")setShowCustom(false);}} placeholder="e.g. 11 or 6.5mm" autoFocus style={{flex:1,background:"var(--surface2)",border:`1px solid ${customErr?"#FF4D00":"var(--border)"}`,borderRadius:10,padding:"10px 14px",color:"var(--text)",fontFamily:"DM Mono,monospace",fontSize:15,outline:"none"}}/>
            <button onClick={addEdge} style={{background:"var(--accent)",border:"none",borderRadius:10,color:"#fff",padding:"10px 18px",fontFamily:"Bebas Neue,sans-serif",fontSize:16,letterSpacing:"0.05em",cursor:"pointer"}}>ADD</button>
          </div>
          {customErr&&<div style={{fontSize:12,color:"var(--accent)",marginTop:6}}>{customErr}</div>}
        </div>
      )}
      <p className="section-title" style={{marginTop:8}}>Added Weight</p>
      <div className="card" style={{margin:"0 20px 12px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:12,color:"var(--muted)"}}>Assistance / Added Load</div><div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>Negative = assisted, Positive = added weight</div></div>
          <div className="stepper">
            <button className="step-btn" onClick={()=>setAddedWeight(w=>Math.round((w-2.5)*10)/10)}>−</button>
            <span style={{fontFamily:"DM Mono,monospace",fontSize:14,fontWeight:600,minWidth:56,textAlign:"center"}}>{addedWeight>0?"+":""}{addedWeight}<br/><span style={{fontSize:10,color:"var(--muted)"}}>kg</span></span>
            <button className="step-btn" onClick={()=>setAddedWeight(w=>Math.round((w+2.5)*10)/10)}>+</button>
          </div>
        </div>
      </div>
      <p className="section-title" style={{marginTop:8}}>Session Preview</p>
      <div className="setup-row">
        <div className="setup-chip">Sets
          <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <button onClick={()=>selectedProto===4?setCustomProto(p=>({...p,sets:Math.max(1,p.sets-1)})):onAdjustSets(-1)} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:6,color:"var(--text)",width:22,height:22,lineHeight:1,fontSize:14,cursor:"pointer",padding:0}}>−</button>
            <strong>{proto.sets}</strong>
            <button onClick={()=>selectedProto===4?setCustomProto(p=>({...p,sets:Math.min(12,p.sets+1)})):onAdjustSets(1)} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:6,color:"var(--text)",width:22,height:22,lineHeight:1,fontSize:14,cursor:"pointer",padding:0}}>+</button>
          </span>
        </div>
        <div className="setup-chip">Reps
          <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <button onClick={()=>selectedProto===4?setCustomProto(p=>({...p,reps:Math.max(1,p.reps-1)})):onAdjustReps(-1)} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:6,color:"var(--text)",width:22,height:22,lineHeight:1,fontSize:14,cursor:"pointer",padding:0}}>−</button>
            <strong>{proto.reps}×{proto.hangSeconds}s</strong>
            <button onClick={()=>selectedProto===4?setCustomProto(p=>({...p,reps:Math.min(12,p.reps+1)})):onAdjustReps(1)} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:6,color:"var(--text)",width:22,height:22,lineHeight:1,fontSize:14,cursor:"pointer",padding:0}}>+</button>
          </span>
        </div>
        <div className="setup-chip">Total<strong>{fmtTime(totalTime)}</strong></div>
      </div>
      <button className="start-btn" onClick={onStart}>START SESSION</button>
      <div style={{height:8}}/>
    </>
  );
}

// ─── WORKOUT SCREEN ──────────────────────────────────────────────────────────
function WorkoutScreen({proto,grip,edge,addedWeight,cueSelections,muted,setMuted,onComplete,onExit}){
  const CIRC=2*Math.PI*120;
  const PRE_START=10;
  const buildPhases=useCallback(()=>{
    const phases=[{type:"pre-start",duration:PRE_START,set:1,rep:1}];
    for(let s=0;s<proto.sets;s++){
      for(let r=0;r<proto.reps;r++){
        phases.push({type:"hang",duration:proto.hangSeconds,set:s+1,rep:r+1});
        if(r<proto.reps-1&&proto.restBetweenHangs>0)phases.push({type:"rest-short",duration:proto.restBetweenHangs,set:s+1,rep:r+1});
      }
      if(s<proto.sets-1)phases.push({type:"rest",duration:proto.restBetweenSets,set:s+1,rep:proto.reps});
    }
    return phases;
  },[proto]);
  const phases=useRef(buildPhases());
  const[phaseIdx,setPhaseIdx]=useState(0);
  const[timeLeft,setTimeLeft]=useState(phases.current[0]?.duration??PRE_START);
  const[paused,setPaused]=useState(false);
  const[elapsed,setElapsed]=useState(0);
  const intervalRef=useRef(null);
  const startRef=useRef(Date.now());
  const phaseIdxRef=useRef(0);
  const timeLeftRef=useRef(phases.current[0]?.duration??PRE_START);
  const pausedRef=useRef(false);
  const{play}=useSoundEngine(cueSelections,muted);
  const playRef=useRef(play);
  useEffect(()=>{playRef.current=play;},[play]);
  const cur=phases.current[phaseIdx];
  const isHang=cur?.type==="hang";
  const isPreStart=cur?.type==="pre-start";
  const nextPh=phases.current[phaseIdx+1];
  const countdownActive=(isPreStart||(!isHang&&nextPh?.type==="hang"))&&timeLeft<=3&&timeLeft>0;
  const phaseColor=isHang?proto.color:isPreStart?"#FFD600":"#666680";
  const ringColor=countdownActive?"#FFD600":phaseColor;
  const strokeOffset=CIRC*(1-(cur?timeLeft/cur.duration:0));
  const hangsCompleted=phases.current.slice(0,phaseIdx).filter(p=>p.type==="hang").length;
  const totalHangs=phases.current.filter(p=>p.type==="hang").length;
  useEffect(()=>{
    // Keep the AudioContext alive for the entire session. iOS/Safari suspends an idle
    // context between cues, which killed all audio after the first hang/rest cycle.
    // A continuous inaudible oscillator prevents suspension; visibilitychange + per-tick
    // resume() recover it if the OS suspends it anyway.
    let keepAlive=null;
    try{
      const kac=window.__hangio_ac;
      if(kac&&kac.state!=="closed"){
        keepAlive=kac.createOscillator();
        const kg=kac.createGain();
        kg.gain.value=0.0001;keepAlive.frequency.value=30;
        keepAlive.connect(kg);kg.connect(kac.destination);keepAlive.start();
      }
    }catch{/* audio unavailable — non-fatal */}
    // Screen wake lock: keep the phone awake for the whole session so long
    // rests don't auto-lock the screen (which also killed audio cues).
    let wakeLock=null;
    const acquireWake=async()=>{
      try{wakeLock=await navigator.wakeLock?.request("screen");}catch{/* unsupported or denied — non-fatal */}
    };
    acquireWake();
    const recover=()=>{
      const a=window.__hangio_ac;
      if(a&&a.state!=="running")a.resume().catch(()=>{});
      const s=window.__hangio_silence;
      if(s&&s.paused)s.play().catch(()=>{});
      // Wake locks auto-release when the page is hidden — re-acquire on return
      if(document.visibilityState==="visible"&&(!wakeLock||wakeLock.released))acquireWake();
    };
    document.addEventListener("visibilitychange",recover);
    document.addEventListener("pointerdown",recover,true);
    const tick=()=>{
      recover();
      if(pausedRef.current)return;
      const idx=phaseIdxRef.current;
      const t=timeLeftRef.current;
      const curPh=phases.current[idx];
      const ni=idx+1;
      const nPh=phases.current[ni];
      if(t<=1){
        if(ni>=phases.current.length){
          clearInterval(intervalRef.current);
          const dur=Math.round((Date.now()-startRef.current)/1000);
          playRef.current("complete");
          onComplete({duration:dur,sets:proto.sets,reps:proto.reps,totalHangs,proto});
          return;
        }
        if(nPh?.type==="hang")playRef.current("hangStart");
        else if(curPh?.type==="hang")playRef.current("hangEnd");
        // Announce the between-set rest as it begins ("Next set in …")
        if(curPh?.type==="hang"&&nPh?.type==="rest")playRef.current("restStart",{secs:nPh.duration});
        phaseIdxRef.current=ni;
        timeLeftRef.current=nPh.duration;
        setPhaseIdx(ni);
        setTimeLeft(nPh.duration);
        return;
      }
      const nextIsHang=nPh?.type==="hang";
      const curIsPreStart=curPh?.type==="pre-start";
      const curIsRest=curPh?.type==="rest"||curPh?.type==="rest-short";
      if((curIsPreStart||curIsRest)&&nextIsHang&&(t===4||t===3||t===2)){
        playRef.current("countdown",{n:t-1});
      }
      // 30-seconds-left warning during between-set rest: quick triple beep
      if(curPh?.type==="rest"&&t===31){
        [0,180,360].forEach(d=>setTimeout(()=>playRef.current("countdown"),d));
      }
      timeLeftRef.current=t-1;
      setTimeLeft(t-1);
      if(curPh?.type!=="pre-start")setElapsed(e=>e+1);
    };
    intervalRef.current=setInterval(tick,1000);
    return()=>{
      clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange",recover);
      document.removeEventListener("pointerdown",recover,true);
      try{if(keepAlive)keepAlive.stop();}catch{/* already stopped */}
      stopSilenceLoop();
      try{wakeLock?.release();}catch{/* already released */}
    };
  },[]);
  const handlePause=()=>{
    const next=!pausedRef.current;
    pausedRef.current=next;
    setPaused(next);
  };
  const handleQuit=()=>{
    const hc=phases.current.slice(0,phaseIdxRef.current).filter(p=>p.type==="hang").length;
    if(hc===0){onExit();return;} // nothing done — nothing to log
    const dur=Math.round((Date.now()-startRef.current)/1000);
    const setsDone=Math.max(1,phases.current[phaseIdxRef.current]?.set??1);
    onComplete({duration:dur,sets:setsDone,reps:proto.reps,totalHangs:hc,partial:true,proto});
  };
  const phaseLabel=isPreStart?"GET READY":isHang?"HANG":cur?.type==="rest"?"REST":"SHORT REST";
  const phaseSub=isPreStart?`First hang in ${timeLeft}s`:countdownActive?"GET READY":isHang?"HANG":cur?.type==="rest"?"REST":"SHORT REST";
  return(
    <div className="workout-screen">
      <div className="glow" style={{width:300,height:300,background:phaseColor,top:"30%",left:"50%",transform:"translateX(-50%)"}}/>
      <div className="mute-badge" onClick={()=>setMuted(m=>!m)}>{muted?"Muted":"Sound On"}</div>
      <div style={{textAlign:"center",zIndex:1}}>
        <div className="phase-label" style={{color:ringColor}}>{phaseLabel}</div>
        <div style={{fontSize:12,color:"var(--muted)",marginTop:3}}>{isPreStart?`${proto.name} · ${proto.sets} sets`:`Set ${cur?.set} of ${proto.sets}${proto.reps>1?` · Rep ${cur?.rep} of ${proto.reps}`:""}`}</div>
      </div>
      <div className="timer-ring" style={{zIndex:1}}>
        {(isHang||countdownActive)&&<div className="pulse-ring" style={{color:ringColor}}/>}
        <svg viewBox="0 0 260 260" width="260" height="260">
          <circle className="timer-ring-track" cx="130" cy="130" r="120"/>
          <circle className="timer-ring-prog" cx="130" cy="130" r="120" stroke={ringColor} strokeDasharray={CIRC} strokeDashoffset={strokeOffset}/>
        </svg>
        <div className="timer-center">
          <div className="timer-num" style={{color:ringColor,transition:"color 0.2s"}}>{timeLeft}</div>
          <div className="timer-phase-sub">{phaseSub}</div>
        </div>
      </div>
      <div className="workout-grip" style={{zIndex:1}}>
        <span style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.1em"}}>Grip / Edge</span>
        <strong>{grip} · {edge}{addedWeight!==0?` · ${addedWeight>0?"+":""}${addedWeight}kg`:""}</strong>
      </div>
      <div className="workout-meta" style={{zIndex:1}}>
        <div className="wm-item"><label>Hangs</label><span>{hangsCompleted}/{totalHangs}</span></div>
        <div className="wm-item"><label>Elapsed</label><span>{fmtTime(elapsed)}</span></div>
        <div className="wm-item"><label>Protocol</label><span style={{fontSize:12,lineHeight:1.3}}>{proto.name}</span></div>
      </div>
      <div className="control-row" style={{zIndex:1}}>
        <button className="ctrl-btn" onClick={handleQuit}>Quit</button>
        <button className="ctrl-btn primary" onClick={handlePause}>{paused?"Resume":"Pause"}</button>
      </div>
    </div>
  );
}
// ─── COMPLETE SCREEN + SESSION NOTES ────────────────────────────────────────
const EDIT_BTN_STYLE={background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:6,color:"var(--text)",width:22,height:22,lineHeight:1,fontSize:13,cursor:"pointer",padding:0,flexShrink:0};
function EditStat({label,value,display,onMinus,onPlus}){
  return(
    <div className="complete-stat"><label>{label}</label>
      <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        <button onClick={onMinus} style={EDIT_BTN_STYLE}>−</button>{display??value}<button onClick={onPlus} style={EDIT_BTN_STYLE}>+</button>
      </span>
    </div>
  );
}
function CompleteScreen({session,onDone,setSessions}){
  const[notes,setNotes]=useState("");
  const[saved,setSaved]=useState(false);
  // Approval step: values are editable until approved, then locked into history
  const[vals,setVals]=useState({sets:session.sets??0,totalHangs:session.totalHangs??0,duration:session.duration??0});
  const adj=(key,d)=>setVals(v=>({...v,[key]:Math.max(0,v[key]+d)}));
  const isPartial=!!session.partial;

  const handleApprove=()=>{
    if(setSessions){
      const final={...session,...vals,notes:notes.trim()||undefined,approved:true};
      setSessions(prev=>[final,...prev]);
    }
    setSaved(true);
    setTimeout(onDone,800);
  };

  return(
    <div className="complete-screen">
      <div className="glow" style={{width:300,height:300,background:isPartial?"#FFD600":"#A8FF3E",top:"30%",left:"50%",transform:"translateX(-50%)",opacity:0.15}}/>
      <div className="complete-icon">{isPartial?"⏸":"🏔"}</div>
      <div className="complete-title" style={{color:isPartial?"#FFD600":"#A8FF3E"}}>{isPartial?"ENDED EARLY":"CRUSHED IT"}</div>
      <div style={{color:"var(--muted)",fontSize:13}}>{session.protocol} · {session.grip} · {session.edge}{session.fromProgram?` · ${session.fromProgram}`:""}</div>
      <div style={{fontFamily:"DM Mono,monospace",fontSize:10,letterSpacing:2,color:"var(--muted)",textTransform:"uppercase"}}>Review & adjust — locked once approved</div>
      <div className="complete-grid" style={{zIndex:1}}>
        <EditStat label="Sets" value={vals.sets} onMinus={()=>adj("sets",-1)} onPlus={()=>adj("sets",1)}/>
        <EditStat label="Total Hangs" value={vals.totalHangs} onMinus={()=>adj("totalHangs",-1)} onPlus={()=>adj("totalHangs",1)}/>
        <EditStat label="Duration" display={fmtTime(vals.duration)} onMinus={()=>adj("duration",-15)} onPlus={()=>adj("duration",15)}/>
        <div className="complete-stat"><label>Added Weight</label><span>{session.addedWeight>0?"+":""}{session.addedWeight}kg</span></div>
      </div>
      <div style={{width:"100%",zIndex:1}}>
        <div style={{fontFamily:"DM Mono,monospace",fontSize:10,letterSpacing:3,color:"var(--muted)",textTransform:"uppercase",marginBottom:8}}>Session Notes (optional)</div>
        <textarea
          className="notes-area"
          rows={3}
          placeholder="How did it feel? Any breakthroughs, struggles, observations..."
          value={notes}
          onChange={e=>setNotes(e.target.value)}
          autoFocus={false}
        />
      </div>
      {saved?(
        <div style={{color:"#A8FF3E",fontFamily:"DM Mono,monospace",fontSize:12,letterSpacing:2}}>✓ Session locked in</div>
      ):(
        <div style={{width:"100%",zIndex:1,display:"flex",flexDirection:"column",gap:10}}>
          <button className="start-btn" style={{width:"100%",margin:0}} onClick={handleApprove}>
            ✓ APPROVE & SAVE
          </button>
          <button onClick={onDone} style={{background:"none",border:"none",color:"var(--muted)",fontFamily:"DM Mono,monospace",fontSize:11,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",padding:6}}>
            Discard — don't log this session
          </button>
        </div>
      )}
    </div>
  );
}

// ─── HISTORY TAB ─────────────────────────────────────────────────────────────
function HistoryTab({sessions,onClear}){
  if(!sessions.length)return(<><div className="page-header"><div className="page-title">HISTORY</div><div className="page-sub">Your completed sessions</div></div><div className="history-empty"><span className="icon">🧗</span>No sessions yet. Complete your first workout!</div></>);
  return(
    <>
      <div className="page-header" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
        <div><div className="page-title">HISTORY</div><div className="page-sub">{sessions.length} session{sessions.length!==1?"s":""} logged</div></div>
        <button onClick={onClear} style={{background:"none",border:"1px solid var(--border)",color:"var(--muted)",padding:"6px 12px",borderRadius:8,fontSize:12,cursor:"pointer"}}>Clear all</button>
      </div>
      {sessions.map((s,i)=>{const d=new Date(s.date);return(
        <div key={i} className="session-card">
          <div className="session-header">
            <div><div className="session-name">{s.protocol}{s.fromProgram&&<span style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"var(--ember)",marginLeft:8}}>📋</span>}</div><div style={{fontSize:13,color:"var(--muted)",marginTop:2}}>{s.grip} · {s.edge}{s.addedWeight!==0&&` · ${s.addedWeight>0?"+":""}${s.addedWeight}kg`}</div></div>
            <div className="session-date">{d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}<br/>{d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>
          </div>
          <div className="session-stats"><span className="stat-pill">{s.sets} sets</span><span className="stat-pill">{s.totalHangs} hangs</span><span className="stat-pill">{fmtTime(s.duration)}</span></div>
          {s.notes&&<div className="session-notes-preview">"{s.notes}"</div>}
        </div>
      );})}
      <div style={{height:16}}/>
    </>
  );
}

// ─── PROGRESS TAB ─────────────────────────────────────────────────────────────
function calcStreak(sessions){if(!sessions.length)return 0;const days=new Set(sessions.map(s=>s.date?.split("T")[0]));let streak=0,d=new Date();while(true){const k=d.toISOString().split("T")[0];if(days.has(k)){streak++;d.setDate(d.getDate()-1);}else break;}return streak;}
function WeekGrid({sessions}){
  const today=new Date();
  const days=Array.from({length:28},(_,i)=>{const d=new Date(today);d.setDate(today.getDate()-(27-i));return d.toISOString().split("T")[0];});
  const active=new Set(sessions.map(s=>s.date?.split("T")[0]));
  return(<div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:6}}>{["S","M","T","W","T","F","S"].map((l,i)=><div key={i} style={{fontSize:10,color:"var(--muted)",textAlign:"center",fontFamily:"DM Mono,monospace"}}>{l}</div>)}</div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>{days.map(d=><div key={d} style={{aspectRatio:"1",borderRadius:6,background:active.has(d)?"var(--accent)":"var(--surface2)",opacity:active.has(d)?1:0.5}}/>)}</div><div style={{fontSize:11,color:"var(--muted)",marginTop:8}}>Last 28 days</div></div>);
}
function ProgressTab({sessions}){
  const totalHangs=sessions.reduce((a,s)=>a+(s.totalHangs||0),0);
  const totalTime=sessions.reduce((a,s)=>a+(s.duration||0),0);
  const streak=calcStreak(sessions);
  const protoCounts={};sessions.forEach(s=>{protoCounts[s.protocol]=(protoCounts[s.protocol]||0)+1;});
  const protoMax=Math.max(...Object.values(protoCounts),1);
  const protoColors={"Max Hang":"#FF4D00","Repeaters":"#00D4FF","Density Hang":"#A8FF3E","7-53 Protocol":"#FFD600","Custom":"#FF2D78","Program Workout":"#e05c34"};
  return(
    <>
      <div className="page-header"><div className="page-title">PROGRESS</div><div className="page-sub">Your finger strength journey</div></div>
      <div className="progress-stat">
        <div className="ps-card"><div className="ps-label">Sessions</div><div className="ps-val">{sessions.length}</div></div>
        <div className="ps-card"><div className="ps-label">Total Hangs</div><div className="ps-val">{totalHangs}</div></div>
        <div className="ps-card"><div className="ps-label">Training Time</div><div className="ps-val" style={{fontSize:24}}>{fmtTime(totalTime)}</div></div>
        <div className="ps-card"><div className="ps-label">Day Streak</div><div className="ps-val">{streak}<span className="ps-unit"> d</span></div></div>
      </div>
      {Object.keys(protoCounts).length>0&&(<><p className="section-title" style={{marginTop:8}}>Protocol Breakdown</p><div className="bar-chart">{Object.entries(protoCounts).map(([name,count])=><div key={name} className="bar-row"><div className="bar-label">{name.split(" ")[0]}</div><div className="bar-track"><div className="bar-fill" style={{width:`${(count/protoMax)*100}%`,background:protoColors[name]||"var(--accent)"}}/></div><div className="bar-val">{count}</div></div>)}</div></>)}
      {sessions.length>0&&(<><p className="section-title">Recent Activity</p><div style={{padding:"0 20px 20px"}}><WeekGrid sessions={sessions}/></div></>)}
      {!sessions.length&&<div className="history-empty"><span className="icon">📊</span>Complete sessions to track your progress</div>}
    </>
  );
}

// ─── ANALYTICS SCREEN ────────────────────────────────────────────────────────
function AnalyticsScreen({sessions,savedPrograms,onBack}){
  const[tab,setTab]=useState("overview");
  const totalSessions=sessions.length;
  const totalHangs=sessions.reduce((a,s)=>a+(s.totalHangs||0),0);
  const totalTime=sessions.reduce((a,s)=>a+(s.duration||0),0);
  const streak=calcStreak(sessions);
  const avgHangs=totalSessions?Math.round(totalHangs/totalSessions):0;
  const avgDur=totalSessions?Math.round(totalTime/totalSessions):0;
  const weeklyVolume=Array.from({length:8},(_,w)=>{
    const wi=7-w;const start=new Date();start.setDate(start.getDate()-wi*7-6);start.setHours(0,0,0,0);
    const end=new Date();end.setDate(end.getDate()-wi*7+1);end.setHours(0,0,0,0);
    const wSessions=sessions.filter(s=>{const d=new Date(s.date);return d>=start&&d<end;});
    return{label:`W-${wi===0?"now":wi}`,count:wSessions.length,hangs:wSessions.reduce((a,s)=>a+(s.totalHangs||0),0)};
  });
  const maxWH=Math.max(...weeklyVolume.map(w=>w.hangs),1);
  const protoCounts={};sessions.forEach(s=>{protoCounts[s.protocol]=(protoCounts[s.protocol]||0)+1;});
  const protoColors={"Max Hang":"#FF4D00","Repeaters":"#00D4FF","Density Hang":"#A8FF3E","7-53 Protocol":"#FFD600","Custom":"#FF2D78","Program Workout":"#e05c34"};
  const protoMax=Math.max(...Object.values(protoCounts),1);
  const notedSessions=sessions.filter(s=>s.notes&&s.notes.trim());
  const programSessions=sessions.filter(s=>s.fromProgram);
  return(
    <div className="saved-shell fade-up">
      <div className="goal-header">
        <button className="back-btn" onClick={onBack}>Back</button>
        <div><div className="goal-header-title">ANALYTICS</div><div className="goal-header-sub">Performance trends & insights</div></div>
      </div>
      <div style={{display:"flex",borderBottom:"1px solid #1a1a1a",flexShrink:0}}>
        {[{id:"overview",label:"Overview"},{id:"volume",label:"Volume"},{id:"notes",label:"Notes"},{id:"sessions",label:"Sessions"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"12px 4px",background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,color:tab===t.id?"var(--text)":"var(--muted)",fontFamily:"DM Mono,monospace",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",cursor:"pointer",transition:"color 0.2s"}}>{t.label}</button>
        ))}
      </div>
      <div className="goal-scroll" style={{padding:"20px 20px 32px"}}>
        {!totalSessions&&<div className="empty-state"><span className="icon">📊</span><p>Complete sessions in Free Hang or via a program to see analytics here.</p></div>}
        {!!totalSessions&&tab==="overview"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:"#1a1a1a",border:"1px solid #1a1a1a",borderRadius:10,overflow:"hidden",marginBottom:20}}>
              {[{l:"Sessions",v:totalSessions},{l:"Day Streak",v:`${streak}d`},{l:"Total Hangs",v:totalHangs},{l:"Total Time",v:fmtTime(totalTime),raw:true},{l:"Avg Hangs",v:avgHangs,u:"/session"},{l:"Avg Session",v:fmtTime(avgDur),raw:true}].map((k,i)=>(
                <div key={i} style={{background:"var(--surface)",padding:"14px 16px"}}>
                  <div style={{fontFamily:"DM Mono,monospace",fontSize:9,letterSpacing:3,color:"var(--muted)",textTransform:"uppercase",marginBottom:5}}>{k.l}</div>
                  <div style={{fontFamily:"Bebas Neue,sans-serif",fontSize:k.raw?22:28,color:"var(--chalk)",letterSpacing:1}}>{k.v}{k.u&&<span style={{fontSize:12,color:"var(--muted)",marginLeft:3}}>{k.u}</span>}</div>
                </div>
              ))}
            </div>
            {programSessions.length>0&&<div style={{background:"rgba(224,92,52,0.08)",border:"1px solid rgba(224,92,52,0.2)",borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#e05c34"}}>📋 {programSessions.length} session{programSessions.length!==1?"s":""} completed from goal programs</div>}
            <div style={{marginBottom:20}}>
              <div style={{fontFamily:"DM Mono,monospace",fontSize:9,letterSpacing:3,color:"var(--muted)",textTransform:"uppercase",marginBottom:10}}>Activity — Last 28 Days</div>
              <WeekGrid sessions={sessions}/>
            </div>
            {Object.keys(protoCounts).length>0&&(
              <div>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:9,letterSpacing:3,color:"var(--muted)",textTransform:"uppercase",marginBottom:10}}>Protocol Usage</div>
                {Object.entries(protoCounts).sort((a,b)=>b[1]-a[1]).map(([name,count])=>(
                  <div key={name} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:protoColors[name]||"var(--accent)",flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:13,color:"var(--chalk)"}}>{name}</span>
                        <span style={{fontFamily:"DM Mono,monospace",fontSize:11,color:"var(--muted)"}}>{count} · {Math.round(count/totalSessions*100)}%</span>
                      </div>
                      <div style={{height:6,background:"var(--surface2)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${(count/protoMax)*100}%`,background:protoColors[name]||"var(--accent)",borderRadius:3}}/></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {!!totalSessions&&tab==="volume"&&(
          <>
            <div style={{fontFamily:"DM Mono,monospace",fontSize:9,letterSpacing:3,color:"var(--muted)",textTransform:"uppercase",marginBottom:14}}>Weekly Hang Volume — Last 8 Weeks</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:6,height:120,marginBottom:20}}>
              {weeklyVolume.map((w,i)=>{const h=maxWH>0?(w.hangs/maxWH)*100:0;return(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <span style={{fontFamily:"DM Mono,monospace",fontSize:9,color:w.hangs>0?"var(--chalk)":"var(--muted)"}}>{w.hangs||""}</span>
                  <div style={{width:"100%",background:"var(--surface2)",borderRadius:4,height:80,display:"flex",alignItems:"flex-end"}}>
                    <div style={{width:"100%",height:`${h}%`,background:i===7?"var(--accent)":"#e05c34aa",borderRadius:4,minHeight:w.hangs>0?4:0}}/>
                  </div>
                  <span style={{fontFamily:"DM Mono,monospace",fontSize:8,color:"var(--muted)"}}>{w.label}</span>
                </div>
              );})}
            </div>
            {(()=>{
              const gripCounts={};sessions.forEach(s=>{if(s.grip)gripCounts[s.grip]=(gripCounts[s.grip]||0)+1;});
              const gmax=Math.max(...Object.values(gripCounts),1);
              return Object.keys(gripCounts).length>0&&(
                <>
                  <div style={{fontFamily:"DM Mono,monospace",fontSize:9,letterSpacing:3,color:"var(--muted)",textTransform:"uppercase",marginBottom:10}}>Grip Type Usage</div>
                  {Object.entries(gripCounts).sort((a,b)=>b[1]-a[1]).map(([g,c])=>(
                    <div key={g} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <span style={{fontSize:12,color:"var(--chalk)",width:120,flexShrink:0}}>{g}</span>
                      <div style={{flex:1,height:6,background:"var(--surface2)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${(c/gmax)*100}%`,background:"#A8FF3E",borderRadius:3}}/></div>
                      <span style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"var(--muted)",width:20,textAlign:"right"}}>{c}</span>
                    </div>
                  ))}
                </>
              );
            })()}
          </>
        )}
        {tab==="notes"&&(
          <>
            <div style={{fontFamily:"DM Mono,monospace",fontSize:9,letterSpacing:3,color:"var(--muted)",textTransform:"uppercase",marginBottom:14}}>Session Notes ({notedSessions.length})</div>
            {!notedSessions.length&&<div className="empty-state" style={{padding:"40px 0"}}><span className="icon">📝</span><p>No session notes yet. Add notes after completing a session.</p></div>}
            {notedSessions.map((s,i)=>{const d=new Date(s.date);return(
              <div key={i} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"16px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:"var(--chalk)"}}>{s.protocol}</div>
                    <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{s.grip} · {s.edge}{s.fromProgram?` · ${s.fromProgram}`:""}</div>
                  </div>
                  <div style={{textAlign:"right",fontFamily:"DM Mono,monospace",fontSize:10,color:"var(--muted)"}}>{d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                </div>
                <div style={{fontSize:13,color:"var(--chalk)",lineHeight:1.6,fontStyle:"italic",padding:"10px 14px",background:"rgba(255,255,255,0.03)",borderLeft:"2px solid var(--ember)",borderRadius:"0 4px 4px 0"}}>"{s.notes}"</div>
                <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                  <span style={{background:"var(--surface2)",borderRadius:6,padding:"4px 10px",fontFamily:"DM Mono,monospace",fontSize:11,color:"var(--muted)"}}>{s.totalHangs} hangs</span>
                  <span style={{background:"var(--surface2)",borderRadius:6,padding:"4px 10px",fontFamily:"DM Mono,monospace",fontSize:11,color:"var(--muted)"}}>{fmtTime(s.duration)}</span>
                  {s.addedWeight!==0&&<span style={{background:"var(--surface2)",borderRadius:6,padding:"4px 10px",fontFamily:"DM Mono,monospace",fontSize:11,color:"var(--muted)"}}>{s.addedWeight>0?"+":""}{s.addedWeight}kg</span>}
                </div>
              </div>
            );})}
          </>
        )}
        {tab==="sessions"&&(
          <>
            <div style={{fontFamily:"DM Mono,monospace",fontSize:9,letterSpacing:3,color:"var(--muted)",textTransform:"uppercase",marginBottom:14}}>Recent Sessions</div>
            {sessions.slice(0,15).map((s,i)=>{const d=new Date(s.date);return(
              <div key={i} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:"var(--chalk)"}}>{s.protocol}{s.fromProgram&&<span style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"var(--ember)",marginLeft:8}}>📋 {s.fromProgram}</span>}</div>
                    <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{s.grip} · {s.edge}</div>
                  </div>
                  <div style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"var(--muted)",textAlign:"right"}}>{d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}<br/>{d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[{l:"Sets",v:s.sets},{l:"Hangs",v:s.totalHangs},{l:"Duration",v:fmtTime(s.duration)}].map(({l,v})=>(
                    <div key={l} style={{background:"var(--surface2)",borderRadius:6,padding:"5px 10px"}}>
                      <div style={{fontFamily:"DM Mono,monospace",fontSize:8,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1}}>{l}</div>
                      <div style={{fontFamily:"DM Mono,monospace",fontSize:14,color:"var(--chalk)",marginTop:1}}>{v}</div>
                    </div>
                  ))}
                </div>
                {s.notes&&<div style={{fontSize:12,color:"var(--muted)",marginTop:8,fontStyle:"italic",borderTop:"1px solid var(--border)",paddingTop:8}}>"{s.notes}"</div>}
              </div>
            );})}
            {sessions.length>15&&<div style={{textAlign:"center",fontSize:12,color:"var(--muted)",paddingTop:8}}>Showing 15 of {sessions.length} sessions</div>}
            {savedPrograms.length>0&&(
              <>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:9,letterSpacing:3,color:"var(--muted)",textTransform:"uppercase",marginTop:24,marginBottom:14}}>Saved Programs</div>
                {savedPrograms.map((p,i)=>(
                  <div key={i} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px",marginBottom:8}}>
                    <div style={{fontFamily:"Bebas Neue,sans-serif",fontSize:18,letterSpacing:1,color:"var(--chalk)",marginBottom:6}}>{p.programName}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"var(--muted)",background:"var(--surface2)",padding:"3px 8px",borderRadius:4}}>{p.totalWeeks} weeks</span>
                      <span style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"var(--muted)",background:"var(--surface2)",padding:"3px 8px",borderRadius:4}}>{p.phases?.length} phases</span>
                      {p.formData?.peakDate&&<span style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"var(--muted)",background:"var(--surface2)",padding:"3px 8px",borderRadius:4}}>Peak {new Date(p.formData.peakDate+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>}
                      <span style={{fontFamily:"DM Mono,monospace",fontSize:10,color:"var(--ember)",background:"rgba(224,92,52,0.12)",padding:"3px 8px",borderRadius:4}}>{programSessions.filter(s=>s.fromProgram===p.programName).length} sessions logged</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const[screen,setScreen]=useState("landing");
  const[savedPrograms,setSavedPrograms]=useLocalStorage("hb_programs_v1",[]);
  const[viewProgram,setViewProgram]=useState(null);
  const[sessions,setSessions]=useLocalStorage("hb_sessions",[]);
  const[cueSelections,setCueSelections]=useLocalStorage("hb_cue_v2",getDefaultCueSelections());
  const[muted,setMuted]=useLocalStorage("hb_muted",false);

  const handleLandingSelect=choice=>{if(choice==="settings"){setScreen("settings");return;}setScreen(choice);};
  const handleSaveProgram=program=>{setSavedPrograms(prev=>[program,...prev]);setScreen("saved-programs");};
  const handleDeleteProgram=idx=>setSavedPrograms(prev=>prev.filter((_,i)=>i!==idx));

  if(screen==="free-hang")return(<FreeHangView onBack={()=>setScreen("landing")} cueSelections={cueSelections} muted={muted} setMuted={setMuted} sessions={sessions} setSessions={setSessions}/>);

  return(
    <div className="app">
      {screen==="settings"&&<SettingsSheet cueSelections={cueSelections} setCueSelections={setCueSelections} muted={muted} setMuted={setMuted} onClose={()=>setScreen("landing")}/>}
      {screen==="landing"&&<LandingScreen onSelect={handleLandingSelect} savedPrograms={savedPrograms}/>}
      {screen==="new-program"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <GoalBuilder onBack={()=>setScreen("landing")} onSave={handleSaveProgram}/>
        </div>
      )}
      {screen==="saved-programs"&&!viewProgram&&(
        <SavedProgramsView programs={savedPrograms} onBack={()=>setScreen("landing")} onOpen={p=>{setViewProgram(p);setScreen("saved-detail");}} onDelete={handleDeleteProgram}/>
      )}
      {screen==="saved-detail"&&viewProgram&&(
        <SavedProgramDetail program={viewProgram} onBack={()=>{setViewProgram(null);setScreen("saved-programs");}} onUpdateProgram={updated=>{setSavedPrograms(prev=>prev.map(p=>p.savedAt===viewProgram.savedAt?updated:p));setViewProgram(updated);}} cueSelections={cueSelections} muted={muted} setMuted={setMuted} sessions={sessions} setSessions={setSessions}/>
      )}
      {screen==="analytics"&&(
        <AnalyticsScreen sessions={sessions} savedPrograms={savedPrograms} onBack={()=>setScreen("landing")}/>
      )}
    </div>
  );
}
