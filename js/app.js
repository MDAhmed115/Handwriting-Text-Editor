// ── font map ──
const FM = {
  kalam:    "'Kalam', cursive",
  caveat:   "'Caveat', cursive",
  shadows:  "'Shadows Into Light', cursive",
  patrick:  "'Patrick Hand', cursive",
  indie:    "'Indie Flower', cursive",
  dancing:  "'Dancing Script', cursive",
  nothing:  "'Nothing You Could Do', cursive",
  rock:     "'Rock Salt', cursive",
  architect:"'Architects Daughter', cursive",
  personal: "'AhmedHandwriting', cursive"
};

// ── typo ──
const AK={a:'sq',b:'vg',c:'xv',d:'sf',e:'wr',f:'dg',g:'fh',h:'gj',i:'uo',j:'hk',k:'jl',l:'k',m:'n',n:'bm',o:'ip',p:'o',q:'wa',r:'et',s:'ad',t:'ry',u:'yi',v:'cb',w:'qe',x:'zc',y:'ut',z:'x','1':'2','2':'13','3':'24','4':'35','5':'46','6':'57','7':'68','8':'79','9':'80','0':'9',';':':','=':'+'};
function typo(ch,freq){
  if(!freq)return ch;
  const r=[0,.01,.025,.055][freq];
  if(Math.random()>r)return ch;
  const lo=ch.toLowerCase();
  if(AK[lo]){const o=AK[lo];return o[Math.floor(Math.random()*o.length)]+ch;}
  return ch+ch;
}

// ── hex→rgb ──
function h2r(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}

// ── per-char style (REALISTIC — subtle wobble, stays near baseline) ──
function cStyle(wobble, charVar, slant, baseColor, baselineNudge){
  baselineNudge = baselineNudge || 0;
  const wb=parseInt(wobble), cv=parseInt(charVar);
  const sl=parseInt(slant);

  // Baseline wobble: VERY subtle Y offset only — 0.5 to 1.5px max
  const tyOff = wb===0 ? 0 : (Math.random()-.5)*2*[0,.8,1.5,2.5][wb];
  // Size variation: very small — 0.97 to 1.03
  const sc = cv===0 ? 1 : 1+(Math.random()-.5)*2*[0,.018,.035,.06][cv];
  // Rotation: very small — like real pen tilt
  const rot = sl + (Math.random()-.5)*2*[0,.8,1.5,2.8][cv];
  // X offset per char for natural spacing irregularity
  const txOff = cv===0 ? 0 : (Math.random()-.5)*2*[0,.3,.6,1][cv];

  // ink color variation — subtle
  const [r,g,b]=h2r(baseColor);
  const v=(Math.random()-.5)*22;
  const cr=Math.max(0,Math.min(255,r+v));
  const cg=Math.max(0,Math.min(255,g+v));
  const cb=Math.max(0,Math.min(255,b+v));
  // Ink opacity variation — simulates pressure
  const op=0.82+Math.random()*.18;

  const totalY = (tyOff + baselineNudge).toFixed(1);
  return {
    s:`transform:rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)}) translate(${txOff.toFixed(1)}px,${totalY}px);display:inline-block;`,
    c:`rgba(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)},${op.toFixed(2)})`
  };
}

// ── page geometry (matches .pg in style.css: 1123px tall, 56px top/bottom padding) ──
const PAGE_TOP    = 56;
const PAGE_USABLE = 1011;   // 1123 - 56 - 56

// Measure where the text baseline sits inside a line box for a given font, so the
// ruled lines can be placed right under the handwriting no matter which font is used.
function measureBaseline(fontCss, size, lineH){
  const d=document.createElement('div');
  d.style.cssText=`position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;font-family:${fontCss};font-size:${size}px;line-height:${lineH}px;`;
  d.innerHTML='Hxgy<span style="display:inline-block;width:0;height:0;vertical-align:baseline"></span>';
  document.body.appendChild(d);
  const b=d.lastChild.offsetTop;
  document.body.removeChild(d);
  return (b>0&&b<lineH*2)?b:Math.round(lineH*0.7);
}

// Width of one space in the given font (used to build uneven indentation)
function measureSpace(fontCss, size){
  const d=document.createElement('div');
  d.style.cssText=`position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;font-family:${fontCss};font-size:${size}px;`;
  d.innerHTML='<span>'+'&nbsp;'.repeat(20)+'</span>';
  document.body.appendChild(d);
  const w=d.firstChild.getBoundingClientRect().width/20;
  document.body.removeChild(d);
  return (w>1&&w<size*2)?w:size*0.3;
}

// ── paper bg ──
function paperBg(type, lineCol, margin, lineSp, ruleTop){
  const BG={'ruled-cream':'#fdf8ee','ruled-white':'#fafafa','ruled-blue':'#f0f4ff','ruled-yellow':'#fffde0',grid:'#fefefe',plain:'#ffffff'};
  const bg=BG[type]||'#fdf8ee';
  // NOTE: lines are drawn as real 1px elements (see addLines in buildPage), NOT as CSS
  // gradients, because html2canvas (used for the PDF export) can't render repeating gradients.
  let rules=null;
  if(type!=='plain' && type!=='grid'){
    const S=lineSp;
    const first=((((ruleTop)%S)+S)%S);            // y of the first ruled line (>= 0)
    rules={first,step:S};
  }
  return{bg,bi:'none',grid:type==='grid',rules,margin:!!(margin && type!=='plain' && type!=='grid')};
}

