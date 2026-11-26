"use strict";
const OTPRO_PAPER_BUILD = "20261126-05";
(function (global) {
  const hhmm = value => {
    const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/);
    return match ? `${match[1]}:${match[2]}` : "";
  };
  const minutes = value => { const time = hhmm(value); return time ? Number(time.slice(0,2))*60+Number(time.slice(3)) : NaN; };
  const note = value => String(value || "").replace(/\r\n/g,"\n").trim();
  function visibleNote(raw) {
    let text=String(raw || ""),index=-1;
    for(const marker of ["[[OTPRO_META]]","[[OT_PRO_META]]"]){const found=text.lastIndexOf(marker);if(found>index)index=found;}
    return index<0?text:text.slice(0,index).trim();
  }
  function lunch(raw) {
    const text=String(raw || "");let index=-1,selected="";
    for(const marker of ["[[OTPRO_META]]","[[OT_PRO_META]]"]){const found=text.lastIndexOf(marker);if(found>index){index=found;selected=marker;}}
    if(index<0)return false;
    try{return Boolean(JSON.parse(text.slice(index+selected.length).trim())?.lunchChecked);}catch{return false;}
  }
  const ref = (type,date,id="") => type==="main" ? (id?`${date}:${id}`:date) : String(id);
  function fingerprint(row) {
    return JSON.stringify(["otpro-paper-v1",String(row.type||""),ref(row.type,row.dateKey,String(row.id||"")),String(row.dateKey||""),String(row.sourceStart||row.from||""),String(row.sourceEnd||row.to||""),note(row.note)]);
  }
  function mainRanges(log,settings={}) {
    const start=hhmm(log?.start_time),end=hhmm(log?.end_time);
    if(!start||!end)return [];
    const sunday=new Date(`${log.work_date}T12:00:00Z`).getUTCDay()===0;
    let a=minutes(start),b=minutes(end);if(b<a)b+=1440;
    if(sunday)return b-a-(lunch(log.note)?60:0)>0?[{id:"",from:start,to:end}]:[];
    const normalStart=hhmm(settings.defaultShiftStart)||"07:45",normalEnd=hhmm(settings.defaultShiftEnd)||"17:00";
    let s=minutes(normalStart),e=minutes(normalEnd);if(e<=s)e+=1440;
    const overtime=Math.max(0,Math.min(b,s)-a)+Math.max(0,b-Math.max(a,e))+(lunch(log.note)?60:0);
    if(overtime<=0)return [];
    const ranges=[];
    // Keep the existing paper-sheet segment semantics for old checkbox fingerprints.
    if(a<s)ranges.push({id:"morning",from:start,to:normalStart});
    if(b>e)ranges.push({id:"evening",from:a>e?start:normalEnd,to:end});
    return ranges;
  }
  function written(row,statuses) {
    const direct=statuses.get(`${row.type}:${ref(row.type,row.dateKey,String(row.id||""))}`);
    if(direct)return direct.is_written===true&&(!direct.source_fingerprint||direct.source_fingerprint===row.fingerprint);
    if(row.type==="main"&&row.id){
      const old=statuses.get(`main:${row.dateKey}`);
      return old?.is_written===true&&(!old.source_fingerprint||old.source_fingerprint===row.legacyFingerprint);
    }
    return false;
  }
  function paperRows({logs=[],extras=[],statuses=[],settings={},throughDate="9999-12-31",timeZone="Asia/Ho_Chi_Minh"}) {
    const map=new Map(statuses.map(row=>[`${row.source_type}:${row.source_ref}`,row]));const rows=[];
    for(const log of logs){
      const date=String(log.work_date||"").slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>throughDate)continue;
      const content=visibleNote(log.note);
      const legacyFingerprint=fingerprint({type:"main",dateKey:date,id:"",sourceStart:String(log.start_time||""),sourceEnd:String(log.end_time||""),note:content});
      for(const range of mainRanges({...log,work_date:date},settings)){
        const row={type:"main",dateKey:date,...range,sourceStart:range.from,sourceEnd:range.to,note:content,legacyFingerprint};
        row.fingerprint=fingerprint(row);row.isWritten=written(row,map);rows.push(row);
      }
    }
    const display=value=>{const date=new Date(value);return value&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat("vi-VN",{timeZone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(date):"--:--";};
    for(const item of extras){
      const date=String(item.work_date||"").slice(0,10);
      if(item.status!=="completed"||!item.end_at||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>throughDate)continue;
      const row={type:"extra",dateKey:date,id:String(item.id),from:display(item.start_at),to:display(item.end_at),sourceStart:String(item.start_at||""),sourceEnd:String(item.end_at||""),note:String(item.note||"")};
      row.fingerprint=fingerprint(row);row.isWritten=written(row,map);rows.push(row);
    }
    return rows.sort((a,b)=>a.dateKey.localeCompare(b.dateKey)||(a.type===b.type?0:a.type==='main'?-1:1)||(a.type==='extra'?a.sourceStart.localeCompare(b.sourceStart):a.from.localeCompare(b.from)));
  }
  function preferences(value={}) {
    const interval=Number(value.paperRepeatMinutes??0);
    const days=Array.isArray(value.paperDays)?[...new Set(value.paperDays.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=7))]:[1,2,3,4,5,6,7];
    let zone=String(value.timezone||"Asia/Ho_Chi_Minh");try{new Intl.DateTimeFormat("en",{timeZone:zone}).format();}catch{zone="Asia/Ho_Chi_Minh";}
    return {remindPaper:value.remindPaper!==false,paperReminderTime:hhmm(value.paperReminderTime)||"08:00",paperEndTime:hhmm(value.paperEndTime)||"17:00",paperRepeatMinutes:Number.isInteger(interval)&&interval>=5&&interval<=1440?interval:0,paperDays:days.length?days:[1,2,3,4,5,6,7],timezone:zone,retentionEnabled:value.retentionEnabled===true};
  }
  function localClock(now,timeZone) {
    const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
    return {date:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)};
  }
  const shiftDate=(date,days)=>{const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);};
  function reminderSlot(now,input) {
    const prefs=preferences(input);if(!prefs.remindPaper)return null;
    const local=localClock(now,prefs.timezone),start=minutes(prefs.paperReminderTime),end=minutes(prefs.paperEndTime);
    let anchor=local.date,elapsed=local.minute-start;
    if(end<start){if(local.minute<=end){anchor=shiftDate(local.date,-1);elapsed=local.minute+1440-start;}else if(local.minute<start)return null;}
    else if(local.minute<start||local.minute>end)return null;
    const weekday=new Date(`${anchor}T12:00:00Z`).getUTCDay()||7;if(!prefs.paperDays.includes(weekday))return null;
    const bucket=prefs.paperRepeatMinutes?Math.floor(elapsed/prefs.paperRepeatMinutes):"once";
    return {anchorDate:anchor,throughDate:local.date,key:`paper:${anchor}:${prefs.paperReminderTime}:${prefs.paperEndTime}:${prefs.paperRepeatMinutes}:${bucket}`,preferences:prefs};
  }
  const safeEndpoint=value=>{try{const url=new URL(value);return url.protocol==="https:"&&(url.hostname==="fcm.googleapis.com"||url.hostname==="web.push.apple.com"||url.hostname.endsWith(".push.services.mozilla.com")||url.hostname==="updates.push.services.mozilla.com"||url.hostname.endsWith(".notify.windows.com")||url.hostname.endsWith(".push.microsoft.com"));}catch{return false;}};
  global.OTProPaperLogic={hhmm,visibleNote,mainRanges,fingerprint,written,paperRows,preferences,localClock,reminderSlot,safeEndpoint};
})(globalThis);
