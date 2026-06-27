/* CSC Lagos State LMS v3.0
   Backend: Google Sheets API (all users, all devices, real-time)
   Fallback: localStorage cache when API unreachable */
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
setInterval(()=>{const t=new Image();Object.defineProperty(t,'id',{get:()=>{if(!_dt){_dt=true;const w=document.getElementById('devtools-warn');if(w)w.style.display='flex';}return '';}});console.log('%c',t);},2000);

// ── Config ────────────────────────────────────────────────────────────────────
const CFG={APP:'CSC-LMS',PASS:70,VERSION:'3.0.0'};

// ── LocalStorage ──────────────────────────────────────────────────────────────
const S={
  get:(k)=>{try{return JSON.parse(localStorage.getItem(CFG.APP+'_'+k));}catch{return null;}},
  set:(k,v)=>{try{localStorage.setItem(CFG.APP+'_'+k,JSON.stringify(v));}catch(e){console.warn('Storage full',e);}},
  del:(k)=>{localStorage.removeItem(CFG.APP+'_'+k);}
};

// ── API Client ────────────────────────────────────────────────────────────────
const API={
  get url(){return S.get('api_url')||'';},
  set url(v){S.set('api_url',v);},
  get token(){return S.get('api_token')||'';},
  set token(v){S.set('api_token',v);},

  isConfigured(){return !!this.url;},

  async call(payload,showLoad=false){
    if(!this.url)throw new Error('API not configured. Please set the Google Sheets URL in Admin Settings.');
    if(showLoad)loadingShow(payload._loadMsg||'Please wait…');
    try{
      const res=await fetch(this.url,{
        method:'POST',redirect:'follow',
        headers:{'Content-Type':'text/plain'},
        body:JSON.stringify({...payload,token:this.token})
      });
      const txt=await res.text();
      try{return JSON.parse(txt);}catch{throw new Error('Invalid response from server. Check your Apps Script URL.');}
    }finally{if(showLoad)loadingHide();}
  },

  async ping(){return this.call({action:'ping'});},
  async register(name,email,password,gl){return this.call({action:'register',name,email,password,gl},{_loadMsg:'Creating your account…'});},
  async login(email,password){return this.call({action:'login',email,password},{_loadMsg:'Signing you in…'});},
  async logout(){return this.call({action:'logout'});},
  async getMe(){return this.call({action:'get_me'});},
  async getProgress(){return this.call({action:'get_progress'});},
  async saveProgress(gl,stage,data){return this.call({action:'save_progress',gl,stage,...data});},
  async getAllUsers(){return this.call({action:'get_all_users'},{_loadMsg:'Loading all officers…'});},
  async getAllProgress(){return this.call({action:'get_all_progress'},{_loadMsg:'Loading progress data…'});},
  async resetProgress(userId){return this.call({action:'reset_progress',userId},{_loadMsg:'Resetting progress…'});},
  async deleteUser(userId){return this.call({action:'delete_user',userId},{_loadMsg:'Deleting user…'});}
};

// ── Loading Overlay ───────────────────────────────────────────────────────────
function loadingShow(msg='Loading…'){
  let el=document.getElementById('loading-overlay');
  if(!el){
    el=document.createElement('div');el.id='loading-overlay';
    el.innerHTML=`<div class="loading-card"><div class="loading-spinner"></div><div id="loading-msg" class="loading-msg"></div></div>`;
    document.body.appendChild(el);
  }
  document.getElementById('loading-msg').textContent=msg;
  el.style.display='flex';
}
function loadingHide(){const el=document.getElementById('loading-overlay');if(el)el.style.display='none';}

// ── Toast ─────────────────────────────────────────────────────────────────────
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

// ── TTS ───────────────────────────────────────────────────────────────────────
const TTS={
  synth:window.speechSynthesis,utt:null,playing:false,paused:false,
  rate:()=>parseFloat(S.get('tts_rate')||1.0),voices:[],
  init(){if(!this.synth)return;const load=()=>{this.voices=this.synth.getVoices();};load();this.synth.onvoiceschanged=load;},
  bestVoice(){return this.voices.find(v=>v.lang==='en-NG')||this.voices.find(v=>v.lang==='en-GB')||this.voices.find(v=>v.lang.startsWith('en'))||null;},
  stripHtml(h){const d=document.createElement('div');d.innerHTML=h;return d.innerText||d.textContent||'';},
  speak(text){
    this.stop();if(!this.synth)return;
    const u=new SpeechSynthesisUtterance(this.stripHtml(text));
    u.rate=this.rate();u.pitch=1.0;u.volume=1.0;
    const v=this.bestVoice();if(v)u.voice=v;
    u.onstart=()=>{this.playing=true;this.paused=false;this._ui();};
    u.onend=()=>{this.playing=false;this.paused=false;this._ui();};
    u.onerror=()=>{this.playing=false;this._ui();};
    this.synth.speak(u);this.utt=u;this.playing=true;this._ui();
  },
  pause(){if(this.synth&&this.playing){this.synth.pause();this.paused=true;this._ui();}},
  resume(){if(this.synth&&this.paused){this.synth.resume();this.paused=false;this._ui();}},
  stop(){if(this.synth)this.synth.cancel();this.playing=false;this.paused=false;this.utt=null;this._ui();},
  toggle(text){if(this.playing&&!this.paused)this.pause();else if(this.paused)this.resume();else this.speak(text);},
  setRate(r){S.set('tts_rate',r);},
  _ui(){const b=document.getElementById('tts-btn');const s=document.getElementById('tts-status');if(b){b.textContent=this.playing&&!this.paused?'⏸ Pause':'▶ Listen';b.classList.toggle('active',this.playing);}if(s)s.textContent=this.playing&&!this.paused?'🔊 Reading…':this.paused?'⏸ Paused':'🔇 Ready';}
};

