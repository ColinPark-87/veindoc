const CLINIC={hours:{open:9,weekdayEnd:18,satEnd:13,lunch:[13,14]}};
function clinicStatus(now){
  const d=now.getDay(), h=now.getHours()+now.getMinutes()/60;
  const {open,weekdayEnd,satEnd,lunch}=CLINIC.hours;
  if(d===0) return {open:false,tone:"closed",msg:"일요일 휴진"};
  const close=d===6?satEnd:weekdayEnd;
  const hhmm=n=>`${String(n).padStart(2,"0")}:00`;
  if(h<open) return {open:false,tone:"pause",msg:`${hhmm(open)} 진료 시작`};
  if(h>=close) return {open:false,tone:"closed",msg:"오늘 진료 종료"};
  if(d!==6&&h>=lunch[0]&&h<lunch[1]) return {open:false,tone:"pause",msg:`점심 · ${hhmm(lunch[1])} 재개`};
  return {open:true,tone:"open",msg:`진료중 · ${hhmm(close)}까지`};
}
const C={open:'🟢',pause:'🟡',closed:'🔴'};
const cases=[
 ['월 10:00', new Date(2026,7,3,10,0)],
 ['월 13:30 점심', new Date(2026,7,3,13,30)],
 ['월 07:00 개원전', new Date(2026,7,3,7,0)],
 ['월 19:00 종료', new Date(2026,7,3,19,0)],
 ['토 11:00', new Date(2026,7,8,11,0)],
 ['토 14:00 종료', new Date(2026,7,8,14,0)],
 ['일 11:00 휴진', new Date(2026,7,9,11,0)],
];
let pass=0;
for(const [label,d] of cases){
  const s=clinicStatus(d);
  console.log(`  ${C[s.tone]} ${label.padEnd(14)} → ${s.msg}`);
  pass++;
}
// 자기검증
const asserts=[
 [clinicStatus(new Date(2026,7,9,11)).tone==='closed','일요일=빨강'],
 [clinicStatus(new Date(2026,7,3,19)).tone==='closed','종료=빨강'],
 [clinicStatus(new Date(2026,7,3,13,30)).tone==='pause','점심=노랑'],
 [clinicStatus(new Date(2026,7,3,10)).tone==='open','진료중=초록'],
 [clinicStatus(new Date(2026,7,8,14)).tone==='closed','토요일 14시=빨강'],
];
console.log();
asserts.forEach(([ok,n])=>console.log(`  ${ok?'PASS':'FAIL'}  ${n}`));
process.exit(asserts.every(([ok])=>ok)?0:1);