// ── SCAN + FLASH + FOLD canvas ──
function drawFX(canvas, opts, pageIndex){
  const w=canvas.width=canvas.offsetWidth||794;
  const h=canvas.height=canvas.offsetHeight||1123;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);

  const {scanStyle,shadow,curl,grain,fold,foldPat,foldSoft,foldCPct,foldCHPct,flash,flashPos,flashInt}=opts;
  const si=parseInt(shadow), fsi=parseInt(flashInt), fsft=parseInt(foldSoft);

  // 1. Grain
  if(grain){
    const id=ctx.createImageData(w,h); const d=id.data;
    for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*14;d[i]=d[i+1]=d[i+2]=128+n;d[i+3]=Math.random()*8;}
    ctx.putImageData(id,0,0);
  }

  // 2. Scan tint + vignette
  const SC={none:{t:null,v:0},light:{t:'rgba(255,255,240,.06)',v:.14},camscanner:{t:'rgba(245,238,210,.15)',v:.28},dark:{t:'rgba(30,25,10,.18)',v:.4},warm:{t:'rgba(255,220,140,.12)',v:.24}};
  const sc=SC[scanStyle]||SC.camscanner;
  if(sc.t){ctx.fillStyle=sc.t;ctx.fillRect(0,0,w,h);}
  const vs=sc.v*([0,.35,.65,.95][si]||.65);
  if(vs>0){
    const g=ctx.createRadialGradient(w*.5,h*.4,h*.1,w*.5,h*.4,h*.88);
    g.addColorStop(0,`rgba(255,255,200,${vs*.06})`);
    g.addColorStop(.5,'rgba(0,0,0,0)');
    g.addColorStop(1,`rgba(0,0,0,${vs*.52})`);
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    [[0,0],[w,0],[0,h],[w,h]].forEach(([cx,cy])=>{
      const cg=ctx.createRadialGradient(cx,cy,0,cx,cy,w*.5);
      cg.addColorStop(0,`rgba(0,0,0,${vs*.32})`);cg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=cg;ctx.fillRect(0,0,w,h);
    });
    if(scanStyle!=='none'){
      const le=ctx.createLinearGradient(0,0,w*.06,0);
      le.addColorStop(0,`rgba(0,0,0,${vs*.2})`);le.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=le;ctx.fillRect(0,0,w*.06,h);
      const te=ctx.createLinearGradient(0,0,0,h*.04);
      te.addColorStop(0,`rgba(0,0,0,${vs*.16})`);te.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=te;ctx.fillRect(0,0,w,h*.04);
    }
  }

  // 3. Flash
  if(flash){
    const PM={tl:[w*.2,h*.16],tr2:[w*.8,h*.16],tc:[w*.5,h*.15],c:[w*.5,h*.44]};
    const [fx,fy]=PM[flashPos]||PM.tl;
    const fr=w*(.28+fsi*.11), fstr=[0,.12,.25,.42,.6][fsi];
    const fg=ctx.createRadialGradient(fx,fy,0,fx,fy,fr);
    fg.addColorStop(0,`rgba(255,255,255,${fstr})`);
    fg.addColorStop(.18,`rgba(255,253,240,${fstr*.65})`);
    fg.addColorStop(.45,`rgba(255,248,220,${fstr*.25})`);
    fg.addColorStop(.75,`rgba(255,245,200,${fstr*.07})`);
    fg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=fg;ctx.fillRect(0,0,w,h);
    if(fsi>=2){
      const hs=ctx.createRadialGradient(fx,fy,0,fx,fy,fr*.13);
      hs.addColorStop(0,`rgba(255,255,255,${fstr*.85})`);hs.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=hs;ctx.fillRect(0,0,w,h);
    }
    if(fsi>=3){
      const sw=w*.65;
      const sg=ctx.createLinearGradient(fx-sw/2,fy,fx+sw/2,fy);
      sg.addColorStop(0,'rgba(255,255,255,0)');sg.addColorStop(.45,`rgba(255,255,255,${fstr*.22})`);
      sg.addColorStop(.5,`rgba(255,255,255,${fstr*.45})`);sg.addColorStop(.55,`rgba(255,255,255,${fstr*.22})`);
      sg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=sg;ctx.fillRect(0,fy-3,w,6);
    }
  }

  // 4. SMOOTH FOLD CREASES ──────────────────────────────────────────────
  // Alternating bevel: odd pages inward, even pages outward
  if(fold && fsft>0){
    const cpY=h*(parseInt(foldCPct)/100);   // vertical crease pos
    const cpX=w*(parseInt(foldCHPct)/100);  // horizontal crease pos
    // softness controls blur spread and alpha
    const spread=[0,6,14,28][fsft];
    const alpha =[0,.08,.14,.22][fsft];
    const isOdd=(pageIndex%2===0); // page 0 = first page

    function smoothCrease(x1,y1,x2,y2, inward){
      const dx=x2-x1, dy=y2-y1;
      const len=Math.sqrt(dx*dx+dy*dy);
      const nx=-dy/len, ny=dx/len; // normal direction

      // Which side gets shadow vs highlight depends on inward/outward
      const shadowSide  = inward ? 1 : -1;
      const lightSide   = inward ? -1 : 1;

      // Draw as series of gradient strips to simulate GaussBlur
      for(let step=0;step<spread;step++){
        const t=step/spread;
        const a=alpha*(1-t)*(1-t); // quadratic falloff = smooth
        // Shadow on one side
        ctx.save();
        ctx.strokeStyle=`rgba(0,0,0,${a})`;
        ctx.lineWidth=1;
        ctx.beginPath();
        ctx.moveTo(x1+nx*shadowSide*(step+.5), y1+ny*shadowSide*(step+.5));
        ctx.lineTo(x2+nx*shadowSide*(step+.5), y2+ny*shadowSide*(step+.5));
        ctx.stroke();
        // Highlight on other side
        ctx.strokeStyle=`rgba(255,250,240,${a*.6})`;
        ctx.beginPath();
        ctx.moveTo(x1+nx*lightSide*(step+.5), y1+ny*lightSide*(step+.5));
        ctx.lineTo(x2+nx*lightSide*(step+.5), y2+ny*lightSide*(step+.5));
        ctx.stroke();
        ctx.restore();
      }

      // Center crease line — very subtle
      ctx.save();
      ctx.strokeStyle=`rgba(80,70,50,${alpha*.55})`;
      ctx.lineWidth=.6;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      ctx.restore();

      // Slight tonal shift on one half (paper bends away from light)
      const halfGrad = ctx.createLinearGradient(
        x1+ny*shadowSide*.5, y1+ny*shadowSide*.5,
        x1+ny*shadowSide*(spread+5), y1+ny*shadowSide*(spread+5)
      );
      halfGrad.addColorStop(0,`rgba(0,0,0,${alpha*.35})`);
      halfGrad.addColorStop(1,'rgba(0,0,0,0)');
    }

    if(foldPat==='horizontal' || foldPat==='cross' || foldPat==='thirds'){
      if(foldPat==='thirds'){
        smoothCrease(0,h/3,w,h/3,isOdd);
        smoothCrease(0,h*2/3,w,h*2/3,!isOdd);
      } else if(foldPat==='cross'){
        smoothCrease(0,cpY,w,cpY,isOdd);
        smoothCrease(cpX,0,cpX,h,!isOdd);
        // quad tone shift
        const qg=ctx.createRadialGradient(cpX,cpY,0,cpX,cpY,Math.max(w,h)*.5);
        qg.addColorStop(0,`rgba(0,0,0,${alpha*.1})`);qg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=qg;ctx.fillRect(0,0,w,h);
      } else {
        smoothCrease(0,cpY,w,cpY,isOdd);
        // Tonal shift below crease
        const tg=ctx.createLinearGradient(0,cpY,0,cpY+spread*1.5);
        tg.addColorStop(0,`rgba(0,0,0,${alpha*.4})`);tg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=tg;ctx.fillRect(0,cpY,w,spread*2);
      }
    } else if(foldPat==='diagonal'){
      smoothCrease(w*.02,h*.04,w*.98,h*.96,isOdd);
    }
  }

  // 5. Page curl
  if(curl&&si>0){
    const cg=ctx.createRadialGradient(w,h,0,w,h,w*.26);
    cg.addColorStop(0,`rgba(0,0,0,${si*.1})`);cg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=cg;ctx.fillRect(0,0,w,h);
  }
}

// ── PDF EXPORT via html2canvas + jsPDF ──
// Each .pw page div is screenshotted at full resolution and added to a PDF.
// This avoids all browser print re-rendering issues and gaps.
async function safePrint(){
  const pages = document.querySelectorAll('#prev .pvp');
  if(!pages.length){ alert('Generate handwriting first!'); return; }

  const btn = document.getElementById('pdfBtn')||document.getElementById('bPdf');
  const btnText = btn.textContent;
  btn.textContent = '⏳ Building PDF…';
  btn.disabled = true;

  try{
    if(document.fonts&&document.fonts.ready) await document.fonts.ready;
    // Load html2canvas if not already loaded
    if(typeof html2canvas === 'undefined'){
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }
    // Load jsPDF if not already loaded
    if(typeof window.jspdf === 'undefined'){
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }

    const { jsPDF } = window.jspdf;
    // A4 in mm: 210 x 297
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });

    for(let i=0; i<pages.length; i++){
      btn.textContent = `⏳ Page ${i+1} / ${pages.length}…`;
      const pg = pages[i];

      const canvas = await html2canvas(pg, {
        scale: 2,            // 2x = crisp on high-DPI
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        // The preview lives inside nested scroll containers. html2canvas keeps
        // their overflow clips in its cloned document, which cuts page edges
        // and any strokes near the top or bottom when the page is scrolled.
        onclone: clonedDoc=>{
          const body=clonedDoc.body,ws=clonedDoc.querySelector('.ws'),pr=clonedDoc.getElementById('prev');
          body.style.cssText+=';height:auto;min-height:0;overflow:visible';
          if(ws)ws.style.cssText+=';height:auto;min-height:0;overflow:visible;display:block';
          if(pr)pr.style.cssText+=';height:auto;max-height:none;overflow:visible;display:block;padding:0;gap:0;background:transparent';
          const editor=clonedDoc.getElementById('ew');if(editor)editor.style.display='none';
          const status=clonedDoc.querySelector('.status');if(status)status.style.display='none';
          clonedDoc.querySelectorAll('.pw').forEach(page=>{page.style.zoom='1';page.style.filter='none';page.style.margin='0 auto'});
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      if(i > 0) pdf.addPage();
      // Fill the full A4 page (210mm x 297mm)
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    }

    pdf.save('handwriting.pdf');
  } catch(err){
    console.error(err);
    alert('PDF generation failed: ' + err.message);
  }

  btn.textContent = btnText;
  btn.disabled = false;
}

function loadScript(src){
  return new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = ()=> reject(new Error('Failed to load: ' + src));
    document.head.appendChild(s);
  });
}


// ── make sure a font is loaded before we lay out text ──
async function ensureFont(key, size){
  if(!document.fonts||!document.fonts.load) return;
  const fam=(FM[key]||FM.kalam).split(',')[0];   // e.g. 'AhmedHandwriting'
  try{
    await document.fonts.load(`${size||19}px ${fam}`, 'AaBbCc123');
    await document.fonts.load(`700 ${size||19}px ${fam}`, 'AaBbCc123');
  }catch(e){ console.warn('Font load failed:', fam, e); }
}

// Warm up the personal font as soon as the page opens
if(document.fonts&&document.fonts.load){ document.fonts.load("19px 'AhmedHandwriting'").catch(()=>{}); }