// ── Auth ──────────────────────────────────────────────────────────────────────
const Auth={
  current(){
    const sess=S.get('session');
    if(!sess)return null;
    // Check token expiry
    if(sess.expiresAt&&new Date()>new Date(sess.expiresAt)){this.clearSession();return null;}
    return sess.user;
  },
  saveSession(user,token){
    const exp=new Date(Date.now()+48*3600*1000).toISOString();
    S.set('session',{user,token,expiresAt:exp});
    API.token=token;
  },
  clearSession(){S.del('session');S.del('api_token');API.token='';},

  async login(email,password){
    // BOOTSTRAP ADMIN: allow Super Admin to sign in offline so they can
    // configure the database the very first time (before API is connected).
    const BOOT_EMAIL='superadmin@csc.lagos.gov.ng';
    const BOOT_PASS='CSC@Admin2024!';
    if(email.toLowerCase().trim()===BOOT_EMAIL && password===BOOT_PASS){
      // If API is configured, try the real login first (to get a server token)
      if(API.isConfigured()){
        try{
          loadingShow('Signing you in…');
          const r=await API.login(email,password);
          if(r.ok){this.saveSession(r.user,r.token);return r;}
        }catch(e){/* fall through to local bootstrap */}
        finally{loadingHide();}
      }
      // Local bootstrap session (no server token — admin can now set up the DB)
      const adminUser={userId:'admin001',id:'admin001',name:'Super Administrator',email:BOOT_EMAIL,gl:null,role:'admin'};
      this.saveSession(adminUser,'');
      return{ok:true,user:adminUser,bootstrap:true};
    }

    // All other users require the database
    if(!API.isConfigured())return{ok:false,msg:'The LMS database is not yet configured. Please sign in as the Super Admin to set it up.'};
    try{
      loadingShow('Signing you in…');
      const r=await API.login(email,password);
      if(!r.ok)return r;
      this.saveSession(r.user,r.token);
      try{
        const pr=await API.getProgress();
        if(pr.ok)S.set('prog_'+r.user.userId,pr.progress);
      }catch(e){/* non-fatal */}
      return r;
    }catch(e){return{ok:false,msg:e.message};}
    finally{loadingHide();}
  },

  async register(name,email,password,gl){
    if(!API.isConfigured())return{ok:false,msg:'The LMS database is not yet configured. Please contact your administrator.'};
    try{
      loadingShow('Creating your account…');
      const r=await API.register(name,email,password,gl);
      if(!r.ok)return r;
      this.saveSession(r.user,r.token);
      S.set('prog_'+r.user.userId,{});
      return r;
    }catch(e){return{ok:false,msg:e.message};}
    finally{loadingHide();}
  },

  async logout(){
    try{if(API.token)await API.logout();}catch(e){/* non-fatal */}
    TTS.stop();
    this.clearSession();
    S.del('prog_'+(this.current()?.userId||''));
    location.hash='#/login';
  }
};

// ── Progress (localStorage cache + API sync) ──────────────────────────────────
const Prog={
  _cache(uid){return S.get('prog_'+uid)||{};},
  _setCache(uid,data){S.set('prog_'+uid,data);},

  getStage(uid,gl,stage){
    const p=this._cache(uid);
    return(p[gl]||{})[stage]||{started:false,completed:false,score:0,passed:false,attempts:0,certId:null,date:null};
  },

  async save(uid,gl,stage,data){
    // 1. Update localStorage immediately (fast UI)
    const p=this._cache(uid);
    if(!p[gl])p[gl]={};
    p[gl][stage]={...this.getStage(uid,gl,stage),...data};
    this._setCache(uid,p);
    // 2. Sync to API in background
    if(API.isConfigured()&&API.token){
      API.saveProgress(gl,stage,data).catch(e=>console.warn('Progress sync failed:',e));
    }
  },

  canAccess(uid,gl,stage){return stage===1||this.getStage(uid,gl,stage-1).passed;},
  stagesCompleted(uid,gl){return Object.keys(LMS_CONTENT[GL_MAP[gl]]?.stages||{}).filter(s=>this.getStage(uid,gl,parseInt(s)).passed).length;},
  totalStages(gl){return Object.keys(LMS_CONTENT[GL_MAP[gl]]?.stages||{}).length;}
};

// ── Router ────────────────────────────────────────────────────────────────────
const routes={
  '':()=>guard(renderDashboard),'/':()=>guard(renderDashboard),
  '/login':()=>safeRender(renderLogin),
  '/register':()=>safeRender(renderRegister),
  '/dashboard':()=>guard(renderDashboard),
  '/learn':()=>guard(renderLearn),'/quiz':()=>guard(renderQuiz),
  '/cert':()=>guard(renderCert),
  '/admin':()=>guard(renderAdmin,true),'/admin/user':()=>guard(renderUserReport,true)
};

function safeRender(fn){
  try{fn();}catch(e){
    console.error('[CSC-LMS]',e);
    app().innerHTML=`<div class="auth-page"><div class="auth-card">
      <div class="auth-header-band"></div>
      <div class="auth-body" style="text-align:center;padding:40px 24px">
        <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
        <h2 style="color:var(--red);margin-bottom:8px">Something went wrong</h2>
        <p style="color:var(--text-light);font-size:.9rem;margin-bottom:20px">${e.message||'An unexpected error occurred.'}</p>
        <a href="#/login" class="btn-primary" style="display:inline-block;text-decoration:none">← Back to Login</a>
      </div></div></div>`;
  }
}

