
// ── WEDAYS STUDIO PUBLISHED TEXT ───────────────────────
(function applyPublishedStudioText(){
  if (document.body && document.body.hasAttribute('data-no-studio-text')) return;
  function normalize(value){ return String(value || '').replace(/\s+/g,' ').trim(); }
  function replaceKeepingSpacing(node, replacement){
    var original = String(node.nodeValue || '');
    var leading = (original.match(/^\s*/) || [''])[0];
    var trailing = (original.match(/\s*$/) || [''])[0];
    node.nodeValue = leading + replacement + trailing;
  }
  function applyMap(map){
    if (!map || typeof map !== 'object') return;
    var skipTags = new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','SELECT','OPTION','SVG','PATH','CODE','PRE']);
    var skipClosest = '.nav,.menu-btn,.chat-widget,[data-no-studio-text],[data-no-studio-edit]';
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node){
        var parent = node.parentElement;
        if (!parent || skipTags.has(parent.tagName) || parent.closest(skipClosest)) return NodeFilter.FILTER_REJECT;
        var text = normalize(node.nodeValue);
        if (!text || !Object.prototype.hasOwnProperty.call(map, text)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(node){
      var key = normalize(node.nodeValue);
      var value = map[key];
      if (typeof value === 'string' && value.trim()) replaceKeepingSpacing(node, value);
    });
  }
  fetch('/site-text.json?v=' + Date.now(), { cache: 'no-store' })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(data){ if (data && data.text) applyMap(data.text); })
    .catch(function(){});
})();


const nav=document.querySelector('.nav');window.addEventListener('scroll',()=>{if(nav)nav.classList.toggle('scrolled',scrollY>40);const p=document.querySelector('.progress');if(p){const h=document.documentElement.scrollHeight-innerHeight;p.style.width=(scrollY/h*100)+'%'}});document.querySelectorAll('.menu-btn').forEach(b=>b.addEventListener('click',()=>document.body.classList.toggle('mobile-open')));const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>io.observe(el));document.querySelectorAll('.faq-q').forEach(q=>q.addEventListener('click',()=>q.closest('.faq-item').classList.toggle('open')));
document.querySelectorAll('[data-before-after]').forEach(box=>{
  const range=box.querySelector('.ba-range');
  const setPos=(value)=>{
    const v=Math.max(0,Math.min(100,Number(value)));
    box.style.setProperty('--pos',v+'%');
  };
  setPos(range.value);
  range.addEventListener('input',()=>setPos(range.value));
});
document.querySelectorAll('[data-lead-form]').forEach(function(form){
  if (form.__leadBound) return;
  form.__leadBound = true;
  var trap = document.createElement('input');
  trap.type = 'text';
  trap.name = 'honeypot';
  trap.tabIndex = -1;
  trap.autocomplete = 'off';
  trap.setAttribute('aria-hidden', 'true');
  trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
  form.prepend(trap);

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    if (!form.reportValidity()) return;
    var message = form.querySelector('.form-message');
    var button = form.querySelector('button[type="submit"]');
    var originalLabel = button ? button.textContent : '';
    var data = new FormData(form);
    var page = form.closest('.preview-page');
    var payload = {
      type: page && page.id === 'page-website-scan' ? 'website-scan-request' : 'contact',
      name: data.get('name') || '',
      company: data.get('company') || '',
      email: data.get('email') || '',
      phone: data.get('phone') || '',
      website: data.get('website') || '',
      service: data.get('service') || '',
      message: data.get('message') || '',
      honeypot: data.get('honeypot') || ''
    };

    if (button) {
      button.disabled = true;
      button.textContent = 'Versturen…';
    }
    if (message) {
      message.style.display = 'none';
      message.style.color = '';
    }

    try {
      var response = await fetch('/api/lead', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      var result = await response.json().catch(function(){ return {}; });
      if (!response.ok) throw new Error(result.error || 'Versturen is niet gelukt.');
      if (message) {
        message.textContent = 'Bedankt! Je aanvraag is verzonden. WeDays neemt contact met je op.';
        message.style.color = '#34d399';
        message.style.display = 'block';
      }
      form.reset();
    } catch (error) {
      if (message) {
        message.textContent = error && error.message ? error.message : 'Versturen is niet gelukt. Probeer het opnieuw.';
        message.style.color = '#f87171';
        message.style.display = 'block';
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }
  });
});
const answers={};document.querySelectorAll('[data-question]').forEach(group=>{group.querySelectorAll('.option').forEach(opt=>opt.addEventListener('click',()=>{group.querySelectorAll('.option').forEach(o=>o.classList.remove('selected'));opt.classList.add('selected');answers[group.dataset.question]=opt.dataset.value;updateAdvisor()}))});function updateAdvisor(){const result=document.querySelector('#advisor-result');if(!result)return;let score=0,custom=false;if(answers.pages==='1-3')score+=1;if(answers.pages==='4-7')score+=2;if(answers.pages==='8+')score+=3;if(['aanvragen','groei','redesign'].includes(answers.goal))score+=2;if(answers.goal==='maatwerk'||answers.extra==='ja')custom=true;if(answers.content==='nee')score+=1;let pack='Website',txt='Een complete website past het best bij je situatie.';if(custom){pack='Maatwerk';txt='Omdat je extra functionaliteiten of integraties wilt, is maatwerk logisch.'}else if(score>=5){pack='Website + Beheer';txt='Je wilt maximale zekerheid, onderhoud en ondersteuning. Website + Beheer sluit hier het beste op aan.'}else if(score>=3){pack='Website + Domein';txt='Je wilt professioneel online staan zonder gedoe met domein en hosting. Website + Domein sluit hier het beste op aan.'}result.style.display='block';result.innerHTML=`<span class="badge">Aanbevolen pakket</span><h3>${pack}</h3><p>${txt}</p><a class="btn btn-primary" href="/pakketten" data-route="pakketten">Bekijk dit pakket →</a>`}