// ════════ WORD-STYLE EDITOR (new) ════════
const $=id=>document.getElementById(id),qa=s=>[...document.querySelectorAll(s)];
const ed=$('ed'),sheet=$('sheet'),ink=$('ink'),hl=$('hl'),prev=$('prev'),PAGE_H=1123;
const FN={kalam:'Kalam',caveat:'Caveat',shadows:'Shadows Into Light',patrick:'Patrick Hand',indie:'Indie Flower',dancing:'Dancing Script',nothing:'Nothing You Could Do',rock:'Rock Salt',architect:"Architect's Daughter",personal:'My Handwriting (font file)'};
const L={wb:['None','Subtle','Low','Medium'],cv:['None','Low','Medium','High'],ty:['None','Low','Medium','High'],iv:['None','Low','Medium','High'],ld:['None','Low','Medium','High'],fso:['Hairline','Soft','Medium','Bold'],sh2:['None','Light','Medium','Heavy'],fi:['','Light','Medium','Strong','Blinding'],dr:['None','Light','Medium','Heavy']};
const FMT={mp:v=>(v>0?'+':'')+v+'px',rm:v=>v+'px',iw:v=>v+'%',ls:v=>v+'px · '+Math.floor(PAGE_USABLE/v)+' lines/pg',lo:v=>(v>0?'+':'')+v+'px',fz:v=>v+'px',cs:v=>v+'px',ws2:v=>v+'px',sl2:v=>({'-5':'Strong','-4':'Medium','-3':'Slight','-2':'Subtle','-1':'Minimal','0':'None'})[v],fcp:v=>v+'%',fch:v=>v+'%',dw:v=>v+'px',cdl:v=>(v/10)+'s'};
const fmt=(id,v)=>FMT[id]?FMT[id](v):(L[id]?L[id][v]:v);
const fam=k=>(FM[k]||FM.kalam).split(',')[0].replace(/'/g,'');
const fonts=()=>Object.keys(FM).map(k=>[k,FN[k]||k]);
const opt=(a,s)=>a.map(([v,t])=>`<option value="${v}"${v==s?' selected':''}>${t}</option>`).join('');
const R=(id,t,a,b,v,st=1)=>`<label class="mn">${t}<input type="range" class="rb" id="${id}" min="${a}" max="${b}" value="${v}" step="${st}"><b data-v="${id}"></b></label>`;
const SL=(id,t,o,d)=>`<label class="mn">${t}<select class="rb" id="${id}">${opt(o,d)}</select></label>`;
const CK=(id,t,on)=>`<label class="mn tg"><input type="checkbox" class="rb" id="${id}"${on?' checked':''}>${t}</label>`;
const G=(t,h)=>`<div class="grp"><div class="gi">${h}</div><div class="gl">${t}</div></div>`;
const B=(c,t,v)=>`<button data-c="${c}"${v?` data-v="${v}"`:''}>${t}</button>`;
const TL=(t,i)=>`<button class="tl" data-t="${t}">${i}</button>`;
const SW=['#1a2f6e','#111111','#b32020','#0d6b2d','#ffe94d','#ff9ec4'].map(c=>`<i class="sw" data-col="${c}" style="background:${c}"></i>`).join('');
const TABS={
home:()=>G('Font',`<select id="hf">${opt(fonts())}</select><select id="hs">${opt([10,12,14,16,18,19,20,22,24,28,32,40,48].map(x=>[x,x]),19)}</select>${B('bold','<b>B</b>')}${B('italic','<i>I</i>')}${B('underline','<u>U</u>')}${B('strikeThrough','<s>S</s>')}<label class="mn tg">A<input type="color" id="hc" value="#1a2f6e"></label><label class="mn tg">🖍<input type="color" id="hh" value="#ffe94d"></label>`)+G('Paragraph',B('justifyLeft','L')+B('justifyCenter','C')+B('justifyRight','R')+B('insertUnorderedList','• List')+B('insertOrderedList','1. List'))+G('Styles',`<select id="hst">${opt([['p','Normal'],['h1','Heading 1'],['h2','Heading 2'],['h3','Heading 3']])}</select>`)+G('Undo',B('undo','↶')+B('redo','↷')),
insert:()=>G('Shapes',TL('line','╱ Line')+TL('arrow','➜ Arrow')+TL('rect','▭ Rect')+TL('ellipse','◯ Oval')+TL('tri','△ Triangle'))+G('Insert',`<label class="bt">🖼 Picture<input type="file" id="img" accept="image/*" hidden></label>${B('insertHorizontalRule','― Rule')}<button id="pbk">⤓ Page break</button>`),
draw:()=>G('Tools',TL('convert','🔤 Type (ink→text)')+TL('pen','🖊 Pen')+TL('pencil','✏ Pencil')+TL('hl','🖍 Highlighter')+TL('eraser','🧽 Eraser')+TL('selectRect','▭ Select')+TL('selectLasso','〰 Lasso')+TL('type','⌶ Text cursor'))+G('Colour',SW+'<input type="color" id="dc" value="#1a2f6e">')+G('Pen',R('dw','Size',1,14,3)+CK('mi','Match typed ink',true)+CK('dp','Pressure',true)+R('dr','Roughness',0,3,0))+G('Convert',R('cdl','Auto-convert after',3,30,12)+'<button id="cvnow">Convert now</button><button id="ucv">↶ Undo convert</button>')+G('Actions','<button id="ustk">↶ Undo stroke</button><button id="cstk">Clear drawing</button>'),
layout:()=>G('Paper',SL('pt','Type',[['ruled-cream','Ruled — cream'],['ruled-white','Ruled — white'],['ruled-blue','Ruled — blue'],['ruled-yellow','Ruled — yellow'],['grid','Grid'],['plain','Plain']],'ruled-cream')+SL('lc2','Line colour',[['#b0c8e4','Light blue'],['#c5d8a4','Light green'],['#d0c0e0','Light purple'],['#c8c8c8','Grey']])+CK('mg','Red margin',true))+G('Spacing',R('ls','Line spacing',24,48,34)+R('lo','Lines up/down',-12,12,0)+R('mp','Left margin',-30,40,0)+R('rm','Right margin',0,120,0))+G('Imperfect edges',R('iw','Indent width',50,150,100,5)+R('iv','Indent unevenness',0,3,1)+R('ld','Line-start drift',0,3,1)),
hand:()=>G('Font',SL('fs','Handwriting',fonts(),'kalam')+SL('ic','Ink',[['#1a2f6e','Blue ballpoint'],['#111111','Black gel'],['#0d3d0d','Dark green'],['#6e1a1a','Dark red']])+R('fz','Default size',13,28,19)+'<label class="bt">＋ Custom font<input type="file" id="cf" accept=".ttf,.otf,.woff,.woff2" hidden></label>')+G('Spacing',R('cs','Character spacing',-1,10,0,.5)+R('ws2','Word spacing',-2,24,0,.5))+G('Human feel',R('wb','Wobble',0,3,1)+R('cv','Variation',0,3,1)+R('ty','Typos',0,3,0)+R('sl2','Slant',-5,0,-2)),
effects:()=>G('Scan',SL('ss','Style',[['none','None'],['light','Light scan'],['camscanner','CamScanner'],['dark','Night'],['warm','Warm lamp']],'camscanner')+R('sh2','Vignette',0,3,2)+CK('pc','Page curl',true)+CK('pg2','Grain',true))+G('Flash',CK('fg','Flash glare',true)+SL('fpos','Position',[['tl','Top-left'],['tr2','Top-right'],['tc','Top-centre'],['c','Centre']])+R('fi','Intensity',1,4,2))+G('Creases',CK('fl','Creases',true)+SL('fp','Pattern',[['horizontal','Horizontal'],['cross','Cross'],['thirds','Thirds'],['diagonal','Diagonal']],'cross')+R('fcp','Vertical',20,80,50)+R('fch','Horizontal',20,80,50)+R('fso','Softness',0,3,2)),
file:()=>G('Document','<button id="bnew">🗋 New</button><button id="bpg">＋ Page</button><button id="bpgm">－ Page</button><button id="bref">⟳ Refresh preview</button><button id="pdfBtn">🖨️ Export PDF</button>')
};
let view='ed',saved=null,pages=1,tab='home';
function showTab(t){tab=t;$('rib').innerHTML=TABS[t]();qa('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.k===t));restoreVals();applyEdit();syncUI();setTool(t==='draw'?(T.tool==='type'?'pen':T.tool):t==='insert'?T.tool:'type');}
$('tabs').innerHTML=Object.keys(TABS).map(k=>`<button data-k="${k}">${{home:'Home',insert:'Insert',draw:'Draw',layout:'Layout',hand:'Handwriting',effects:'Effects',file:'File'}[k]}</button>`).join('');
$('tabs').onclick=e=>{const b=e.target.closest('button');if(b&&b.dataset.k)showTab(b.dataset.k)};

// Ribbon visibility and drag resize preferences
const ribbonWrap=document.getElementById('ribWrap');
const ribbon=$('rib'),grip=$('ribGrip'),ribbonButton=document.createElement('button');
ribbonButton.id='bRibbon';ribbonButton.type='button';ribbonButton.textContent='Hide ribbon';ribbonButton.setAttribute('aria-expanded','true');ribbonButton.title='Show or hide the ribbon';tabs.appendChild(ribbonButton);
const savedRibbonHeight=Number(localStorage.getItem('hwRibbonHeight'));
if(savedRibbonHeight){ribbonWrap.style.height=Math.max(92,Math.min(savedRibbonHeight,innerHeight*.5))+'px';ribbon.style.minHeight='84px';ribbon.style.flex='1 1 auto'}
if(localStorage.getItem('hwRibbonHidden')==='true'){document.body.classList.add('ribbon-hidden');ribbonButton.textContent='Show ribbon';ribbonButton.setAttribute('aria-expanded','false')}
ribbonButton.onclick=()=>{const hidden=document.body.classList.toggle('ribbon-hidden');ribbonButton.textContent=hidden?'Show ribbon':'Hide ribbon';ribbonButton.setAttribute('aria-expanded',String(!hidden));localStorage.setItem('hwRibbonHidden',String(hidden))};
grip.onpointerdown=e=>{e.preventDefault();grip.setPointerCapture(e.pointerId);const startY=e.clientY,startHeight=ribbonWrap.getBoundingClientRect().height;const move=ev=>{const h=Math.max(92,Math.min(innerHeight*.5,startHeight+ev.clientY-startY));ribbonWrap.style.height=h+'px';ribbon.style.minHeight='84px';ribbon.style.flex='1 1 auto'};const done=()=>{localStorage.setItem('hwRibbonHeight',String(Math.round(ribbonWrap.getBoundingClientRect().height)));grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',done);grip.removeEventListener('pointercancel',done)};grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',done);grip.addEventListener('pointercancel',done)};
// settings persist across tabs (controls are rebuilt per tab)
const V={};
function restoreVals(){qa('#rib .rb').forEach(el=>{if(el.id in V){el.type==='checkbox'?el.checked=V[el.id]:el.value=V[el.id]}})}
function syncUI(){qa('#rib [data-v]').forEach(b=>{const el=$(b.dataset.v);b.textContent=fmt(el.id,el.value)});qa('.tl').forEach(b=>b.classList.toggle('on',b.dataset.t===T.tool));qa('.sw').forEach(s=>s.classList.toggle('on',s.dataset.col===T[T.tool==='hl'?'hcol':'col']));if($('dp'))$('dp').checked=T.pressure}
const DEF={mi:true,cdl:12,cs:0,ws2:0,fs:'kalam',ic:'#1a2f6e',fz:19,wb:1,cv:1,ty:0,sl2:-2,iw:100,iv:1,ld:1,pt:'ruled-cream',lc2:'#b0c8e4',ls:34,lo:0,mp:0,rm:0,ss:'camscanner',sh2:2,fpos:'tl',fi:2,fp:'cross',fcp:50,fch:50,fso:2,mg:true,pc:true,pg2:true,fg:true,fl:true,dr:0};
const val=id=>id in V?V[id]:DEF[id];
function cfg(){const g=id=>val(id);return{font:g('fs'),ink:g('ic'),size:+g('fz'),wobble:g('wb'),charVar:g('cv'),typo:+g('ty'),slant:g('sl2'),paper:g('pt'),lineCol:g('lc2'),margin:g('mg'),fold:g('fl'),foldPat:g('fp'),foldSoft:g('fso'),foldCPct:g('fcp'),foldCHPct:g('fch'),scan:g('ss'),shadow:g('sh2'),curl:g('pc'),grain:g('pg2'),flash:g('fg'),flashPos:g('fpos'),flashInt:g('fi'),lineSp:+g('ls'),lineOff:+g('lo'),marginX:+g('mp'),rm:+g('rm'),indentW:g('iw')/100,indentVar:+g('iv'),drift:+g('ld'),charSpace:+g('cs'),wordSpace:+g('ws2')}}
let tmr;
$('rib').addEventListener('input',e=>{const el=e.target;
  if(el.classList.contains('rb')){V[el.id]=el.type==='checkbox'?el.checked:el.value;if(el.dataset&&$('rib').querySelector(`[data-v="${el.id}"]`))$('rib').querySelector(`[data-v="${el.id}"]`).textContent=fmt(el.id,el.value);
    if(el.id==='dp')T.pressure=el.checked;
    if(el.id==='dr'){redraw();}
    else{applyEdit();if(view==='pv'){clearTimeout(tmr);tmr=setTimeout(gen,350)}}save();}
  else if(el.id==='dw')T.w=+el.value;
  else if(el.id==='dc'){unmatch();T[T.tool==='hl'?'hcol':'col']=el.value;syncUI()}
  else if(el.id==='hc')exec('foreColor',el.value);
  else if(el.id==='hh')exec('hiliteColor',el.value);
});
$('rib').addEventListener('change',e=>{const el=e.target;
  if(el.id==='hf')applyStyle('fontFamily',FM[el.value]);
  else if(el.id==='hs')applyStyle('fontSize',el.value+'px');
  else if(el.id==='hst')exec('formatBlock','<'+el.value+'>');
  else if(el.id==='img'&&el.files[0]){const r=new FileReader();r.onload=()=>exec('insertHTML',`<img src="${r.result}" style="max-width:100%">`);r.readAsDataURL(el.files[0])}
  else if(el.id==='cf'&&el.files[0])addFont(el.files[0]);
  if(el.id==='dw'){T.w=+el.value}
});
$('rib').addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault()});
$('rib').addEventListener('click',e=>{const b=e.target.closest('button,.sw');if(!b)return;
  if(b.dataset.c){setTool('type');exec(b.dataset.c,b.dataset.v)}
  else if(b.dataset.t)setTool(b.dataset.t);
  else if(b.classList.contains('sw')){unmatch();T[T.tool==='hl'?'hcol':'col']=b.dataset.col;syncUI()}
  else if(b.id==='ustk'){const removed=ST.pop();if(removed)selected=selected.filter(s=>s!==removed);redraw();save()}
  else if(b.id==='cstk'){if(confirm('Remove all drawings?')){ST.length=0;selected=[];redraw();save()}}
  else if(b.id==='pbk')pageBreak();
  else if(b.id==='bpg'){pages++;applyEdit();save();if(view==='pv')gen().then(()=>prev.scrollTo({top:prev.scrollHeight,behavior:'smooth'}));else prev.scrollTo({top:prev.scrollHeight,behavior:'smooth'})}
  else if(b.id==='bpgm'){if(pages<=1)return;if(pages>needPages()){pages--;applyEdit();save();if(view==='pv')gen()}else alert('The last page still has text or drawings on it.')}
  else if(b.id==='bnew'){if(confirm('Start a new document?')){ed.innerHTML='<div><br></div>';ST.length=0;selected=[];pages=1;applyEdit();redraw();save()}}
  else if(b.id==='bref')gen();
  else if(b.id==='cvnow')convertPending();
  else if(b.id==='ucv')undoConvert();
  else if(b.id==='pdfBtn')exportPDF();
});
// text commands
document.addEventListener('selectionchange',()=>{const s=getSelection();if(s.rangeCount&&ed.contains(s.anchorNode))saved=s.getRangeAt(0).cloneRange();syncFmt()});
function exec(c,v){ed.focus();if(saved){const s=getSelection();s.removeAllRanges();s.addRange(saved)}document.execCommand(c,false,v);save()}
function applyStyle(prop,val){ed.focus();const s=getSelection();if(saved){s.removeAllRanges();s.addRange(saved)}if(!s.rangeCount)return;const r=s.getRangeAt(0);
  if(r.collapsed){const sp=document.createElement('span');sp.style[prop]=val;sp.textContent='\u200B';r.insertNode(sp);const n=document.createRange();n.setStart(sp.firstChild,1);n.collapse(true);s.removeAllRanges();s.addRange(n);saved=n.cloneRange();save();return}
  const ns=[],w=document.createTreeWalker(r.commonAncestorContainer.nodeType===3?r.commonAncestorContainer.parentNode:r.commonAncestorContainer,NodeFilter.SHOW_TEXT);
  while(w.nextNode())if(r.intersectsNode(w.currentNode)&&w.currentNode.nodeValue)ns.push(w.currentNode);
  let first,lastN;
  ns.forEach(t=>{let a=0,b=t.nodeValue.length;if(t===r.startContainer)a=r.startOffset;if(t===r.endContainer)b=r.endOffset;if(a>=b)return;
    let mid=t;if(a>0)mid=t.splitText(a);if(b-a<mid.nodeValue.length)mid.splitText(b-a);
    const sp=document.createElement('span');sp.style[prop]=val;mid.replaceWith(sp);sp.appendChild(mid);first=first||sp;lastN=sp});
  if(first){const n=document.createRange();n.setStartBefore(first);n.setEndAfter(lastN);s.removeAllRanges();s.addRange(n);saved=n.cloneRange()}
  save()}
function syncFmt(){const s=getSelection();if(!s.rangeCount||!ed.contains(s.anchorNode))return;let n=s.anchorNode;n=n.nodeType===3?n.parentElement:n;const cs=getComputedStyle(n),f=cs.fontFamily.split(',')[0].replace(/["']/g,'').trim(),k=Object.keys(FM).find(k=>fam(k)===f),hf=$('hf'),hs=$('hs');
  if(hf&&k)hf.value=k;if(hs){const px=Math.round(parseFloat(cs.fontSize));if([...hs.options].some(o=>+o.value===px))hs.value=px}}
// click anywhere on the page to start typing there
sheet.addEventListener('mousedown',e=>{if(T.tool!=='type'||view!=='ed'||(e.target!==ed&&e.target!==sheet))return;e.preventDefault();ed.focus();
  const c=cfg(),S=c.lineSp,er=ed.getBoundingClientRect(),zk=zkE(),y=Math.max(0,(e.clientY-er.top)/zk);let t=null;
  for(const k of ed.children){const r=k.getBoundingClientRect();if(y>=(r.top-er.top)/zk&&y<(r.bottom-er.top)/zk){t=k;break}}
  if(!t){const l=ed.lastElementChild,have=l?Math.round((l.getBoundingClientRect().bottom-er.top)/zk/S):0,line=Math.floor(y/S);
    for(let i=have;i<=line;i++){const d=document.createElement('div');d.innerHTML='<br>';ed.appendChild(d)}t=ed.lastElementChild}
  if(!t.textContent.replace(/\u200B/g,'').trim()&&!t.querySelector('img')){const n=Math.max(0,Math.round((e.clientX-er.left)/zk/measureSpace(FM[c.font]||FM.kalam,c.size)));t.textContent=n?' '.repeat(n):'';if(!n)t.innerHTML='<br>'}
  const r=document.createRange(),tn=document.createTreeWalker(t,NodeFilter.SHOW_TEXT);let ln=null;while(tn.nextNode())ln=tn.currentNode;
  ln?(r.setStart(ln,ln.nodeValue.length)):r.setStart(t,0);r.collapse(true);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);saved=r.cloneRange();save()});
document.execCommand('defaultParagraphSeparator',false,'div');
ed.addEventListener('paste',e=>{e.preventDefault();const t=(e.clipboardData.getData('text/plain')||'').replace(/\r/g,'').replace(/\t/g,'    ');
  exec(t.includes('\n')?'insertHTML':'insertText',t.includes('\n')?t.split('\n').map(l=>`<div>${l.replace(/&/g,'&amp;').replace(/</g,'&lt;')||'<br>'}</div>`).join(''):t)});
ed.addEventListener('input',save);
function pageBreak(){const c=cfg(),H=Math.floor(PAGE_USABLE/c.lineSp)*c.lineSp;exec('insertHTML','<div id="pbn" class="pbk"></div><div><br></div>');const el=$('pbn');if(!el)return;const y=(el.getBoundingClientRect().top-ed.getBoundingClientRect().top)/zkE();el.style.height=(H-(y%H||0))+'px';el.removeAttribute('id');save()}
async function addFont(f){const n='Custom'+Date.now();const ff=new FontFace(n,await f.arrayBuffer());await ff.load();document.fonts.add(ff);FM[n]=`'${n}', cursive`;FN[n]=f.name.replace(/\.\w+$/,'');V.fs=n;showTab(tab);$('hf')||0;applyEdit()}

// paper / edit sheet
function applyEdit(){const c=cfg(),f=FM[c.font]||FM.kalam,H=Math.floor(PAGE_USABLE/c.lineSp)*c.lineSp;
  const rt=PAGE_TOP+measureBaseline(f,c.size,c.lineSp)+2+c.lineOff,pb=paperBg(c.paper,c.lineCol,c.margin,c.lineSp,rt),S=c.lineSp;
  Object.assign(sheet.style,{backgroundColor:pb.bg,paddingLeft:(104+c.marginX)+'px',paddingRight:(58+c.rm)+'px',minHeight:Math.max(PAGE_H,112+pages*H)+'px'});ed.style.minHeight=pages*H+'px';
  ed.style.cssText=`font-family:${f};font-size:${c.size}px;line-height:${S}px;letter-spacing:${c.charSpace}px;word-spacing:${c.wordSpace}px;color:${c.ink};min-height:${pages*H}px`;
  const ln=$('ln').style;ln.backgroundImage=pb.grid?`linear-gradient(${c.lineCol} 1px,transparent 1px),linear-gradient(90deg,${c.lineCol} 1px,transparent 1px)`:pb.rules?`linear-gradient(${c.lineCol} 1px,transparent 1px)`:'none';
  ln.backgroundSize=pb.grid?'32px 32px':`100% ${S}px`;ln.backgroundPosition=pb.grid?'0 31px':`0 ${pb.rules?pb.rules.first:0}px`;
  const m=$('mgl').style;m.display=pb.margin?'block':'none';m.left=(82+c.marginX)+'px';
  $('pgl').style.cssText=`background:linear-gradient(transparent ${H-1}px,rgba(74,127,181,.5) ${H-1}px);background-size:100% ${H}px;background-position:0 ${PAGE_TOP}px`;
  qa('#hf').forEach(s=>s.value=c.font);
}
// The drawing canvases are rendered at a higher resolution than their CSS size (device pixel ratio x zoom,
// at least 2x). Text is vector and always crisp; a 1x canvas looked soft next to it.
let INK_K=2;
function fitInk(){const w=sheet.offsetWidth,h=sheet.offsetHeight;if(!w||!h)return;
  let k=Math.max(2,Math.ceil((window.devicePixelRatio||1)*(Z/100)));
  k=Math.max(1,Math.min(k,Math.sqrt(16e6/(w*h))));          // cap canvas memory
  [ink,hl].forEach(c=>{c.width=Math.round(w*k);c.height=Math.round(h*k)});
  INK_K=ink.width/w;redraw()}
new ResizeObserver(fitInk).observe(sheet);

// ── drawing ──
const ST=[],T={tool:'type',col:'#1a2f6e',hcol:'#ffe94d',w:3,pressure:true};let cur=null,er=false,selected=[],selectGesture=null,moveGesture=null;
const SHP=['line','arrow','rect','ellipse','tri'];
function setTool(t){T.tool=t;ink.style.pointerEvents=t==='type'?'none':'auto';ink.style.zIndex=t==='selectRect'||t==='selectLasso'?'3':'1';ink.style.cursor=t==='eraser'?'cell':'crosshair';syncUI()}
// ── ADDITION (drawing code above/below is untouched): the text box sits above the drawing layer,
// so while any draw tool is active it must ignore the mouse, otherwise drags select text / scroll instead of drawing.
{const st=document.createElement('style');st.textContent='#sheet.drawing #ed{pointer-events:none!important;-webkit-user-select:none!important;user-select:none!important}#sheet.drawing #ink{z-index:5!important;touch-action:none!important}';document.head.appendChild(st);
const _setTool=setTool;setTool=function(t){if(T.tool==='convert'&&t!=='convert')convertPending();_setTool(t);sheet.classList.toggle('drawing',t!=='type');if(t!=='type'){const g=getSelection();if(g&&g.rangeCount)g.removeAllRanges()}};
ink.addEventListener('pointerdown',e=>e.preventDefault())}
const rng=a=>()=>(a=Math.imul(a^a>>>15,a|1),a^=a+Math.imul(a^a>>>7,a|61),((a^a>>>14)>>>0)/4294967296);

// Stroke renderer. Each stroke is ONE smooth path painted with ONE opacity, in the same ink
// colour as typed text (with the same small per-stroke colour/opacity variation), so drawn ink
// and typed ink look the same.
function rs(ctx,s,r){
  const R=rng(s.seed+1),P=s.pts;if(!P.length)return;
  ctx.save();ctx.lineCap=ctx.lineJoin='round';
  let ox=0,oy=0;
  if(s.hl){
    const j=r*.8;ctx.strokeStyle=s.color;ctx.globalAlpha=.38;ctx.lineWidth=s.w*4+4;ctx.lineCap='butt';ctx.beginPath();
    P.forEach((p,i)=>{ox=ox*.9+(R()-.5)*j*.6;oy=oy*.9+(R()-.5)*j*.6;i?ctx.lineTo(p[0]+ox,p[1]+oy):ctx.moveTo(p[0]+ox,p[1]+oy)});
    ctx.stroke();ctx.restore();return}
  const pencil=s.tool==='pencil',j=r*(pencil?.5:.8);
  const base=SHP.includes(s.tool)?P:smoothPts(P,2);          // removes mouse/stylus jitter -> smooth pen line
  const Q=base.map(p=>{ox=ox*.92+(R()-.5)*j*.5;oy=oy*.92+(R()-.5)*j*.5;return[p[0]+ox,p[1]+oy]});
  const avg=s.pr?P.reduce((a,p)=>a+p[2],0)/P.length:1;
  ctx.lineWidth=Math.max(.7,s.w*(pencil?.55:1)*(s.pr?0.3+avg*1.1:1)*(1+(R()-.5)*.1*r));
  ctx.globalAlpha=s.op!=null?s.op:(pencil?.65:.88)+R()*.12;      // ONE opacity per stroke (no dark joints)
  const [cr,cg,cb]=h2r(s.color||val('ic')),dv=s.dv||0,cl=x=>Math.max(0,Math.min(255,Math.round(x+dv)));
  ctx.strokeStyle=`rgb(${cl(cr)},${cl(cg)},${cl(cb)})`;
  ctx.beginPath();ctx.moveTo(Q[0][0],Q[0][1]);
  for(let i=1;i<Q.length-1;i++)ctx.quadraticCurveTo(Q[i][0],Q[i][1],(Q[i][0]+Q[i+1][0])/2,(Q[i][1]+Q[i+1][1])/2);
  const L=Q[Q.length-1];ctx.lineTo(L[0],L[1]);ctx.stroke();ctx.restore()}
function redraw(){const x=ink.getContext('2d'),h=hl.getContext('2d');
  x.setTransform(1,0,0,1,0,0);h.setTransform(1,0,0,1,0,0);x.clearRect(0,0,ink.width,ink.height);h.clearRect(0,0,hl.width,hl.height);
  x.setTransform(INK_K,0,0,INK_K,0,0);h.setTransform(INK_K,0,0,INK_K,0,0);const r=+val('dr');ST.concat(cur&&cur.pts?[cur]:[]).forEach(s=>rs(s.hl?h:x,s,r));
  const pts=selected.flatMap(s=>s.pts);if(pts.length){const b=strokeBounds(pts);x.save();x.setLineDash([6,4]);x.strokeStyle='#2878d0';x.lineWidth=1.5;x.strokeRect(b.x-5,b.y-5,b.w+10,b.h+10);x.restore()}
  if(selectGesture){x.save();x.setLineDash([6,4]);x.strokeStyle='#2878d0';x.lineWidth=1.5;x.beginPath();if(selectGesture.kind==='rect'){const a=selectGesture.start,p=selectGesture.pts.at(-1);x.rect(a[0],a[1],p[0]-a[0],p[1]-a[1])}else selectGesture.pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.stroke();x.restore()}}
function strokeBounds(pts){const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys);return{x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y}}
function dens(P){const o=[];for(let i=1;i<P.length;i++){const[a,b]=[P[i-1],P[i]],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/5));for(let k=0;k<n;k++)o.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n,.6])}o.push([...P[P.length-1].slice(0,2),.6]);return o}
function shapePts(t,a,b){const[x1,y1]=a,[x2,y2]=b,an=Math.atan2(y2-y1,x2-x1),h=16;let P;
  if(t==='line')P=[a,b];
  else if(t==='arrow')P=[a,b,[x2-h*Math.cos(an-.45),y2-h*Math.sin(an-.45)],b,[x2-h*Math.cos(an+.45),y2-h*Math.sin(an+.45)]];
  else if(t==='rect')P=[a,[x2,y1],b,[x1,y2],a];
  else if(t==='tri')P=[[(x1+x2)/2,y1],b,[x1,y2],[(x1+x2)/2,y1]];
  else{P=[];for(let i=0;i<=44;i++){const q=i/44*6.6;P.push([(x1+x2)/2+(x2-x1)/2*Math.cos(q),(y1+y2)/2+(y2-y1)/2*Math.sin(q)])}}
  return dens(P)}
