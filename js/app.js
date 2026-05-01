/* CSC Lagos State LMS - Core Application */
"use strict";
(function(){
// ── Source Protection ──────────────────────────────────────────────────────────
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&['I','J','C','K'].includes(e.key))||
    (e.ctrlKey&&['u','U','s','S'].includes(e.key))||(e.metaKey&&e.altKey&&['i','I'].includes(e.key))){
    e.preventDefault();e.stopPropagation();return false;
  }
});
let _dt=false;
const _dw=()=>{
  const t=new Image();
  Object.defineProperty(t,'id',{get:()=>{
    if(!_dt){_dt=true;document.getElementById('devtools-warn').style.display='flex';}
    return '';
  }});
  console.log('%c',t);
};
setInterval(_dw,1500);

// ── Config ────────────────────────────────────────────────────────────────────
const CFG={
  APP:'CSC-LMS',
  PASS:70,
  ADMIN_EMAIL:'superadmin@csc.lagos.gov.ng',
  ADMIN_PASS:'CSC@Admin2024!',
  VERSION:'1.0.0'
};

// ── Storage Helpers ────────────────────────────────────────────────────────────
const S={
  get:(k)=>{try{return JSON.parse(localStorage.getItem(CFG.APP+'_'+k));}catch{return null;}},
  set:(k,v)=>{localStorage.setItem(CFG.APP+'_'+k,JSON.stringify(v));},
  del:(k)=>{localStorage.removeItem(CFG.APP+'_'+k);}
};

// ── Hash helper ────────────────────────────────────────────────────────────────
const _h=(s)=>{let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return h.toString(36);};