const routes={
  "home":"page-home",
  "over-ons":"page-over-ons",
  "diensten":"page-diensten",
  "pakketten":"page-pakketten",
  "werkwijze":"page-werkwijze",
  "website-scan":"page-website-scan",
  "keuzehulp":"page-keuzehulp",
  "blog":"page-blog",
  "faq":"page-faq",
  "contact":"page-contact",
  "privacy":"page-privacy",
  "voorwaarden":"page-voorwaarden"
};
function showRoute(route){
  const id=routes[route]||routes.home;
  document.querySelectorAll('.preview-page').forEach(p=>p.classList.remove('active'));
  const page=document.getElementById(id);
  if(page){page.classList.add('active');}
  document.querySelectorAll('[data-route]').forEach(a=>a.classList.toggle('active',a.dataset.route===route));
  document.body.classList.remove('mobile-open');
  window.scrollTo({top:0,behavior:'smooth'});
}
// Normale navigatie behouden: links met data-route mogen gewoon naar de echte pagina gaan.
// showRoute wordt alleen gebruikt bij het laden van de juiste route en in de admin preview.




function makeMorphCard(card, article){
  const clone=document.createElement('div');
  clone.className='blogx-morph-card';
  const preview=document.createElement('div');
  preview.className='blogx-morph-preview';
  preview.innerHTML=card.innerHTML;
  const morphArticle=document.createElement('div');
  morphArticle.className='blogx-morph-article';
  const h=article.querySelector('h2')?.textContent||'Blog';
  const lead=article.querySelector('.blogx-lead')?.textContent||'';
  morphArticle.innerHTML=`<span class="eyebrow">Lees artikel</span><h2>${h}</h2><p>${lead}</p>`;
  clone.appendChild(preview);
  clone.appendChild(morphArticle);
  return clone;
}
document.querySelectorAll('[data-blogx-open]').forEach(card=>card.addEventListener('click',()=>{
 const key=card.dataset.blogxOpen;
 const ov=document.getElementById('blogxOverview');
 const art=document.getElementById('blogx-'+key);
 const shell=card.closest('.blogx-shell');
 if(!ov||!art||!shell)return;

 const rect=card.getBoundingClientRect();
 shell.style.setProperty('--morph-top',rect.top+'px');
 shell.style.setProperty('--morph-left',rect.left+'px');
 shell.style.setProperty('--morph-width',rect.width+'px');
 shell.style.setProperty('--morph-height',rect.height+'px');

 const cardRect=card.getBoundingClientRect();
 const shellRect=shell.getBoundingClientRect();
 const x=((cardRect.left+cardRect.width/2-shellRect.left)/shellRect.width)*100;
 const y=((cardRect.top+cardRect.height/2-shellRect.top)/shellRect.height)*100;
 shell.style.setProperty('--zoom-x',x+'%');
 shell.style.setProperty('--zoom-y',y+'%');

 const morph=makeMorphCard(card,art);
 document.body.appendChild(morph);

 shell.classList.add('blogx-is-zooming');
 document.querySelectorAll('.blogx-card').forEach(c=>{
   c.classList.toggle('zoom-focus',c===card);
   c.classList.toggle('zoom-muted',c!==card);
 });
 ov.classList.add('zooming');

 setTimeout(()=>{
   ov.classList.add('hidden');
   ov.classList.remove('zooming');
   document.querySelectorAll('.blogx-card').forEach(c=>c.classList.remove('zoom-focus','zoom-muted'));
   document.querySelectorAll('.blogx-reader').forEach(x=>x.classList.remove('active'));
   art.classList.add('active');
   shell.classList.remove('blogx-is-zooming');
   morph.remove();
   art.scrollIntoView({behavior:'smooth',block:'start'});
 },840);
}));
document.querySelectorAll('[data-blogx-back]').forEach(btn=>btn.addEventListener('click',()=>{
 document.querySelectorAll('.blogx-reader').forEach(x=>x.classList.remove('active'));
 const ov=document.getElementById('blogxOverview');
 if(ov){
   ov.classList.remove('hidden','zooming');
   ov.scrollIntoView({behavior:'smooth',block:'start'});
 }
}));