let last=null;
const zkE=()=>ed.getBoundingClientRect().width/ed.offsetWidth||1;
const pt=e=>{const r=ink.getBoundingClientRect(),zk=r.width/ink.offsetWidth||1;let p=e.pointerType==='pen'?e.pressure:.5;
  if(T.pressure&&e.pointerType!=='pen'&&last){p=Math.max(.25,1-Math.hypot(e.clientX-last[0],e.clientY-last[1])/22)}last=[e.clientX,e.clientY];return[(e.clientX-r.left)/zk,(e.clientY-r.top)/zk,p]};
function erase(p){const n=ST.length;for(let i=ST.length-1;i>=0;i--)if(ST[i].pts.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<10))ST.splice(i,1);if(n!==ST.length)redraw()}
function insideLasso(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
function selectionHit(stroke,g){const b=strokeBounds(stroke.pts);if(g.kind==='rect'){const a=g.start,p=g.pts.at(-1),x1=Math.min(a[0],p[0]),x2=Math.max(a[0],p[0]),y1=Math.min(a[1],p[1]),y2=Math.max(a[1],p[1]);return b.x<=x2&&b.x+b.w>=x1&&b.y<=y2&&b.y+b.h>=y1}return stroke.pts.some(p=>insideLasso(p,g.pts))}
function pointInSelection(p){if(!selected.length)return false;const b=strokeBounds(selected.flatMap(s=>s.pts));return p[0]>=b.x-12&&p[0]<=b.x+b.w+12&&p[1]>=b.y-12&&p[1]<=b.y+b.h+12}
// Light smoothing of raw pointer points (3-point weighted average, endpoints kept)
function smoothPts(P,n){let Q=P.map(p=>[p[0],p[1]]);
  for(let k=0;k<n;k++){const T2=Q.map(p=>p.slice());
    for(let i=1;i<Q.length-1;i++){T2[i][0]=(Q[i-1][0]+2*Q[i][0]+Q[i+1][0])/4;T2[i][1]=(Q[i-1][1]+2*Q[i][1]+Q[i+1][1])/4}
    Q=T2}
  return Q}
// Measures how thick the chosen font's pen stroke really is (renders 'l' and 'I' large and scans the
// stem), so drawn ink gets the same line weight as typed text in ANY font, including your own.
const stemCache={};
function stemWidth(c){
  const f=FM[c.font]||FM.kalam,key=f+'|'+c.size,fb=Math.max(1.2,c.size*.09);
  if(stemCache[key])return stemCache[key];
  try{
    if(document.fonts&&document.fonts.check&&!document.fonts.check(`${c.size}px ${f}`))return fb;   // font not loaded yet
    const K=8,sz=c.size*K,cv=document.createElement('canvas');cv.width=Math.ceil(sz*1.4);cv.height=Math.ceil(sz*1.6);
    const g=cv.getContext('2d',{willReadFrequently:true}),meds=[];
    g.font=`${sz}px ${f}`;g.textBaseline='alphabetic';g.fillStyle='#000';
    for(const ch of ['l','I']){
      g.clearRect(0,0,cv.width,cv.height);g.fillText(ch,sz*.3,sz*1.1);
      const runs=[];
      for(const fr of [.18,.26,.34]){
        const y=Math.round(sz*1.1-sz*fr),d=g.getImageData(0,y,cv.width,1).data;let best=0,cnt=0;
        for(let x=0;x<cv.width;x++){if(d[x*4+3]>128){cnt++;best=Math.max(best,cnt)}else cnt=0}
        if(best)runs.push(best)}
      if(runs.length){runs.sort((a,b)=>a-b);meds.push(runs[runs.length>>1])}}
    if(!meds.length)return fb;
    const w=Math.min(...meds)/K;
    const out=Math.max(.9,Math.min(c.size*.2,w));
    stemCache[key]=out;return out
  }catch(e){return fb}}
function inkDown(e){ink.setPointerCapture(e.pointerId);last=null;clearTimeout(cvTmr);const p=pt(e);
  if(T.tool==='selectRect'||T.tool==='selectLasso'){if(pointInSelection(p)){moveGesture={start:p,strokes:selected.map(s=>({s,pts:s.pts.map(q=>q.slice())}))}}else{selected=[];selectGesture={kind:T.tool==='selectRect'?'rect':'lasso',start:p,pts:[p]}}redraw();return}
  if(T.tool==='eraser'){er=true;erase(p);return}
  const cv=T.tool==='convert',tl=cv?'pen':T.tool,match=cv||!!val('mi');
  cur={tool:tl,cv,color:tl==='hl'?T.hcol:(match?null:T.col),
    w:(match&&tl!=='hl')?stemWidth(cfg()):T.w,
    pr:!match&&T.pressure&&tl==='pen',seed:Math.random()*1e6|0,hl:tl==='hl',
    op:tl==='pencil'?.6+Math.random()*.1:.92+Math.random()*.08,dv:(Math.random()-.5)*14,pts:[p],a:p}}
ink.onpointerdown=inkDown;
ink.onpointermove=e=>{if(!(cur||er||selectGesture||moveGesture))return;
  if(cur&&!SHP.includes(cur.tool)){const evs=e.getCoalescedEvents?e.getCoalescedEvents():[];(evs.length?evs:[e]).forEach(ev=>cur.pts.push(pt(ev)));redraw();return}
  const p=pt(e);
  if(selectGesture){selectGesture.pts.push(p);redraw();return}
  if(moveGesture){const dx=p[0]-moveGesture.start[0],dy=p[1]-moveGesture.start[1];moveGesture.strokes.forEach(({s,pts})=>{s.pts=pts.map(q=>[q[0]+dx,q[1]+dy,q[2]])});redraw();return}
  if(er)return erase(p);
  cur.pts=SHP.includes(cur.tool)?shapePts(cur.tool,cur.a,p):cur.pts.concat([p]);redraw()};
ink.onpointerup=()=>{er=false;let cvStroke=false;
  if(selectGesture){selected=ST.filter(s=>selectionHit(s,selectGesture));selectGesture=null}
  else if(moveGesture)moveGesture=null;
  else if(cur){if(cur.pts.length===1&&!SHP.includes(cur.tool))cur.pts.push([cur.pts[0][0]+.1,cur.pts[0][1]+.1,cur.pts[0][2]]);   // taps = dots (i-dots, full stops)
    if(cur.pts.length>1){delete cur.a;cvStroke=!!cur.cv;ST.push(cur)}}
  cur=null;last=null;redraw();save();if(cvStroke)scheduleConvert()};
ink.onpointercancel=ink.onpointerup;
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'&&T.tool!=='type'){e.preventDefault();const removed=ST.pop();if(removed)selected=selected.filter(s=>s!==removed);redraw();save()}});
function inkPage(i,H,r){const K=3,mk=(layer,z)=>{const c=document.createElement('canvas');c.width=794*K;c.height=PAGE_H*K;c.style.cssText=`position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:${z}`;const ctx=c.getContext('2d');ctx.scale(K,K);ctx.translate(0,-i*H);ctx.beginPath();ctx.rect(0,i*H,794,H);ctx.clip();ST.forEach(s=>{if(!!s.hl===layer)rs(ctx,s,r)});return c};return[mk(true,1),mk(false,1)]}

// ══════ INK → TEXT ("Type" tool) ══════
// Draw a word with the "Type (ink→text)" tool; after a short pause the strokes are recognised and
// replaced by typed text (in the chosen handwriting font) on the ruled line where you wrote.
let cvTmr=null,cvP=null,lastConv=null;
function unmatch(){if(T.tool==='hl')return;V.mi=false;const m=$('mi');if(m)m.checked=false}
function toast(msg,ms){let t=$('toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;left:50%;bottom:54px;transform:translateX(-50%);background:#272727;color:#e0e0e0;border:1px solid #444;border-radius:6px;padding:6px 14px;font-size:.85rem;z-index:99;pointer-events:none;transition:opacity .2s';document.body.appendChild(t)}
  t.textContent=msg;t.style.opacity=1;clearTimeout(t._h);if(ms)t._h=setTimeout(()=>{t.style.opacity=0},ms)}
function scheduleConvert(){clearTimeout(cvTmr);cvTmr=setTimeout(convertPending,(+val('cdl')||12)*100)}
function convertPending(){clearTimeout(cvTmr);if(cvP)return cvP;if(!ST.some(s=>s.cv&&!s.hl))return Promise.resolve();
  cvP=runConvert().finally(()=>{cvP=null});return cvP}

// Google Input Tools handwriting endpoint (needs internet)
async function recogniseInk(strokes,dx,dy,W,H){
  const inkData=strokes.map((s,k)=>{const xs=[],ys=[],ts=[];let t=k*400;
    s.pts.forEach(p=>{xs.push(Math.round((p[0]-dx)*10)/10);ys.push(Math.round((p[1]-dy)*10)/10);ts.push(t);t+=12});return[xs,ys,ts]});
  const res=await fetch('https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({options:'enable_pre_space',requests:[{writing_guide:{writing_area_width:W,writing_area_height:H},ink:inkData,language:'en'}]})});
  const d=await res.json();
  if(d[0]!=='SUCCESS')throw new Error('recognition '+d[0]);
  return (d[1][0][1][0]||'').trim()}

function placeText(k,txt,n,c){
  const S=c.lineSp,zk=zkE(),er=ed.getBoundingClientRect(),yMid=(k+.5)*S;
  const find=()=>{for(const ch of ed.children){const r=ch.getBoundingClientRect();if(yMid>=(r.top-er.top)/zk&&yMid<(r.bottom-er.top)/zk)return ch}return null};
  let t=find();
  if(!t){const l=ed.lastElementChild,have=l?Math.round((l.getBoundingClientRect().bottom-er.top)/zk/S):0;
    for(let i=have;i<=k;i++){const d=document.createElement('div');d.innerHTML='<br>';ed.appendChild(d)}t=find()||ed.lastElementChild}
  if(!t.textContent.replace(/\u200B/g,'').trim()&&!t.querySelector('img'))t.textContent=' '.repeat(n)+txt;
  else t.appendChild(document.createTextNode(' '+txt))}

async function runConvert(){
  const pend=ST.filter(s=>s.cv&&!s.hl);if(!pend.length)return;
  toast('Reading handwriting…');
  try{
    const c=cfg(),S=c.lineSp,zk=zkE(),er=ed.getBoundingClientRect(),ir=ink.getBoundingClientRect();
    const ox=(er.left-ir.left)/zk,oy=(er.top-ir.top)/zk,sp=measureSpace(FM[c.font]||FM.kalam,c.size);
    const lines=new Map();
    pend.forEach(s=>{const b=strokeBounds(s.pts),k=Math.max(0,Math.floor((b.y+b.h/2-oy)/S));if(!lines.has(k))lines.set(k,[]);lines.get(k).push(s)});
    const before=ed.innerHTML,done=[],failed=[];
    for(const k of [...lines.keys()].sort((a,b)=>a-b)){
      const grp=lines.get(k),b=strokeBounds(grp.flatMap(s=>s.pts)),dx=b.x-10,dy=oy+k*S-S*.3;
      const txt=await recogniseInk(grp,dx,dy,Math.ceil(b.w+20),Math.ceil(Math.max(S*1.6,b.y+b.h-dy+10)));
      if(!txt){failed.push(k+1);continue}
      const n=Math.round((b.x-ox)/sp);
      placeText(k,txt,n>=3?n:0,c);done.push(...grp)}
    if(done.length){lastConv={html:before,strokes:done.slice()};
      done.forEach(s=>{const i=ST.indexOf(s);if(i>-1)ST.splice(i,1)});selected=selected.filter(s=>!done.includes(s));redraw();save()}
    toast(failed.length?`Couldn't read line ${failed.join(', ')}`:'Converted ✓',2200);
  }catch(err){
    console.error(err);toast('Recognition failed — it needs an internet connection',4000)}}
function undoConvert(){if(!lastConv)return toast('Nothing to undo',1500);
  ed.innerHTML=lastConv.html;lastConv.strokes.forEach(s=>{s.cv=false});ST.push(...lastConv.strokes);lastConv=null;redraw();save()}

// ── humanise a clone of the document ──
function decoOf(n,root){let u=false,st=false,q=n.parentElement;while(q&&q!==root){const t=q.tagName,d=(q.style.textDecorationLine||q.style.textDecoration||'');if(t==='U'||t==='INS'||/underline/.test(d))u=true;if(t==='S'||t==='STRIKE'||t==='DEL'||/line-through/.test(d))st=true;q=q.parentElement}return{u,s:st}}
// Browsers do not draw an ancestor's text-decoration through inline-block words, and html2canvas
// draws it differently again. So decorated words are only TAGGED here (data-u / data-s + a zero-size
// baseline marker) and the lines are drawn afterwards by addDecoLines() as real elements.
function addDecoLines(wrap,S){const cont=wrap.querySelector('.hwc');if(!cont)return;
  const oz=wrap.style.zoom;wrap.style.zoom='1';
  const cr=cont.getBoundingClientRect(),zk=cr.width/cont.offsetWidth||1,words=[...cont.querySelectorAll('.ch')];
  const mk=(kind,run)=>{const y=run.ys.reduce((a,b)=>a+b,0)/run.ys.length,sz=run.size,th=Math.max(1.1,sz*.055),top=kind==='u'?y+Math.max(2,sz*.13):y-sz*.28;
    const d=document.createElement('div');d.className='dl';
    d.style.cssText=`position:absolute;pointer-events:none;left:${(run.l-1).toFixed(1)}px;top:${(top-th/2).toFixed(1)}px;width:${(run.r-run.l+2).toFixed(1)}px;height:${th.toFixed(2)}px;background:${run.color};border-radius:1px;transform-origin:0 50%;transform:rotate(${((Math.random()-.5)*.6).toFixed(2)}deg)`;
    cont.appendChild(d)};
  ['u','s'].forEach(kind=>{let run=null;const flush=()=>{if(run)mk(kind,run);run=null};
    words.forEach(w=>{const m=w.querySelector('.ulm');if(!w.hasAttribute('data-'+kind)||!m){flush();return}
      const wr=w.getBoundingClientRect(),by=(m.getBoundingClientRect().top-cr.top)/zk,L=(wr.left-cr.left)/zk,R=(wr.right-cr.left)/zk;
      if(run){const my=run.ys.reduce((a,b)=>a+b,0)/run.ys.length;if(Math.abs(by-my)>S*.6||L<run.r-8)flush()}
      if(!run){const cs=getComputedStyle(w);run={l:L,r:R,ys:[],size:parseFloat(cs.fontSize)||19,color:cs.color}}
      run.ys.push(by);run.r=Math.max(run.r,R)});flush()});
  wrap.style.zoom=oz}
function humanize(root,c){const f=FM[c.font]||FM.kalam,sw=measureSpace(f,c.size),dMax=[0,2,4,7][c.drift],vA=[0,.08,.18,.3][c.indentVar],rnd=()=>Math.random()*2-1;let pd=0;
  [...root.children].forEach(b=>{if(/^(UL|OL|IMG|HR)$/.test(b.tagName)||b.classList.contains('pbk'))return;pd=Math.abs(pd*.5+rnd()*dMax);let px=0;
    const t=document.createTreeWalker(b,NodeFilter.SHOW_TEXT).nextNode();
    if(t){const m=t.nodeValue.match(/^ +/);if(m){const n=m[0].length,u=sw*c.indentW;px=(n%4)*u;for(let i=0;i<(n>>2);i++)px+=4*u*(1+rnd()*vA);t.nodeValue=t.nodeValue.slice(n)}}
    if(pd)b.style.transform=`translateX(${pd.toFixed(1)}px)`;   /* visual shift only: never changes line wrapping */
    if(px){const sp=document.createElement('span');sp.style.cssText=`display:inline-block;width:${px.toFixed(1)}px`;b.insertBefore(sp,b.firstChild)}});
  const ns=[],w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(w.nextNode())ns.push(w.currentNode);
  const dec=new Map(ns.map(n=>[n,decoOf(n,root)]));
  ns.forEach(n=>{n.nodeValue=n.nodeValue.replace(/\u200B/g,'');if(!n.nodeValue)return;let q=n.parentElement,own=false;while(q&&q!==root){if(q.style.color||q.getAttribute('color')){own=true;break}q=q.parentElement}
    const fr=document.createDocumentFragment(),deco=dec.get(n)||{};
    (n.nodeValue.match(/\s+|\S+/g)||[]).forEach(tk=>{if(/^\s/.test(tk)){fr.appendChild(document.createTextNode(tk));return}
      const{s,c:col}=cStyle(c.wobble,c.charVar,c.slant,c.ink,0),sp=document.createElement('span');sp.className='ch';sp.style.cssText=s.replace(/rotate\(([-\d.]+)deg\)/,(m,a)=>`skewX(${(-a).toFixed(1)}deg)`)+(own?'':`color:${col}`);
      if(c.typo&&/^[a-z]{3,}$/i.test(tk)){const i=Math.floor(Math.random()*tk.length);tk=tk.slice(0,i)+typo(tk[i],c.typo)+tk.slice(i+1)}
      sp.textContent=tk;if(deco.u||deco.s){if(deco.u)sp.setAttribute('data-u','1');if(deco.s)sp.setAttribute('data-s','1');const mk=document.createElement('i');mk.className='ulm';mk.style.cssText='display:inline-block;width:0;height:0';sp.appendChild(mk)}fr.appendChild(sp)});n.replaceWith(fr)});
  root.querySelectorAll('u,ins,s,strike,del,[style*="text-decoration"]').forEach(e=>{e.style.textDecoration='none'})}

function buildPage(html,c,i,H){const font=FM[c.font]||FM.kalam,S=c.lineSp,wrap=document.createElement('div'),pg=document.createElement('div');
  wrap.className='pw pvp';pg.className='pg';pg.style.paddingLeft=(104+c.marginX)+'px';pg.style.paddingRight=(58+c.rm)+'px';
  const pb=paperBg(c.paper,c.lineCol,c.margin,S,PAGE_TOP+measureBaseline(font,c.size,S)+2+c.lineOff);pg.style.backgroundColor=pb.bg;
  const box=document.createElement('div');box.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';
  const mk=css=>{const d=document.createElement('div');d.style.cssText='position:absolute;background:'+c.lineCol+';'+css;box.appendChild(d)};
  if(pb.rules)for(let y=pb.rules.first;y<PAGE_H;y+=S)mk(`left:0;right:0;top:${y}px;height:1px`);
  if(pb.grid){for(let y=31;y<PAGE_H;y+=32)mk(`left:0;right:0;top:${y}px;height:1px`);for(let x=31;x<794;x+=32)mk(`top:0;bottom:0;left:${x}px;width:1px`)}
  pg.appendChild(box);
  if(pb.margin){const m=document.createElement('div');m.style.cssText=`position:absolute;left:${82+c.marginX}px;width:2px;top:0;bottom:0;background:rgba(210,70,70,.5);z-index:1`;pg.appendChild(m)}
  const[h,x]=inkPage(i,H,+val('dr'));pg.appendChild(h);
  // Keep the page window anchored at the page's text origin. A negative top
  // margin on the content can collapse through this wrapper, moving the page
  // window itself and making later preview pages appear blank. Translate only
  // the content, then clip it to the fixed page window.
  const win=document.createElement('div');win.className='text-window';win.style.cssText=`position:relative;z-index:2;height:${H}px;display:flow-root`;
  // Use a real overflow clip instead of clip-path: PDF rasterizers often
  // mis-handle clip-path on transformed text and repeat/cut glyphs at seams.
  const clip=document.createElement('div');clip.className='text-clip';clip.style.cssText=`position:absolute;left:-40px;right:-40px;top:-3px;height:${H+6}px;overflow:hidden`;
  const cont=document.createElement('div');cont.className='hwc';cont.style.cssText=`width:calc(100% - 80px);position:relative;font-family:${font};font-size:${c.size}px;line-height:${S}px;letter-spacing:${c.charSpace}px;word-spacing:${c.wordSpace}px;color:${c.ink};transform:translate(40px,${3-i*H}px)`;cont.innerHTML=html;clip.appendChild(cont);win.appendChild(clip);pg.appendChild(win);
  const pn=document.createElement('div');pn.className='pn';pn.style.cssText=`font-family:${font};color:${c.ink}`;pn.textContent=i+1;pg.appendChild(pn);pg.appendChild(x);
  const cv=document.createElement('canvas');cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:10';pg.appendChild(cv);wrap.appendChild(pg);
  const o={scanStyle:c.scan,shadow:c.shadow,curl:c.curl,grain:c.grain,fold:c.fold,foldPat:c.foldPat,foldSoft:c.foldSoft,foldCPct:c.foldCPct,foldCHPct:c.foldCHPct,flash:c.flash,flashPos:c.flashPos,flashInt:c.flashInt};
  setTimeout(()=>{cv.width=pg.offsetWidth;cv.height=pg.offsetHeight;drawFX(cv,o,i)},55);return wrap}

function needPages(){const c=cfg(),H=Math.floor(PAGE_USABLE/c.lineSp)*c.lineSp,maxY=ST.reduce((m,s)=>Math.max(m,...s.pts.map(p=>p[1])),0),l=ed.lastElementChild,ch=l?(l.getBoundingClientRect().bottom-ed.getBoundingClientRect().top)/zkE():0;return Math.max(1,Math.ceil(ch/H),Math.ceil((maxY-PAGE_TOP)/H))}
async function gen(){await convertPending();const c=cfg();await ensureFont(c.font,c.size);applyEdit();
  const root=ed.cloneNode(true);humanize(root,c);const H=Math.floor(PAGE_USABLE/c.lineSp)*c.lineSp;
  const np=Math.max(pages,needPages());
  qa('.pvp').forEach(x=>x.remove());for(let i=0;i<np;i++)prev.appendChild(buildPage(root.innerHTML,c,i,H));
  qa('.pvp').forEach(w=>addDecoLines(w,c.lineSp))}
function setView(v){view=v;$('ew').classList.toggle('off',v==='pv');$('bEd').classList.toggle('on',v==='ed');$('bPv').classList.toggle('on',v==='pv');qa('.pvp').forEach(x=>x.remove());if(v==='pv'){setTool('type');gen()}}
let Z=100;
function setZoom(v){Z=Math.max(50,Math.min(250,Math.round(v)));prev.style.setProperty('--z',Z/100);$('zm').value=Z;$('zv').textContent=Z+'%';fitInk()}
$('zm').oninput=e=>setZoom(+e.target.value);$('zo').onclick=()=>setZoom(Z-10);$('zi').onclick=()=>setZoom(Z+10);$('zr').onclick=()=>setZoom(100);
prev.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();setZoom(Z-Math.sign(e.deltaY)*10)}},{passive:false});
async function exportPDF(){const z=Z;setZoom(100);try{await gen();await new Promise(r=>setTimeout(r,200));await safePrint()}finally{setZoom(z);if(view!=='pv')qa('.pvp').forEach(x=>x.remove())}}

// ── autosave ──
function save(){try{localStorage.setItem('hw3',JSON.stringify({h:ed.innerHTML,ST,V,pages}))}catch(e){}}
// Start each app load with a fresh document. Autosave still supports recovery
// during the current session, but a previous session is never restored.
try{localStorage.removeItem('hw3')}catch(e){}
if(!ed.innerHTML.trim())ed.innerHTML='<div><br></div>';
if(V.fs&&!FM[V.fs])V.fs='kalam';
$('bEd').onclick=()=>setView('ed');$('bPv').onclick=()=>setView('pv');$('bPdf').onclick=exportPDF;
if(document.fonts&&document.fonts.load){document.fonts.load("19px 'AhmedHandwriting'").catch(()=>{})}
showTab('home');applyEdit();redraw();
