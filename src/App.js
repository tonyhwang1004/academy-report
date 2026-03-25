import { useState, useEffect } from "react";
import html2canvas from "html2canvas";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx7j-laaG375ha--NBLuYF4lSXSYVpPefsHRWXMBbPt72q_2Yf17xgv0Sh81NwPccXcvg/exec";
const ADMIN_PASSWORD  = "sue12345";
const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_KEY || "";

const TEACHERS = [
  { id:"anni", name:"anni",     password:"anni",     role:"manager" },
  { id:"suzi", name:"suzi",     password:"suzi",     role:"teacher" },
  { id:"t3",   name:"Teacher3",  password:"teacher3", role:"teacher" },
];

const DEFAULT_TEAMS = {
  Lilly:   ["Amy","Brian","Chloe","Daniel","Emma"],
  Aster:   ["Finn","Grace","Henry","Ivy","Jack"],
  Middle1: ["Karen","Leo","Mia","Nathan","Olivia"],
  Middle2: ["Paul","Quinn","Rachel","Sam","Tina"],
  Middle3: ["Uma","Victor","Wendy","Xavier","Yuna"],
};
const WW_OPTIONS  = ["Pass","Retest","Absent"];
const HW_OPTIONS  = ["Excellent","Good","Average","Incomplete"];
const ATT_OPTIONS = ["Active","Normal","Passive"];
const WEEK_EMPTY  = { date:"",ww:"",hw:"",attitude:"",grammar:"",reading:"",writing:"" };

const TEAM_COLOR_LIST = [
  { accent:"#f43f7a", light:"#fff0f5", border:"#fecdd3" },
  { accent:"#10b981", light:"#f0fdf4", border:"#bbf7d0" },
  { accent:"#3b82f6", light:"#eff6ff", border:"#bfdbfe" },
  { accent:"#f59e0b", light:"#fffbeb", border:"#fde68a" },
  { accent:"#8b5cf6", light:"#faf5ff", border:"#ddd6fe" },
];

function loadTeams() {
  try { const s=localStorage.getItem("academy_teams_v1"); if(s) return JSON.parse(s); } catch(e){}
  return DEFAULT_TEAMS;
}
function saveTeams(teams) { localStorage.setItem("academy_teams_v1", JSON.stringify(teams)); }

const WW_C  = { Pass:"#10b981", Retest:"#f59e0b", Absent:"#ef4444" };
const HW_C  = { Excellent:"#8b5cf6", Good:"#10b981", Average:"#f59e0b", Incomplete:"#ef4444" };
const ATT_C = { "Active":"#3b82f6","Normal":"#94a3b8","Passive":"#f87171" };