const pathToRoute = {
  "/": "home",
  "/over-ons": "over-ons",
  "/diensten": "diensten",
  "/pakketten": "pakketten",
  "/werkwijze": "werkwijze",
  "/website-scan": "website-scan",
  "/keuzehulp": "keuzehulp",
  "/blog": "blog",
  "/faq": "faq",
  "/contact": "contact",
  "/privacy": "privacy",
  "/voorwaarden": "voorwaarden"
};

// Publieke pagina's zijn echte Astro routes.
// We forceren geen verborgen SPA-route meer op gewone bezoekerspagina's.
// Daardoor kan /contact nooit terugvallen op een oude of verkeerde pagina.
window.addEventListener("load", () => {
  if (!document.body || !document.body.hasAttribute("data-studio-preview")) return;
  const route = pathToRoute[window.location.pathname];
  if (route && route !== "home") showRoute(route);
});


document.querySelectorAll('[data-service-card]').forEach(card=>{
  const reset=()=>{
    card.style.setProperty('--rx','0deg');
    card.style.setProperty('--ry','0deg');
    card.style.setProperty('--x','50%');
    card.style.setProperty('--y','50%');
  };
  card.addEventListener('pointermove',e=>{
    const r=card.getBoundingClientRect();
    const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
    const y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
    card.style.setProperty('--x',(x*100).toFixed(1)+'%');
    card.style.setProperty('--y',(y*100).toFixed(1)+'%');
    card.style.setProperty('--rx',((.5-y)*7).toFixed(2)+'deg');
    card.style.setProperty('--ry',((x-.5)*9).toFixed(2)+'deg');
  });
  card.addEventListener('pointerleave',reset);
  card.addEventListener('pointercancel',reset);
});

document.querySelectorAll('.services-showcase').forEach(showcase=>{
  showcase.addEventListener('pointermove',e=>{
    const r=showcase.getBoundingClientRect();
    const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
    const y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
    showcase.style.setProperty('--mx',(x*100).toFixed(1)+'%');
    showcase.style.setProperty('--my',(y*100).toFixed(1)+'%');
  });
});