function guard(fn,adminOnly=false){
  let u;
  try{u=Auth.current();}catch(e){console.error('[CSC-LMS] session read failed',e);Auth.clearSession();location.hash='#/login';return;}
  if(!u){location.hash='#/login';if(getHash()==='/login')safeRender(renderLogin);return;}
  if(adminOnly&&u.role!=='admin'){location.hash='#/dashboard';return;}
  try{
    fn();
  }catch(e){
    console.error('[CSC-LMS] render failed',e);
    // Never leave the user stuck on the loading screen — show a recovery view
    app().innerHTML=`<div class="auth-page"><div class="auth-card">
      <div class="auth-header-band"></div>
      <div class="auth-body" style="text-align:center;padding:40px 24px">
        <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
        <h2 style="color:var(--red,#c0392b);margin-bottom:8px">Could not load this page</h2>
        <p style="color:#4a5568;font-size:.9rem;margin-bottom:20px">${(e&&e.message)||'An unexpected error occurred while loading your dashboard.'}</p>
        <button class="btn-primary" style="margin-right:8px" onclick="location.hash='#/dashboard';location.reload()">↻ Retry</button>
        <button class="btn-outline" onclick="window.Auth.logout()">Sign Out</button>
      </div></div></div>`;
  }
}

const getHash=()=>location.hash.replace('#','').split('?')[0]||'/';
const getParams=()=>{const p={};(location.hash.split('?')[1]||'').split('&').forEach(x=>{const[k,v]=x.split('=');if(k)p[k]=decodeURIComponent(v||'');});return p;};

function router(){
  try{
    const u=Auth.current();
    const h=getHash();
    // If not logged in and not heading to a public page, force login
    if(!u && h!=='/login' && h!=='/register'){
      if(location.hash!=='#/login')location.hash='#/login';
      safeRender(renderLogin);
      return;
    }
    const fn=routes[h];
    if(fn)fn();else guard(renderDashboard);
    updateNavStatus();
  }catch(e){
    console.error('[CSC-LMS] router failed',e);
    // Absolute last resort: never leave a blank/loading screen
    safeRender(renderLogin);
  }
}
window.addEventListener('hashchange',()=>{TTS.stop();router();});

