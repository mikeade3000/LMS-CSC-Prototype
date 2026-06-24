/* CSC Lagos State LMS v2.0 — Core Application
   Updates: GL06, TTS narration, Google Sheets sync, bug fixes, UI improvements */
"use strict";
(function(){

// ── Source Protection ─────────────────────────────────────────────────────────
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&['I','J','C','K'].includes(e.key))||
    (e.ctrlKey&&['u','U','s','S'].includes(e.key))||(e.metaKey&&e.altKey&&['i','I'].includes(e.key))){
    e.preventDefault();e.stopPropagation();return false;
  }
},true);
document.addEventListener('selectstart',e=>{if(e.target.tagName!=='INPUT'&&e.target.tagName!=='TEXTAREA')e.preventDefault();});
let _dt=false;
const _dw=()=>{const t=new Image();Object.defineProperty(t,'id',{get:()=>{if(!_dt){_dt=true;const w=document.getElementById('devtools-warn');if(w)w.style.display='flex';}return '';}});console.log('%c',t);};
setInterval(_dw,2000);

// ── Config ────────────────────────────────────────────────────────────────────
const CFG={
  APP:'CSC-LMS',PASS:70,VERSION:'2.0.0',
  ADMIN_EMAIL:'superadmin@csc.lagos.gov.ng',
  ADMIN_PASS:'CSC@Admin2024!'
};

// ── Storage ───────────────────────────────────────────────────────────────────
const S={
  get:(k)=>{try{return JSON.parse(localStorage.getItem(CFG.APP+'_'+k));}catch{return null;}},
  set:(k,v)=>{try{localStorage.setItem(CFG.APP+'_'+k,JSON.stringify(v));}catch(e){console.warn('Storage full',e);}},
  del:(k)=>{localStorage.removeItem(CFG.APP+'_'+k);}
};
const _h=(s)=>{let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return h.toString(36);};