// ── WEBSITE SCANNER ─────────────────────────────────────
(function initScan() {
  function showPhase(id) {
    ["scanPhase1","scanPhase2","scanPhase3","scanPhaseError"].forEach(function(p){
      var el = document.getElementById(p);
      if (el) el.style.display = p === id ? "" : "none";
    });
  }

  function resetSteps() {
    document.querySelectorAll(".scan-step").forEach(function(s){
      s.classList.remove("active","done");
    });
  }

  function animateSteps(totalMs, callback) {
    var steps = Array.from(document.querySelectorAll(".scan-step"));
    var perStep = Math.floor(totalMs / steps.length);
    steps.forEach(function(step, i) {
      setTimeout(function(){
        // Mark previous as done
        if (i > 0) steps[i-1].classList.remove("active");
        if (i > 0) steps[i-1].classList.add("done");
        step.classList.add("active");
        // Last step
        if (i === steps.length - 1) {
          setTimeout(function(){
            step.classList.remove("active");
            step.classList.add("done");
            if (callback) callback();
          }, perStep);
        }
      }, i * perStep);
    });
  }

  function renderResults(data, rawUrl) {
    // URL label
    var urlEl = document.getElementById("resultsUrl");
    if (urlEl) urlEl.textContent = rawUrl;

    // Grade
    var overall = parseFloat(data.overall) || 0;
    var grade =
      overall >= 8 ? "Sterke website" :
      overall >= 6.5 ? "Goede basis, ruimte voor verbetering" :
      overall >= 5 ? "Verbetering nodig" :
      "Zwakke basis, snel aan de slag";
    var gradeEl = document.getElementById("resultsGrade");
    if (gradeEl) gradeEl.textContent = grade;

    // Overall ring + number
    var overallEl = document.getElementById("scanOverall");
    var numEl = document.getElementById("overallNum");
    var ringEl = document.getElementById("scanRingFill");
    if (overallEl) {
      overallEl.classList.remove("score-good","score-medium","score-bad");
      overallEl.classList.add(overall >= 7 ? "score-good" : overall >= 5 ? "score-medium" : "score-bad");
    }
    if (numEl && ringEl) {
      var current = 0;
      var step = overall / 40;
      var iv = setInterval(function(){
        current = Math.min(current + step, overall);
        numEl.textContent = current.toFixed(1);
        // SVG ring: circumference = 2 * pi * 34 ≈ 213.6
        var dashoffset = 213.6 - (213.6 * (current / 10));
        ringEl.style.strokeDashoffset = dashoffset;
        if (current >= overall) clearInterval(iv);
      }, 25);
    }

    // Score cards
    var cats = [
      { key:"seo", label:"SEO", icon:"◎" },
      { key:"mobiel", label:"Mobiel", icon:"◫" },
      { key:"conversie", label:"Conversie", icon:"↗" },
      { key:"snelheid", label:"Snelheid", icon:"⚡" },
      { key:"uitstraling", label:"Uitstraling", icon:"◆" }
    ];
    var grid = document.getElementById("scanScoresGrid");
    if (grid) {
      grid.innerHTML = "";
      cats.forEach(function(cat){
        var score = parseFloat((data.scores || {})[cat.key]) || 0;
        var pct = (score / 10) * 100;
        var cls = score >= 7 ? "score-good" : score >= 5 ? "score-medium" : "score-bad";
        var card = document.createElement("div");
        card.className = "scan-score-card " + cls;
        card.innerHTML =
          '<div class="ssc-top">' +
          '<span class="ssc-icon">' + cat.icon + '</span>' +
          '<span class="ssc-label">' + cat.label + '</span>' +
          '<span class="ssc-num">' + score.toFixed(1) + '</span>' +
          '</div>' +
          '<div class="ssc-bar"><span style="width:0%"></span></div>';
        grid.appendChild(card);
        // Animate bar
        setTimeout(function(){
          var bar = card.querySelector(".ssc-bar span");
          if (bar) bar.style.width = pct + "%";
        }, 200);
      });
    }

    // Findings
    var findingsEl = document.getElementById("scanFindings");
    if (findingsEl) {
      findingsEl.innerHTML = "";
      var catLabels = { seo:"◎ SEO", mobiel:"◫ Mobiel", conversie:"↗ Conversie", snelheid:"⚡ Snelheid", uitstraling:"◆ Uitstraling" };
      cats.forEach(function(cat){
        var f = (data.findings || {})[cat.key];
        if (!f) return;
        var sec = document.createElement("div");
        sec.className = "scan-finding-section";
        var h4 = document.createElement("h4");
        h4.textContent = catLabels[cat.key] || cat.label;
        sec.appendChild(h4);
        (f.good || []).forEach(function(item){
          var row = document.createElement("div");
          row.className = "scan-finding-row good";
          row.innerHTML = '<span class="sf-dot">✓</span><span>' + escapeHtml(item) + '</span>';
          sec.appendChild(row);
        });
        (f.bad || []).forEach(function(item){
          var row = document.createElement("div");
          row.className = "scan-finding-row bad";
          row.innerHTML = '<span class="sf-dot">✗</span><span>' + escapeHtml(item) + '</span>';
          sec.appendChild(row);
        });
        findingsEl.appendChild(sec);
      });
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;");
  }

  async function runScan() {
    var urlInput = document.getElementById("scanUrlInput");
    if (!urlInput) return;
    var url = urlInput.value.trim();
    if (!url) { urlInput.focus(); return; }
    if (!url.startsWith("http")) url = "https://" + url;

    showPhase("scanPhase2");
    var loadingUrlEl = document.getElementById("scanLoadingUrl");
    if (loadingUrlEl) loadingUrlEl.textContent = url;
    resetSteps();

    // Start step animation (~4 seconds for 5 steps)
    var stepsDone = false;
    animateSteps(4000, function(){ stepsDone = true; });

    try {
      var response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url })
      });
      var data = await response.json();

      // Wait until steps animation is done (at least 4.2s)
      var waitStart = Date.now();
      while (!stepsDone && Date.now() - waitStart < 5000) {
        await new Promise(function(r){ setTimeout(r, 100); });
      }
      await new Promise(function(r){ setTimeout(r, 300); });

      if (data.error) {
        var errEl = document.getElementById("scanErrorMsg");
        if (errEl) errEl.textContent = data.error;
        showPhase("scanPhaseError");
        return;
      }

      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "website-scan-started",
          website: data.url || url
        })
      }).then(function(response){
        if (!response.ok) console.warn("Website Scan kon niet in de lead-inbox worden geregistreerd.");
      }).catch(function(){
        console.warn("Website Scan kon niet in de lead-inbox worden geregistreerd.");
      });

      renderResults(data, url);
      showPhase("scanPhase3");

    } catch (e) {
      var errEl2 = document.getElementById("scanErrorMsg");
      if (errEl2) errEl2.textContent = "Er is een fout opgetreden. Controleer de URL en probeer opnieuw.";
      showPhase("scanPhaseError");
    }
  }

  function bindScanEvents() {
    var startBtn = document.getElementById("scanStartBtn");
    var urlInput = document.getElementById("scanUrlInput");
    if (startBtn && !startBtn.__scanBound) {
      startBtn.__scanBound = true;
      startBtn.addEventListener("click", runScan);
    }
    if (urlInput && !urlInput.__scanBound) {
      urlInput.__scanBound = true;
      urlInput.addEventListener("keydown", function(e){ if (e.key === "Enter") runScan(); });
    }
    document.querySelectorAll(".scan-restart").forEach(function(btn){
      if (!btn.__scanBound) {
        btn.__scanBound = true;
        btn.addEventListener("click", function(){
          showPhase("scanPhase1");
          var ui = document.getElementById("scanUrlInput");
          if (ui) ui.value = "";
          resetSteps();
          var ov = document.getElementById("scanOverall");
          if (ov) ov.classList.remove("score-good","score-medium","score-bad");
          var rf = document.getElementById("scanRingFill");
          if (rf) rf.style.strokeDashoffset = "213.6";
          var es = document.getElementById("scanEmailSent");
          var ef = document.getElementById("scanEmailForm");
          if (es) es.style.display = "none";
          if (ef) ef.style.display = "";
        });
      }
    });
    var emailForm = document.getElementById("scanEmailForm");
    if (emailForm && !emailForm.__scanBound) {
      var emailCopy = document.querySelector(".scan-email-copy p");
      if (emailCopy) {
        emailCopy.textContent = "Laat je e-mailadres en telefoonnummer achter. Door te versturen vraag je WeDays om contact over jouw Website Scan.";
      }
      var phoneInput = emailForm.querySelector('input[name="phone"]');
      if (!phoneInput) {
        phoneInput = document.createElement("input");
        phoneInput.className = "input";
        phoneInput.name = "phone";
        phoneInput.type = "tel";
        phoneInput.autocomplete = "tel";
        phoneInput.placeholder = "Telefoonnummer";
        phoneInput.required = true;
        var emailSubmit = emailForm.querySelector('button[type="submit"]');
        emailForm.insertBefore(phoneInput, emailSubmit);
      }
      emailForm.__scanBound = true;
      emailForm.addEventListener("submit", async function(e){
        e.preventDefault();
        if (!emailForm.reportValidity()) return;
        var email = emailForm.querySelector('input[type="email"]')?.value || '';
        var phone = emailForm.querySelector('input[name="phone"]')?.value || '';
        var scannedUrl = document.getElementById("resultsUrl")?.textContent || '';
        var submit = emailForm.querySelector('button[type="submit"]');
        var originalLabel = submit ? submit.textContent : '';
        var sent = document.getElementById("scanEmailSent");
        if (submit) {
          submit.disabled = true;
          submit.textContent = "Versturen…";
        }
        if (sent) sent.style.display = "none";

        try {
          var response = await fetch('/api/lead', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ type:'website-scan', email: email, phone: phone, website: scannedUrl })
          });
          var result = await response.json().catch(function(){ return {}; });
          if (!response.ok) throw new Error(result.error || 'Versturen is niet gelukt.');
          emailForm.style.display = "none";
          if (sent) {
            sent.textContent = "✓ Ontvangen. WeDays neemt binnen één werkdag persoonlijk contact met je op.";
            sent.style.color = "#34d399";
            sent.style.display = "";
          }
        } catch (error) {
          if (sent) {
            sent.textContent = error && error.message ? error.message : "Versturen is niet gelukt. Probeer het opnieuw.";
            sent.style.color = "#f87171";
            sent.style.display = "";
          }
        } finally {
          if (submit) {
            submit.disabled = false;
            submit.textContent = originalLabel;
          }
        }
      });
    }
  }

  // Bind on load + re-bind when navigating to scan page
  document.addEventListener("DOMContentLoaded", bindScanEvents);

  // Hook into the routing system
  var origShowRoute = window.showRoute;
  if (typeof origShowRoute === "function") {
    window.showRoute = function(route) {
      origShowRoute(route);
      if (route === "website-scan") {
        setTimeout(bindScanEvents, 50);
        showPhase("scanPhase1");
      }
    };
  }
})();