const app=()=>document.getElementById('app');
const esc=(s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function updateNavStatus(){
  const dot=document.getElementById('api-status-dot');
  if(!dot)return;
  dot.className='api-dot '+(API.isConfigured()?'ok':'off');
  dot.title=API.isConfigured()?'Database connected':'Database not configured';
}

function renderShell(content){
  const u=Auth.current();
  const nav=u?`
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
      <span class="api-dot" id="api-status-dot" title="Database status"></span>
      <span class="nav-user">👤 ${esc(u.name.split(' ')[0])}</span>
      <button onclick="doLogout()" class="btn-logout">Sign Out</button>
    </div>
  </nav>`:'';
  app().innerHTML=nav+`<div class="main-content">${content}</div>`;
  updateNavStatus();
}

window.doLogout=async function(){await Auth.logout();};

// ── Login ─────────────────────────────────────────────────────────────────────
function renderLogin(){
  const apiReady=API.isConfigured();
  app().innerHTML=`
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header-band"></div>
      <div class="auth-body">
        <div class="auth-logo">🏛️</div>
        <h1 class="auth-title">Civil Service Commission</h1>
        <p class="auth-subtitle">Lagos State — Learning Management System</p>
        ${!apiReady?`<div class="api-notice">⚙️ <strong>Database not configured.</strong> The Super Administrator can sign in to set it up.</div>`:''}
        <form class="auth-form" onsubmit="return false">
          <div class="form-group">
            <label>Official Email Address</label>
            <input type="email" id="l_email" placeholder="your.email@domain.com" autocomplete="email" required
              onkeydown="if(event.key==='Enter')doLogin()">
          </div>
          <div class="form-group">
            <label>Password</label>
            <div class="pw-wrap">
              <input type="password" id="l_pw" placeholder="Enter your password" autocomplete="current-password" required
                onkeydown="if(event.key==='Enter')doLogin()">
              <button type="button" class="pw-toggle" onclick="togglePw('l_pw',this)">👁</button>
            </div>
          </div>
          <div id="loginErr" class="form-error" style="display:none"></div>
          <button class="btn-primary full" onclick="doLogin()">
            Sign In to LMS
          </button>
        </form>
        <p class="auth-switch">Don't have an account? <a href="#/register">Create Account</a></p>
      </div>
    </div>
  </div>`;
}

window.doLogin=async function(){
  const email=document.getElementById('l_email')?.value?.trim();
  const pw=document.getElementById('l_pw')?.value;
  const err=document.getElementById('loginErr');
  const showErr=(m)=>{if(err){err.textContent=m;err.style.display='block';}};
  if(!email||!pw){showErr('Please enter your email and password.');return;}
  const r=await Auth.login(email,pw);
  if(!r.ok){showErr(r.msg);return;}
  if(err)err.style.display='none';
  toast(`Welcome back, ${r.user.name.split(' ')[0]}!`,'success');
  setTimeout(()=>{location.hash=r.user.role==='admin'?'#/admin':'#/dashboard';},300);
};

// ── Register ──────────────────────────────────────────────────────────────────
function renderRegister(){
  const levels=(typeof GRADE_LEVELS!=='undefined'&&Array.isArray(GRADE_LEVELS))
    ?GRADE_LEVELS:["GL06","GL07","GL08","GL09","GL10","GL12","GL13","GL14","GL15","GL16"];
  const glOpts=levels.map(g=>`<option value="${g}">${g.replace('GL','Grade Level ')}</option>`).join('');
  const apiReady=API.isConfigured();

  app().innerHTML=`
  <div class="auth-page">
    <div class="auth-card reg-card">
      <div class="auth-header-band"></div>
      <div class="auth-body">
        <div class="auth-logo">🏛️</div>
        <h1 class="auth-title">Create Account</h1>
        <p class="auth-subtitle">Lagos State Civil Service Commission — LMS</p>
        ${!apiReady?`<div class="api-notice">⚙️ <strong>Database not configured.</strong> Registration is unavailable. Contact your administrator.</div>`:''}
        <form class="auth-form" onsubmit="return false">
          <div class="reg-row">
            <div class="form-group">
              <label>Full Name <span class="req">*</span></label>
              <input type="text" id="r_name" placeholder="e.g. Adaeze Okonkwo" autocomplete="name" required minlength="2" ${!apiReady?'disabled':''}>
            </div>
            <div class="form-group">
              <label>Grade Level <span class="req">*</span></label>
              <select id="r_gl" required ${!apiReady?'disabled':''}>
                <option value="">-- Select --</option>
                ${glOpts}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Official Email Address <span class="req">*</span></label>
            <input type="email" id="r_email" placeholder="your.email@domain.com" autocomplete="email" required ${!apiReady?'disabled':''}>
          </div>
          <div class="reg-row">
            <div class="form-group">
              <label>Password <span class="req">*</span></label>
              <div class="pw-wrap">
                <input type="password" id="r_pw" placeholder="At least 6 characters" autocomplete="new-password" required minlength="6" ${!apiReady?'disabled':''}>
                <button type="button" class="pw-toggle" onclick="togglePw('r_pw',this)">👁</button>
              </div>
            </div>
            <div class="form-group">
              <label>Confirm Password <span class="req">*</span></label>
              <div class="pw-wrap">
                <input type="password" id="r_pw2" placeholder="Repeat password" autocomplete="new-password" required minlength="6" ${!apiReady?'disabled':''}>
                <button type="button" class="pw-toggle" onclick="togglePw('r_pw2',this)">👁</button>
              </div>
            </div>
          </div>
          <div class="reg-terms">
            <label class="terms-label">
              <input type="checkbox" id="r_terms" required ${!apiReady?'disabled':''}>
              <span>I agree to use this platform in accordance with the <strong>CSC Code of Conduct</strong></span>
            </label>
          </div>
          <div id="regErr" class="form-error" style="display:none"></div>
          <button class="btn-primary full" onclick="doRegister()" ${!apiReady?'disabled style="opacity:.5;cursor:not-allowed"':''}>
            Create My Account &rarr;
          </button>
        </form>
        <p class="auth-switch">Already have an account? <a href="#/login">Sign In</a></p>
      </div>
    </div>
  </div>`;
}

window.togglePw=function(id,btn){
  const el=document.getElementById(id);if(!el)return;
  const show=el.type==='password';el.type=show?'text':'password';btn.textContent=show?'🙈':'👁';
};

window.doRegister=async function(){
  const name=(document.getElementById('r_name')?.value||'').trim();
  const email=(document.getElementById('r_email')?.value||'').trim();
  const gl=document.getElementById('r_gl')?.value||'';
  const pw=document.getElementById('r_pw')?.value||'';
  const pw2=document.getElementById('r_pw2')?.value||'';
  const terms=document.getElementById('r_terms')?.checked;
  const err=document.getElementById('regErr');
  const showErr=(m)=>{if(err){err.textContent=m;err.style.display='block';}};

  if(!terms){showErr('Please accept the Code of Conduct to continue.');return;}
  if(pw!==pw2){showErr('Passwords do not match. Please re-enter.');return;}
  if(pw.length<6){showErr('Password must be at least 6 characters.');return;}

  const r=await Auth.register(name,email,pw,gl);
  if(!r.ok){showErr(r.msg);return;}
  if(err)err.style.display='none';
  toast(`Welcome, ${name.split(' ')[0]}! Your account has been created.`,'success');
  setTimeout(()=>{location.hash='#/dashboard';},400);
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard(){
  const u=Auth.current();
  if(!u){location.hash='#/login';return;}
  // Admins don't have a learning dashboard — send them to the admin panel
  if(u.role==='admin'){location.hash='#/admin';renderAdmin();return;}
  const glKey=GL_MAP[u.gl];
  const course=LMS_CONTENT[glKey];
  if(!course){renderShell(`<div class="error-box">⚠️ No course found for ${esc(u.gl)}. Please contact the administrator.</div>`);return;}

  const done=Prog.stagesCompleted(u.id||u.userId,u.gl);
  const total=Prog.totalStages(u.gl);
  const pct=total?Math.round((done/total)*100):0;
  const uid=u.id||u.userId;
  const circumference=2*Math.PI*38;
  const greetHour=new Date().getHours();
  const greet=greetHour<12?'Good morning':greetHour<17?'Good afternoon':'Good evening';

  const stages=Object.entries(course.stages).map(([sNum,s])=>{
    const sn=parseInt(sNum);
    const prog=Prog.getStage(uid,u.gl,sn);
    const canAccess=Prog.canAccess(uid,u.gl,sn);
    const cls=prog.passed?'stage-done':prog.started?'stage-active':'stage-locked';
    const badge=prog.passed?'<span class="stage-badge done">✅ Completed</span>':prog.started?'<span class="stage-badge progress">📖 In Progress</span>':'<span class="stage-badge locked">🔒 Locked</span>';
    return`<div class="stage-card ${cls}">
      <div class="stage-left"><div class="stage-icon-wrap">${s.icon}</div></div>
      <div class="stage-info">
        <div class="stage-meta">Stage ${sn} of ${total}</div>
        <div class="stage-title">${esc(s.title)}</div>
        <div class="stage-desc">${esc(s.description)}</div>
        <div class="stage-footer">
          ${badge}
          ${prog.passed?`<span class="stage-score">Score: <strong>${prog.score}%</strong></span>`:''}
          ${prog.passed&&prog.date?`<span class="stage-date">${new Date(prog.date).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</span>`:''}
        </div>
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
            stroke-dasharray="${circumference}" stroke-dashoffset="${circumference*(1-pct/100)}"
            stroke-linecap="round" transform="rotate(-90 45 45)" style="transition:stroke-dashoffset .8s ease"/>
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
    ${done===total?`<div class="completion-banner">🎉 Congratulations! You have completed all ${total} stages of the ${course.title} programme!</div>`:''}
  </div>`);

  // Background: refresh progress from API without blocking the UI
  if(API.isConfigured()&&API.token){
    API.getProgress().then(r=>{if(r.ok){Prog._setCache(uid,r.progress);}}).catch(()=>{});
  }
}
window.goLearn=(s)=>{location.hash=`#/learn?stage=${s}`;};
window.goQuiz=(s)=>{location.hash=`#/quiz?stage=${s}`;};
window.goCert=(s)=>{location.hash=`#/cert?stage=${s}`;};

// ── Learn ─────────────────────────────────────────────────────────────────────
let _ttsText='';
function renderLearn(){
  const u=Auth.current(),p=getParams(),stage=parseInt(p.stage)||1;
  const uid=u.id||u.userId;
  const glKey=GL_MAP[u.gl];
  const course=LMS_CONTENT[glKey];
  const stageData=course?.stages[stage];
  if(!stageData||!Prog.canAccess(uid,u.gl,stage)){location.hash='#/dashboard';return;}
  Prog.save(uid,u.gl,stage,{started:true});
  let ti=Math.max(0,Math.min(parseInt(p.topic)||0,stageData.topics.length-1));
  const topic=stageData.topics[ti];
  const prog=Prog.getStage(uid,u.gl,stage);
  _ttsText=topic.content;

  const topicNav=stageData.topics.map((t,i)=>`
    <div class="topic-nav-item ${i===ti?'active':''}" onclick="goTopic(${stage},${i})">
      <span class="topic-check">${i<ti?'✅':'○'}</span><span>${esc(t.title)}</span>
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
        ?`<div class="quiz-done">✅ Stage Passed — ${prog.score}%</div><button class="btn-gold full mt8" onclick="goCert(${stage})">📜 Certificate</button>`
        :`<button class="btn-primary full mt8" onclick="goQuiz(${stage})">📝 Take Stage Quiz</button>`}
    </div>
    <div class="learn-main">
      <div class="topic-header">
        <div><h2>${esc(topic.title)}</h2><span class="reading-time">⏱ ${esc(topic.readingTime)} read</span></div>
      </div>
      <div class="tts-bar">
        <div class="tts-left"><span class="tts-label">🔊 Audio Narration</span><span id="tts-status" class="tts-status">🔇 Ready</span></div>
        <div class="tts-controls">
          <button id="tts-btn" class="btn-tts" onclick="ttsToggle()">▶ Listen</button>
          <button class="btn-tts-sm" onclick="ttsStop()">⏹ Stop</button>
          <select class="tts-rate" onchange="ttsRate(this.value)">
            <option value="0.8" ${rateVal==0.8?'selected':''}>0.8×</option>
            <option value="1.0" ${rateVal==1.0?'selected':''}>1.0×</option>
            <option value="1.25" ${rateVal==1.25?'selected':''}>1.25×</option>
            <option value="1.5" ${rateVal==1.5?'selected':''}>1.5×</option>
          </select>
        </div>
      </div>
      <div class="topic-body">${topic.content}</div>
      <div class="topic-footer">
        ${ti>0?`<button class="btn-outline" onclick="goTopic(${stage},${ti-1})">← Previous</button>`:'<span></span>'}
        ${isLast?`<button class="btn-primary" onclick="goQuiz(${stage})">📝 Take Stage Quiz →</button>`:`<button class="btn-primary" onclick="goTopic(${stage},${ti+1})">Next Topic →</button>`}
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
  const u=Auth.current(),p=getParams(),stage=parseInt(p.stage)||1;
  const uid=u.id||u.userId;
  const glKey=GL_MAP[u.gl];
  const stageData=LMS_CONTENT[glKey]?.stages[stage];
  if(!stageData){location.hash='#/dashboard';return;}
  const prog=Prog.getStage(uid,u.gl,stage);

  if(prog.passed){
    renderShell(`<div class="quiz-done-page"><div class="quiz-done-card">
      <div class="done-icon">✅</div><h2>Stage ${stage} Already Passed!</h2>
      <p>You scored <strong>${prog.score}%</strong>.</p>
      <div class="done-actions">
        <button class="btn-primary" onclick="goCert(${stage})">📜 View Certificate</button>
        <button class="btn-outline" onclick="location.hash='#/dashboard'">← Dashboard</button>
      </div></div></div>`);
    return;
  }
  if(!_qs.stage||_qs.stage!==stage||_qs.uid!==uid){
    const qs=[...stageData.quiz.questions];
    for(let i=qs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[qs[i],qs[j]]=[qs[j],qs[i]];}
    _qs={stage,uid,gl:u.gl,questions:qs,current:0,answers:{}};
  }
  if(!p.submit)renderQuizQ();else renderQuizResults();
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
        <div class="q-dots">${qs.map((_,i)=>`<span class="dot ${i===ci?'active':_qs.answers[i]!==undefined?'answered':''}" onclick="_goQ(${i})"></span>`).join('')}</div>
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

async function renderQuizResults(){
  const u=Auth.current(),stageNum=parseInt(getParams().stage)||_qs.stage||1;
  const uid=u.id||u.userId;
  const qs=_qs.questions||[],answers={..._qs.answers};
  _qs={};
  if(!qs.length){location.hash='#/dashboard';return;}
  let correct=0;qs.forEach((q,i)=>{if(answers[i]===q.ans)correct++;});
  const score=Math.round((correct/qs.length)*100),passed=score>=CFG.PASS;
  const prog=Prog.getStage(uid,u.gl,stageNum);
  const attempts=(prog.attempts||0)+1;
  const certId=passed&&!prog.certId?'CSC'+Date.now().toString(36).toUpperCase():prog.certId||null;
  await Prog.save(uid,u.gl,stageNum,{completed:true,score,passed,attempts,certId,date:new Date().toISOString()});

  if(passed)toast('🎉 Congratulations! You passed Stage '+stageNum+'!','success',5000);
  else toast(`Score: ${score}% — need ${CFG.PASS}% to pass. Review and try again.`,'warn',5000);

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
        <button class="btn-outline" onclick="goLearn(${stageNum})">📖 Review Material</button>
        <button class="btn-outline" onclick="location.hash='#/dashboard'">🏠 Dashboard</button>
      </div>
    </div>
    <div class="review-section"><h3>Question-by-Question Review</h3>${review}</div>
  </div>`);
}

// ── Certificate ───────────────────────────────────────────────────────────────
function renderCert(){
  const u=Auth.current(),p=getParams(),stage=parseInt(p.stage)||1;
  const uid=u.id||u.userId;
  const prog=Prog.getStage(uid,u.gl,stage);
  if(!prog.passed){toast('Complete and pass the quiz first','warn');location.hash=`#/quiz?stage=${stage}`;return;}
  const glKey=GL_MAP[u.gl];
  const course=LMS_CONTENT[glKey];
  const stageData=course.stages[stage];
  const dateStr=prog.date?new Date(prog.date).toLocaleDateString('en-NG',{year:'numeric',month:'long',day:'numeric'}):new Date().toLocaleDateString('en-NG',{year:'numeric',month:'long',day:'numeric'});
  const titles={1:'Certificate of Completion',2:'Certificate of Proficiency',3:'Certificate of Excellence'};
  const certId=prog.certId||('CSC-'+Date.now().toString(36).toUpperCase());

  renderShell(`<div class="cert-page">
    <div class="cert-actions no-print">
      <button class="btn-back" onclick="location.hash='#/dashboard'">← Dashboard</button>
      <button class="btn-outline" onclick="goLearn(${stage})">📖 Review Stage</button>
      <button class="btn-gold" onclick="window.print()">🖨️ Print / Save PDF</button>
    </div>
    <div class="cert-wrapper">
      <div class="cert-outer">
        <div class="cert-corner cert-corner-tl"></div><div class="cert-corner cert-corner-tr"></div>
        <div class="cert-corner cert-corner-bl"></div><div class="cert-corner cert-corner-br"></div>
        <div class="cert-inner">
          <div class="cert-logos"><div class="cert-emblem-ring"><span class="cert-emblem">🏛️</span></div></div>
          <div class="cert-header-text">
            <div class="cert-govt-name">LAGOS STATE GOVERNMENT</div>
            <div class="cert-body-org">Civil Service Commission</div>
            <div class="cert-dept">Learning Management System</div>
          </div>
          <div class="cert-ribbon-bar"></div>
          <div class="cert-doc-type">${titles[stage]||'Certificate of Completion'}</div>
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
              <div class="sig-name">Chairman</div>
              <div class="sig-title">Civil Service Commission, Lagos State</div>
            </div>
            <div class="cert-seal"><div class="seal-ring"><div class="seal-inner">CSC<br/>LAGOS<br/>STATE</div></div></div>
            <div class="sig-block">
              <div class="sig-graphic">_______________________</div>
              <div class="sig-name">Director of Training</div>
              <div class="sig-title">Civil Service Commission, Lagos State</div>
            </div>
          </div>
          <div class="cert-footer-bar">
            <span>CSC LMS v${CFG.VERSION}</span>
            <span>Verified Certificate | lms.csc.lagosstate.gov.ng</span>
          </div>
        </div>
      </div>
    </div>
  </div>`);
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────
async function renderAdmin(){
  renderShell(`<div class="admin-loading">
    <div class="loading-spinner lg"></div>
    <p>Loading all officers from database…</p>
  </div>`);

  let users=[],allProgress=[];

  if(API.isConfigured()&&API.token){
    try{
      const [ur,pr]=await Promise.all([API.getAllUsers(),API.getAllProgress()]);
      if(ur.ok)users=ur.users||[];
      if(pr.ok)allProgress=pr.progress||[];
    }catch(e){toast('Could not reach database: '+e.message,'error',6000);}
  }else{
    renderShell(`<div class="admin-page">
      <div class="admin-hero">
        <div><h2>📊 Super Admin Dashboard</h2>
        <p class="admin-sub">Welcome — let's connect your database</p></div>
      </div>
      <div class="api-setup-banner">
        <h2>⚙️ One-Time Database Setup</h2>
        <p>You're signed in as Super Administrator. To track all officers across <strong>every device and browser</strong>, connect your Google Sheets database below.</p>
        <div class="setup-steps">
          <div class="setup-step"><span class="step-n">1</span> Open a new Google Sheet → <strong>Extensions → Apps Script</strong></div>
          <div class="setup-step"><span class="step-n">2</span> Paste the <code>backend.gs</code> file → Save</div>
          <div class="setup-step"><span class="step-n">3</span> <strong>Deploy → New Deployment → Web App</strong> (Execute as: Me, Access: Anyone)</div>
          <div class="setup-step"><span class="step-n">4</span> Copy the Web App URL and paste it below</div>
        </div>
        ${renderApiSettings()}
      </div>
    </div>`);
    return;
  }

  // Build stats
  const glStats={};
  users.filter(u=>u.role!=='admin').forEach(u=>{
    if(!u.gl)return;
    if(!glStats[u.gl])glStats[u.gl]={count:0,s1:0,s2:0,s3:0};
    glStats[u.gl].count++;
  });
  allProgress.forEach(p=>{
    if(!p.passed||!glStats[p.gl])return;
    if(p.stage===1)glStats[p.gl].s1++;
    else if(p.stage===2)glStats[p.gl].s2++;
    else if(p.stage===3)glStats[p.gl].s3++;
  });
  const totalPassed=allProgress.filter(p=>p.passed).length;
  const totalAttempts=allProgress.reduce((a,p)=>a+(p.attempts||0),0);

  // Progress lookup helper
  const progLookup={};
  allProgress.forEach(p=>{
    if(!progLookup[p.userId])progLookup[p.userId]={};
    if(!progLookup[p.userId][p.gl])progLookup[p.userId][p.gl]={};
    progLookup[p.userId][p.gl][p.stage]=p;
  });

  const officers=users.filter(u=>u.role!=='admin');
  const userRows=officers.map(u=>{
    const stages=[1,2,3].map(s=>{
      const sp=(progLookup[u.userId]?.[u.gl]||{})[s];
      return sp?.passed?`<span class="badge-pass">S${s}✅</span>`:sp?.started?`<span class="badge-prog">S${s}📖</span>`:`<span class="badge-lock">S${s}🔒</span>`;
    }).join('');
    const joined=u.joinedAt?new Date(u.joinedAt).toLocaleDateString('en-NG'):'—';
    const lastLogin=u.lastLogin?new Date(u.lastLogin).toLocaleDateString('en-NG'):'—';
    return`<tr onclick="viewUser('${u.userId}')" class="user-row">
      <td><strong>${esc(u.name)}</strong><br><small class="muted">${esc(u.email)}</small></td>
      <td><span class="gl-badge">${esc(u.gl||'N/A')}</span></td>
      <td>${stages}</td>
      <td><small>${joined}</small></td>
      <td><small>${lastLogin}</small></td>
      <td><button class="btn-sm" onclick="event.stopPropagation();viewUser('${u.userId}')">Report</button></td>
    </tr>`;
  }).join('');

  const glRows=Object.entries(glStats).sort((a,b)=>a[0].localeCompare(b[0])).map(([gl,s])=>{
    const total=s.count*3||1;const pct=Math.round(((s.s1+s.s2+s.s3)/total)*100);
    return`<tr><td><strong>${gl}</strong></td><td>${s.count}</td><td>${s.s1}</td><td>${s.s2}</td><td>${s.s3}</td>
    <td><div class="mini-bar"><div style="width:${pct}%"></div></div><small class="muted">${pct}%</small></td></tr>`;
  }).join('');

  renderShell(`<div class="admin-page">
    <div class="admin-hero">
      <div>
        <h2>📊 Super Admin Dashboard</h2>
        <p class="admin-sub">Civil Service Commission — Live data from Google Sheets database</p>
      </div>
      <div class="admin-hero-actions">
        <button class="btn-outline" onclick="adminRefresh()">↻ Refresh</button>
        <button class="btn-outline" onclick="adminExportCSV()">⬇️ Export CSV</button>
      </div>
    </div>

    <div class="stat-cards">
      <div class="stat-card"><div class="stat-num">${officers.length}</div><div class="stat-lbl">Total Officers</div></div>
      <div class="stat-card green"><div class="stat-num">${totalPassed}</div><div class="stat-lbl">Stages Passed</div></div>
      <div class="stat-card gold"><div class="stat-num">${totalAttempts}</div><div class="stat-lbl">Quiz Attempts</div></div>
      <div class="stat-card"><div class="stat-num">${Object.keys(glStats).length}</div><div class="stat-lbl">Grade Levels Active</div></div>
    </div>

    <!-- API Settings -->
    <div class="admin-section">
      <h3>🔗 Database Connection <span class="badge-on">● Google Sheets Connected</span></h3>
      ${renderApiSettings(true)}
    </div>

    <!-- GL Performance -->
    <div class="admin-section">
      <h3>Performance by Grade Level</h3>
      <table class="data-table">
        <thead><tr><th>GL</th><th>Officers</th><th>Stage 1 ✅</th><th>Stage 2 ✅</th><th>Stage 3 ✅</th><th>Progress</th></tr></thead>
        <tbody>${glRows||'<tr><td colspan="6" class="empty-row">No data yet</td></tr>'}</tbody>
      </table>
    </div>

    <!-- All Officers -->
    <div class="admin-section">
      <h3>All Officers <span class="muted" style="font-weight:400;font-size:.85rem">— from all devices &amp; browsers</span></h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Officer</th><th>Grade Level</th><th>Progress</th><th>Joined</th><th>Last Login</th><th></th></tr></thead>
          <tbody>${userRows||'<tr><td colspan="6" class="empty-row">No officers registered yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </div>`);

  // Store all users and progress for the user report view
  window._adminUsers=users;
  window._adminProgress=progLookup;
}

function renderApiSettings(compact=false){
  const url=API.url;
  return`<div class="sheets-config" style="${compact?'margin-top:12px':''}">
    <input type="url" id="api-url-input" placeholder="Paste your Google Apps Script Web App URL here…"
      value="${esc(url)}" class="sheets-input">
    <button class="btn-primary" onclick="saveApiUrl()">Save & Test</button>
    ${url?`<button class="btn-outline" onclick="adminRefresh()">↑ Reconnect</button>`:''}
    ${url?`<button class="warn-btn" onclick="clearApiUrl()">Disconnect</button>`:''}
  </div>
  <p class="sheets-help">Deploy <code>backend.gs</code> as a Google Apps Script Web App, then paste the URL above.
  <strong>Execute as: Me | Who has access: Anyone</strong></p>`;
}

window.viewUser=(id)=>{
  // Store target user ID for the report page
  window._reportUserId=id;
  location.hash=`#/admin/user?uid=${id}`;
};
window.adminRefresh=()=>{location.hash='#/admin';renderAdmin();};
window.saveApiUrl=async function(){
  const url=document.getElementById('api-url-input')?.value?.trim();
  if(!url){toast('Please enter a valid URL','error');return;}
  API.url=url;
  toast('Testing connection…','info',2000);
  try{
    const r=await API.ping();
    if(r.ok!==false){
      toast('✅ Google Sheets database connected!','success',4000);
      // If the admin is on a bootstrap (offline) session with no server token,
      // silently re-authenticate to obtain a real token so admin API calls work.
      if(!API.token){
        try{
          const lr=await API.login('superadmin@csc.lagos.gov.ng','CSC@Admin2024!');
          if(lr.ok){Auth.saveSession(lr.user,lr.token);toast('Admin session upgraded — you can now manage all officers.','success',4000);}
        }catch(e){/* the sheet may have a different admin password; non-fatal */}
      }
    }else{toast('Connected but unexpected response. Check your Apps Script.','warn',5000);}
  }catch(e){toast('❌ Could not reach URL. Ensure it is deployed as "Anyone" access.','error',6000);}
  updateNavStatus();
  setTimeout(()=>renderAdmin(),1200);
};
window.clearApiUrl=function(){
  if(!confirm('Disconnect the Google Sheets database?'))return;
  API.url='';updateNavStatus();toast('Database disconnected','info');
  renderAdmin();
};
window.adminExportCSV=function(){
  const users=window._adminUsers||[];
  const prog=window._adminProgress||{};
  const rows=[['Name','Email','Grade Level','Joined','Last Login','Stage 1 Score','Stage 1 Passed','Stage 2 Score','Stage 2 Passed','Stage 3 Score','Stage 3 Passed']];
  users.filter(u=>u.role!=='admin').forEach(u=>{
    const s1=(prog[u.userId]?.[u.gl]||{})[1]||{};
    const s2=(prog[u.userId]?.[u.gl]||{})[2]||{};
    const s3=(prog[u.userId]?.[u.gl]||{})[3]||{};
    rows.push([u.name,u.email,u.gl,u.joinedAt||'',u.lastLogin||'',s1.score||0,s1.passed?'YES':'NO',s2.score||0,s2.passed?'YES':'NO',s3.score||0,s3.passed?'YES':'NO']);
  });
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`CSC_LMS_AllOfficers_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('CSV exported','success');
};

// ── User Report ───────────────────────────────────────────────────────────────
async function renderUserReport(){
  const p=getParams();
  const uid=p.uid||window._reportUserId;
  if(!uid){location.hash='#/admin';return;}

  renderShell(`<div class="admin-loading"><div class="loading-spinner lg"></div><p>Loading officer report…</p></div>`);

  let user=null,progress={};

  // Try to find user from cached admin data
  if(window._adminUsers){
    user=(window._adminUsers||[]).find(u=>u.userId===uid);
    progress=window._adminProgress?.[uid]||{};
  }

  // Fallback: fetch fresh from API
  if(!user&&API.isConfigured()&&API.token){
    try{
      const [ur,pr]=await Promise.all([API.getAllUsers(),API.getAllProgress()]);
      if(ur.ok){user=(ur.users||[]).find(u=>u.userId===uid);}
      if(pr.ok){
        (pr.progress||[]).forEach(p2=>{
          if(p2.userId!==uid)return;
          if(!progress[p2.gl])progress[p2.gl]={};
          progress[p2.gl][p2.stage]=p2;
        });
      }
    }catch(e){toast('Could not load user data: '+e.message,'error');}
  }

  if(!user){renderShell(`<div class="error-box">⚠️ Officer not found. <a href="#/admin">← Back to Admin</a></div>`);return;}

  const glKey=GL_MAP[user.gl];
  const course=glKey?LMS_CONTENT[glKey]:null;
  const allPassed=[1,2,3].every(s=>(progress[user.gl]||{})[s]?.passed);

  const stageRows=[1,2,3].map(s=>{
    if(!user.gl||!course)return`<tr><td>Stage ${s}</td><td colspan="4" class="muted">—</td></tr>`;
    const sp=(progress[user.gl]||{})[s]||{};
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
          <p><span class="gl-badge">${esc(user.gl||'Not Set')}</span>
          &nbsp; Joined: ${user.joinedAt?new Date(user.joinedAt).toLocaleDateString('en-NG',{year:'numeric',month:'long',day:'numeric'}):'—'}</p>
          <p class="muted" style="font-size:.8rem">Last login: ${user.lastLogin?new Date(user.lastLogin).toLocaleDateString('en-NG',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</p>
          ${allPassed?'<span class="badge-complete">🏆 All Stages Complete</span>':''}
        </div>
        <div class="report-actions">
          <button class="btn-outline" onclick="adminResetUser('${user.userId}','${esc(user.name)}')">↺ Reset Progress</button>
          <button class="warn-btn" style="margin-top:8px" onclick="adminDeleteUser('${user.userId}','${esc(user.name)}')">🗑 Delete User</button>
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
          const sp=(progress[user.gl]||{})[s]||{};
          if(!sp.passed)return`<div class="cert-item locked"><span>Stage ${s} Certificate</span><span class="text-muted">Not yet earned</span></div>`;
          return`<div class="cert-item earned"><span>📜 Stage ${s} Certificate</span><span class="text-green">Earned — ID: ${esc(sp.certId||'—')}</span></div>`;
        }).join('')}
      </div>`:''}
    </div>
  </div>`);
}

window.adminResetUser=async function(uid,name){
  if(!confirm(`Reset all progress for ${name}? This cannot be undone.`))return;
  try{
    const r=await API.resetProgress(uid);
    if(r.ok){toast(`Progress reset for ${name}`,'success');location.hash='#/admin';}
    else toast('Reset failed: '+r.msg,'error');
  }catch(e){toast('Error: '+e.message,'error');}
};

window.adminDeleteUser=async function(uid,name){
  if(!confirm(`DELETE ${name} permanently? This removes their account and all progress. This CANNOT be undone.`))return;
  if(!confirm(`Are you absolutely sure you want to delete ${name}?`))return;
  try{
    const r=await API.deleteUser(uid);
    if(r.ok){toast(`${name} deleted`,'success');location.hash='#/admin';}
    else toast('Delete failed: '+r.msg,'error');
  }catch(e){toast('Error: '+e.message,'error');}
};

// ── Init ──────────────────────────────────────────────────────────────────────
function initApp(){
  TTS.init();
  // Restore API token from session
  const sess=S.get('session');
  if(sess?.token)API.token=sess.token;
}

initApp();
window.Auth=Auth;
router();
})();