// ── Toast Notifications ───────────────────────────────────────────────────────
function toast(msg,type='info',dur=3500){
  let tc=document.getElementById('toast-container');
  if(!tc){tc=document.createElement('div');tc.id='toast-container';document.body.appendChild(tc);}
  const t=document.createElement('div');
  t.className=`toast toast-${type}`;
  t.innerHTML=`<span class="toast-icon">${type==='success'?'✅':type==='error'?'❌':type==='warn'?'⚠️':'ℹ️'}</span><span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400);},dur);
}

// ── TTS Audio Narration ───────────────────────────────────────────────────────
const TTS={
  synth:window.speechSynthesis,
  utt:null,playing:false,paused:false,
  rate:()=>parseFloat(S.get('tts_rate')||1.0),
  voices:[],

  init(){
    if(!this.synth)return;
    const load=()=>{this.voices=this.synth.getVoices();};
    load();
    this.synth.onvoiceschanged=load;
  },

  bestVoice(){
    return this.voices.find(v=>v.lang==='en-NG')||
           this.voices.find(v=>v.lang==='en-GB'&&v.name.includes('Male'))||
           this.voices.find(v=>v.lang==='en-GB')||
           this.voices.find(v=>v.lang.startsWith('en')&&v.name.includes('Male'))||
           this.voices.find(v=>v.lang.startsWith('en'))||null;
  },

  stripHtml(html){
    const d=document.createElement('div');d.innerHTML=html;return d.innerText||d.textContent||'';
  },

  speak(text,onEnd){
    this.stop();
    if(!this.synth)return;
    const clean=this.stripHtml(text);
    this.utt=new SpeechSynthesisUtterance(clean);
    this.utt.rate=this.rate();
    this.utt.pitch=1.0;
    this.utt.volume=1.0;
    const v=this.bestVoice();
    if(v)this.utt.voice=v;
    this.utt.onstart=()=>{this.playing=true;this.paused=false;this._ui();};
    this.utt.onend=()=>{this.playing=false;this.paused=false;this._ui();if(onEnd)onEnd();};
    this.utt.onpause=()=>{this.paused=true;this._ui();};
    this.utt.onresume=()=>{this.paused=false;this._ui();};
    this.utt.onerror=()=>{this.playing=false;this.paused=false;this._ui();};
    this.synth.speak(this.utt);
    this.playing=true;this._ui();
  },

  pause(){if(this.synth&&this.playing){this.synth.pause();this.paused=true;this._ui();}},
  resume(){if(this.synth&&this.paused){this.synth.resume();this.paused=false;this._ui();}},
  stop(){if(this.synth){this.synth.cancel();}this.playing=false;this.paused=false;this.utt=null;this._ui();},

  toggle(text){
    if(this.playing&&!this.paused){this.pause();}
    else if(this.paused){this.resume();}
    else{this.speak(text);}
  },

  setRate(r){S.set('tts_rate',r);},

  _ui(){
    const btn=document.getElementById('tts-btn');
    const bar=document.getElementById('tts-status');
    if(btn){
      btn.textContent=this.playing&&!this.paused?'⏸ Pause':'▶ Listen';
      btn.classList.toggle('active',this.playing);
    }
    if(bar){bar.textContent=this.playing&&!this.paused?'🔊 Reading aloud...':this.paused?'⏸ Paused':'🔇 Ready';}
  }
};

// ── Google Sheets Sync ────────────────────────────────────────────────────────
const GSync={
  get url(){return S.get('gsheets_url')||'';},
  set url(v){S.set('gsheets_url',v);},
  pendingKey:'gsync_pending',

  isOn(){return !!this.url;},

  async post(payload){
    if(!this.isOn())return{ok:false,msg:'Not configured'};
    try{
      const r=await fetch(this.url,{
        method:'POST',redirect:'follow',
        headers:{'Content-Type':'text/plain'},
        body:JSON.stringify(payload)
      });
      const txt=await r.text();
      try{return JSON.parse(txt);}catch{return{ok:true,raw:txt};}
    }catch(e){
      // Queue for retry
      const q=S.get(this.pendingKey)||[];
      q.push({...payload,_ts:Date.now()});
      if(q.length>50)q.shift();// cap
      S.set(this.pendingKey,q);
      return{ok:false,msg:e.message,queued:true};
    }
  },

  async syncUser(user){
    return this.post({action:'sync_user',id:user.id,name:user.name,email:user.email,gl:user.gl,joined:user.joined});
  },

  async syncCompletion(userId,gl,stage,score,passed,certId){
    const users=S.get('users')||[];
    const u=users.find(x=>x.id===userId);
    return this.post({action:'sync_completion',userId,userName:u?.name||'',userEmail:u?.email||'',gl,stage,score,passed,certId,date:new Date().toISOString()});
  },

  async flushPending(){
    const q=S.get(this.pendingKey)||[];
    if(!q.length||!this.isOn())return;
    const remaining=[];
    for(const item of q){
      const r=await this.post(item);
      if(!r.ok&&!r.queued===false)remaining.push(item);
    }
    S.set(this.pendingKey,remaining);
    if(remaining.length===0&&q.length>0)toast('Synced pending records to Google Sheets','success');
  },

  updateIndicator(){
    const el=document.getElementById('sync-dot');
    if(!el)return;
    const pending=(S.get(this.pendingKey)||[]).length;
    el.className='sync-dot '+(this.isOn()?pending>0?'warn':'ok':'off');
    el.title=this.isOn()?pending>0?`${pending} unsynced records`:'Synced':'Sheets not configured';
  }
};

// ── Init / Seed ───────────────────────────────────────────────────────────────
function initApp(){
  let users=S.get('users')||[];
  if(!users.find(u=>u.email===CFG.ADMIN_EMAIL)){
    users.unshift({id:'admin001',name:'Super Administrator',email:CFG.ADMIN_EMAIL,pw:_h(CFG.ADMIN_PASS),role:'admin',gl:null,joined:new Date().toISOString()});
  }
  const demos=[
    {id:'u001',name:'Adesola Adeyemi',email:'user1@csc.lagos.gov.ng',pw:_h('User1@2024'),role:'user',gl:'GL06'},
    {id:'u002',name:'Emeka Okafor',email:'user2@csc.lagos.gov.ng',pw:_h('User2@2024'),role:'user',gl:'GL07'},
    {id:'u003',name:'Fatima Sule',email:'user3@csc.lagos.gov.ng',pw:_h('User3@2024'),role:'user',gl:'GL12'}
  ];
  demos.forEach(d=>{if(!users.find(u=>u.email===d.email))users.push({...d,joined:new Date().toISOString()});});
  S.set('users',users);
  TTS.init();
  setTimeout(()=>GSync.flushPending(),3000);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
const Auth={
  current:()=>S.get('session'),
  login:(email,pw)=>{
    const users=S.get('users')||[];
    const u=users.find(x=>x.email.toLowerCase()===email.toLowerCase()&&x.pw===_h(pw));
    if(!u)return{ok:false,msg:'Invalid email or password.'};
    S.set('session',{id:u.id,name:u.name,email:u.email,role:u.role,gl:u.gl});
    return{ok:true,user:Auth.current()};
  },
  register:(name,email,pw,gl)=>{
    const users=S.get('users')||[];
    if(users.find(u=>u.email.toLowerCase()===email.toLowerCase()))return{ok:false,msg:'Email already registered.'};
    if(!name||name.trim().length<2)return{ok:false,msg:'Please enter your full name (at least 2 characters).'};
    if(!email||!/\S+@\S+\.\S+/.test(email))return{ok:false,msg:'Please enter a valid email address.'};
    if(!pw||pw.length<6)return{ok:false,msg:'Password must be at least 6 characters.'};
    if(!gl)return{ok:false,msg:'Please select your grade level.'};
    const id='u'+Date.now();
    const u={id,name:name.trim(),email:email.toLowerCase(),pw:_h(pw),role:'user',gl,joined:new Date().toISOString()};
    users.push(u);S.set('users',users);
    S.set('session',{id,name:u.name,email:u.email,role:'user',gl});
    GSync.syncUser(u);
    return{ok:true,user:Auth.current()};
  },
  logout:()=>{TTS.stop();S.del('session');location.hash='#/login';}
};

// ── Progress ──────────────────────────────────────────────────────────────────
const Prog={
  get:(uid)=>S.get('prog_'+uid)||{},
  getStage:(uid,gl,stage)=>{const p=Prog.get(uid);return(p[gl]||{})[stage]||{started:false,completed:false,score:0,passed:false,attempts:0,certId:null,date:null};},
  save:(uid,gl,stage,data)=>{
    const p=Prog.get(uid);
    if(!p[gl])p[gl]={};
    p[gl][stage]={...Prog.getStage(uid,gl,stage),...data};
    S.set('prog_'+uid,p);
    if(data.passed)GSync.syncCompletion(uid,gl,stage,data.score,data.passed,data.certId).then(()=>GSync.updateIndicator());
  },
  canAccess:(uid,gl,stage)=>stage===1||Prog.getStage(uid,gl,stage-1).passed,
  stagesCompleted:(uid,gl)=>Object.keys(LMS_CONTENT[GL_MAP[gl]]?.stages||{}).filter(s=>Prog.getStage(uid,gl,parseInt(s)).passed).length,
  totalStages:(gl)=>Object.keys(LMS_CONTENT[GL_MAP[gl]]?.stages||{}).length
};

// ── Router ────────────────────────────────────────────────────────────────────
const routes={
  '':()=>guard(renderDashboard),
  '/':()=>guard(renderDashboard),
  '/login':()=>safeRender(renderLogin),
  '/register':()=>safeRender(renderRegister),
  '/dashboard':()=>guard(renderDashboard),
  '/learn':()=>guard(renderLearn),
  '/quiz':()=>guard(renderQuiz),
  '/cert':()=>guard(renderCert),
  '/admin':()=>guard(renderAdmin,true),
  '/admin/user':()=>guard(renderUserReport,true)
};

// safeRender: wraps any view function in error handling so a JS error
// never silently leaves the previous page on screen
function safeRender(fn){
  try{fn();}catch(e){
    console.error('[CSC-LMS] Render error:',e);
    app().innerHTML=`<div class="auth-page"><div class="auth-card">
      <div class="auth-header-band"></div>
      <div class="auth-body" style="text-align:center;padding:40px 24px">
        <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
        <h2 style="color:#c0392b;margin-bottom:8px">Something went wrong</h2>
        <p style="color:#666;font-size:.9rem;margin-bottom:20px">${e.message||'An unexpected error occurred. Please try again.'}</p>
        <a href="#/login" class="btn-primary" style="display:inline-block;text-decoration:none">← Back to Login</a>
      </div></div></div>`;
  }
}

function guard(fn,adminOnly=false){
  const u=Auth.current();
  if(!u){location.hash='#/login';return;}
  if(adminOnly&&u.role!=='admin'){location.hash='#/dashboard';return;}
  try{fn();}catch(e){console.error('[CSC-LMS] View error:',e);}
}
const getHash=()=>location.hash.replace('#','').split('?')[0]||'/';
const getParams=()=>{const p={};(location.hash.split('?')[1]||'').split('&').forEach(x=>{const[k,v]=x.split('=');if(k)p[k]=decodeURIComponent(v||'');});return p;};
function router(){
  const h=getHash();
  const fn=routes[h];
  if(fn){fn();}else{guard(renderDashboard);}
  GSync.updateIndicator();
}
window.addEventListener('hashchange',()=>{TTS.stop();router();});

// ── Shell ─────────────────────────────────────────────────────────────────────
const app=()=>document.getElementById('app');
const esc=(s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const pendingCount=()=>(S.get('gsync_pending')||[]).length;

function renderShell(content,showNav=true){
  const u=Auth.current();
  const syncHtml=GSync.isOn()?`<span class="sync-dot" id="sync-dot" title="Google Sheets sync"></span>`:'';
  const nav=showNav&&u?`
  <nav class="navbar">
    <div class="nav-brand">
      <span class="nav-logo">🏛️</span>
      <div>
        <div class="nav-title">Lagos State Civil Service Commission</div>
        <div class="nav-sub">Learning Management System v${CFG.VERSION}</div>
      </div>
    </div>
    <div class="nav-links">
      ${u.role==='admin'?`<a href="#/admin" class="nav-link">📊 Admin</a>`:`<a href="#/dashboard" class="nav-link">🏠 Dashboard</a>`}
      ${syncHtml}
      <span class="nav-user">👤 ${esc(u.name.split(' ')[0])}</span>
      <button onclick="Auth.logout()" class="btn-logout">Sign Out</button>
    </div>
  </nav>`:'';
  app().innerHTML=nav+`<div class="main-content">${content}</div>`;
  GSync.updateIndicator();
}

// ── Login ─────────────────────────────────────────────────────────────────────
function renderLogin(){
  app().innerHTML=`
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header-band"></div>
      <div class="auth-body">
        <div class="auth-logo">🏛️</div>
        <h1 class="auth-title">Civil Service Commission</h1>
        <p class="auth-subtitle">Lagos State — Learning Management System</p>
        <form class="auth-form" onsubmit="return false">
          <div class="form-group">
            <label>Official Email Address</label>
            <input type="email" id="l_email" placeholder="your.email@domain.com" autocomplete="email" required>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="l_pw" placeholder="Enter your password" autocomplete="current-password" required
              onkeydown="if(event.key==='Enter')doLogin()">
          </div>
          <div id="loginErr" class="form-error" style="display:none"></div>
          <button class="btn-primary full" onclick="doLogin()">Sign In to LMS</button>
        </form>
        <p class="auth-switch">Don't have an account? <a href="#/register">Create Account</a></p>
      </div>
    </div>
  </div>`;
}
window.doLogin=function(){
  const email=document.getElementById('l_email').value.trim();
  const pw=document.getElementById('l_pw').value;
  const err=document.getElementById('loginErr');
  if(!email||!pw){err.textContent='Please enter your email and password.';err.style.display='block';return;}
  const r=Auth.login(email,pw);
  if(!r.ok){err.textContent=r.msg;err.style.display='block';return;}
  err.style.display='none';
  toast(`Welcome back, ${r.user.name.split(' ')[0]}!`,'success');
  setTimeout(()=>{location.hash=r.user.role==='admin'?'#/admin':'#/dashboard';},300);
};

// ── Register ──────────────────────────────────────────────────────────────────
function renderRegister(){
  // Defensive: ensure GRADE_LEVELS is available
  const levels = (typeof GRADE_LEVELS !== 'undefined' && Array.isArray(GRADE_LEVELS))
    ? GRADE_LEVELS
    : ["GL06","GL07","GL08","GL09","GL10","GL12","GL13","GL14","GL15","GL16"];

  const glOpts = levels.map(g=>`<option value="${g}">${g.replace('GL','Grade Level ')}</option>`).join('');

  app().innerHTML=`
  <div class="auth-page">
    <div class="auth-card reg-card">
      <div class="auth-header-band"></div>
      <div class="auth-body">
        <div class="auth-logo">🏛️</div>
        <h1 class="auth-title">Create Account</h1>
        <p class="auth-subtitle">Lagos State Civil Service Commission — LMS</p>

        <form class="auth-form" onsubmit="return false" autocomplete="off">
          <div class="reg-row">
            <div class="form-group">
              <label>Full Name <span class="req">*</span></label>
              <input type="text" id="r_name" placeholder="e.g. Adaeze Okonkwo"
                autocomplete="name" required minlength="2">
            </div>
            <div class="form-group">
              <label>Grade Level <span class="req">*</span></label>
              <select id="r_gl" required>
                <option value="">-- Select --</option>
                ${glOpts}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Official Email Address <span class="req">*</span></label>
            <input type="email" id="r_email" placeholder="your.name@csc.lagos.gov.ng"
              autocomplete="email" required>
          </div>

          <div class="reg-row">
            <div class="form-group">
              <label>Password <span class="req">*</span></label>
              <div class="pw-wrap">
                <input type="password" id="r_pw" placeholder="At least 6 characters"
                  autocomplete="new-password" required minlength="6">
                <button type="button" class="pw-toggle" onclick="togglePw('r_pw',this)"
                  title="Show password">👁</button>
              </div>
            </div>
            <div class="form-group">
              <label>Confirm Password <span class="req">*</span></label>
              <div class="pw-wrap">
                <input type="password" id="r_pw2" placeholder="Repeat password"
                  autocomplete="new-password" required minlength="6">
                <button type="button" class="pw-toggle" onclick="togglePw('r_pw2',this)"
                  title="Show password">👁</button>
              </div>
            </div>
          </div>

          <div id="regErr" class="form-error" style="display:none"></div>

          <div class="reg-terms">
            <label class="terms-label">
              <input type="checkbox" id="r_terms" required>
              <span>I agree to use this platform in accordance with the
              <strong>CSC Code of Conduct</strong></span>
            </label>
          </div>

          <button class="btn-primary full" onclick="doRegister()">
            Create My Account &rarr;
          </button>
        </form>

        <p class="auth-switch">Already have an account?
          <a href="#/login">Sign In</a>
        </p>
      </div>
    </div>
  </div>`;
}

window.togglePw=function(id,btn){
  const input=document.getElementById(id);
  if(!input)return;
  const show=input.type==='password';
  input.type=show?'text':'password';
  btn.textContent=show?'🙈':'👁';
};

window.doRegister=function(){
  const name=(document.getElementById('r_name')?.value||'').trim();
  const email=(document.getElementById('r_email')?.value||'').trim();
  const gl=document.getElementById('r_gl')?.value||'';
  const pw=document.getElementById('r_pw')?.value||'';
  const pw2=document.getElementById('r_pw2')?.value||'';
  const terms=document.getElementById('r_terms')?.checked;
  const err=document.getElementById('regErr');
  const showErr=(msg)=>{if(err){err.textContent=msg;err.style.display='block';}};

  if(!terms){showErr('Please accept the Code of Conduct to continue.');return;}
  if(pw!==pw2){showErr('Passwords do not match. Please re-enter.');return;}
  if(pw.length<6){showErr('Password must be at least 6 characters.');return;}

  const r=Auth.register(name,email,pw,gl);
  if(!r.ok){showErr(r.msg);return;}
  if(err)err.style.display='none';
  toast(`Welcome, ${name.split(' ')[0]}! Your account has been created.`,'success');
  setTimeout(()=>{location.hash='#/dashboard';},400);
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard(){
  const u=Auth.current();
  const glKey=GL_MAP[u.gl];
  const course=LMS_CONTENT[glKey];
  if(!course){renderShell(`<div class="error-box">⚠️ No course found for ${esc(u.gl)}. Please contact the administrator.</div>`);return;}
  const done=Prog.stagesCompleted(u.id,u.gl);
  const total=Prog.totalStages(u.gl);
  const pct=total?Math.round((done/total)*100):0;
  const circumference=2*Math.PI*38;

  const stages=Object.entries(course.stages).map(([sNum,s])=>{
    const sn=parseInt(sNum);
    const prog=Prog.getStage(u.id,u.gl,sn);
    const canAccess=Prog.canAccess(u.id,u.gl,sn);
    const cls=prog.passed?'stage-done':prog.started?'stage-active':'stage-locked';
    const label=prog.passed?'<span class="stage-badge done">✅ Completed</span>':prog.started?'<span class="stage-badge progress">📖 In Progress</span>':'<span class="stage-badge locked">🔒 Locked</span>';
    return`<div class="stage-card ${cls}">
      <div class="stage-left">
        <div class="stage-icon-wrap">${s.icon}</div>
      </div>
      <div class="stage-info">
        <div class="stage-meta">Stage ${sn} of ${total}</div>
        <div class="stage-title">${esc(s.title)}</div>
        <div class="stage-desc">${esc(s.description)}</div>
        <div class="stage-footer">${label}${prog.passed?`<span class="stage-score">Score: <strong>${prog.score}%</strong></span>`:''}${prog.passed&&prog.date?`<span class="stage-date">${new Date(prog.date).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</span>`:''}</div>
      </div>
      <div class="stage-actions">
        ${canAccess?`
          <button class="btn-primary" onclick="goLearn(${sn})">${prog.passed?'Review':'Start Learning'}</button>
          ${prog.started&&!prog.passed?`<button class="btn-outline" onclick="goQuiz(${sn})">Take Quiz</button>`:''}
          ${prog.passed?`<button class="btn-gold" onclick="goCert(${sn})">📜 Certificate</button>`:''}
        `:`<span class="locked-msg">🔒 Pass Stage ${sn-1} first</span>`}
      </div>
    </div>`;
  }).join('');

  const greetHour=new Date().getHours();
  const greet=greetHour<12?'Good morning':greetHour<17?'Good afternoon':'Good evening';

  renderShell(`
  <div class="dashboard">
    <div class="dash-header">
      <div class="dash-header-left">
        <div class="dash-greet">${greet},</div>
        <h2>${esc(u.name)}</h2>
        <p class="dash-meta">${esc(course.title)} &mdash; ${esc(course.subtitle)}</p>
        <div class="dash-tags">
          <span class="dash-tag">${esc(u.gl)}</span>
          <span class="dash-tag">${done}/${total} Stages</span>
          ${done===total?'<span class="dash-tag gold">🏆 Graduate</span>':''}
        </div>
      </div>
      <div class="progress-ring-wrap">
        <svg width="90" height="90" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="8"/>
          <circle cx="45" cy="45" r="38" fill="none" stroke="#c9922a" stroke-width="8"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${circumference*(1-pct/100)}"
            stroke-linecap="round" transform="rotate(-90 45 45)"
            style="transition:stroke-dashoffset .8s ease"/>
        </svg>
        <div class="ring-label">${pct}%</div>
      </div>
    </div>

    <div class="progress-bar-wrap">
      <div class="progress-bar-label">Overall Progress — ${done} of ${total} stages completed</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>

    <h3 class="section-heading">Your Learning Stages</h3>
    <div class="stages-list">${stages}</div>
    ${done===total?`<div class="completion-banner">🎉 Outstanding achievement! You have completed all ${total} stages of the ${course.title} programme. You are now a certified CSC LMS graduate!</div>`:''}
  </div>`);
}
window.goLearn=(s)=>{location.hash=`#/learn?stage=${s}`;};
window.goQuiz=(s)=>{location.hash=`#/quiz?stage=${s}`;};
window.goCert=(s)=>{location.hash=`#/cert?stage=${s}`;};

// ── Learn ─────────────────────────────────────────────────────────────────────
let _ttsText='';
function renderLearn(){
  const u=Auth.current();
  const p=getParams();
  const stage=parseInt(p.stage)||1;
  const glKey=GL_MAP[u.gl];
  const course=LMS_CONTENT[glKey];
  const stageData=course?.stages[stage];
  if(!stageData||!Prog.canAccess(u.id,u.gl,stage)){location.hash='#/dashboard';return;}
  Prog.save(u.id,u.gl,stage,{started:true});
  let ti=Math.max(0,Math.min(parseInt(p.topic)||0,stageData.topics.length-1));
  const topic=stageData.topics[ti];
  const prog=Prog.getStage(u.id,u.gl,stage);
  _ttsText=topic.content;

  const topicNav=stageData.topics.map((t,i)=>`
    <div class="topic-nav-item ${i===ti?'active':''}" onclick="goTopic(${stage},${i})">
      <span class="topic-check">${i<ti?'✅':'○'}</span>
      <span>${esc(t.title)}</span>
    </div>`).join('');
  const isLast=ti===stageData.topics.length-1;
  const rateVal=TTS.rate();

  renderShell(`
  <div class="learn-page">
    <div class="learn-sidebar">
      <button class="btn-back" onclick="location.hash='#/dashboard'">← Dashboard</button>
      <div class="sidebar-stage">Stage ${stage}: ${esc(stageData.title)}</div>
      <div class="topic-nav">${topicNav}</div>
      <div class="sidebar-sep"></div>
      ${prog.passed
        ?`<div class="quiz-done">✅ Stage Passed — ${prog.score}%</div><button class="btn-gold full mt8" onclick="goCert(${stage})">📜 View Certificate</button>`
        :`<button class="btn-primary full mt8" onclick="goQuiz(${stage})">📝 Take Stage Quiz</button>`}
    </div>
    <div class="learn-main">
      <div class="topic-header">
        <div>
          <h2>${esc(topic.title)}</h2>
          <span class="reading-time">⏱ ${esc(topic.readingTime)} read</span>
        </div>
      </div>

      <!-- TTS Bar -->
      <div class="tts-bar">
        <div class="tts-left">
          <span class="tts-label">🔊 Audio Narration</span>
          <span id="tts-status" class="tts-status">🔇 Ready</span>
        </div>
        <div class="tts-controls">
          <button id="tts-btn" class="btn-tts" onclick="ttsToggle()">▶ Listen</button>
          <button class="btn-tts-sm" onclick="ttsStop()">⏹ Stop</button>
          <select class="tts-rate" onchange="ttsRate(this.value)" title="Playback speed">
            <option value="0.8" ${rateVal==0.8?'selected':''}>0.8×</option>
            <option value="1.0" ${rateVal==1.0?'selected':''}>1.0×</option>
            <option value="1.25" ${rateVal==1.25?'selected':''}>1.25×</option>
            <option value="1.5" ${rateVal==1.5?'selected':''}>1.5×</option>
          </select>
        </div>
      </div>

      <div class="topic-body" id="topic-body">${topic.content}</div>

      <div class="topic-footer">
        ${ti>0?`<button class="btn-outline" onclick="goTopic(${stage},${ti-1})">← Previous Topic</button>`:'<span></span>'}
        ${isLast
          ?`<button class="btn-primary" onclick="goQuiz(${stage})">📝 Take Stage Quiz →</button>`
          :`<button class="btn-primary" onclick="goTopic(${stage},${ti+1})">Next Topic →</button>`}
      </div>
    </div>
  </div>`);
  TTS._ui();
}
window.goTopic=(stage,idx)=>{TTS.stop();location.hash=`#/learn?stage=${stage}&topic=${idx}`;};
window.ttsToggle=function(){TTS.toggle(_ttsText);};
window.ttsStop=function(){TTS.stop();};
window.ttsRate=function(r){TTS.setRate(parseFloat(r));if(TTS.playing){TTS.stop();TTS.speak(_ttsText);}};

// ── Quiz ──────────────────────────────────────────────────────────────────────
let _qs={};
function renderQuiz(){
  const u=Auth.current();
  const p=getParams();
  const stage=parseInt(p.stage)||1;
  const glKey=GL_MAP[u.gl];
  const course=LMS_CONTENT[glKey];
  const stageData=course?.stages[stage];
  if(!stageData){location.hash='#/dashboard';return;}
  const prog=Prog.getStage(u.id,u.gl,stage);

  if(prog.passed){
    renderShell(`<div class="quiz-done-page">
      <div class="quiz-done-card">
        <div class="done-icon">✅</div>
        <h2>Stage ${stage} Already Passed!</h2>
        <p>You scored <strong>${prog.score}%</strong> on ${new Date(prog.date||Date.now()).toLocaleDateString('en-NG')}.</p>
        <div class="done-actions">
          <button class="btn-primary" onclick="goCert(${stage})">📜 View Certificate</button>
          <button class="btn-outline" onclick="location.hash='#/dashboard'">← Dashboard</button>
        </div>
      </div></div>`);
    return;
  }

  if(!_qs.stage||_qs.stage!==stage||_qs.uid!==u.id){
    const qs=[...stageData.quiz.questions];
    for(let i=qs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[qs[i],qs[j]]=[qs[j],qs[i]];}
    _qs={stage,uid:u.id,gl:u.gl,questions:qs,current:0,answers:{}};
  }
  if(!p.submit)renderQuizQ();
  else renderQuizResults();
}

function renderQuizQ(){
  if(!_qs.questions?.length){location.hash='#/dashboard';return;}
  const qs=_qs.questions,ci=_qs.current,q=qs[ci],total=qs.length,answered=Object.keys(_qs.answers).length;
  const opts=q.opts.map((o,i)=>{const sel=_qs.answers[ci]===i;return`<label class="quiz-opt ${sel?'selected':''}"><input type="radio" name="qopt" value="${i}" ${sel?'checked':''} onchange="_selOpt(${i})"><span class="opt-letter">${['A','B','C','D'][i]}</span><span>${esc(o)}</span></label>`;}).join('');
  renderShell(`<div class="quiz-page">
    <div class="quiz-header">
      <button class="btn-back" onclick="goLearn(${_qs.stage})" style="color:#fff;margin-bottom:0">← Back to Reading</button>
      <div class="quiz-title">Stage ${_qs.stage} Assessment</div>
      <div class="quiz-meta">${answered}/${total} answered</div>
    </div>
    <div class="quiz-progress-bar"><div style="width:${((ci+1)/total)*100}%"></div></div>
    <div class="quiz-body">
      <div class="q-number">Question ${ci+1} of ${total}</div>
      <div class="q-text">${esc(q.q)}</div>
      <div class="q-opts">${opts}</div>
      <div class="quiz-nav">
        ${ci>0?`<button class="btn-outline" onclick="_goQ(${ci-1})">← Previous</button>`:'<span></span>'}
        <div class="q-dots">${qs.map((_,i)=>`<span class="dot ${i===ci?'active':_qs.answers[i]!==undefined?'answered':''}" onclick="_goQ(${i})" title="Q${i+1}"></span>`).join('')}</div>
        ${ci<total-1?`<button class="btn-primary" onclick="_goQ(${ci+1})">Next →</button>`:`<button class="btn-gold" onclick="_submitQ()">Submit Quiz ✓</button>`}
      </div>
    </div>
  </div>`);
}
window._selOpt=function(i){_qs.answers[_qs.current]=i;renderQuizQ();};
window._goQ=function(i){_qs.current=i;renderQuizQ();};
window._submitQ=function(){
  const ua=_qs.questions.length-Object.keys(_qs.answers).length;
  if(ua>0&&!confirm(`${ua} question(s) unanswered. Submit anyway?`))return;
  location.hash=`#/quiz?stage=${_qs.stage}&submit=1`;
};

function renderQuizResults(){
  const u=Auth.current();
  // BUG FIX: save state before reset so template literals can reference it
  const stageNum=_qs.stage||parseInt(getParams().stage)||1;
  const qs=_qs.questions||[];
  const answers={..._qs.answers};
  _qs={};// safe to reset now

  if(!qs.length){location.hash='#/dashboard';return;}
  let correct=0;qs.forEach((q,i)=>{if(answers[i]===q.ans)correct++;});
  const score=Math.round((correct/qs.length)*100);
  const passed=score>=CFG.PASS;
  const prog=Prog.getStage(u.id,u.gl,stageNum);
  const attempts=(prog.attempts||0)+1;
  const certId=passed&&!prog.certId?'CSC'+Date.now().toString(36).toUpperCase():prog.certId||null;
  Prog.save(u.id,u.gl,stageNum,{completed:true,score,passed,attempts,certId,date:new Date().toISOString()});

  if(passed)toast('🎉 Congratulations! You passed the Stage '+stageNum+' Quiz!','success',5000);
  else toast(`Score: ${score}% — you need ${CFG.PASS}% to pass. Review and try again.`,'warn',5000);

  const review=qs.map((q,i)=>{
    const ua=answers[i],ok=ua===q.ans;
    return`<div class="review-item ${ok?'correct':'wrong'}">
      <div class="review-q">${esc(q.q)}</div>
      <div class="review-ans">
        <span class="your-ans">Your answer: <strong>${ua!==undefined?esc(q.opts[ua]):'Not answered'}</strong></span>
        ${!ok?`<span class="correct-ans">✅ Correct: <strong>${esc(q.opts[q.ans])}</strong></span>`:''}
      </div>
      ${q.exp?`<div class="review-exp">💡 ${esc(q.exp)}</div>`:''}
    </div>`;
  }).join('');

  renderShell(`<div class="results-page">
    <div class="results-card ${passed?'passed':'failed'}">
      <div class="result-icon">${passed?'🎉':'😔'}</div>
      <h2>${passed?'Congratulations — You Passed!':'Not Quite — Please Try Again'}</h2>
      <div class="score-display">
        <div class="score-circle">
          <span class="score-num">${score}%</span>
          <span class="score-label">${correct}/${qs.length} Correct</span>
        </div>
      </div>
      <p class="pass-msg">${passed
        ?`You scored <strong>${score}%</strong> — above the required ${CFG.PASS}% pass mark. Well done!`
        :`You scored <strong>${score}%</strong>. A minimum of <strong>${CFG.PASS}%</strong> is required. Review the material carefully and try again.`}</p>
      <div class="result-actions">
        ${passed?`<button class="btn-gold" onclick="goCert(${stageNum})">📜 Get Certificate</button>`:''}
        <button class="btn-outline" onclick="goLearn(${stageNum})">📖 Review Reading</button>
        <button class="btn-outline" onclick="location.hash='#/dashboard'">🏠 Dashboard</button>
      </div>
    </div>
    <div class="review-section">
      <h3>Question-by-Question Review</h3>
      ${review}
    </div>
  </div>`);
}

// ── Certificate ───────────────────────────────────────────────────────────────
function renderCert(){
  const u=Auth.current();
  const p=getParams();
  const stage=parseInt(p.stage)||1;
  const prog=Prog.getStage(u.id,u.gl,stage);
  if(!prog.passed){toast('Complete and pass the quiz first','warn');location.hash=`#/quiz?stage=${stage}`;return;}
  const glKey=GL_MAP[u.gl];
  const course=LMS_CONTENT[glKey];
  const stageData=course.stages[stage];
  const dateStr=prog.date?new Date(prog.date).toLocaleDateString('en-NG',{year:'numeric',month:'long',day:'numeric'}):new Date().toLocaleDateString('en-NG',{year:'numeric',month:'long',day:'numeric'});
  const certTitles={1:'Certificate of Completion',2:'Certificate of Proficiency',3:'Certificate of Excellence'};
  const certId=prog.certId||('CSC-'+Date.now().toString(36).toUpperCase());

  renderShell(`<div class="cert-page">
    <div class="cert-actions no-print">
      <button class="btn-back" onclick="location.hash='#/dashboard'">← Dashboard</button>
      <button class="btn-outline" onclick="goLearn(${stage})">📖 Review Stage</button>
      <button class="btn-gold" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
    <div class="cert-wrapper" id="certDoc">
      <div class="cert-outer">
        <div class="cert-corner cert-corner-tl"></div>
        <div class="cert-corner cert-corner-tr"></div>
        <div class="cert-corner cert-corner-bl"></div>
        <div class="cert-corner cert-corner-br"></div>
        <div class="cert-inner">
          <div class="cert-logos">
            <div class="cert-emblem-ring"><span class="cert-emblem">🏛️</span></div>
          </div>
          <div class="cert-header-text">
            <div class="cert-govt-name">LAGOS STATE GOVERNMENT</div>
            <div class="cert-body-org">Civil Service Commission</div>
            <div class="cert-dept">Learning Management System</div>
          </div>
          <div class="cert-ribbon-bar"></div>
          <div class="cert-doc-type">${certTitles[stage]||'Certificate of Completion'}</div>
          <div class="cert-stage-tag">Stage ${stage} — ${esc(stageData.title)}</div>
          <div class="cert-preamble">This is to certify that</div>
          <div class="cert-name">${esc(u.name)}</div>
          <div class="cert-designation">${esc(u.gl.replace('GL','Grade Level '))} &mdash; ${esc(course.subtitle)}</div>
          <div class="cert-body-text">has successfully completed <strong>Stage ${stage}: ${esc(stageData.title)}</strong> of the
          Civil Service Commission Learning Management System programme, achieving a score of
          <strong>${prog.score}%</strong> in the stage assessment.</div>
          <div class="cert-award-line">Awarded on: <strong>${dateStr}</strong></div>
          <div class="cert-id-line">Certificate No.: <span class="cert-id-code">${certId}</span></div>
          <div class="cert-sigs">
            <div class="sig-block">
              <div class="sig-graphic">_______________________</div>
              <div class="sig-name">Kadri Hamzat</div>
              <div class="sig-title">Chairman, Civil Service Commission</div>
              <div class="sig-title">Lagos State Government</div>
            </div>
            <div class="cert-seal">
              <div class="seal-ring">
                <div class="seal-inner">CSC<br/>LAGOS<br/>STATE</div>
              </div>
            </div>
            <div class="sig-block">
              <div class="sig-graphic">_______________________</div>
              <div class="sig-name">Director of Training & Development</div>
              <div class="sig-title">Civil Service Commission</div>
              <div class="sig-title">Lagos State Government</div>
            </div>
          </div>
          <div class="cert-footer-bar">
            <span>Lagos State Civil Service Commission — LMS v${CFG.VERSION}</span>
            <span>Verified Certificate | lms.csc.lagosstate.gov.ng</span>
          </div>
        </div>
      </div>
    </div>
  </div>`);
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────
function renderAdmin(){
  const users=(S.get('users')||[]).filter(u=>u.role!=='admin');
  let totalPassed=0,totalAttempts=0;
  const glStats={};
  users.forEach(u=>{
    if(!u.gl)return;
    if(!glStats[u.gl])glStats[u.gl]={count:0,s1:0,s2:0,s3:0};
    glStats[u.gl].count++;
    [1,2,3].forEach(s=>{
      const sp=Prog.getStage(u.id,u.gl,s);
      if(sp.passed){totalPassed++;if(s===1)glStats[u.gl].s1++;else if(s===2)glStats[u.gl].s2++;else glStats[u.gl].s3++;}
      totalAttempts+=sp.attempts||0;
    });
  });
  const pending=pendingCount();
  const sheetsUrl=GSync.url;

  const userRows=users.map(u=>{
    const stages=[1,2,3].map(s=>{const sp=Prog.getStage(u.id,u.gl,s);return sp.passed?`<span class="badge-pass">S${s}✅</span>`:sp.started?`<span class="badge-prog">S${s}📖</span>`:`<span class="badge-lock">S${s}🔒</span>`;}).join('');
    return`<tr onclick="viewUser('${u.id}')" class="user-row">
      <td><strong>${esc(u.name)}</strong><br><small class="muted">${esc(u.email)}</small></td>
      <td><span class="gl-badge">${esc(u.gl||'N/A')}</span></td>
      <td>${stages}</td>
      <td><small>${new Date(u.joined||Date.now()).toLocaleDateString('en-NG')}</small></td>
      <td><button class="btn-sm" onclick="event.stopPropagation();viewUser('${u.id}')">Report</button></td>
    </tr>`;
  }).join('');

  const glRows=Object.entries(glStats).sort((a,b)=>a[0].localeCompare(b[0])).map(([gl,s])=>`<tr>
    <td><strong>${gl}</strong></td><td>${s.count}</td><td>${s.s1}</td><td>${s.s2}</td><td>${s.s3}</td>
    <td><div class="mini-bar"><div style="width:${s.count?Math.round(((s.s1+s.s2+s.s3)/(s.count*3))*100):0}%"></div></div></td>
  </tr>`).join('');

  renderShell(`<div class="admin-page">
    <div class="admin-hero">
      <div>
        <h2>📊 Super Admin Dashboard</h2>
        <p class="admin-sub">Civil Service Commission — LMS Administration Panel</p>
      </div>
      <div class="admin-hero-actions">
        <button class="btn-outline" onclick="adminExportCSV()">⬇️ Export CSV</button>
      </div>
    </div>

    <div class="stat-cards">
      <div class="stat-card"><div class="stat-num">${users.length}</div><div class="stat-lbl">Registered Officers</div></div>
      <div class="stat-card green"><div class="stat-num">${totalPassed}</div><div class="stat-lbl">Stages Passed</div></div>
      <div class="stat-card gold"><div class="stat-num">${totalAttempts}</div><div class="stat-lbl">Quiz Attempts</div></div>
      <div class="stat-card"><div class="stat-num">${Object.keys(glStats).length}</div><div class="stat-lbl">Grade Levels Active</div></div>
      ${pending>0?`<div class="stat-card warn"><div class="stat-num">${pending}</div><div class="stat-lbl">Unsynced Records</div></div>`:''}
    </div>

    <!-- Google Sheets Config -->
    <div class="admin-section">
      <h3>🔗 Google Sheets Sync ${GSync.isOn()?'<span class="badge-on">● Active</span>':'<span class="badge-off">○ Not configured</span>'}</h3>
      <div class="sheets-config">
        <input type="url" id="sheets-url" placeholder="Paste your Google Apps Script Web App URL here..."
          value="${esc(sheetsUrl)}" class="sheets-input">
        <button class="btn-primary" onclick="saveSheets()">Save & Test</button>
        ${GSync.isOn()?`<button class="btn-outline" onclick="syncNow()">↑ Sync Now</button>`:''}
        ${GSync.isOn()?`<button class="btn-sm warn-btn" onclick="clearSheets()">Disconnect</button>`:''}
      </div>
      <p class="sheets-help">Deploy the provided <code>backend.gs</code> as a Google Apps Script Web App, then paste its URL here. <a href="#" onclick="showSheetsHelp()">Setup guide →</a></p>
    </div>

    <div class="admin-sections">
      <div class="admin-section">
        <h3>Performance by Grade Level</h3>
        <table class="data-table">
          <thead><tr><th>GL</th><th>Officers</th><th>Stage 1 ✅</th><th>Stage 2 ✅</th><th>Stage 3 ✅</th><th>Progress</th></tr></thead>
          <tbody>${glRows||'<tr><td colspan="6" class="empty-row">No officers registered yet</td></tr>'}</tbody>
        </table>
      </div>
      <div class="admin-section">
        <h3>All Officers <span class="muted" style="font-weight:400;font-size:.85rem">(click row to view full report)</span></h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Officer</th><th>Grade Level</th><th>Progress</th><th>Joined</th><th></th></tr></thead>
            <tbody>${userRows||'<tr><td colspan="5" class="empty-row">No officers registered yet</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`);
}
window.viewUser=(id)=>{location.hash=`#/admin/user?uid=${id}`;};
window.saveSheets=async function(){
  const url=document.getElementById('sheets-url')?.value?.trim();
  if(!url){toast('Please enter a valid URL','error');return;}
  GSync.url=url;
  toast('Testing connection...','info',2000);
  try{
    const r=await GSync.post({action:'ping'});
    if(r.ok!==false){toast('Google Sheets connected successfully!','success');}
    else{toast('Connected but received unexpected response. Check your Apps Script.','warn');}
  }catch(e){toast('Could not reach the URL. Check it is correct and deployed as "Anyone".','error');}
  GSync.updateIndicator();
  router();
};
window.syncNow=async function(){
  toast('Syncing to Google Sheets...','info',2000);
  await GSync.flushPending();
  // Push all current data
  const users=(S.get('users')||[]).filter(u=>u.role!=='admin');
  for(const u of users){
    await GSync.syncUser(u);
    [1,2,3].forEach(s=>{
      const p=Prog.getStage(u.id,u.gl,s);
      if(p.passed)GSync.syncCompletion(u.id,u.gl,s,p.score,p.passed,p.certId);
    });
  }
  toast('Sync complete!','success');
  GSync.updateIndicator();
};
window.clearSheets=function(){
  if(!confirm('Disconnect Google Sheets sync?'))return;
  GSync.url='';GSync.updateIndicator();toast('Sheets disconnected','info');router();
};
window.showSheetsHelp=function(){
  toast('Deploy backend.gs from the downloaded ZIP as a Google Apps Script Web App with "Anyone" access.','info',6000);
  return false;
};
window.adminExportCSV=function(){
  const users=(S.get('users')||[]).filter(u=>u.role!=='admin');
  const rows=[['Name','Email','Grade Level','Joined','Stage 1 Score','Stage 1 Passed','Stage 2 Score','Stage 2 Passed','Stage 3 Score','Stage 3 Passed']];
  users.forEach(u=>{
    const s1=Prog.getStage(u.id,u.gl,1),s2=Prog.getStage(u.id,u.gl,2),s3=Prog.getStage(u.id,u.gl,3);
    rows.push([u.name,u.email,u.gl,new Date(u.joined||Date.now()).toLocaleDateString('en-NG'),s1.score,s1.passed,s2.score,s2.passed,s3.score,s3.passed]);
  });
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`CSC_LMS_Report_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('CSV exported successfully','success');
};

// ── User Report ───────────────────────────────────────────────────────────────
function renderUserReport(){
  const p=getParams();
  const users=S.get('users')||[];
  const user=users.find(u=>u.id===p.uid);
  if(!user){location.hash='#/admin';return;}
  const glKey=GL_MAP[user.gl];
  const course=glKey?LMS_CONTENT[glKey]:null;
  const allPassed=[1,2,3].every(s=>user.gl&&Prog.getStage(user.id,user.gl,s).passed);

  const stageRows=[1,2,3].map(s=>{
    if(!user.gl||!course)return`<tr><td>Stage ${s}</td><td colspan="4" class="muted">—</td></tr>`;
    const sp=Prog.getStage(user.id,user.gl,s);
    const sd=course.stages[s];
    return`<tr>
      <td><strong>Stage ${s}</strong><br><small class="muted">${esc(sd.title)}</small></td>
      <td>${sp.started?'<span class="text-green">Yes</span>':'No'}</td>
      <td>${sp.completed?'<span class="text-green">Yes</span>':'No'}</td>
      <td class="${sp.passed?'text-green':'text-red'}">${sp.passed?`✅ Passed (${sp.score}%)`:'Not yet passed'}</td>
      <td>${sp.attempts||0}</td>
    </tr>`;
  }).join('');

  renderShell(`<div class="user-report-page">
    <button class="btn-back" onclick="location.hash='#/admin'">← Back to Admin</button>
    <div class="report-card">
      <div class="report-header">
        <div class="report-avatar">${user.name.charAt(0).toUpperCase()}</div>
        <div class="report-info">
          <h2>${esc(user.name)}</h2>
          <p>${esc(user.email)}</p>
          <p><span class="gl-badge">${esc(user.gl||'Not Set')}</span>&nbsp; Joined: ${new Date(user.joined||Date.now()).toLocaleDateString('en-NG',{year:'numeric',month:'long',day:'numeric'})}</p>
          ${allPassed?'<span class="badge-complete">🏆 All Stages Complete</span>':''}
        </div>
        <div class="report-actions">
          <button class="btn-outline" onclick="adminResetUser('${user.id}')">↺ Reset Progress</button>
        </div>
      </div>

      <h3 style="margin:20px 0 12px">Learning Progress</h3>
      <table class="data-table">
        <thead><tr><th>Stage</th><th>Started</th><th>Completed</th><th>Result</th><th>Attempts</th></tr></thead>
        <tbody>${stageRows}</tbody>
      </table>

      ${user.gl&&course?`
      <h3 style="margin:24px 0 12px">Certificates Earned</h3>
      <div class="cert-list">
        ${[1,2,3].map(s=>{
          const sp=Prog.getStage(user.id,user.gl,s);
          if(!sp.passed)return`<div class="cert-item locked"><span>Stage ${s} Certificate</span><span class="text-muted">Not yet earned</span></div>`;
          return`<div class="cert-item earned"><span>📜 Stage ${s} Certificate</span><span class="text-green">Earned — ID: ${esc(sp.certId||'—')}</span></div>`;
        }).join('')}
      </div>`:''}
    </div>
  </div>`);
}
window.adminResetUser=function(uid){
  if(!confirm('Reset this officer\'s progress? This cannot be undone.'))return;
  S.del('prog_'+uid);
  toast('Progress reset successfully','success');
  router();
};

// ── Boot ──────────────────────────────────────────────────────────────────────
initApp();
window.Auth=Auth;
router();
})();