// ── Init / Seed Data ──────────────────────────────────────────────────────────
function initApp(){
  let users=S.get('users')||[];
  if(!users.find(u=>u.email===CFG.ADMIN_EMAIL)){
    users.unshift({id:'admin001',name:'Super Administrator',email:CFG.ADMIN_EMAIL,
      pw:_h(CFG.ADMIN_PASS),role:'admin',gl:null,joined:new Date().toISOString()});
    S.set('users',users);
  }
  // Seed 3 demo users
  const demos=[
    {id:'u001',name:'Adesola Adeyemi',email:'user1@csc.lagos.gov.ng',pw:_h('User1@2024'),role:'user',gl:'GL07'},
    {id:'u002',name:'Emeka Okafor',email:'user2@csc.lagos.gov.ng',pw:_h('User2@2024'),role:'user',gl:'GL12'},
    {id:'u003',name:'Fatima Sule',email:'user3@csc.lagos.gov.ng',pw:_h('User3@2024'),role:'user',gl:'GL15'}
  ];
  demos.forEach(d=>{
    if(!users.find(u=>u.email===d.email)){
      users.push({...d,joined:new Date().toISOString()});
    }
  });
  S.set('users',users);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
const Auth={
  current:()=>S.get('session'),
  login:(email,pw)=>{
    const users=S.get('users')||[];
    const u=users.find(x=>x.email.toLowerCase()===email.toLowerCase()&&x.pw===_h(pw));
    if(!u)return{ok:false,msg:'Invalid email or password.'};
    const sess={id:u.id,name:u.name,email:u.email,role:u.role,gl:u.gl};
    S.set('session',sess);
    return{ok:true,user:sess};
  },
  register:(name,email,pw,gl)=>{
    const users=S.get('users')||[];
    if(users.find(u=>u.email.toLowerCase()===email.toLowerCase()))return{ok:false,msg:'Email already registered.'};
    if(!name||name.trim().length<2)return{ok:false,msg:'Please enter your full name.'};
    if(!email||!/\S+@\S+\.\S+/.test(email))return{ok:false,msg:'Please enter a valid email address.'};
    if(!pw||pw.length<6)return{ok:false,msg:'Password must be at least 6 characters.'};
    if(!gl)return{ok:false,msg:'Please select your grade level.'};
    const id='u'+Date.now();
    const u={id,name:name.trim(),email:email.toLowerCase(),pw:_h(pw),role:'user',gl,joined:new Date().toISOString()};
    users.push(u);S.set('users',users);
    const sess={id,name:u.name,email:u.email,role:'user',gl};
    S.set('session',sess);
    return{ok:true,user:sess};
  },
  logout:()=>{S.del('session');location.hash='#/login';}
};

// ── Progress ──────────────────────────────────────────────────────────────────
const Prog={
  key:(uid)=>'prog_'+uid,
  get:(uid)=>S.get(Prog.key(uid))||{},
  getStage:(uid,gl,stage)=>{const p=Prog.get(uid);return(p[gl]||{})[stage]||{started:false,completed:false,score:0,passed:false,attempts:0,certId:null};},
  save:(uid,gl,stage,data)=>{
    const p=Prog.get(uid);
    if(!p[gl])p[gl]={};
    p[gl][stage]={...Prog.getStage(uid,gl,stage),...data};
    S.set(Prog.key(uid),p);
  },
  canAccess:(uid,gl,stage)=>{
    if(stage===1)return true;
    return Prog.getStage(uid,gl,stage-1).passed;
  },
  allProgress:(uid)=>Prog.get(uid)
};

// ── Router ────────────────────────────────────────────────────────────────────
const routes={
  '':()=>routeGuard(()=>renderDashboard()),
  '/':()=>routeGuard(()=>renderDashboard()),
  '/login':()=>renderLogin(),
  '/register':()=>renderRegister(),
  '/dashboard':()=>routeGuard(()=>renderDashboard()),
  '/learn':()=>routeGuard(()=>renderLearn()),
  '/quiz':()=>routeGuard(()=>renderQuiz()),
  '/cert':()=>routeGuard(()=>renderCert()),
  '/admin':()=>routeGuard(()=>renderAdmin(),true),
  '/admin/user':()=>routeGuard(()=>renderUserReport(),true)
};

function routeGuard(fn,adminOnly=false){
  const u=Auth.current();
  if(!u){location.hash='#/login';return;}
  if(adminOnly&&u.role!=='admin'){location.hash='#/dashboard';return;}
  fn();
}

function getHash(){
  const h=location.hash.replace('#','').split('?')[0]||'/';
  return h;
}
function getParams(){
  const q=location.hash.split('?')[1]||'';
  const p={};
  q.split('&').forEach(x=>{const[k,v]=x.split('=');if(k)p[k]=decodeURIComponent(v||'');});
  return p;
}

function router(){
  const h=getHash();
  const fn=routes[h]||routes[''];
  fn&&fn();
}
window.addEventListener('hashchange',router);

// ── Render Helpers ────────────────────────────────────────────────────────────
const app=()=>document.getElementById('app');
const esc=(s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function renderShell(content,showNav=true){
  const u=Auth.current();
  const nav=showNav&&u?`
  <nav class="navbar">
    <div class="nav-brand">
      <span class="nav-logo">🏛️</span>
      <div>
        <div class="nav-title">Lagos State Civil Service Commission</div>
        <div class="nav-sub">Learning Management System</div>
      </div>
    </div>
    <div class="nav-links">
      ${u.role==='admin'?`<a href="#/admin" class="nav-link">📊 Admin Dashboard</a>`:`<a href="#/dashboard" class="nav-link">🏠 My Dashboard</a>`}
      <span class="nav-user">👤 ${esc(u.name)}</span>
      <button onclick="Auth.logout()" class="btn-logout">Sign Out</button>
    </div>
  </nav>`:'';
  app().innerHTML=nav+`<div class="main-content">${content}</div>`;
}

// ── Login View ────────────────────────────────────────────────────────────────
function renderLogin(){
  app().innerHTML=`
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">🏛️</div>
      <h1 class="auth-title">Civil Service Commission</h1>
      <p class="auth-subtitle">Lagos State Learning Management System</p>
      <form id="loginForm" class="auth-form" onsubmit="return false">
        <div class="form-group">
          <label>Email Address</label>
          <input type="email" id="l_email" placeholder="your.email@domain.com" autocomplete="email" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="l_pw" placeholder="Enter your password" autocomplete="current-password" required>
        </div>
        <div id="loginErr" class="form-error" style="display:none"></div>
        <button class="btn-primary full" onclick="doLogin()">Sign In to LMS</button>
      </form>
      <p class="auth-switch">Don't have an account? <a href="#/register">Create Account</a></p>
    </div>
  </div>`;
}
window.doLogin=function(){
  const email=document.getElementById('l_email').value;
  const pw=document.getElementById('l_pw').value;
  const err=document.getElementById('loginErr');
  const r=Auth.login(email,pw);
  if(!r.ok){err.textContent=r.msg;err.style.display='block';return;}
  err.style.display='none';
  location.hash=r.user.role==='admin'?'#/admin':'#/dashboard';
};

// ── Register View ─────────────────────────────────────────────────────────────
function renderRegister(){
  const glOpts=GRADE_LEVELS.map(g=>`<option value="${g}">${g.replace('GL','Grade Level ')}</option>`).join('');
  app().innerHTML=`
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">🏛️</div>
      <h1 class="auth-title">Create Account</h1>
      <p class="auth-subtitle">Lagos State Civil Service LMS</p>
      <form class="auth-form" onsubmit="return false">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="r_name" placeholder="Enter your full name" autocomplete="name" required>
        </div>
        <div class="form-group">
          <label>Official Email Address</label>
          <input type="email" id="r_email" placeholder="your.email@domain.com" autocomplete="email" required>
        </div>
        <div class="form-group">
          <label>Grade Level</label>
          <select id="r_gl" required>
            <option value="">-- Select Grade Level --</option>
            ${glOpts}
          </select>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="r_pw" placeholder="At least 6 characters" autocomplete="new-password" required>
        </div>
        <div class="form-group">
          <label>Confirm Password</label>
          <input type="password" id="r_pw2" placeholder="Repeat password" autocomplete="new-password" required>
        </div>
        <div id="regErr" class="form-error" style="display:none"></div>
        <button class="btn-primary full" onclick="doRegister()">Create Account</button>
      </form>
      <p class="auth-switch">Already have an account? <a href="#/login">Sign In</a></p>
    </div>
  </div>`;
}
window.doRegister=function(){
  const name=document.getElementById('r_name').value;
  const email=document.getElementById('r_email').value;
  const gl=document.getElementById('r_gl').value;
  const pw=document.getElementById('r_pw').value;
  const pw2=document.getElementById('r_pw2').value;
  const err=document.getElementById('regErr');
  if(pw!==pw2){err.textContent='Passwords do not match.';err.style.display='block';return;}
  const r=Auth.register(name,email,pw,gl);
  if(!r.ok){err.textContent=r.msg;err.style.display='block';return;}
  location.hash='#/dashboard';
};

// ── Dashboard View ────────────────────────────────────────────────────────────
function renderDashboard(){
  const u=Auth.current();
  const glKey=GL_MAP[u.gl];
  const course=LMS_CONTENT[glKey];
  if(!course){renderShell(`<div class="error-box">No course found for ${u.gl}. Please contact the administrator.</div>`);return;}

  const stages=Object.entries(course.stages).map(([sNum,s])=>{
    const sn=parseInt(sNum);
    const prog=Prog.getStage(u.id,u.gl,sn);
    const canAccess=Prog.canAccess(u.id,u.gl,sn);
    const statusClass=prog.completed&&prog.passed?'stage-done':prog.started?'stage-active':'stage-locked';
    const statusLabel=prog.completed&&prog.passed?'✅ Completed':prog.started?'📖 In Progress':'🔒 Locked';
    return`<div class="stage-card ${statusClass}">
      <div class="stage-icon">${s.icon}</div>
      <div class="stage-info">
        <div class="stage-num">Stage ${sn}</div>
        <div class="stage-title">${esc(s.title)}</div>
        <div class="stage-desc">${esc(s.description)}</div>
        <div class="stage-status">${statusLabel}${prog.passed?` &nbsp;|&nbsp; Score: <strong>${prog.score}%</strong>`:''}</div>
      </div>
      <div class="stage-actions">
        ${canAccess?`
          <button class="btn-primary" onclick="goLearn(${sn})">${prog.passed?'Review':'Start Learning'}</button>
          ${prog.started&&!prog.passed?`<button class="btn-outline" onclick="goQuiz(${sn})">Take Quiz</button>`:''}
          ${prog.passed?`<button class="btn-gold" onclick="goCert(${sn})">📜 Certificate</button>`:''}
        `:`<span class="locked-msg">Complete Stage ${sn-1} to unlock</span>`}
      </div>
    </div>`;
  }).join('');

  // Calculate overall progress
  const total=Object.keys(course.stages).length;
  const done=Object.keys(course.stages).filter(s=>Prog.getStage(u.id,u.gl,parseInt(s)).passed).length;
  const pct=Math.round((done/total)*100);

  renderShell(`
  <div class="dashboard">
    <div class="dash-header">
      <div>
        <h2>Welcome back, ${esc(u.name)}</h2>
        <p class="dash-meta">${esc(course.title)} &mdash; ${esc(course.subtitle)}</p>
      </div>
      <div class="progress-ring-wrap">
        <svg width="90" height="90" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="38" fill="none" stroke="#e0e0e0" stroke-width="8"/>
          <circle cx="45" cy="45" r="38" fill="none" stroke="#c9922a" stroke-width="8"
            stroke-dasharray="${2*Math.PI*38}"
            stroke-dashoffset="${2*Math.PI*38*(1-pct/100)}"
            stroke-linecap="round" transform="rotate(-90 45 45)"/>
        </svg>
        <div class="ring-label">${pct}%</div>
      </div>
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-bar-label">Overall Progress: ${done}/${total} stages completed</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
    <h3 class="section-heading">Your Learning Stages</h3>
    <div class="stages-list">${stages}</div>
    ${done===total?`<div class="completion-banner">🎉 Congratulations! You have completed all three stages. You are now a certified CSC LMS graduate!</div>`:''}
  </div>`);
}
window.goLearn=(s)=>{location.hash=`#/learn?stage=${s}`;};
window.goQuiz=(s)=>{location.hash=`#/quiz?stage=${s}`;};
window.goCert=(s)=>{location.hash=`#/cert?stage=${s}`;};

// ── Learn View ────────────────────────────────────────────────────────────────
function renderLearn(){
  const u=Auth.current();
  const p=getParams();
  const stage=parseInt(p.stage)||1;
  const glKey=GL_MAP[u.gl];
  const course=LMS_CONTENT[glKey];
  const stageData=course.stages[stage];
  if(!stageData){location.hash='#/dashboard';return;}
  if(!Prog.canAccess(u.id,u.gl,stage)){location.hash='#/dashboard';return;}

  Prog.save(u.id,u.gl,stage,{started:true});

  let topicIdx=parseInt(p.topic)||0;
  if(topicIdx>=stageData.topics.length)topicIdx=stageData.topics.length-1;
  const topic=stageData.topics[topicIdx];
  const prog=Prog.getStage(u.id,u.gl,stage);

  const topicNav=stageData.topics.map((t,i)=>`
    <div class="topic-nav-item ${i===topicIdx?'active':''}" onclick="goTopic(${stage},${i})">
      <span class="topic-check">${i<topicIdx?'✅':'○'}</span>
      <span>${esc(t.title)}</span>
    </div>`).join('');

  const isLast=topicIdx===stageData.topics.length-1;

  renderShell(`
  <div class="learn-page">
    <div class="learn-sidebar">
      <button class="btn-back" onclick="location.hash='#/dashboard'">← Back</button>
      <div class="sidebar-stage">Stage ${stage}: ${esc(stageData.title)}</div>
      <div class="topic-nav">${topicNav}</div>
      ${!prog.passed?`<button class="btn-primary full mt16" onclick="goQuiz(${stage})">📝 Take Stage Quiz</button>`:`<div class="quiz-done">✅ Stage Passed (${prog.score}%)</div>`}
    </div>
    <div class="learn-main">
      <div class="topic-header">
        <h2>${esc(topic.title)}</h2>
        <span class="reading-time">⏱ ${esc(topic.readingTime)} read</span>
      </div>
      <div class="topic-body">${topic.content}</div>
      <div class="topic-footer">
        ${topicIdx>0?`<button class="btn-outline" onclick="goTopic(${stage},${topicIdx-1})">← Previous</button>`:'<span></span>'}
        ${isLast?`<button class="btn-primary" onclick="goQuiz(${stage})">📝 Take Stage Quiz →</button>`
          :`<button class="btn-primary" onclick="goTopic(${stage},${topicIdx+1})">Next Topic →</button>`}
      </div>
    </div>
  </div>`);
}
window.goTopic=(stage,idx)=>{location.hash=`#/learn?stage=${stage}&topic=${idx}`;};

// ── Quiz View ─────────────────────────────────────────────────────────────────
let _quizState={};
function renderQuiz(){
  const u=Auth.current();
  const p=getParams();
  const stage=parseInt(p.stage)||1;
  const glKey=GL_MAP[u.gl];
  const course=LMS_CONTENT[glKey];
  const stageData=course.stages[stage];
  const prog=Prog.getStage(u.id,u.gl,stage);

  if(prog.passed){
    renderShell(`
    <div class="quiz-done-page">
      <div class="quiz-done-card">
        <div class="done-icon">✅</div>
        <h2>Stage ${stage} Already Passed!</h2>
        <p>You scored <strong>${prog.score}%</strong> on this stage.</p>
        <div class="done-actions">
          <button class="btn-primary" onclick="goCert(${stage})">📜 View Certificate</button>
          <button class="btn-outline" onclick="location.hash='#/dashboard'">← Dashboard</button>
        </div>
      </div>
    </div>`);
    return;
  }

  // Init/resume quiz state
  if(!_quizState.stage||_quizState.stage!==stage||_quizState.uid!==u.id){
    const qs=[...stageData.quiz.questions];
    // Shuffle
    for(let i=qs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[qs[i],qs[j]]=[qs[j],qs[i]];}
    _quizState={stage,uid:u.id,gl:u.gl,questions:qs,current:0,answers:{},submitted:false};
  }

  if(!p.submit){
    renderQuizQuestion();
  } else {
    renderQuizResults();
  }
}

function renderQuizQuestion(){
  const qs=_quizState.questions;
  const ci=_quizState.current;
  const q=qs[ci];
  const u=Auth.current();
  const glKey=GL_MAP[u.gl];
  const course=LMS_CONTENT[glKey];
  const stageData=course.stages[_quizState.stage];
  const total=qs.length;
  const answered=Object.keys(_quizState.answers).length;

  const opts=q.opts.map((o,i)=>{
    const sel=_quizState.answers[ci]===i;
    return`<label class="quiz-opt ${sel?'selected':''}">
      <input type="radio" name="qopt" value="${i}" ${sel?'checked':''} onchange="_selectOpt(${i})">
      <span class="opt-letter">${['A','B','C','D'][i]}</span>
      <span>${esc(o)}</span>
    </label>`;
  }).join('');

  renderShell(`
  <div class="quiz-page">
    <div class="quiz-header">
      <button class="btn-back" onclick="goLearn(${_quizState.stage})">← Back to Reading</button>
      <div class="quiz-title">Stage ${_quizState.stage} Quiz</div>
      <div class="quiz-meta">${answered}/${total} answered</div>
    </div>
    <div class="quiz-progress-bar"><div style="width:${((ci+1)/total)*100}%"></div></div>
    <div class="quiz-body">
      <div class="q-number">Question ${ci+1} of ${total}</div>
      <div class="q-text">${esc(q.q)}</div>
      <div class="q-opts">${opts}</div>
      <div class="quiz-nav">
        ${ci>0?`<button class="btn-outline" onclick="_goQ(${ci-1})">← Previous</button>`:'<span></span>'}
        <div class="q-dots">${qs.map((_,i)=>`<span class="dot ${i===ci?'active':_quizState.answers[i]!==undefined?'answered':''}" onclick="_goQ(${i})"></span>`).join('')}</div>
        ${ci<total-1?`<button class="btn-primary" onclick="_goQ(${ci+1})">Next →</button>`
          :`<button class="btn-gold" onclick="_submitQuiz()">Submit Quiz</button>`}
      </div>
    </div>
  </div>`);
}
window._selectOpt=function(i){_quizState.answers[_quizState.current]=i;renderQuizQuestion();};
window._goQ=function(i){_quizState.current=i;renderQuizQuestion();};
window._submitQuiz=function(){
  const unanswered=_quizState.questions.length-Object.keys(_quizState.answers).length;
  if(unanswered>0){
    if(!confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`))return;
  }
  location.hash=`#/quiz?stage=${_quizState.stage}&submit=1`;
};

function renderQuizResults(){
  const u=Auth.current();
  const qs=_quizState.questions;
  const answers=_quizState.answers;
  let correct=0;
  qs.forEach((q,i)=>{if(answers[i]===q.ans)correct++;});
  const score=Math.round((correct/qs.length)*100);
  const passed=score>=CFG.PASS;

  const prog=Prog.getStage(u.id,u.gl,_quizState.stage);
  const attempts=(prog.attempts||0)+1;
  let certId=prog.certId;
  if(passed&&!certId){certId='CSC'+Date.now().toString(36).toUpperCase();}
  Prog.save(u.id,u.gl,_quizState.stage,{completed:true,score,passed,attempts,certId,date:new Date().toISOString()});

  const review=qs.map((q,i)=>{
    const ua=answers[i];
    const ok=ua===q.ans;
    return`<div class="review-item ${ok?'correct':'wrong'}">
      <div class="review-q">${esc(q.q)}</div>
      <div class="review-ans">
        <span class="your-ans">Your answer: <strong>${ua!==undefined?q.opts[ua]:'Not answered'}</strong></span>
        ${!ok?`<span class="correct-ans">Correct: <strong>${q.opts[q.ans]}</strong></span>`:''}
      </div>
      ${q.exp?`<div class="review-exp">💡 ${esc(q.exp)}</div>`:''}
    </div>`;
  }).join('');

  _quizState={};// reset

  renderShell(`
  <div class="results-page">
    <div class="results-card ${passed?'passed':'failed'}">
      <div class="result-icon">${passed?'🎉':'😔'}</div>
      <h2>${passed?'Congratulations! You Passed!':'Not Quite — Please Try Again'}</h2>
      <div class="score-display">
        <div class="score-circle">
          <span class="score-num">${score}%</span>
          <span class="score-label">${correct}/${qs.length} Correct</span>
        </div>
      </div>
      <p class="pass-msg">${passed?`You achieved ${score}%, above the required ${CFG.PASS}% pass mark.`
        :`You scored ${score}%. A minimum of ${CFG.PASS}% is required to pass. Review the material and try again.`}</p>
      <div class="result-actions">
        ${passed?`<button class="btn-gold" onclick="goCert(${_quizState.stage||getParams().stage.replace('?submit=1','')})">📜 Get Certificate</button>`:''}
        <button class="btn-outline" onclick="goLearn(${getParams().stage||1})">📖 Review Material</button>
        <button class="btn-outline" onclick="location.hash='#/dashboard'">🏠 Dashboard</button>
      </div>
    </div>
    <div class="review-section">
      <h3>Question Review</h3>
      ${review}
    </div>
  </div>`);
}

// ── Certificate View ──────────────────────────────────────────────────────────
function renderCert(){
  const u=Auth.current();
  const p=getParams();
  const stage=parseInt(p.stage)||1;
  const prog=Prog.getStage(u.id,u.gl,stage);
  if(!prog.passed){location.hash=`#/quiz?stage=${stage}`;return;}

  const glKey=GL_MAP[u.gl];
  const course=LMS_CONTENT[glKey];
  const stageData=course.stages[stage];
  const date=new Date(prog.date);
  const dateStr=date.toLocaleDateString('en-NG',{year:'numeric',month:'long',day:'numeric'});
  const stageNames=['','Foundation & Induction','Core Competency & Skill Development','Leadership, Strategy & Excellence'];
  const certTitles=['','Certificate of Completion','Certificate of Proficiency','Certificate of Excellence'];

  renderShell(`
  <div class="cert-page">
    <div class="cert-actions no-print">
      <button class="btn-back" onclick="location.hash='#/dashboard'">← Dashboard</button>
      <button class="btn-gold" onclick="window.print()">🖨️ Print / Save PDF</button>
    </div>
    <div class="cert-wrapper" id="certDoc">
      <div class="cert-border">
        <div class="cert-inner">
          <div class="cert-logos">
            <div class="cert-emblem">🏛️</div>
          </div>
          <div class="cert-header-text">
            <div class="cert-govt">Lagos State Government</div>
            <div class="cert-body-name">Civil Service Commission</div>
          </div>
          <div class="cert-ribbon"></div>
          <div class="cert-doc-title">${certTitles[stage]}</div>
          <div class="cert-stage-label">Stage ${stage}: ${stageNames[stage]}</div>
          <div class="cert-preamble">This is to certify that</div>
          <div class="cert-recipient">${esc(u.name)}</div>
          <div class="cert-gl">${esc(u.gl.replace('GL','Grade Level '))} &mdash; ${esc(course.title)}</div>
          <div class="cert-body-text">
            has successfully completed Stage ${stage} of the Civil Service Commission Learning Management System
            programme for ${esc(course.subtitle)}, achieving a score of
            <strong>${prog.score}%</strong> in the stage assessment.
          </div>
          <div class="cert-date">Awarded on: ${dateStr}</div>
          <div class="cert-id">Certificate ID: ${prog.certId||'CSC-'+Date.now().toString(36).toUpperCase()}</div>
          <div class="cert-sigs">
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-name">Chairman</div>
              <div class="sig-title">Civil Service Commission, Lagos State</div>
            </div>
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-name">Director of Training</div>
              <div class="sig-title">Civil Service Commission, Lagos State</div>
            </div>
          </div>
          <div class="cert-footer-bar">
            <span>Lagos State Civil Service Commission LMS &bull; Verified Certificate</span>
            <span>lms.csc.lagosstate.gov.ng</span>
          </div>
        </div>
      </div>
    </div>
  </div>`);
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────
function renderAdmin(){
  const users=(S.get('users')||[]).filter(u=>u.role!=='admin');
  const allGLKeys=[...new Set(users.map(u=>u.gl).filter(Boolean))];

  let totalPassed=0,totalAttempts=0;
  const glStats={};
  users.forEach(u=>{
    if(!u.gl)return;
    const prog=Prog.get(u.id);
    if(!glStats[u.gl])glStats[u.gl]={count:0,s1:0,s2:0,s3:0};
    glStats[u.gl].count++;
    [1,2,3].forEach(s=>{
      const sp=Prog.getStage(u.id,u.gl,s);
      if(sp.passed){totalPassed++;if(s===1)glStats[u.gl].s1++;else if(s===2)glStats[u.gl].s2++;else glStats[u.gl].s3++;}
      totalAttempts+=sp.attempts||0;
    });
  });

  const userRows=users.map(u=>{
    const prog=Prog.get(u.id);
    const stages=[1,2,3].map(s=>{
      const sp=Prog.getStage(u.id,u.gl,s);
      return sp.passed?`<span class="badge-pass">S${s}✅</span>`:sp.started?`<span class="badge-prog">S${s}📖</span>`:`<span class="badge-lock">S${s}🔒</span>`;
    }).join('');
    const joined=new Date(u.joined).toLocaleDateString('en-NG');
    return`<tr onclick="viewUser('${u.id}')" class="user-row">
      <td><strong>${esc(u.name)}</strong><br><small>${esc(u.email)}</small></td>
      <td><span class="gl-badge">${esc(u.gl||'N/A')}</span></td>
      <td>${stages}</td>
      <td>${joined}</td>
      <td><button class="btn-sm" onclick="event.stopPropagation();viewUser('${u.id}')">View Report</button></td>
    </tr>`;
  }).join('');

  const glTable=Object.entries(glStats).map(([gl,s])=>`<tr>
    <td><strong>${gl}</strong></td><td>${s.count}</td>
    <td>${s.s1}</td><td>${s.s2}</td><td>${s.s3}</td>
  </tr>`).join('');

  renderShell(`
  <div class="admin-page">
    <h2>📊 Super Admin Dashboard</h2>
    <p class="admin-sub">Civil Service Commission — LMS Administration Panel</p>
    <div class="stat-cards">
      <div class="stat-card"><div class="stat-num">${users.length}</div><div class="stat-lbl">Total Officers</div></div>
      <div class="stat-card"><div class="stat-num">${totalPassed}</div><div class="stat-lbl">Stages Passed</div></div>
      <div class="stat-card"><div class="stat-num">${totalAttempts}</div><div class="stat-lbl">Quiz Attempts</div></div>
      <div class="stat-card"><div class="stat-num">${Object.keys(glStats).length}</div><div class="stat-lbl">Grade Levels Active</div></div>
    </div>
    <div class="admin-sections">
      <div class="admin-section">
        <h3>Performance by Grade Level</h3>
        <table class="data-table">
          <thead><tr><th>GL</th><th>Officers</th><th>Stage 1 ✅</th><th>Stage 2 ✅</th><th>Stage 3 ✅</th></tr></thead>
          <tbody>${glTable||'<tr><td colspan="5" style="text-align:center">No data yet</td></tr>'}</tbody>
        </table>
      </div>
      <div class="admin-section">
        <h3>All Officers</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Officer</th><th>Grade Level</th><th>Progress</th><th>Joined</th><th>Action</th></tr></thead>
            <tbody>${userRows||'<tr><td colspan="5" style="text-align:center">No officers registered yet</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`);
}
window.viewUser=(id)=>{location.hash=`#/admin/user?uid=${id}`;};

// ── Individual User Report ────────────────────────────────────────────────────
function renderUserReport(){
  const p=getParams();
  const uid=p.uid;
  const users=S.get('users')||[];
  const user=users.find(u=>u.id===uid);
  if(!user){location.hash='#/admin';return;}

  const glKey=GL_MAP[user.gl];
  const course=glKey?LMS_CONTENT[glKey]:null;

  const stageRows=[1,2,3].map(s=>{
    if(!user.gl||!course)return`<tr><td>Stage ${s}</td><td colspan="4">—</td></tr>`;
    const sp=Prog.getStage(uid,user.gl,s);
    const stageData=course.stages[s];
    return`<tr>
      <td><strong>Stage ${s}</strong><br><small>${esc(stageData.title)}</small></td>
      <td>${sp.started?'Yes':'No'}</td>
      <td>${sp.completed?'Yes':'No'}</td>
      <td class="${sp.passed?'text-green':'text-red'}">${sp.passed?`✅ Passed (${sp.score}%)`:'Not Passed'}</td>
      <td>${sp.attempts||0}</td>
    </tr>`;
  }).join('');

  const joined=new Date(user.joined).toLocaleDateString('en-NG',{year:'numeric',month:'long',day:'numeric'});
  const allPassed=[1,2,3].every(s=>user.gl&&Prog.getStage(uid,user.gl,s).passed);

  renderShell(`
  <div class="user-report-page">
    <button class="btn-back" onclick="location.hash='#/admin'">← Back to Admin</button>
    <div class="report-card">
      <div class="report-header">
        <div class="report-avatar">${user.name.charAt(0).toUpperCase()}</div>
        <div>
          <h2>${esc(user.name)}</h2>
          <p>${esc(user.email)}</p>
          <p><span class="gl-badge">${esc(user.gl||'Not Set')}</span> &nbsp; Joined: ${joined}</p>
          ${allPassed?'<span class="badge-complete">🏆 All Stages Complete</span>':''}
        </div>
      </div>
      <h3>Learning Progress Report</h3>
      <table class="data-table">
        <thead><tr><th>Stage</th><th>Started</th><th>Completed</th><th>Result</th><th>Attempts</th></tr></thead>
        <tbody>${stageRows}</tbody>
      </table>
      ${user.gl&&course?`
      <h3 style="margin-top:24px">Certificates Earned</h3>
      <div class="cert-list">
        ${[1,2,3].map(s=>{
          const sp=Prog.getStage(uid,user.gl,s);
          if(!sp.passed)return`<div class="cert-item locked"><span>Stage ${s} Certificate</span><span class="text-muted">Not yet earned</span></div>`;
          return`<div class="cert-item earned"><span>📜 Stage ${s} Certificate</span><span class="text-green">Earned — ID: ${sp.certId||'—'}</span></div>`;
        }).join('')}
      </div>`:''}
    </div>
  </div>`);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
initApp();
// Make Auth accessible globally for logout button
window.Auth=Auth;
router();
})();