// ── AI CHAT WIDGET ───────────────────────────────────────
(function initChatWidget(){
  var widget = document.getElementById("chatWidget");
  if (!widget) return;
  var bubble = document.getElementById("chatBubble");
  var panel = document.getElementById("chatPanel");
  var closeBtn = document.getElementById("chatClose");
  var messagesEl = document.getElementById("chatMessages");
  var form = document.getElementById("chatForm");
  var input = document.getElementById("chatInput");
  var tooltip = document.getElementById("chatTooltip");

  var history = [];
  var greeted = false;
  var waitingForReply = false;

  // Last-resort global safety net: if ANYTHING throws or rejects anywhere
  // on the page while we're waiting for Weda's reply, surface that as a
  // visible message instead of letting it disappear into the console.
  window.addEventListener("error", function(){
    if (waitingForReply) {
      waitingForReply = false;
      hideTyping();
      addMessage("assistant", "Sorry, er ging iets onverwachts mis (technische fout op de pagina). Probeer het opnieuw, of mail naar info@wedays.nl.");
    }
  });
  window.addEventListener("unhandledrejection", function(){
    if (waitingForReply) {
      waitingForReply = false;
      hideTyping();
      addMessage("assistant", "Sorry, er ging iets onverwachts mis (onbeantwoord verzoek). Probeer het opnieuw, of mail naar info@wedays.nl.");
    }
  });

  function addMessage(role, text) {
    if (!messagesEl) return;
    var div = document.createElement("div");
    div.className = "chat-msg " + (role === "user" ? "user" : "bot");
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    if (!messagesEl) return;
    var div = document.createElement("div");
    div.className = "chat-typing";
    div.id = "chatTypingIndicator";
    div.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function hideTyping() {
    var el = document.getElementById("chatTypingIndicator");
    if (el) el.remove();
  }

  function openChat() {
    widget.classList.add("open");
    if (tooltip) tooltip.classList.remove("show");
    if (!greeted) {
      greeted = true;
      addMessage("assistant", "Hoi, ik ben Weda, de AI-assistent van WeDays. Stel gerust een vraag over websites, webdesign of onze aanpak.");
    }
    setTimeout(function(){ if (input) input.focus(); }, 100);
  }
  function closeChat() {
    widget.classList.remove("open");
  }

  if (bubble && !bubble.__bound) {
    bubble.__bound = true;
    bubble.addEventListener("click", function(){
      if (widget.classList.contains("open")) closeChat(); else openChat();
    });
  }
  if (closeBtn && !closeBtn.__bound) {
    closeBtn.__bound = true;
    closeBtn.addEventListener("click", closeChat);
  }

  async function sendMessage(text) {
    // Everything is inside this single try/catch, including the steps
    // before the network call, so nothing can fail silently. sendMessage
    // is async, so a throw here would otherwise become an unhandled
    // promise rejection that never shows up in the UI.
    var sendBtn = null;
    waitingForReply = true;

    // Hard timeout: if /api/chat never responds at all (hangs), abort after
    // 15s and show a visible message instead of waiting forever.
    var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timeoutId = setTimeout(function(){
      if (controller) controller.abort();
    }, 15000);

    try {
      addMessage("user", text);
      history.push({ role: "user", content: text });
      showTyping();
      sendBtn = form ? form.querySelector(".chat-send") : null;
      if (sendBtn) sendBtn.disabled = true;

      var fetchOpts = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-12) })
      };
      if (controller) fetchOpts.signal = controller.signal;

      var res = await fetch("/api/chat", fetchOpts);
      clearTimeout(timeoutId);

      if (!res.ok) {
        // Server responded, but with an error status (e.g. 404 if the
        // function route doesn't exist, 500 if it crashed, 429 if the free
        // Workers AI daily quota ran out). Show the status code so this is
        // diagnosable instead of a silent generic failure.
        hideTyping();
        waitingForReply = false;
        addMessage("assistant", "Sorry, Weda kreeg een foutcode terug (HTTP " + res.status + "). Probeer het opnieuw, of mail naar info@wedays.nl.");
        history.push({ role: "assistant", content: "[fout " + res.status + "]" });
        return;
      }

      var data = await res.json();
      hideTyping();
      waitingForReply = false;
      var reply = (data && data.reply) || "Sorry, daar kan ik nu geen antwoord op geven. Neem gerust contact op via het contactformulier.";
      addMessage("assistant", reply);
      history.push({ role: "assistant", content: reply });
    } catch (e) {
      clearTimeout(timeoutId);
      hideTyping();
      waitingForReply = false;
      var isAbort = e && e.name === "AbortError";
      var fallback = isAbort
        ? "Sorry, het duurde te lang om een antwoord te krijgen. Probeer het opnieuw, of mail naar info@wedays.nl."
        : "Sorry, de assistent is even niet bereikbaar (" + (e && e.message ? e.message : "onbekende fout") + "). Probeer het opnieuw, of mail naar info@wedays.nl.";
      addMessage("assistant", fallback);
      history.push({ role: "assistant", content: fallback });
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  if (form && !form.__bound) {
    form.__bound = true;
    form.addEventListener("submit", function(e){
      e.preventDefault();
      e.stopPropagation();
      var text = (input && input.value || "").trim();
      if (!text) return;
      if (input) input.value = "";
      // sendMessage is async, always attach a .catch so a rejection can
      // never disappear silently, even if something unexpected happens.
      sendMessage(text).catch(function(){
        hideTyping();
        addMessage("assistant", "Sorry, er ging iets mis. Neem gerust contact op via het contactformulier.");
      });
    });
  }

  // One-time subtle tooltip nudge
  try {
    if (tooltip && !sessionStorage.getItem("wedaysChatTooltipShown")) {
      setTimeout(function(){
        tooltip.classList.add("show");
        try { sessionStorage.setItem("wedaysChatTooltipShown", "1"); } catch (e) {}
        setTimeout(function(){ tooltip.classList.remove("show"); }, 6000);
      }, 3500);
    }
  } catch (e) {
    // sessionStorage unavailable (e.g. private browsing), skip tooltip nudge silently
  }
})();