// ══════════════════════════════════════════════════════════
// 🖨️ Print Utility Function
// ══════════════════════════════════════════════════════════
function printHtml(html, title) {
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Noto Sans KR', sans-serif; background: #f8fafc; color: #1e1b4b; }
      .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 16mm 14mm; }
      @media print {
        body { background: #fff; }
        .no-print { display: none !important; }
        .page { width: 100%; padding: 0; margin: 0; box-shadow: none; }
        @page { size: A4 portrait; margin: 14mm 12mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
      @media screen {
        body { padding: 20px; }
        .page { box-shadow: 0 4px 24px #00000015; border-radius: 4px; }
      }
      .print-btn {
        display: block; margin: 16px auto;
        padding: 12px 40px; background: #6366f1; color: #fff;
        border: none; border-radius: 10px; font-size: 15px;
        font-weight: 700; cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
        box-shadow: 0 4px 14px #6366f130;
      }
    </style>
  </head><body>
    <button class="no-print print-btn" onclick="window.print()">🖨️ Print</button>
    <div class="page">${html}</div>
  </body></html>`);
  win.document.close();
}

// ══════════════════════════════════════════════════════════
// API Functions
// ══════════════════════════════════════════════════════════
async function callClaude(prompt) {
  const url = APPS_SCRIPT_URL + "?action=generateFeedback&prompt=" + encodeURIComponent(prompt);
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.text || "";
}
async function saveToSheet(payload) {
  const url = APPS_SCRIPT_URL + "?action=save&team=" + encodeURIComponent(payload.team)
    + "&student=" + encodeURIComponent(payload.student)
    + "&weekIndex=" + payload.weekIndex
    + "&week=" + encodeURIComponent(JSON.stringify(payload.week));
  await fetch(url);
}
async function loadFromSheet(team, student) {
  const url = `${APPS_SCRIPT_URL}?action=load&team=${encodeURIComponent(team)}&student=${encodeURIComponent(student)}`;
  const res  = await fetch(url);
  const data = await res.json();
  return data.weeks || Array.from({length:4},()=>({...WEEK_EMPTY}));
}
async function saveFeedback(team, student, type, text) {
  const url = APPS_SCRIPT_URL + "?action=saveFeedback&team=" + encodeURIComponent(team)
    + "&student=" + encodeURIComponent(student)
    + "&type=" + encodeURIComponent(type)
    + "&date=" + new Date().toISOString().slice(0,10)
    + "&text=" + encodeURIComponent(text);
  await fetch(url);
}

// ══════════════════════════════════════════════════════════
// Prompt Builder
// ══════════════════════════════════════════════════════════
function buildWeeklyPrompt(team, student, week) {
  const grammarNote = week.grammar
    ? `Grammar unit: "${week.grammar}". Please mention the key grammar concepts and describe the student's understanding level.`
    : "Grammar progress not entered.";
  const writingNote = week.writing
    ? `Writing evaluation: "${week.writing}". Please describe the student's strengths or areas for improvement in sentence structure, vocabulary, and paragraph flow.`
    : "Writing evaluation not entered.";
  return `You are an English academy teacher. Based on the student's weekly data below, write a warm and professional weekly feedback in Korean for parents.

Student: ${team} team ${student} / Date: ${week.date||"this week"}
- Wordly Wise: ${week.ww||"N/A"} / Homework: ${week.hw||"N/A"} / Attitude: ${week.attitude||"N/A"}
- Grammar: ${week.grammar||"N/A"} / Reading: ${week.reading||"N/A"} / Writing: ${week.writing||"N/A"}

[Grammar Note] ${grammarNote}
[Writing Note] ${writingNote}

Requirements:
- 3-4 sentences
- Start with student name
- Strengths -> Areas for improvement -> Encouragement
- Must include specific Grammar and Writing content
- Warm and professional tone
- Plain text only, no markdown`;
}

function buildMonthlyPrompt(team, student, weeks) {
  const f = weeks.filter(w=>w.ww||w.hw||w.attitude);
  const wwPass  = f.filter(w=>w.ww==="Pass").length;
  const wwTotal = f.filter(w=>w.ww==="Pass"||w.ww==="Retest").length;
  const hwGood  = f.filter(w=>w.hw==="Excellent"||w.hw==="Good").length;
  const attGood = f.filter(w=>w.attitude==="Active").length;
  const allGrammars = f.filter(w=>w.grammar).map(w=>w.grammar).join(", ") || "None";
  const allWritings = f.filter(w=>w.writing).map(w=>w.writing).join(" / ") || "None";
  return `You are an English academy teacher. Based on the monthly data below, write a comprehensive monthly report in Korean for parents.

Student: ${team} team ${student} / Recorded classes: ${f.length}
WW Pass rate: ${wwTotal>0?Math.round(wwPass/wwTotal*100):0}% (Pass ${wwPass} / Retest ${wwTotal-wwPass})
Homework rate: ${f.length>0?Math.round(hwGood/f.length*100):0}% / Active attitude: ${attGood}/${f.length}
Grammar units this month: ${allGrammars}
Writing evaluations this month: ${allWritings}

Requirements:
- 5-6 sentences
- Start with student name
- Overall achievement -> Strengths (mention Grammar & Writing) -> Areas for improvement -> Next month encouragement
- Include statistics naturally
- Plain text only, no markdown`;
}

// ══════════════════════════════════════════════════════════
// UI Components
// ══════════════════════════════════════════════════════════
function PillGroup({ options, value, onChange, colorMap }) {
  return (
    <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
      {options.map(opt => {
        const on=value===opt; const c=colorMap?.[opt]||"#6366f1";
        return (
          <button key={opt} onClick={()=>onChange(on?"":opt)} style={{
            padding:"5px 14px",borderRadius:20,
            border: on?`2px solid ${c}`:"2px solid #e5e7eb",
            background: on?c:"#fff", color: on?"#fff":"#9ca3af",
            fontSize:12,fontWeight:on?700:500,cursor:"pointer",
            transition:"all .15s",fontFamily:"'Noto Sans KR',sans-serif",
            boxShadow: on?`0 2px 8px ${c}40`:"none",
          }}>{opt}</button>
        );
      })}
    </div>
  );
}

function WeekCard({ weekNum, data, onChange }) {
  const upd=(k,v)=>onChange({...data,[k]:v});
  return (
    <div style={{ background:"#fff",borderRadius:20,border:"1.5px solid #f1f5f9",padding:"22px 24px",boxShadow:"0 4px 20px #00000008" }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20 }}>
        <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:800,fontFamily:"'DM Mono',monospace",boxShadow:"0 4px 12px #6366f130" }}>W{weekNum}</div>
        <input type="date" value={data.date} onChange={e=>upd("date",e.target.value)} style={{ border:"2px solid #f1f5f9",background:"#f8fafc",borderRadius:10,padding:"6px 12px",fontSize:13,color:"#64748b",fontFamily:"'Noto Sans KR',sans-serif",outline:"none" }}/>
      </div>
      <div style={{ display:"grid",gap:16 }}>
        {[
          {label:"📘 Wordly Wise",key:"ww",opts:WW_OPTIONS,cm:WW_C},
          {label:"📋 Homework",key:"hw",opts:HW_OPTIONS,cm:HW_C},
          {label:"🌟 Attitude",key:"attitude",opts:ATT_OPTIONS,cm:ATT_C},
        ].map(({label,key,opts,cm})=>(
          <div key={key}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:7,fontFamily:"'Noto Sans KR',sans-serif" }}>{label}</div>
            <PillGroup options={opts} value={data[key]} onChange={v=>upd(key,v)} colorMap={cm}/>
          </div>
        ))}
        {[
          {label:"📐 Grammar Progress",key:"grammar",ph:"e.g. Unit 5 Lesson 2 — Present Perfect"},
          {label:"📖 Reading Level",key:"reading",ph:"e.g. Good / Excellent comprehension"},
          {label:"✍️ Writing Evaluation",key:"writing",ph:"e.g. Improved use of connectives"},
        ].map(({label,key,ph})=>(
          <div key={key}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:7,fontFamily:"'Noto Sans KR',sans-serif" }}>{label}</div>
            <input value={data[key]} placeholder={ph} onChange={e=>upd(key,e.target.value)}
              style={{ width:"100%",boxSizing:"border-box",border:"2px solid #f1f5f9",borderRadius:12,padding:"9px 14px",fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",color:"#374151",background:"#fafafa",outline:"none",transition:"border-color .15s" }}
              onFocus={e=>e.target.style.borderColor="#6366f1"} onBlur={e=>e.target.style.borderColor="#f1f5f9"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label,value,color,icon }) {
  return (
    <div style={{ background:"#fff",borderRadius:16,border:`2px solid ${color}20`,padding:"16px 12px",textAlign:"center",flex:1,minWidth:76,boxShadow:`0 4px 14px ${color}10` }}>
      <div style={{ fontSize:18,marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:22,fontWeight:800,color,fontFamily:"'DM Mono',monospace",lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:10,color:"#94a3b8",marginTop:4,fontFamily:"'Noto Sans KR',sans-serif",fontWeight:500 }}>{label}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ReportBox — 🖨️ Print Button Added
// ══════════════════════════════════════════════════════════
function ReportBox({ text, loading, onCopy, onPrint, saved }) {
  if (loading) return (
    <div style={{ background:"#f8fafc",borderRadius:18,padding:32,display:"flex",alignItems:"center",gap:14,border:"2px dashed #e2e8f0" }}>
      <div style={{ width:22,height:22,borderRadius:"50%",border:"3px solid #6366f1",borderTopColor:"transparent",animation:"spin .7s linear infinite",flexShrink:0 }}/>
      <span style={{ color:"#94a3b8",fontFamily:"'Noto Sans KR',sans-serif",fontSize:14 }}>AI is generating feedback...</span>
    </div>
  );
  if (!text) return (
    <div style={{ background:"#fafbff",borderRadius:18,padding:36,border:"2px dashed #e0e7ff",textAlign:"center" }}>
      <div style={{ fontSize:36,marginBottom:10 }}>✨</div>
      <div style={{ color:"#c7d2fe",fontFamily:"'Noto Sans KR',sans-serif",fontSize:13,fontWeight:500 }}>Press the button to generate AI feedback</div>
    </div>
  );
  return (
    <div style={{ background:"linear-gradient(135deg,#eff6ff,#faf5ff)",borderRadius:18,padding:26,border:"2px solid #e0e7ff",position:"relative" }}>
      <div style={{ position:"absolute",top:16,right:16,display:"flex",gap:8,alignItems:"center" }}>
        {saved&&<span style={{ fontSize:11,color:"#10b981",fontWeight:700,fontFamily:"'DM Mono',monospace",background:"#f0fdf4",padding:"4px 10px",borderRadius:8,border:"1px solid #bbf7d0" }}>✓ Saved</span>}
        <button onClick={onPrint} style={{ background:"#f0fdf4",color:"#10b981",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"6px 14px",fontSize:12,fontFamily:"'Noto Sans KR',sans-serif",cursor:"pointer",fontWeight:700 }}>🖨️ Print</button>
        <button onClick={onCopy} style={{ background:"#6366f1",color:"#fff",border:"none",borderRadius:10,padding:"6px 14px",fontSize:12,fontFamily:"'Noto Sans KR',sans-serif",cursor:"pointer",fontWeight:700,boxShadow:"0 4px 12px #6366f130" }}>📋 Copy</button>
      </div>
      <div style={{ fontSize:10,fontWeight:700,color:"#a5b4fc",marginBottom:12,letterSpacing:2,fontFamily:"'DM Mono',monospace" }}>AI FEEDBACK</div>
      <p style={{ margin:0,lineHeight:1.9,color:"#374151",fontFamily:"'Noto Sans KR',sans-serif",fontSize:14,whiteSpace:"pre-wrap",paddingRight:180 }}>{text}</p>
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#1e1b4b",color:"#fff",padding:"12px 24px",borderRadius:14,fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",fontWeight:600,boxShadow:"0 8px 24px #00000030",zIndex:9999,animation:"fadeUp .3s ease" }}>{msg}</div>
  );
}

// ══════════════════════════════════════════════════════════
// Login Screen
// ══════════════════════════════════════════════════════════
function LoginScreen({ onLogin, onAdminLogin }) {
  const [id, setId]     = useState("");
  const [pw, setPw]     = useState("");
  const [err, setErr]   = useState("");
  const [mode, setMode] = useState("teacher");
  const [adminPw, setAdminPw]   = useState("");
  const [adminErr, setAdminErr] = useState(false);

  const tryLogin = () => {
    const teacher = TEACHERS.find(t => t.name === id && t.password === pw);
    if (teacher) { onLogin(teacher); }
    else { setErr("Wrong ID or Password"); setTimeout(()=>setErr(""),2000); }
  };
  const tryAdmin = () => {
    if (adminPw === ADMIN_PASSWORD) { onAdminLogin(); }
    else { setAdminErr(true); setTimeout(()=>setAdminErr(false),1500); }
  };

  return (
    <div style={{ minHeight:"100vh",background:"linear-gradient(150deg,#f0f4ff 0%,#fdf4ff 50%,#f0fdf9 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Noto Sans KR',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&family=DM+Mono:wght@500;700&display=swap'); @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}} *{box-sizing:border-box}`}</style>
      <div style={{ width:"100%",maxWidth:360,animation:"fadeUp .5s ease" }}>
        <div style={{ textAlign:"center",marginBottom:32 }}>
          <div style={{ width:64,height:64,borderRadius:20,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 14px",boxShadow:"0 8px 24px #6366f130" }}>📚</div>
          <h1 style={{ margin:0,fontSize:24,fontWeight:800,color:"#1e1b4b" }}>Academy Report</h1>
          <p style={{ margin:"6px 0 0",fontSize:13,color:"#94a3b8" }}>AI Feedback + Auto Save to Google Sheets</p>
        </div>
        {mode === "teacher" ? (
          <div style={{ background:"#fff",borderRadius:24,padding:28,boxShadow:"0 8px 40px #6366f110",border:"1.5px solid #f1f5f9" }}>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,marginBottom:8,fontFamily:"'DM Mono',monospace" }}>ID</div>
              <input value={id} onChange={e=>setId(e.target.value)} placeholder="Enter ID"
                style={{ width:"100%",border:"2px solid #e2e8f0",borderRadius:12,padding:"11px 14px",fontSize:14,fontFamily:"'Noto Sans KR',sans-serif",color:"#374151",outline:"none",background:"#fafafa" }}
                onFocus={e=>e.target.style.borderColor="#6366f1"} onBlur={e=>e.target.style.borderColor="#e2e8f0"}
              />
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,marginBottom:8,fontFamily:"'DM Mono',monospace" }}>Password</div>
              <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&tryLogin()} placeholder="Enter Password"
                style={{ width:"100%",border:`2px solid ${err?"#f43f7a":"#e2e8f0"}`,borderRadius:12,padding:"11px 14px",fontSize:14,fontFamily:"'Noto Sans KR',sans-serif",color:"#374151",outline:"none",background:err?"#fff0f5":"#fafafa" }}
              />
              {err&&<div style={{ fontSize:12,color:"#f43f7a",marginTop:8,fontFamily:"'Noto Sans KR',sans-serif" }}>❌ {err}</div>}
            </div>
            <button onClick={tryLogin} style={{ width:"100%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:14,padding:"14px",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",boxShadow:"0 8px 24px #6366f130",marginBottom:14 }}>
              Login
            </button>
            <button onClick={()=>setMode("admin")} style={{ width:"100%",background:"none",border:"none",color:"#94a3b8",fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",padding:"4px" }}>
              ⚙️ Login as Admin
            </button>
          </div>
        ) : (
          <div style={{ background:"#fff",borderRadius:24,padding:28,boxShadow:"0 8px 40px #f43f7a10",border:"1.5px solid #fecdd3" }}>
            <div style={{ textAlign:"center",marginBottom:22 }}>
              <div style={{ fontSize:28,marginBottom:8 }}>🔐</div>
              <div style={{ fontSize:16,fontWeight:800,color:"#1e1b4b",fontFamily:"'Noto Sans KR',sans-serif" }}>Admin Login</div>
            </div>
            <input type="password" value={adminPw} onChange={e=>setAdminPw(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&tryAdmin()} placeholder="Admin Password" autoFocus
              style={{ width:"100%",border:`2px solid ${adminErr?"#f43f7a":"#e2e8f0"}`,borderRadius:12,padding:"11px 14px",fontSize:14,fontFamily:"'Noto Sans KR',sans-serif",outline:"none",marginBottom:12,background:adminErr?"#fff0f5":"#fafafa" }}
            />
            {adminErr&&<div style={{ fontSize:12,color:"#f43f7a",marginBottom:12,textAlign:"center",fontFamily:"'Noto Sans KR',sans-serif" }}>❌ Wrong Password</div>}
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>{setMode("teacher");setAdminPw("");}} style={{ flex:1,border:"2px solid #e2e8f0",borderRadius:12,padding:"11px",fontSize:13,fontWeight:700,color:"#64748b",background:"#fff",cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif" }}>Back</button>
              <button onClick={tryAdmin} style={{ flex:2,background:"linear-gradient(135deg,#f43f7a,#f97316)",color:"#fff",border:"none",borderRadius:12,padding:"11px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif" }}>Login</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Admin Panel
// ══════════════════════════════════════════════════════════
function AdminPanel({ teams, onSave, onClose }) {
  const [draft, setDraft] = useState(()=>JSON.parse(JSON.stringify(teams)));
  const [newTeamName, setNewTeamName] = useState("");
  const teamColors = ["#f43f7a","#10b981","#3b82f6","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#84cc16"];
  const updateTeamName = (oldName, newName) => {
    if (!newName.trim()||newName===oldName) return;
    const entries=Object.entries(draft); const idx=entries.findIndex(([k])=>k===oldName);
    if(idx<0)return; entries[idx]=[newName.trim(),entries[idx][1]]; setDraft(Object.fromEntries(entries));
  };
  const updateStudent = (t,i,v) => { const u={...draft,[t]:[...draft[t]]}; u[t][i]=v; setDraft(u); };
  const addStudent    = (t) => setDraft({...draft,[t]:[...draft[t],"New Student"]});
  const removeStudent = (t,i) => setDraft({...draft,[t]:draft[t].filter((_,j)=>j!==i)});
  const addTeam       = () => { if(!newTeamName.trim())return; setDraft({...draft,[newTeamName.trim()]:["Student1"]}); setNewTeamName(""); };
  const removeTeam    = (t) => { if(Object.keys(draft).length<=1)return; const{[t]:_,...rest}=draft; setDraft(rest); };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"#fff",borderRadius:28,width:"100%",maxWidth:700,maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 80px #00000030" }}>
        <div style={{ padding:"24px 28px 20px",borderBottom:"1.5px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#fff",borderRadius:"28px 28px 0 0",zIndex:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#f43f7a,#f97316)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>⚙️</div>
            <div>
              <div style={{ fontSize:18,fontWeight:800,color:"#1e1b4b",fontFamily:"'Noto Sans KR',sans-serif" }}>Admin Settings</div>
              <div style={{ fontSize:11,color:"#94a3b8",fontFamily:"'DM Mono',monospace" }}>TEAM & STUDENT EDITOR</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",borderRadius:10,width:36,height:36,fontSize:18,cursor:"pointer",color:"#64748b" }}>✕</button>
        </div>
        <div style={{ padding:"24px 28px" }}>
          {Object.entries(draft).map(([teamName,students],ti)=>{
            const accent=teamColors[ti%teamColors.length];
            return (
              <div key={teamName} style={{ marginBottom:20,borderRadius:20,border:`2px solid ${accent}20`,background:`${accent}06`,padding:"18px 20px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
                  <div style={{ width:10,height:10,borderRadius:"50%",background:accent,flexShrink:0 }}/>
                  <input defaultValue={teamName} onBlur={e=>updateTeamName(teamName,e.target.value)}
                    style={{ flex:1,border:`2px solid ${accent}30`,borderRadius:10,padding:"7px 12px",fontSize:14,fontWeight:800,color:"#1e1b4b",fontFamily:"'Noto Sans KR',sans-serif",outline:"none",background:"#fff" }}
                    onFocus={e=>e.target.style.borderColor=accent}
                  />
                  <span style={{ fontSize:11,color:"#94a3b8",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap" }}>{students.length} students</span>
                  <button onClick={()=>removeTeam(teamName)} style={{ background:"#fff1f2",border:"1.5px solid #fecdd3",borderRadius:8,padding:"5px 10px",fontSize:11,color:"#f43f7a",cursor:"pointer",fontWeight:700,fontFamily:"'Noto Sans KR',sans-serif" }}>Delete</button>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8 }}>
                  {students.map((sName,si)=>(
                    <div key={si} style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <input value={sName} onChange={e=>updateStudent(teamName,si,e.target.value)}
                        style={{ flex:1,border:"2px solid #f1f5f9",borderRadius:9,padding:"7px 10px",fontSize:13,color:"#374151",fontFamily:"'Noto Sans KR',sans-serif",outline:"none",background:"#fff",minWidth:0 }}
                        onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor="#f1f5f9"}
                      />
                      <button onClick={()=>removeStudent(teamName,si)} style={{ background:"none",border:"none",color:"#fca5a5",cursor:"pointer",fontSize:16,padding:"2px 4px",flexShrink:0 }}>×</button>
                    </div>
                  ))}
                  <button onClick={()=>addStudent(teamName)} style={{ border:`2px dashed ${accent}40`,borderRadius:9,padding:"7px 10px",fontSize:12,color:accent,cursor:"pointer",background:"transparent",fontFamily:"'Noto Sans KR',sans-serif",fontWeight:600 }}>+ + Student</button>
                </div>
              </div>
            );
          })}
          <div style={{ display:"flex",gap:10,marginBottom:24 }}>
            <input value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTeam()} placeholder="Enter team name"
              style={{ flex:1,border:"2px dashed #e2e8f0",borderRadius:12,padding:"10px 14px",fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",color:"#374151",outline:"none",background:"#fafbff" }}
            />
            <button onClick={addTeam} style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:12,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",whiteSpace:"nowrap" }}>+ Add Team</button>
          </div>
          <div style={{ display:"flex",gap:10 }}>
            <button onClick={onClose} style={{ flex:"0 0 auto",border:"2px solid #e2e8f0",borderRadius:14,padding:"13px 24px",fontSize:14,fontWeight:700,color:"#64748b",background:"#fff",cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif" }}>Cancel</button>
            <button onClick={()=>onSave(draft)} style={{ flex:1,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:14,padding:"13px",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",boxShadow:"0 8px 24px #6366f130" }}>💾 Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Anni Mini Panel
// ══════════════════════════════════════════════════════════
function AnniPanel({ teams, onSave, onClose }) {
  const [draft, setDraft] = useState(()=>JSON.parse(JSON.stringify(teams)));
  const [newTeamName, setNewTeamName] = useState("");
  const teamColors = ["#f43f7a","#10b981","#3b82f6","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#84cc16"];
  const updateTeamName = (oldName, newName) => {
    if (!newName.trim()||newName===oldName) return;
    const entries=Object.entries(draft); const idx=entries.findIndex(([k])=>k===oldName);
    if(idx<0)return; entries[idx]=[newName.trim(),entries[idx][1]]; setDraft(Object.fromEntries(entries));
  };
  const updateStudent = (t,i,v) => { const u={...draft,[t]:[...draft[t]]}; u[t][i]=v; setDraft(u); };
  const addStudent    = (t) => setDraft({...draft,[t]:[...draft[t],"New Student"]});
  const removeStudent = (t,i) => setDraft({...draft,[t]:draft[t].filter((_,j)=>j!==i)});
  const addTeam       = () => { if(!newTeamName.trim())return; setDraft({...draft,[newTeamName.trim()]:["Student1"]}); setNewTeamName(""); };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"#fff",borderRadius:28,width:"100%",maxWidth:620,maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 80px #00000030" }}>
        <div style={{ padding:"22px 26px 18px",borderBottom:"1.5px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#fff",borderRadius:"28px 28px 0 0",zIndex:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#10b981,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>👩‍🏫</div>
            <div>
              <div style={{ fontSize:17,fontWeight:800,color:"#1e1b4b",fontFamily:"'Noto Sans KR',sans-serif" }}>Class & Student Manager</div>
              <div style={{ fontSize:11,color:"#94a3b8",fontFamily:"'DM Mono',monospace" }}>TEAM & STUDENT EDITOR</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",borderRadius:10,width:36,height:36,fontSize:18,cursor:"pointer",color:"#64748b" }}>✕</button>
        </div>
        <div style={{ padding:"22px 26px" }}>
          <div style={{ marginBottom:16,padding:"12px 16px",background:"#f0fdf4",borderRadius:14,border:"1.5px solid #bbf7d0",fontSize:12,color:"#065f46",fontFamily:"'Noto Sans KR',sans-serif",lineHeight:1.7 }}>
            💡 You can add/delete class names and students.
          </div>
          {Object.entries(draft).map(([teamName,students],ti)=>{
            const accent=teamColors[ti%teamColors.length];
            return (
              <div key={teamName} style={{ marginBottom:18,borderRadius:20,border:`2px solid ${accent}20`,background:`${accent}06`,padding:"16px 18px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                  <div style={{ width:10,height:10,borderRadius:"50%",background:accent,flexShrink:0 }}/>
                  <input defaultValue={teamName} onBlur={e=>updateTeamName(teamName,e.target.value)}
                    style={{ flex:1,border:`2px solid ${accent}30`,borderRadius:10,padding:"7px 12px",fontSize:14,fontWeight:800,color:"#1e1b4b",fontFamily:"'Noto Sans KR',sans-serif",outline:"none",background:"#fff" }}
                    onFocus={e=>e.target.style.borderColor=accent}
                  />
                  <span style={{ fontSize:11,color:"#94a3b8",fontFamily:"'DM Mono',monospace" }}>{students.length} students</span>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8 }}>
                  {students.map((sName,si)=>(
                    <div key={si} style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <input value={sName} onChange={e=>updateStudent(teamName,si,e.target.value)}
                        style={{ flex:1,border:"2px solid #f1f5f9",borderRadius:9,padding:"7px 10px",fontSize:13,color:"#374151",fontFamily:"'Noto Sans KR',sans-serif",outline:"none",background:"#fff",minWidth:0 }}
                        onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor="#f1f5f9"}
                      />
                      <button onClick={()=>removeStudent(teamName,si)} style={{ background:"none",border:"none",color:"#fca5a5",cursor:"pointer",fontSize:16,padding:"2px 4px",flexShrink:0 }}>×</button>
                    </div>
                  ))}
                  <button onClick={()=>addStudent(teamName)} style={{ border:`2px dashed ${accent}40`,borderRadius:9,padding:"7px 10px",fontSize:12,color:accent,cursor:"pointer",background:"transparent",fontFamily:"'Noto Sans KR',sans-serif",fontWeight:600 }}>+ + Student</button>
                </div>
              </div>
            );
          })}
          <div style={{ display:"flex",gap:10,marginBottom:22 }}>
            <input value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTeam()} placeholder="Enter class name"
              style={{ flex:1,border:"2px dashed #e2e8f0",borderRadius:12,padding:"10px 14px",fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",color:"#374151",outline:"none",background:"#fafbff" }}
            />
            <button onClick={addTeam} style={{ background:"linear-gradient(135deg,#10b981,#3b82f6)",color:"#fff",border:"none",borderRadius:12,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",whiteSpace:"nowrap" }}>+ Add Class</button>
          </div>
          <div style={{ display:"flex",gap:10 }}>
            <button onClick={onClose} style={{ flex:"0 0 auto",border:"2px solid #e2e8f0",borderRadius:14,padding:"13px 24px",fontSize:14,fontWeight:700,color:"#64748b",background:"#fff",cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif" }}>Cancel</button>
            <button onClick={()=>onSave(draft)} style={{ flex:1,background:"linear-gradient(135deg,#10b981,#3b82f6)",color:"#fff",border:"none",borderRadius:14,padding:"13px",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",boxShadow:"0 8px 24px #10b98130" }}>💾 Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Student Chart — Print Feature
// ══════════════════════════════════════════════════════════
const CHART_EMPTY = {
  name:"", mainBook:"", date:"",
  listening1:"", listening2:"",
  pronunciation:"",
  tasks:["","","",""],
  homework:["","",""],
};

function StudentChart({ teams, onClose }) {
  const [chart, setChart] = useState({...CHART_EMPTY, tasks:["","","",""], homework:["","",""]});
  const [copied, setCopied] = useState(false);
  const [aiComment, setAiComment] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selTeam, setSelTeam] = useState(Object.keys(teams)[0]||"");
  const [selStudent, setSelStudent] = useState(Object.values(teams)[0]?.[0]||"");
  const tColors = ["#f43f7a","#10b981","#3b82f6","#f59e0b","#8b5cf6"];
  const upd = (k,v) => setChart(c=>({...c,[k]:v}));
  const updArr = (k,i,v) => setChart(c=>{ const a=[...c[k]]; a[i]=v; return {...c,[k]:a}; });
  const selectStudent = (t,s) => { setSelTeam(t); setSelStudent(s); setChart(c=>({...c,name:s})); };
  const teamColorMap = Object.fromEntries(Object.keys(teams).map((t,i)=>[t,tColors[i%tColors.length]]));

  const buildText = () => {
    const tk = chart.tasks.filter(x=>x.trim());
    const hw = chart.homework.filter(x=>x.trim());
    return `📋 Student Chart
👤 ${chart.name||"(Name)"}  /  📚 ${chart.mainBook||"(Book)"}  /  📅 ${chart.date||"(Date)"}

🎧 Intensive Listening
  · ${chart.listening1||"-"}
  · ${chart.listening2||"-"}

🗣 Pronunciation & Comprehension Check
  ${chart.pronunciation||"-"}

✅ Today's Task
${tk.length?tk.map((x,i)=>`  ${i+1}. ${x}`).join("\n"):"  —"}

🏠 Home Connection / Unfinished Work
${hw.length?hw.map((x,i)=>`  ${i+1}. ${x}`).join("\n"):"  —"}${aiComment?`

💬 Teacher's Comment
  ${aiComment}`:""}`;
  };

  // 🖨️ Student Chart Print
  const handlePrintChart = () => {
    const tk = chart.tasks.filter(x=>x.trim());
    const hw = chart.homework.filter(x=>x.trim());
    const today = chart.date || new Date().toLocaleDateString("ko-KR");
    const html = `
      <div style="font-family:'Noto Sans KR',sans-serif;">
        <div style="background:linear-gradient(135deg,#10b981,#3b82f6);color:#fff;padding:16px 20px;border-radius:10px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:10px;letter-spacing:2px;opacity:0.75;margin-bottom:3px;font-weight:500;">Sue Reading Academy</div>
            <div style="font-size:20px;font-weight:800;letter-spacing:-0.5px;">📋 Student Chart</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:16px;">
          <div style="flex:1;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:12px 16px;">
            <div style="font-size:10px;color:#10b981;font-weight:700;margin-bottom:4px;">👤 Name</div>
            <div style="font-size:16px;font-weight:800;color:#1e1b4b;">${chart.name||"-"}</div>
          </div>
          <div style="flex:2;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:12px 16px;">
            <div style="font-size:10px;color:#3b82f6;font-weight:700;margin-bottom:4px;">📚 Book</div>
            <div style="font-size:14px;font-weight:700;color:#1e1b4b;">${chart.mainBook||"-"}</div>
          </div>
          <div style="flex:1;background:#faf5ff;border:1.5px solid #ddd6fe;border-radius:10px;padding:12px 16px;">
            <div style="font-size:10px;color:#8b5cf6;font-weight:700;margin-bottom:4px;">📅 Date</div>
            <div style="font-size:13px;font-weight:700;color:#1e1b4b;">${today}</div>
          </div>
        </div>
        <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:12px;">
          <div style="font-size:10px;color:#3b82f6;font-weight:700;letter-spacing:1px;margin-bottom:8px;">🎧 INTENSIVE LISTENING</div>
          <div style="font-size:13px;color:#1e1b4b;margin-bottom:4px;">· ${chart.listening1||"-"}</div>
          <div style="font-size:13px;color:#1e1b4b;">· ${chart.listening2||"-"}</div>
        </div>
        <div style="background:#faf5ff;border:1.5px solid #ddd6fe;border-radius:10px;padding:14px 16px;margin-bottom:12px;">
          <div style="font-size:10px;color:#8b5cf6;font-weight:700;letter-spacing:1px;margin-bottom:8px;">🗣 PRONUNCIATION & COMPREHENSION CHECK</div>
          <div style="font-size:13px;color:#1e1b4b;line-height:1.7;">${chart.pronunciation||"-"}</div>
        </div>
        <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin-bottom:12px;">
          <div style="font-size:10px;color:#10b981;font-weight:700;letter-spacing:1px;margin-bottom:8px;">✅ TODAY'S TASK</div>
          ${tk.length?tk.map((x,i)=>`<div style="font-size:13px;color:#1e1b4b;margin-bottom:4px;"><span style="color:#10b981;font-weight:700;">${i+1}.</span> ${x}</div>`).join(""):'<div style="font-size:13px;color:#94a3b8;">—</div>'}
        </div>
        <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:14px 16px;margin-bottom:${aiComment?'12px':'0'};">
          <div style="font-size:10px;color:#f59e0b;font-weight:700;letter-spacing:1px;margin-bottom:8px;">🏠 HOME CONNECTION / UNFINISHED WORK</div>
          ${hw.length?hw.map((x,i)=>`<div style="font-size:13px;color:#1e1b4b;margin-bottom:4px;"><span style="color:#f59e0b;font-weight:700;">${i+1}.</span> ${x}</div>`).join(""):'<div style="font-size:13px;color:#94a3b8;">—</div>'}
        </div>
        ${aiComment?`
        <div style="background:linear-gradient(135deg,#eff6ff,#faf5ff);border:1.5px solid #e0e7ff;border-radius:10px;padding:14px 16px;margin-top:12px;">
          <div style="font-size:10px;color:#6366f1;font-weight:700;letter-spacing:1px;margin-bottom:8px;">💬 Teacher's Comment</div>
          <div style="font-size:13px;color:#374151;line-height:1.8;">${aiComment}</div>
        </div>`:""}
        <div style="margin-top:20px;padding-top:14px;border-top:1px solid #f1f5f9;text-align:center;font-size:10px;color:#94a3b8;">
          Sue Reading Academy · Academy Report System · ${today}
        </div>
      </div>`;
    printHtml(html, `Student Chart - ${chart.name||"Student"}`);
  };

  const handleCopy = async () => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:-9999px;top:0;width:600px;background:#fff;padding:24px;font-family:Noto Sans KR,sans-serif;';
    el.innerHTML = buildPrintHtml();
    document.body.appendChild(el);
    try {
      const canvas = await html2canvas(el, { scale:2, useCORS:true, backgroundColor:'#fff' });
      canvas.toBlob(async (blob) => {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true); setTimeout(()=>setCopied(false),2000);
      });
    } catch(e) { 
      navigator.clipboard.writeText(buildText());
      setCopied(true); setTimeout(()=>setCopied(false),2000);
    } finally { document.body.removeChild(el); }
  };

  const buildPrintHtml = () => {
    const tk = chart.tasks.filter(x=>x.trim());
    const hw = chart.homework.filter(x=>x.trim());
    const today = chart.date || new Date().toLocaleDateString("ko-KR");
    return `<div style="font-family:'Noto Sans KR',sans-serif;max-width:560px;">
      <div style="background:linear-gradient(135deg,#10b981,#3b82f6);color:#fff;padding:16px 20px;border-radius:10px;margin-bottom:16px;">
        <div style="font-size:10px;letter-spacing:2px;opacity:0.75;margin-bottom:3px;">Sue Reading Academy</div>
        <div style="font-size:20px;font-weight:800;">📋 Student Chart</div>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:12px;">
        <div style="flex:1;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:10px 14px;">
          <div style="font-size:9px;color:#10b981;font-weight:700;letter-spacing:1px;margin-bottom:3px;">NAME</div>
          <div style="font-size:15px;font-weight:800;color:#1e1b4b;">\${chart.name||"-"}</div>
        </div>
        <div style="flex:2;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;padding:10px 14px;">
          <div style="font-size:9px;color:#3b82f6;font-weight:700;letter-spacing:1px;margin-bottom:3px;">BOOK TITLE</div>
          <div style="font-size:13px;font-weight:700;color:#1e1b4b;">\${chart.mainBook||"-"}</div>
        </div>
        <div style="flex:1;background:#faf5ff;border:1.5px solid #ddd6fe;border-radius:8px;padding:10px 14px;">
          <div style="font-size:9px;color:#8b5cf6;font-weight:700;letter-spacing:1px;margin-bottom:3px;">DATE</div>
          <div style="font-size:12px;font-weight:700;color:#1e1b4b;">\${today}</div>
        </div>
      </div>
      <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;padding:12px 14px;margin-bottom:10px;">
        <div style="font-size:9px;color:#3b82f6;font-weight:700;letter-spacing:1px;margin-bottom:6px;">🎧 INTENSIVE LISTENING</div>
        <div style="font-size:12px;color:#1e1b4b;margin-bottom:3px;">· \${chart.listening1||"-"}</div>
        <div style="font-size:12px;color:#1e1b4b;">· \${chart.listening2||"-"}</div>
      </div>
      <div style="background:#faf5ff;border:1.5px solid #ddd6fe;border-radius:8px;padding:12px 14px;margin-bottom:10px;">
        <div style="font-size:9px;color:#8b5cf6;font-weight:700;letter-spacing:1px;margin-bottom:6px;">🗣 PRONUNCIATION & COMPREHENSION CHECK</div>
        <div style="font-size:12px;color:#1e1b4b;line-height:1.6;">\${chart.pronunciation||"-"}</div>
      </div>
      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:12px 14px;margin-bottom:10px;">
        <div style="font-size:9px;color:#10b981;font-weight:700;letter-spacing:1px;margin-bottom:6px;">✅ TODAY'S TASK</div>
        \${tk.length?tk.map((x,i)=>\`<div style="font-size:12px;color:#1e1b4b;margin-bottom:3px;"><span style="color:#10b981;font-weight:700;">\${i+1}.</span> \${x}</div>\`).join(""):'<div style="font-size:12px;color:#94a3b8;">—</div>'}
      </div>
      <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:8px;padding:12px 14px;margin-bottom:\${aiComment?'10px':'0'};">
        <div style="font-size:9px;color:#f59e0b;font-weight:700;letter-spacing:1px;margin-bottom:6px;">🏠 HOME CONNECTION / UNFINISHED WORK</div>
        \${hw.length?hw.map((x,i)=>\`<div style="font-size:12px;color:#1e1b4b;margin-bottom:3px;"><span style="color:#f59e0b;font-weight:700;">\${i+1}.</span> \${x}</div>\`).join(""):'<div style="font-size:12px;color:#94a3b8;">—</div>'}
      </div>
      \${aiComment?\`<div style="background:linear-gradient(135deg,#eff6ff,#faf5ff);border:1.5px solid #e0e7ff;border-radius:8px;padding:12px 14px;">
        <div style="font-size:9px;color:#6366f1;font-weight:700;letter-spacing:1px;margin-bottom:6px;">💬 Teacher's Comment</div>
        <div style="font-size:12px;color:#374151;line-height:1.7;">\${aiComment}</div>
      </div>\`:""}
    </div>\`;
  };

  const genAiComment = async () => {
    setAiLoading(true);
    const tk = chart.tasks.filter(x=>x.trim());
    const hw = chart.homework.filter(x=>x.trim());
    const prompt = [
      "You are an English academy teacher.",
      "Write a warm 2-3 sentence parent comment based on:",
      "Student: " + (chart.name||"Student"),
      "Book: " + (chart.mainBook||"N/A"),
      "Date: " + (chart.date||"Today"),
      "Listening: " + (chart.listening1||"-") + ", " + (chart.listening2||"-"),
      "Pronunciation: " + (chart.pronunciation||"-"),
      "Tasks: " + (tk.join(", ")||"-"),
      "Homework: " + (hw.join(", ")||"-"),
      "Requirements: Start with student name, mention today's lesson, end with encouragement. Plain text only."
    ].join("\n");
    try {
      const url = APPS_SCRIPT_URL + "?action=generateFeedback&prompt=" + encodeURIComponent(prompt);
      const res = await fetch(url);
      const data = await res.json();
      setAiComment(data.text||"");
    } catch(e) { setAiComment("Failed to generate - please try again"); }
    finally { setAiLoading(false); }
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto" }}>
      <div style={{ background:"#fff",borderRadius:28,width:"100%",maxWidth:640,maxHeight:"94vh",overflow:"auto",boxShadow:"0 24px 80px #00000030" }}>
        <div style={{ padding:"22px 26px 18px",borderBottom:"1.5px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#fff",borderRadius:"28px 28px 0 0",zIndex:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#10b981,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>📋</div>
            <div>
              <div style={{ fontSize:17,fontWeight:800,color:"#1e1b4b",fontFamily:"'Noto Sans KR',sans-serif" }}>Student Chart</div>
              <div style={{ fontSize:11,color:"#94a3b8",fontFamily:"'DM Mono',monospace" }}>Sue Reading Academy</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"#f1f5f9",border:"none",borderRadius:10,width:36,height:36,fontSize:18,cursor:"pointer",color:"#64748b" }}>✕</button>
        </div>
        <div style={{ padding:"22px 26px" }}>
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,marginBottom:10,fontFamily:"'DM Mono',monospace" }}>Select Student</div>
            {Object.entries(teams).map(([tName,students],ti)=>{
              const accent=teamColorMap[tName]||"#6366f1";
              return (
                <div key={tName} style={{ marginBottom:8 }}>
                  <div style={{ fontSize:11,color:accent,fontWeight:700,marginBottom:6,fontFamily:"'DM Mono',monospace" }}>{tName} Team</div>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                    {students.map(s=>{
                      const on=selStudent===s&&selTeam===tName;
                      return <button key={s} onClick={()=>selectStudent(tName,s)} style={{ padding:"6px 14px",borderRadius:12,border:on?`2px solid ${accent}`:"2px solid #f1f5f9",background:on?accent:"#fafafa",color:on?"#fff":"#94a3b8",fontSize:12,fontWeight:on?700:500,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",transition:"all .15s" }}>{s}</button>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr 1fr",gap:10,marginBottom:14 }}>
            {[{label:"Name",key:"name",ph:"Student Name"},{label:"Main Book Title",key:"mainBook",ph:"Book Title"},{label:"Date",key:"date",ph:"Date",type:"date"}].map(({label,key,ph,type})=>(
              <div key={key}>
                <div style={{ fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:5,fontFamily:"'DM Mono',monospace" }}>{label}</div>
                <input type={type||"text"} value={chart[key]} onChange={e=>upd(key,e.target.value)} placeholder={ph}
                  style={{ width:"100%",boxSizing:"border-box",border:"2px solid #f1f5f9",borderRadius:10,padding:"8px 10px",fontSize:12,fontFamily:"'Noto Sans KR',sans-serif",color:"#374151",background:"#fafafa",outline:"none" }}
                  onFocus={e=>e.target.style.borderColor="#10b981"} onBlur={e=>e.target.style.borderColor="#f1f5f9"}
                />
              </div>
            ))}
          </div>
          <div style={{ background:"#f8fafc",borderRadius:16,border:"1.5px solid #f1f5f9",padding:"14px 16px",marginBottom:10 }}>
            <div style={{ fontSize:10,fontWeight:700,color:"#3b82f6",marginBottom:8,fontFamily:"'DM Mono',monospace",letterSpacing:1 }}>🎧 INTENSIVE LISTENING</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
              {["listening1","listening2"].map((k,i)=>(
                <input key={k} value={chart[k]} onChange={e=>upd(k,e.target.value)} placeholder={`Item ${i+1}`}
                  style={{ border:"2px solid #f1f5f9",borderRadius:10,padding:"8px 12px",fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",color:"#374151",background:"#fff",outline:"none" }}
                  onFocus={e=>e.target.style.borderColor="#3b82f6"} onBlur={e=>e.target.style.borderColor="#f1f5f9"}
                />
              ))}
            </div>
          </div>
          <div style={{ background:"#f8fafc",borderRadius:16,border:"1.5px solid #f1f5f9",padding:"14px 16px",marginBottom:10 }}>
            <div style={{ fontSize:10,fontWeight:700,color:"#8b5cf6",marginBottom:8,fontFamily:"'DM Mono',monospace",letterSpacing:1 }}>🗣 PRONUNCIATION & COMPREHENSION CHECK</div>
            <textarea value={chart.pronunciation} onChange={e=>upd("pronunciation",e.target.value)} placeholder="Enter pronunciation & comprehension notes"
              style={{ width:"100%",boxSizing:"border-box",border:"2px solid #f1f5f9",borderRadius:10,padding:"10px 12px",fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",color:"#374151",background:"#fff",outline:"none",resize:"vertical",minHeight:72,lineHeight:1.7 }}
              onFocus={e=>e.target.style.borderColor="#8b5cf6"} onBlur={e=>e.target.style.borderColor="#f1f5f9"}
            />
          </div>
          <div style={{ background:"#f8fafc",borderRadius:16,border:"1.5px solid #f1f5f9",padding:"14px 16px",marginBottom:10 }}>
            <div style={{ fontSize:10,fontWeight:700,color:"#10b981",marginBottom:8,fontFamily:"'DM Mono',monospace",letterSpacing:1 }}>✅ TODAY'S TASK</div>
            {chart.tasks.map((v,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:i<3?8:0 }}>
                <span style={{ fontSize:12,fontWeight:700,color:"#10b981",fontFamily:"'DM Mono',monospace",width:16,flexShrink:0 }}>{i+1}.</span>
                <input value={v} onChange={e=>updArr("tasks",i,e.target.value)} placeholder={`Task ${i+1}`}
                  style={{ flex:1,border:"2px solid #f1f5f9",borderRadius:10,padding:"8px 12px",fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",color:"#374151",background:"#fff",outline:"none" }}
                  onFocus={e=>e.target.style.borderColor="#10b981"} onBlur={e=>e.target.style.borderColor="#f1f5f9"}
                />
              </div>
            ))}
          </div>
          <div style={{ background:"#f8fafc",borderRadius:16,border:"1.5px solid #f1f5f9",padding:"14px 16px",marginBottom:16 }}>
            <div style={{ fontSize:10,fontWeight:700,color:"#f59e0b",marginBottom:8,fontFamily:"'DM Mono',monospace",letterSpacing:1 }}>🏠 HOME CONNECTION / UNFINISHED WORK</div>
            {chart.homework.map((v,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:i<2?8:0 }}>
                <span style={{ fontSize:12,fontWeight:700,color:"#f59e0b",fontFamily:"'DM Mono',monospace",width:16,flexShrink:0 }}>{i+1}.</span>
                <input value={v} onChange={e=>updArr("homework",i,e.target.value)} placeholder={`HW ${i+1}`}
                  style={{ flex:1,border:"2px solid #f1f5f9",borderRadius:10,padding:"8px 12px",fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",color:"#374151",background:"#fff",outline:"none" }}
                  onFocus={e=>e.target.style.borderColor="#f59e0b"} onBlur={e=>e.target.style.borderColor="#f1f5f9"}
                />
              </div>
            ))}
          </div>
          <button onClick={genAiComment} disabled={aiLoading} style={{ width:"100%",marginBottom:10,padding:"14px",background:aiLoading?"#f1f5f9":"linear-gradient(135deg,#6366f1,#8b5cf6)",color:aiLoading?"#94a3b8":"#fff",border:"none",borderRadius:14,fontSize:14,fontWeight:800,cursor:aiLoading?"not-allowed":"pointer",fontFamily:"'Noto Sans KR',sans-serif",boxShadow:aiLoading?"none":"0 8px 24px #6366f130",transition:"all .2s" }}>
            {aiLoading?"✨ Generating AI Comment...":"✨ Generate AI Comment"}
          </button>
          {aiComment && (
            <div style={{ background:"linear-gradient(135deg,#eff6ff,#faf5ff)",borderRadius:14,border:"2px solid #e0e7ff",padding:"14px 16px",marginBottom:12 }}>
              <div style={{ fontSize:10,fontWeight:700,color:"#6366f1",marginBottom:8,fontFamily:"'DM Mono',monospace",letterSpacing:1.5 }}>💬 AI Comment Preview</div>
              <p style={{ margin:0,fontSize:13,color:"#374151",fontFamily:"'Noto Sans KR',sans-serif",lineHeight:1.9,whiteSpace:"pre-wrap" }}>{aiComment}</p>
              <button onClick={()=>setAiComment("")} style={{ marginTop:8,background:"none",border:"none",color:"#94a3b8",fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif" }}>× Delete Comment</button>
            </div>
          )}
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={()=>{ setChart({...CHART_EMPTY,tasks:["","","",""],homework:["","",""],name:selStudent}); setAiComment(""); }} style={{ flex:"0 0 auto",border:"2px solid #e2e8f0",borderRadius:14,padding:"13px 16px",fontSize:13,fontWeight:700,color:"#64748b",background:"#fff",cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif" }}>🔄 Reset</button>
            <button onClick={handlePrintChart} style={{ flex:"0 0 auto",background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:14,padding:"13px 16px",fontSize:13,fontWeight:700,color:"#10b981",cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif" }}>🖨️ Print</button>
            <button onClick={handleCopy} style={{ flex:1,background:copied?"linear-gradient(135deg,#10b981,#059669)":"linear-gradient(135deg,#10b981,#3b82f6)",color:"#fff",border:"none",borderRadius:14,padding:"13px",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",boxShadow:"0 8px 24px #10b98130",transition:"all .2s" }}>
              {copied?"✅ Image Copied!":"🖼️ Copy as Image"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Main App
// ══════════════════════════════════════════════════════════
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [teams, setTeams]         = useState(loadTeams);
  const [tab,setTab]             = useState("weekly");
  const [team,setTeam]           = useState(()=>Object.keys(loadTeams())[0]);
  const [student,setStudent]     = useState(()=>Object.values(loadTeams())[0][0]);
  const [weeks,setWeeks]         = useState(Array.from({length:4},()=>({...WEEK_EMPTY})));
  const [wIdx,setWIdx]           = useState(0);
  const [weeklyRes,setWeeklyRes] = useState("");
  const [monthlyRes,setMonthlyRes]=useState("");
  const [loading,setLoading]     = useState(false);
  const [syncing,setSyncing]     = useState(false);
  const [toast,setToast]         = useState("");
  const [wSaved,setWSaved]       = useState(false);
  const [mSaved,setMSaved]       = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAnniPanel,  setShowAnniPanel]  = useState(false);
  const [showChartPanel, setShowChartPanel] = useState(false);

  const teamColorMap = Object.fromEntries(Object.keys(teams).map((t,i)=>[t,TEAM_COLOR_LIST[i%TEAM_COLOR_LIST.length]]));
  const tc = teamColorMap[team] || TEAM_COLOR_LIST[0];
  const isAdmin   = currentUser === "admin";
  const isManager = currentUser?.role === "manager";

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(""),2500); };

  const handleLogin = (teacher) => {
    setCurrentUser(teacher);
    const ft=Object.keys(teams)[0]; const fs=teams[ft]?.[0]||"";
    setTeam(ft); setStudent(fs);
    if(ft&&fs) loadStudentData(ft,fs);
  };
  const handleAdminLogin = () => {
    setCurrentUser("admin");
    const ft=Object.keys(teams)[0]; const fs=teams[ft]?.[0]||"";
    setTeam(ft); setStudent(fs);
    if(ft&&fs) loadStudentData(ft,fs);
  };
  const handleLogout = () => {
    setCurrentUser(null);
    setWeeklyRes(""); setMonthlyRes("");
    setWeeks(Array.from({length:4},()=>({...WEEK_EMPTY})));
  };
  const handleAdminSave = (newTeams) => {
    setTeams(newTeams); saveTeams(newTeams);
    const ft=Object.keys(newTeams)[0]; const fs=newTeams[ft][0];
    setTeam(ft); setStudent(fs);
    setShowAdminPanel(false);
    showToast("✅ Team/Student info saved");
    loadStudentData(ft,fs);
  };
  const handleAnniSave = (newTeams) => {
    setTeams(newTeams); saveTeams(newTeams);
    const ft=Object.keys(newTeams)[0]; const fs=newTeams[ft]?.[0]||"";
    setTeam(ft); setStudent(fs);
    setShowAnniPanel(false);
    showToast("✅ Class/Student info saved");
    if(fs) loadStudentData(ft,fs);
  };

  const loadStudentData = async (t,s) => {
    setSyncing(true);
    try {
      const data = await loadFromSheet(t,s);
      setWeeks(data.length>=4?data:[...data,...Array.from({length:4-data.length},()=>({...WEEK_EMPTY}))]);
      setWeeklyRes(""); setMonthlyRes(""); setWSaved(false); setMSaved(false);
    } catch(e) { setWeeks(Array.from({length:4},()=>({...WEEK_EMPTY}))); }
    finally { setSyncing(false); }
  };

  const changeTeam    = async (t) => { setTeam(t); const s=teams[t][0]; setStudent(s); await loadStudentData(t,s); };
  const changeStudent = async (s) => { setStudent(s); await loadStudentData(team,s); };

  useEffect(()=>{ if(currentUser) loadStudentData(team,student); },[currentUser]);

  const updateWeek = (i,d) => { const w=[...weeks]; w[i]=d; setWeeks(w); };

  const saveWeekData = async () => {
    setSyncing(true);
    try { await saveToSheet({team,student,weekIndex:wIdx,week:weeks[wIdx]}); showToast("✅ Saved to Google Sheets"); }
    catch(e) { showToast("❌ Save failed - check network"); }
    finally { setSyncing(false); }
  };

  const genWeekly = async () => {
    setLoading(true); setWeeklyRes(""); setWSaved(false);
    try {
      const text=await callClaude(buildWeeklyPrompt(team,student,weeks[wIdx]));
      setWeeklyRes(text);
      await saveToSheet({team,student,weekIndex:wIdx,week:weeks[wIdx]});
      await saveFeedback(team,student,"weekly",text);
      setWSaved(true); showToast("✅ Feedback generated & saved");
    } catch(e) { showToast("❌ Error: "+e.message); }
    finally { setLoading(false); }
  };

  const genMonthly = async () => {
    setLoading(true); setMonthlyRes(""); setMSaved(false);
    try {
      const text=await callClaude(buildMonthlyPrompt(team,student,weeks));
      setMonthlyRes(text);
      await saveFeedback(team,student,"monthly",text);
      setMSaved(true); showToast("✅ Monthly report generated & saved");
    } catch(e) { showToast("❌ Error: "+e.message); }
    finally { setLoading(false); }
  };

  // Print Weekly Report
  const printWeekly = () => {
    const w = weeks[wIdx];
    const today = w.date || new Date().toLocaleDateString("ko-KR");
    const html = `
      <div style="max-width:600px;margin:0 auto;font-family:'Noto Sans KR',sans-serif;">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:20px;">
          <div style="font-size:11px;letter-spacing:2px;opacity:0.8;margin-bottom:4px;">Sue Reading Academy · Weekly Report</div>
          <div style="font-size:22px;font-weight:800;">📅 Weekly Report</div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:16px;">
          <div style="flex:1;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:12px;">
            <div style="font-size:10px;color:#6366f1;font-weight:700;margin-bottom:2px;">Student</div>
            <div style="font-size:16px;font-weight:800;color:#1e1b4b;">${student}</div>
          </div>
          <div style="flex:1;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:12px;">
            <div style="font-size:10px;color:#10b981;font-weight:700;margin-bottom:2px;">Class</div>
            <div style="font-size:14px;font-weight:700;color:#1e1b4b;">${team} Team</div>
          </div>
          <div style="flex:1;background:#faf5ff;border:1.5px solid #ddd6fe;border-radius:10px;padding:12px;">
            <div style="font-size:10px;color:#8b5cf6;font-weight:700;margin-bottom:2px;">Date</div>
            <div style="font-size:13px;font-weight:700;color:#1e1b4b;">${today}</div>
          </div>
          <div style="flex:1;background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:12px;">
            <div style="font-size:10px;color:#f59e0b;font-weight:700;margin-bottom:2px;">Week</div>
            <div style="font-size:14px;font-weight:700;color:#1e1b4b;">W${wIdx+1}</div>
          </div>
        </div>
        <div style="background:#f8fafc;border:1.5px solid #f1f5f9;border-radius:12px;padding:16px;margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:12px;letter-spacing:1px;">Learning Data</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:${w.grammar||w.reading||w.writing?'12px':'0'};">
            <div style="text-align:center;background:#fff;border-radius:10px;padding:10px;border:1.5px solid #f1f5f9;">
              <div style="font-size:10px;color:#94a3b8;margin-bottom:4px;">Wordly Wise</div>
              <div style="font-size:15px;font-weight:800;color:${WW_C[w.ww]||'#374151'};">${w.ww||"-"}</div>
            </div>
            <div style="text-align:center;background:#fff;border-radius:10px;padding:10px;border:1.5px solid #f1f5f9;">
              <div style="font-size:10px;color:#94a3b8;margin-bottom:4px;">Homework</div>
              <div style="font-size:15px;font-weight:800;color:${HW_C[w.hw]||'#374151'};">${w.hw||"-"}</div>
            </div>
            <div style="text-align:center;background:#fff;border-radius:10px;padding:10px;border:1.5px solid #f1f5f9;">
              <div style="font-size:10px;color:#94a3b8;margin-bottom:4px;">Attitude</div>
              <div style="font-size:15px;font-weight:800;color:${ATT_C[w.attitude]||'#374151'};">${w.attitude||"-"}</div>
            </div>
          </div>
          ${w.grammar||w.reading||w.writing?`<div style="display:grid;gap:8px;">
            ${w.grammar?`<div style="background:#fff;border-radius:8px;padding:8px 12px;border:1.5px solid #f1f5f9;font-size:13px;color:#374151;"><span style="font-weight:700;color:#6366f1;">📐 Grammar:</span> ${w.grammar}</div>`:""}
            ${w.reading?`<div style="background:#fff;border-radius:8px;padding:8px 12px;border:1.5px solid #f1f5f9;font-size:13px;color:#374151;"><span style="font-weight:700;color:#10b981;">📖 Reading:</span> ${w.reading}</div>`:""}
            ${w.writing?`<div style="background:#fff;border-radius:8px;padding:8px 12px;border:1.5px solid #f1f5f9;font-size:13px;color:#374151;"><span style="font-weight:700;color:#f59e0b;">✍️ Writing:</span> ${w.writing}</div>`:""}
          </div>`:""}
        </div>
        ${weeklyRes?`
        <div style="background:linear-gradient(135deg,#eff6ff,#faf5ff);border:2px solid #e0e7ff;border-radius:12px;padding:20px;">
          <div style="font-size:10px;font-weight:700;color:#a5b4fc;margin-bottom:12px;letter-spacing:2px;">AI FEEDBACK</div>
          <p style="margin:0;line-height:1.9;color:#374151;font-size:14px;white-space:pre-wrap;">${weeklyRes}</p>
        </div>`:""}
        <div style="margin-top:20px;padding-top:14px;border-top:1px solid #f1f5f9;text-align:center;font-size:10px;color:#94a3b8;">
          Sue Reading Academy · Academy Report System · ${today}
        </div>
      </div>`;
    printHtml(html, `Weekly Report - ${student} W${wIdx+1}`);
  };

  // 🖨️ Monthly Report Print
  const printMonthly = () => {
    const filled2 = weeks.filter(w=>w.ww||w.hw||w.attitude);
    const wwPass2  = filled2.filter(w=>w.ww==="Pass").length;
    const wwTotal2 = filled2.filter(w=>w.ww==="Pass"||w.ww==="Retest").length;
    const hwGood2  = filled2.filter(w=>w.hw==="Excellent"||w.hw==="Good").length;
    const attGood2 = filled2.filter(w=>w.attitude==="Active").length;
    const today   = new Date().toLocaleDateString("ko-KR");
    const html = `
      <div style="max-width:600px;margin:0 auto;font-family:'Noto Sans KR',sans-serif;">
        <div style="background:linear-gradient(135deg,#8b5cf6,#6366f1,#3b82f6);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:20px;">
          <div style="font-size:11px;letter-spacing:2px;opacity:0.8;margin-bottom:4px;">Sue Reading Academy · Monthly Report</div>
          <div style="font-size:22px;font-weight:800;">🏆 Monthly Report</div>
          <div style="font-size:14px;margin-top:6px;opacity:0.9;">${team} Team · ${student}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
          <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:10px;color:#10b981;font-weight:700;margin-bottom:4px;">WW Pass</div>
            <div style="font-size:24px;font-weight:800;color:#10b981;">${wwPass2}</div>
          </div>
          <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:10px;color:#f59e0b;font-weight:700;margin-bottom:4px;">Pass Rate</div>
            <div style="font-size:24px;font-weight:800;color:#f59e0b;">${wwTotal2>0?Math.round(wwPass2/wwTotal2*100):0}%</div>
          </div>
          <div style="background:#faf5ff;border:1.5px solid #ddd6fe;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:10px;color:#8b5cf6;font-weight:700;margin-bottom:4px;">HW Rate</div>
            <div style="font-size:24px;font-weight:800;color:#8b5cf6;">${filled2.length>0?Math.round(hwGood2/filled2.length*100):0}%</div>
          </div>
          <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:10px;color:#3b82f6;font-weight:700;margin-bottom:4px;">Active Count</div>
            <div style="font-size:24px;font-weight:800;color:#3b82f6;">${attGood2}</div>
          </div>
          <div style="background:#f8fafc;border:1.5px solid #f1f5f9;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:10px;color:#94a3b8;font-weight:700;margin-bottom:4px;">Weeks</div>
            <div style="font-size:24px;font-weight:800;color:#94a3b8;">${filled2.length}</div>
          </div>
          <div style="background:#fff0f5;border:1.5px solid #fecdd3;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:10px;color:#f43f7a;font-weight:700;margin-bottom:4px;">Retest</div>
            <div style="font-size:24px;font-weight:800;color:#f43f7a;">${wwTotal2-wwPass2}</div>
          </div>
        </div>
        ${monthlyRes?`
        <div style="background:linear-gradient(135deg,#eff6ff,#faf5ff);border:2px solid #e0e7ff;border-radius:12px;padding:20px;margin-bottom:16px;">
          <div style="font-size:10px;font-weight:700;color:#a5b4fc;margin-bottom:12px;letter-spacing:2px;">AI MONTHLY FEEDBACK</div>
          <p style="margin:0;line-height:1.9;color:#374151;font-size:14px;white-space:pre-wrap;">${monthlyRes}</p>
        </div>`:""}
        <div style="margin-top:20px;padding-top:14px;border-top:1px solid #f1f5f9;text-align:center;font-size:10px;color:#94a3b8;">
          Sue Reading Academy · Academy Report System · ${today}
        </div>
      </div>`;
    printHtml(html, `Monthly Report - ${student}`);
  };

  const filled  = weeks.filter(w=>w.ww||w.hw||w.attitude);
  const wwPass  = filled.filter(w=>w.ww==="Pass").length;
  const wwTotal = filled.filter(w=>w.ww==="Pass"||w.ww==="Retest").length;
  const hwGood  = filled.filter(w=>w.hw==="Excellent"||w.hw==="Good").length;
  const attGood = filled.filter(w=>w.attitude==="Active").length;

  if (!currentUser) return <LoginScreen onLogin={handleLogin} onAdminLogin={handleAdminLogin}/>;

  return (
    <div style={{ minHeight:"100vh",background:"linear-gradient(150deg,#f0f4ff 0%,#fdf4ff 50%,#f0fdf9 100%)",fontFamily:"'Noto Sans KR',sans-serif",paddingBottom:60 }}>
      {showAdminPanel && <AdminPanel teams={teams} onSave={handleAdminSave} onClose={()=>setShowAdminPanel(false)}/>}
      {showAnniPanel  && <AnniPanel  teams={teams} onSave={handleAnniSave}  onClose={()=>setShowAnniPanel(false)}/>}
      {showChartPanel && <StudentChart teams={teams} onClose={()=>setShowChartPanel(false)}/>}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&family=DM+Mono:wght@500;700&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        *{box-sizing:border-box;}
      `}</style>

      {/* Header */}
      <div style={{ background:"#fff",borderBottom:"1.5px solid #f1f5f9",padding:"20px 24px",boxShadow:"0 2px 20px #6366f10a" }}>
        <div style={{ maxWidth:780,margin:"0 auto",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap" }}>
          <div style={{ width:46,height:46,borderRadius:14,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:"0 6px 18px #6366f130",flexShrink:0 }}>📚</div>
          <div>
            <h1 style={{ margin:0,fontSize:22,fontWeight:800,color:"#1e1b4b",letterSpacing:-0.5 }}>Academy Report</h1>
            <p style={{ margin:0,fontSize:12,color:"#94a3b8",fontWeight:500 }}>AI Feedback + Auto Save to Google Sheets</p>
          </div>
          <div style={{ marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            <div style={{ display:"flex",alignItems:"center",gap:6,background:"#f0f4ff",border:"1.5px solid #c7d2fe",borderRadius:20,padding:"5px 14px" }}>
              <span style={{ fontSize:11,color:"#6366f1",fontWeight:700,fontFamily:"'DM Mono',monospace" }}>
                {isAdmin ? "👑 ADMIN" : `👩‍🏫 ${currentUser.name.toUpperCase()}`}
              </span>
            </div>
            {isManager && (
              <button onClick={()=>setShowAnniPanel(true)} style={{ background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:20,padding:"5px 14px",fontSize:11,color:"#10b981",cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace" }}>
                👩‍🏫 Class Mgmt
              </button>
            )}
            {isManager && (
              <button onClick={()=>setShowChartPanel(true)} style={{ background:"#eff6ff",border:"1.5px solid #bfdbfe",borderRadius:20,padding:"5px 14px",fontSize:11,color:"#3b82f6",cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace" }}>
                📋 Student Chart
              </button>
            )}
            {isAdmin && (
              <button onClick={()=>setShowAdminPanel(true)} style={{ background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:20,padding:"5px 14px",fontSize:11,color:"#64748b",cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace" }}>
                ⚙️ Admin
              </button>
            )}
            {syncing && (
              <div style={{ display:"flex",alignItems:"center",gap:6,background:"#eff6ff",border:"1.5px solid #bfdbfe",borderRadius:20,padding:"5px 14px" }}>
                <div style={{ width:14,height:14,borderRadius:"50%",border:"2px solid #3b82f6",borderTopColor:"transparent",animation:"spin .7s linear infinite" }}/>
                <span style={{ fontSize:11,color:"#3b82f6",fontWeight:700,fontFamily:"'DM Mono',monospace" }}>SYNCING</span>
              </div>
            )}
            <div style={{ display:"flex",alignItems:"center",gap:6,background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:20,padding:"5px 14px" }}>
              <div style={{ width:7,height:7,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 6px #10b98160" }}/>
              <span style={{ fontSize:11,color:"#10b981",fontWeight:700,fontFamily:"'DM Mono',monospace" }}>AI ON</span>
            </div>
            <button onClick={handleLogout} style={{ background:"#fff0f5",border:"1.5px solid #fecdd3",borderRadius:20,padding:"5px 14px",fontSize:11,color:"#f43f7a",cursor:"pointer",fontWeight:700,fontFamily:"'DM Mono',monospace" }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:780,margin:"0 auto",padding:"24px 16px",animation:"fadeUp .5s ease" }}>
        {/* Select Team */}
        <div style={{ background:"#fff",borderRadius:20,border:"1.5px solid #f1f5f9",padding:"20px 22px",marginBottom:12,boxShadow:"0 2px 12px #00000006" }}>
          <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,marginBottom:12,fontFamily:"'DM Mono',monospace" }}>SELECT TEAM</div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {Object.keys(teams).map(t=>{
              const on=t===team; const c=teamColorMap[t]||TEAM_COLOR_LIST[0];
              return <button key={t} onClick={()=>changeTeam(t)} style={{ padding:"9px 20px",borderRadius:14,border:on?`2px solid ${c.accent}`:"2px solid #f1f5f9",background:on?c.light:"#fafafa",color:on?c.accent:"#94a3b8",fontWeight:on?800:500,fontSize:13,cursor:"pointer",transition:"all .18s",fontFamily:"'Noto Sans KR',sans-serif",boxShadow:on?`0 4px 14px ${c.accent}20`:"none" }}>{t} Team</button>;
            })}
          </div>
        </div>

        {/* Select Student */}
        <div style={{ background:"#fff",borderRadius:20,border:`2px solid ${tc.border}`,padding:"20px 22px",marginBottom:12,boxShadow:`0 4px 16px ${tc.accent}08` }}>
          <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,marginBottom:12,fontFamily:"'DM Mono',monospace" }}>SELECT STUDENT</div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {(teams[team]||[]).map(s=>{
              const on=s===student;
              return <button key={s} onClick={()=>changeStudent(s)} style={{ padding:"9px 20px",borderRadius:14,border:on?`2px solid ${tc.accent}`:"2px solid #f1f5f9",background:on?tc.accent:"#fafafa",color:on?"#fff":"#94a3b8",fontWeight:on?800:500,fontSize:13,cursor:"pointer",transition:"all .18s",fontFamily:"'Noto Sans KR',sans-serif",boxShadow:on?`0 4px 14px ${tc.accent}30`:"none" }}>{s}</button>;
            })}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex",gap:3,marginBottom:20,background:"#f1f5f9",borderRadius:16,padding:4 }}>
          {[["weekly","📅 Weekly Report"],["monthly","📊 Monthly Report"]].map(([k,label])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ flex:1,padding:"13px",borderRadius:13,border:"none",background:tab===k?"#fff":"transparent",color:tab===k?"#6366f1":"#94a3b8",fontWeight:tab===k?800:500,fontSize:14,cursor:"pointer",transition:"all .2s",fontFamily:"'Noto Sans KR',sans-serif",boxShadow:tab===k?"0 2px 10px #0000000e":"none" }}>{label}</button>
          ))}
        </div>

        {/* Weekly Tab */}
        {tab==="weekly" && (
          <div style={{ animation:"fadeUp .35s ease" }}>
            <div style={{ background:"#fff",borderRadius:18,border:"1.5px solid #f1f5f9",padding:"18px 20px",marginBottom:14,boxShadow:"0 2px 10px #00000006" }}>
              <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,marginBottom:12,fontFamily:"'DM Mono',monospace" }}>SELECT WEEK</div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                {weeks.map((_,i)=>{
                  const on=i===wIdx; const has=weeks[i].ww||weeks[i].hw||weeks[i].attitude;
                  return (
                    <button key={i} onClick={()=>setWIdx(i)} style={{ width:48,height:48,borderRadius:14,border:on?"2px solid #6366f1":"2px solid #f1f5f9",background:on?"#6366f1":has?"#fafbff":"#fafafa",color:on?"#fff":has?"#6366f1":"#94a3b8",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'DM Mono',monospace",transition:"all .18s",boxShadow:on?"0 4px 14px #6366f130":"none",position:"relative" }}>
                      W{i+1}
                      {has&&!on&&<div style={{ position:"absolute",top:7,right:7,width:6,height:6,borderRadius:"50%",background:"#10b981" }}/>}
                    </button>
                  );
                })}
                <button onClick={()=>setWeeks([...weeks,{...WEEK_EMPTY}])} style={{ width:48,height:48,borderRadius:14,border:"2px dashed #e2e8f0",background:"#fafafa",color:"#c7d2fe",fontSize:22,cursor:"pointer" }}>+</button>
              </div>
            </div>
            <WeekCard weekNum={wIdx+1} data={weeks[wIdx]} onChange={d=>updateWeek(wIdx,d)}/>
            <div style={{ display:"flex",gap:10,marginTop:16 }}>
              <button onClick={saveWeekData} disabled={syncing} style={{ flex:"0 0 auto",padding:"16px 20px",background:syncing?"#f1f5f9":"#fff",color:syncing?"#94a3b8":"#6366f1",border:"2px solid #e0e7ff",borderRadius:16,fontSize:14,fontWeight:700,cursor:syncing?"not-allowed":"pointer",fontFamily:"'Noto Sans KR',sans-serif",transition:"all .2s" }}>
                {syncing?"Saving...":"💾 Save to Sheet"}
              </button>
              <button onClick={genWeekly} disabled={loading} style={{ flex:1,padding:"16px",background:loading?"#f1f5f9":"linear-gradient(135deg,#6366f1,#8b5cf6)",color:loading?"#94a3b8":"#fff",border:"none",borderRadius:16,fontSize:15,fontWeight:800,cursor:loading?"not-allowed":"pointer",fontFamily:"'Noto Sans KR',sans-serif",transition:"all .2s",boxShadow:loading?"none":"0 8px 24px #6366f130" }}>
                {loading?"✨ Generating...":`✨ ${student} Weekly Feedback + Save`}
              </button>
            </div>
            <div style={{ marginTop:16 }}>
              <ReportBox text={weeklyRes} loading={loading} onCopy={()=>navigator.clipboard.writeText(weeklyRes)} onPrint={printWeekly} saved={wSaved}/>
            </div>
          </div>
        )}

        {/* Monthly Tab */}
        {tab==="monthly" && (
          <div style={{ animation:"fadeUp .35s ease" }}>
            <div style={{ background:"#fff",borderRadius:20,border:"1.5px solid #f1f5f9",padding:"22px",marginBottom:14,boxShadow:"0 2px 12px #00000006" }}>
              <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,marginBottom:16,fontFamily:"'DM Mono',monospace" }}>MONTHLY STATS — {student}</div>
              <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
                <StatCard icon="✅" label="WW Pass"    value={wwPass}   color="#10b981"/>
                <StatCard icon="⚠️" label="WW Retest"  value={wwTotal-wwPass} color="#f59e0b"/>
                <StatCard icon="📊" label="Pass Rate"     value={wwTotal>0?Math.round(wwPass/wwTotal*100)+"%":"-"} color="#6366f1"/>
                <StatCard icon="📋" label="HW Rate" value={filled.length>0?Math.round(hwGood/filled.length*100)+"%":"-"} color="#8b5cf6"/>
                <StatCard icon="🌟" label="Active Count" value={attGood} color="#3b82f6"/>
                <StatCard icon="📅" label="Weeks"   value={filled.length} color="#94a3b8"/>
              </div>
            </div>
            <div style={{ background:"#fff",borderRadius:20,border:"1.5px solid #f1f5f9",padding:"22px",marginBottom:14,boxShadow:"0 2px 12px #00000006" }}>
              <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,marginBottom:14,fontFamily:"'DM Mono',monospace" }}>WEEKLY SUMMARY</div>
              <div style={{ display:"grid",gap:8 }}>
                {weeks.map((w,i)=>{
                  const has=w.ww||w.hw||w.attitude;
                  return (
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:14,background:has?"#fafbff":"#fafafa",border:`1.5px solid ${has?"#e0e7ff":"#f1f5f9"}` }}>
                      <div style={{ width:30,height:30,borderRadius:9,background:has?"linear-gradient(135deg,#6366f1,#8b5cf6)":"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:has?"#fff":"#94a3b8",fontFamily:"'DM Mono',monospace",flexShrink:0 }}>W{i+1}</div>
                      {has?(
                        <div style={{ display:"flex",gap:6,flexWrap:"wrap",flex:1 }}>
                          {w.ww&&<span style={{ padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:700,background:WW_C[w.ww]+"18",color:WW_C[w.ww],border:`1px solid ${WW_C[w.ww]}30` }}>{w.ww}</span>}
                          {w.hw&&<span style={{ padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:700,background:HW_C[w.hw]+"18",color:HW_C[w.hw],border:`1px solid ${HW_C[w.hw]}30` }}>{w.hw}</span>}
                          {w.attitude&&<span style={{ padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:700,background:ATT_C[w.attitude]+"18",color:ATT_C[w.attitude],border:`1px solid ${ATT_C[w.attitude]}30` }}>{w.attitude}</span>}
                          {w.grammar&&<span style={{ fontSize:11,color:"#94a3b8" }}>📐 {w.grammar}</span>}
                        </div>
                      ):(
                        <span style={{ color:"#cbd5e1",fontSize:12,fontFamily:"'Noto Sans KR',sans-serif" }}>No data</span>
                      )}
                      <button onClick={()=>{setTab("weekly");setWIdx(i);}} style={{ background:"#f8fafc",border:"1.5px solid #e2e8f0",color:"#6366f1",fontSize:11,padding:"5px 10px",borderRadius:8,cursor:"pointer",fontWeight:600,fontFamily:"'Noto Sans KR',sans-serif",flexShrink:0 }}>Edit</button>
                    </div>
                  );
                })}
              </div>
            </div>
            <button onClick={genMonthly} disabled={loading} style={{ width:"100%",padding:"16px",background:loading?"#f1f5f9":"linear-gradient(135deg,#8b5cf6,#6366f1,#3b82f6)",color:loading?"#94a3b8":"#fff",border:"none",borderRadius:16,fontSize:15,fontWeight:800,cursor:loading?"not-allowed":"pointer",fontFamily:"'Noto Sans KR',sans-serif",transition:"all .2s",boxShadow:loading?"none":"0 8px 24px #8b5cf630" }}>
              {loading?"🏆 Generating...":`🏆 ${student} Monthly Report + Save`}
            </button>
            <div style={{ marginTop:16 }}>
              <ReportBox text={monthlyRes} loading={loading} onCopy={()=>navigator.clipboard.writeText(monthlyRes)} onPrint={printMonthly} saved={mSaved}/>
            </div>
          </div>
        )}

        {/* Bottom Guide */}
        <div style={{ marginTop:20,padding:"14px 18px",background:"#fffbeb",borderRadius:14,border:"1.5px solid #fde68a",display:"flex",gap:10,alignItems:"flex-start" }}>
          <span style={{ fontSize:16,flexShrink:0 }}>💡</span>
          <span style={{ fontSize:12,color:"#92400e",fontFamily:"'Noto Sans KR',sans-serif",lineHeight:1.7 }}>
            Data is <strong>auto-saved to Google Sheets</strong>. Previous data loads automatically when selecting a student.
            Generated feedback can be <strong>copied using the copy button</strong> and pasted to KakaoTalk.
            {isManager && " Use the Class Mgmt button above to edit classes/students."}
            {isAdmin   && " Use the Admin button above to edit all teams/students."}
          </span>
        </div>
      </div>
      <Toast msg={toast}/>
    </div>
  );
}
