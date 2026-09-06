/* Spin-off Ledger — standalone.
   Working store is localStorage; the durable copy is a file you download.
   Shipped rows merge in by id, so new spin-offs appear without touching your notes. */
(function(){
"use strict";

var KEY="spinoff-ledger.v1", SEED=JSON.parse(document.getElementById("seed").textContent);
var app=document.getElementById("app");
var DATA=[], view="list", page=null, filter="upcoming", saveTimer=null;
var api=null, pristine=null, dl=null;   // set when running as a claude.ai artifact

/* ---------- storage ---------- */
function load(){
  var stored=null;
  try{ stored=JSON.parse(localStorage.getItem(KEY)||"null"); }catch(e){}
  if(!stored||!stored.rows){ DATA=SEED.slice(); return persist(true); }
  DATA=stored.rows;
  // rows shipped in a later build that this store has never seen
  var have={}; DATA.forEach(function(r){have[r.id]=1;});
  var added=SEED.filter(function(r){return !have[r.id];});
  if(added.length){ DATA=added.concat(DATA); persist(true); }
  stamp(stored.at,stored.device);
}
function persist(quiet){
  var payload={rows:DATA,at:Date.now(),device:navigator.platform||"this device"};
  // localStorage always — it is the working store, and the fallback when hosted elsewhere
  try{ localStorage.setItem(KEY,JSON.stringify(payload)); }
  catch(e){ document.getElementById("savedchip").textContent="COULD NOT SAVE"; }
  if(!quiet) stamp(payload.at,payload.device);
  // on claude.ai the durable copy is a new version of the page itself
  if(api&&pristine){
    var next=pristine.replace(/(<script type="application\/json" id="seed">)[\s\S]*?(<\/script>)/,
      function(_,a,z){ return a+JSON.stringify(DATA)+z; });
    api.publish(next).catch(function(err){
      if(err&&err.code==="conflict") return;
      if(err&&(err.code==="not_writer"||err.code==="not_granted")) api=null;
    });
  }
}
function touch(){ clearTimeout(saveTimer); saveTimer=setTimeout(function(){persist();},600); }
function stamp(at,device){
  if(!at) return;
  var d=new Date(at), p=function(n){return (n<10?"0":"")+n;};
  document.getElementById("savedchip").textContent="Saved "+p(d.getHours())+":"+p(d.getMinutes());
}

/* ---------- helpers ---------- */
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function byId(id){for(var i=0;i<DATA.length;i++) if(DATA[i].id===id) return DATA[i]; return null;}
function fmt(d){ if(!d) return ""; var p=String(d).split("-"); if(p.length!==3) return d;
  return p[2]+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+p[1]-1]+" "+p[0]; }
function label(list,v){for(var i=0;i<list.length;i++) if(list[i][0]===v) return list[i][1]; return "—";}

var STATUS=[["announced","Announced"],["trading","Trading"],["closed","Closed"],["passed","Passed"]];
var CATALYST=[["","—"],["yes","Identified"],["none","None found"],["unclear","Unclear"]];
var SETUP=[["","—"],["stub","Demerger arbitrage / stub"],["cheap","Cheap absolute + relative"],
           ["forced","Indiscriminate selling"],["divi","Dividend as catalyst"]];
var VERDICT=[["","—"],["watch","Watch"],["dig","Dig in"],["hold","Holding"],["discard","Discard"]];
var FACT_KEYS=["facts","why","ra","rb","flags","econ","bs","rc","tax","cat","timing","dur","val"];
function done(r){var n=0;FACT_KEYS.forEach(function(k){if((r[k]||"").trim())n++;});return n;}

var SECTIONS=[
 {k:"facts",n:"1 · The transaction",src:"Information Statement → The Separation and Distribution",
  p:["Structure — full spin, partial spin, split-off, or carve-out IPO then distribution",
     "Distribution ratio, and <b>size of spinco relative to parent</b> — the best proxy for indiscriminate selling",
     "If partial: percentage retained, and whether it is <b>distributed to holders</b> or sold by IPO (distribution is better)",
     "Share classes and votes; who holds the super-voting stock",
     "Exchange and expected ticker",
     "Record date, distribution date, when-issued window, first regular-way trade"]},
 {k:"why",n:"2 · Why the parent is doing it",src:"Reasons for the Separation, plus the parent's press release and 8-K",
  p:["The stated reason, in the company's words",
     "The likely real reason — is the parent positioning for sale, and the acquirer doesn't want this piece?",
     "Is the spinco the good half or the bad half?",
     "Has the parent tried to sell this business before?",
     "How promoted is the deal? An under-promoted spin is often a signal, not bad news"]},
 {k:"ra",crit:"a",n:"3 · Will institutions be forced to sell",src:"Criterion (a) — if this is empty, stop",
  p:["Index eligibility — if it doesn't qualify for the parent's indices, index funds must sell at any price",
     "Market cap band — below institutional minimums?",
     "Mandate mismatches: sector, geography, dual class, controlled company, emerging growth company",
     "Analyst coverage expected at listing",
     "Does it pay a dividend? Income funds holding the parent sell a non-payer mechanically",
     "Is the leverage or business model unpalatable to the parent's holder base? (the Marriott case)"]},
 {k:"rb",crit:"b",n:"4 · Do insiders want it",src:"Management · Executive Compensation · Security Ownership",
  p:["<b>When is the option strike set</b> — first day, week, or month? Highest-signal item in the filing: before it is set management benefits from a weak open, after it they want the price up",
     "Size of the equity grant relative to salary",
     "Insider ownership percentage; any controlling family",
     "Which executives moved from parent to spinco — good people follow value",
     "Insider open-market buying after listing (Form 4s)"]},
 {k:"flags",n:"5 · Red flags — is this toxic waste?",src:"Run early. Fastest disqualifier.",
  p:["Is the parent dumping debt into the spinco? Compare spinco leverage to the parent's post-separation leverage",
     "Is a cash dividend being paid up to the parent out of new spinco borrowings?",
     "Pension deficits, environmental liabilities, litigation or indemnities assigned to the spinco",
     "Secular decline — is the parent offloading a melting ice cube?",
     "Customer concentration — does the spinco depend on the parent for revenue post-separation?"]},
 {k:"econ",n:"6 · Standalone economics",src:"Unaudited Pro Forma Financial Information; TSA in related-party transactions",
  p:["Revenue, EBITDA, FCF as presented",
     "<b>Then adjust — pro formas understate standalone cost.</b>",
     "TSA scope, term, price, and what it costs to replace",
     "Stranded corporate overhead",
     "Dis-synergies — lost purchasing scale, lost cross-selling",
     "New public-company costs: board, audit, D&amp;O, IR, SOX",
     "Maintenance capex vs depreciation, normalised",
     "Historic segment data from the parent's old 10-Ks — often cleaner than the pro formas"]},
 {k:"bs",n:"7 · Balance sheet and survival",src:"Capitalization and the debt footnotes",
  p:["Net debt at separation",
     "Maturity schedule — can it refinance its first wall on a <b>standalone</b> credit rating, usually worse than the parent's?",
     "Interest coverage on adjusted EBITDA",
     "Revolver size and covenants",
     "NOLs — size, do they travel with the spinco, and are they limited by §382 on the change of control"]},
 {k:"rc",crit:"c",n:"8 · Is hidden value uncovered",src:"Criterion (c)",
  p:["Sum-of-the-parts — price the pieces separately against the combined quote",
     "Was the good business masked by the bad one in consolidated numbers?",
     "Valuation-convention mismatch — heavy D&amp;A depressing EPS in a business the market should value on cash flow",
     "Private-market comparables — recent transactions for assets like this",
     "If leveraged, is the equity effectively a call option? (the Marriott structure)",
     "If unprofitable: assets, revenue multiple, or replacement cost"]},
 {k:"tax",n:"9 · Structure, tax, legal",src:"Material U.S. Federal Income Tax Consequences · Description of Capital Stock",
  p:["Is the distribution tax-free under §355? A taxable spin changes holder behaviour and the selling pattern",
     "§355(e) two-year restrictions limit post-spin M&amp;A — delays the most common catalyst",
     "Anti-takeover provisions: poison pill, staggered board",
     "Non-compete and IP arrangements with the parent"]},
 {k:"cat",n:"10 · Catalyst — what closes the gap",src:"Dividend Policy section of the Form 10; the credit agreement; §355(e)",
  p:["<b>Dividend policy</b> — stated intent, <i>and</i> whether the credit agreement permits it (a restricted-payments covenant blocks it regardless of intent)",
     "Buyback authorisation",
     "<b>Index inclusion</b> — forced <i>buying</i>; the mirror of section 3",
     "Analyst initiation",
     "A stated deleveraging target or margin programme",
     "Expiry of the §355(e) two-year window — when M&amp;A becomes possible",
     "Management incentive vesting dates",
     "First standalone earnings as the prove-it moment",
     "Insider open-market buying",
     "<b>“No identified catalyst” is a valid answer</b> — and an important one. Cheap with no catalyst is a permanent discount, not a trade"]},
 {k:"timing",n:"11 · Timing and mechanics",src:"",
  p:["Record date and distribution date",
     "When-issued trading window",
     "First index rebalance after listing — when the mechanical selling clears",
     "First standalone earnings report",
     "Option-strike setting date, if there are new grants (section 4)"]},
 {k:"dur",n:"12 · Revenue durability",src:"Information Statement → Business and Customers, plus the commercial agreements filed as exhibits",
  p:["<b>Contracted, recurring, or transactional?</b> Contracted volume turns a thin margin into a good business — a sole-source OEM locked onto a platform for the model cycle. Transactional revenue carrying leverage is a different animal",
     "Backlog, order book, subscription or service revenue as a percentage of the total",
     "Customer concentration — top ten as a share of revenue, and anyone above 10% on their own",
     "<b>Revenue contractually tied to the former parent, and when it expires</b> — this is the spin-off-specific one. It is a moat with a cliff edge",
     "Term and termination rights on supply and distribution agreements, and whether exclusivity runs in your favour or against you",
     "What actually drives demand: build cycles, replacement and retrofit, regulation, code mandates",
     "Switching costs — what would it cost this customer to buy somewhere else tomorrow?",
     "Pricing power: has it passed cost inflation through, and does gross margin show it?"]},
 {k:"val",n:"13 · Valuation scaffolding",src:"Your arithmetic, with every assumption stated. No target price here — that belongs in section 14.",
  p:["Owner earnings: pre-tax income + depreciation and amortisation + impairments − maintenance capex, taxed at 25%",
     "Maintenance capex = MIN(average capex, average depreciation × 0.9). Name the years used",
     "<b>Flag every add-back that is contested, and show the number both ways.</b> Acquired intangible amortisation is the usual one — if growth was bought and must keep being bought, it is a real cost",
     "EV bridge: market cap + debt + preferred at liquidation value − cash",
     "Tangible book: equity − goodwill − intangibles − preferred",
     "Graham NCAV: current assets − <i>total</i> liabilities. A negative number is an answer, not a failure",
     "Liquidation with haircuts: receivables ~80%, inventory ~50–60%, PP&amp;E ~30%",
     "Operating cash flow against interest expense, across every year available",
     "<b>What would have to be true</b> for today's price to be right — not what you think it is worth"]}
];

/* ---------- list ---------- */
function renderList(){
  var up=0,comp=0,researched=0;
  DATA.forEach(function(r){
    if(r.status==="announced") up++; else comp++;
    // a single auto-filled note isn't research; require real work
    if(done(r)>=3||r.verdict||r.catalyst) researched++;
  });
  var rows=DATA.filter(function(r){
    return filter==="all"?true:filter==="upcoming"?r.status==="announced":r.status!=="announced"; });

  var body=rows.map(function(r){
    var dots='<span class="score">'+["a","b","c"].map(function(k){
      var v=r[k]||""; return '<span class="sdot '+(v==="y"?"y":v==="n"?"n":"")+'">'+k+'</span>';}).join("")+'</span>';
    return '<tr>'+
      '<td class="nm">'+esc(r.name)+'</td>'+
      '<td class="mono">'+(esc(r.tick)||'<span class="dash">—</span>')+'</td>'+
      '<td class="par">'+(esc(r.parent)||'<span class="dash">—</span>')+'</td>'+
      '<td class="mono">'+(esc(r.ptick)||'<span class="dash">—</span>')+'</td>'+
      '<td class="mono">'+(fmt(r.ann)||'<span class="dash">—</span>')+'</td>'+
      '<td class="mono">'+(fmt(r.first)||'<span class="dash">—</span>')+'</td>'+
      '<td><span class="chip '+esc(r.status)+'">'+label(STATUS,r.status)+'</span></td>'+
      '<td>'+(r.catalyst?'<span class="chip '+esc(r.catalyst)+'">'+label(CATALYST,r.catalyst)+'</span>':'<span class="dash">—</span>')+'</td>'+
      '<td>'+dots+'</td>'+
      '<td><a class="open" data-go="'+esc(r.id)+'" href="#">'+
        (done(r)?'Research <span class="n">'+done(r)+'/'+FACT_KEYS.length+'</span>':'Research <span class="n">+</span>')+'</a></td></tr>';
  }).join("");

  app.className="wrap";
  app.innerHTML=
    '<p class="eyebrow">The ledger</p>'+
    '<h2>Registered spin-offs</h2>'+
    '<p class="sub">Every US spin-off registered on Form 10-12B since 2023, plus the announced pipeline. Open a row to research it.</p>'+
    '<div class="stats">'+
      '<div class="stat"><b>'+up+'</b><span>Upcoming</span></div>'+
      '<div class="stat"><b>'+comp+'</b><span>Completed</span></div>'+
      '<div class="stat"><b>'+researched+'</b><span>Researched</span></div></div>'+
    '<div class="bar"><div class="tabs" role="tablist" id="tabs">'+
      ["upcoming","completed","all"].map(function(f){
        return '<button class="tab" role="tab" data-f="'+f+'" aria-selected="'+(filter===f)+'">'+
          f.charAt(0).toUpperCase()+f.slice(1)+'</button>';}).join("")+
    '</div><div class="actions">'+
      '<button class="btn" id="import">Import a report</button>'+
      '<button class="btn" id="add">Add spin-off</button></div></div>'+
    '<div class="tablewrap"><table><thead><tr>'+
      '<th>Spin-off</th><th>Ticker</th><th>Parent</th><th>Parent ticker</th><th>Announced</th>'+
      '<th>First trade</th><th>Status</th><th>Catalyst</th><th>a·b·c</th><th>Deep dive</th>'+
    '</tr></thead><tbody>'+(body||'<tr><td colspan="10" class="empty">Nothing here.</td></tr>')+'</tbody></table></div>'+
    '<p class="note">Scoring follows Greenblatt: <b>a</b> institutions don\'t want it, for reasons unrelated to merit · <b>b</b> insiders do want it · <b>c</b> a hidden opportunity is uncovered.</p>';

  document.getElementById("tabs").addEventListener("click",function(e){
    var t=e.target.closest(".tab"); if(!t) return; filter=t.dataset.f; renderList(); });
  document.getElementById("add").addEventListener("click",function(){
    var id="new-"+Date.now().toString(36); var row={id:id,name:"New spin-off",tick:"",parent:"",ptick:"",
      ann:"",first:"",status:"announced",a:"",b:"",c:"",url:"",sources:{}};
    FACT_KEYS.concat(["catalyst","setup","verdict","buy","sell","wrong","report"]).forEach(function(k){row[k]="";});
    DATA.unshift(row); touch(); go(id); });
  document.getElementById("import").addEventListener("click",openImport);
}

/* ---------- research ---------- */
function sources(r,k){
  var list=(r.sources&&r.sources[k])||[];
  if(!list.length) return "";
  return '<ul class="srcs"><span class="lbl">Sources</span>'+list.map(function(x){
    return '<li><q>'+esc(x.q)+'</q>'+(x.url?'<a href="'+esc(x.url)+'" target="_blank" rel="noopener">Open →</a>':'')+'</li>';
  }).join("")+'</ul>';
}
function renderResearch(id){
  var r=byId(id); if(!r){ go(""); return; }
  var sel=function(k,list){return '<select data-id="'+esc(r.id)+'" data-k="'+k+'">'+list.map(function(o){
    return '<option value="'+o[0]+'"'+(r[k]===o[0]?" selected":"")+'>'+o[1]+'</option>';}).join("")+'</select>';};

  var blocks=SECTIONS.map(function(sec,i){
    var filled=!!(r[sec.k]||"").trim();
    var cs=sec.crit?'<div class="crit"><label class="fl" style="margin:0 9px 0 0;align-self:center">('+sec.crit+')</label>'+
      '<select data-id="'+esc(r.id)+'" data-k="'+sec.crit+'">'+["","y","n"].map(function(v){
        return '<option value="'+v+'"'+((r[sec.crit]||"")===v?" selected":"")+'>'+(v===""?"—":v==="y"?"Yes":"No")+'</option>';
      }).join("")+'</select></div>':'';
    return '<details class="blk'+(filled?' done':'')+'"'+(i===0?' open':'')+'>'+
      '<summary><span class="car">▶</span>'+sec.n+'<span class="fill"></span></summary><div class="blkbody">'+
      (sec.src?'<p class="why">'+sec.src+'</p>':'')+
      '<ul class="prompts"><li>'+sec.p.join('</li><li>')+'</li></ul>'+cs+
      '<textarea data-id="'+esc(r.id)+'" data-k="'+sec.k+'" placeholder="Facts found, with where they came from.">'+esc(r[sec.k])+'</textarea>'+
      sources(r,sec.k)+'</div></details>';
  }).join("");

  app.className="wrap narrow";
  app.innerHTML=
    '<a class="back" data-go="" href="#">← All spin-offs</a>'+
    '<div class="rhead"><h2>'+esc(r.name)+'</h2><div class="meta">'+
      '<div><span>Ticker</span><b>'+(esc(r.tick)||"—")+'</b></div>'+
      '<div><span>Parent</span><b>'+(esc(r.parent)||"—")+(r.ptick?" ("+esc(r.ptick)+")":"")+'</b></div>'+
      '<div><span>Announced</span><b>'+(fmt(r.ann)||"—")+'</b></div>'+
      '<div><span>First trade</span><b>'+(fmt(r.first)||"—")+'</b></div></div></div>'+
    '<p class="convention">Sections 1–13 hold <b>facts and where they came from</b>. The judgement calls — the (a)/(b)/(c) verdicts, the setup, the buy price and the conclusion — are section 14.</p>'+
    (r.url?'<p style="margin:0 0 20px"><a class="filing" href="'+esc(r.url)+'" target="_blank" rel="noopener">Open the Form 10 on EDGAR →</a></p>':'')+
    blocks+
    '<section class="blk" style="margin-top:32px"><h3>14 · Classify and conclude</h3>'+
      '<p class="why">Yours, not the report\'s. Write the buy price before it trades, so a quoted price can\'t anchor you.</p>'+
      '<div class="grid2" style="margin-bottom:15px">'+
        '<div><label class="fl">Catalyst</label>'+sel("catalyst",CATALYST)+'</div>'+
        '<div><label class="fl">Which setup</label>'+sel("setup",SETUP)+'</div>'+
        '<div><label class="fl">Verdict</label>'+sel("verdict",VERDICT)+'</div>'+
        '<div><label class="fl">Buy below</label><input data-id="'+esc(r.id)+'" data-k="buy" value="'+esc(r.buy)+'" inputmode="decimal"></div>'+
      '</div><label class="fl">What would tell me I\'m wrong</label>'+
      '<textarea data-id="'+esc(r.id)+'" data-k="wrong">'+esc(r.wrong)+'</textarea></section>'+
    '<section class="blk"><h3>Working notes</h3>'+
      '<textarea class="tall" data-id="'+esc(r.id)+'" data-k="report">'+esc(r.report)+'</textarea></section>'+
    '<section class="blk"><h3>Record</h3><div class="grid2">'+
      '<div><label class="fl">Spin-off</label><input data-id="'+esc(r.id)+'" data-k="name" value="'+esc(r.name)+'"></div>'+
      '<div><label class="fl">Ticker</label><input data-id="'+esc(r.id)+'" data-k="tick" value="'+esc(r.tick)+'"></div>'+
      '<div><label class="fl">Parent</label><input data-id="'+esc(r.id)+'" data-k="parent" value="'+esc(r.parent)+'"></div>'+
      '<div><label class="fl">Parent ticker</label><input data-id="'+esc(r.id)+'" data-k="ptick" value="'+esc(r.ptick)+'"></div>'+
      '<div><label class="fl">Announced</label><input type="date" data-id="'+esc(r.id)+'" data-k="ann" value="'+esc(r.ann)+'"></div>'+
      '<div><label class="fl">First trade</label><input type="date" data-id="'+esc(r.id)+'" data-k="first" value="'+esc(r.first)+'"></div>'+
      '<div><label class="fl">Status</label>'+sel("status",STATUS)+'</div>'+
      '<div><label class="fl">Filing URL</label><input data-id="'+esc(r.id)+'" data-k="url" value="'+esc(r.url)+'"></div>'+
    '</div><p style="margin-top:18px"><button class="link" id="del">Remove this spin-off from the ledger</button></p></section>';

  document.getElementById("del").addEventListener("click",function(){
    if(!confirm('Remove "'+(r.name||"this row")+'" from the ledger? Download a backup first if you are unsure.')) return;
    DATA.splice(DATA.indexOf(r),1); persist(); go(""); });
}

/* ---------- data / backup ---------- */
function renderData(){
  app.className="wrap narrow";
  app.innerHTML=
    '<p class="eyebrow">Data</p><h2>Backup &amp; transfer</h2>'+
    '<div class="panel" style="margin-top:24px"><p><b>Local storage is not a backup.</b> Clearing site data or losing this Mac loses the ledger. '+
      'Download a copy after any real research session — the file is plain JSON and opens in anything.</p>'+
      '<div class="row"><button class="btn solid" id="dl">Download a backup</button>'+
      '<button class="btn" id="rest">Restore from a backup…</button></div></div>'+
    '<div class="panel"><p><b>Move it to another device.</b> There is no account and no server, so devices do not sync on their own — '+
      'you hand the ledger over as a file. Download here, open the app on the other device, and restore.</p>'+
      '<p id="lastline"></p></div>'+
    '<div class="panel"><p><b>Import a report.</b> Paste the JSON block from a research session. Nothing changes until you press Merge, '+
      'and it tells you which rows it is about to touch.</p><div class="row"><button class="btn" id="import2">Import a report</button></div></div>'+
    '<div class="panel"><p><b>Rows:</b> '+DATA.length+' · <b>researched:</b> '+
      DATA.filter(function(r){return done(r)>=3||r.verdict||r.catalyst;}).length+'</p></div>';

  var s=null; try{ s=JSON.parse(localStorage.getItem(KEY)||"null"); }catch(e){}
  if(s&&s.at){ var d=new Date(s.at);
    document.getElementById("lastline").innerHTML='Last changed <b>'+d.toLocaleString()+'</b> on '+esc(s.device||"this device")+'.'; }

  document.getElementById("dl").addEventListener("click",download);
  document.getElementById("rest").addEventListener("click",restore);
  document.getElementById("import2").addEventListener("click",openImport);
}
function download(){
  var name="spinoff-ledger-"+new Date().toISOString().slice(0,10)+".json";
  var text=JSON.stringify({rows:DATA,at:Date.now(),app:"spinoff-ledger.v1"},null,1);
  // Inside the artifact viewer a blob link is inert — the host mediates saving.
  if(dl){ dl.save({filename:name,data:text}).catch(function(){}); return; }
  var a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([text],{type:"application/json"})); a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
}
function restore(){
  var inp=document.createElement("input"); inp.type="file"; inp.accept="application/json,.json";
  inp.addEventListener("change",function(){
    var f=inp.files&&inp.files[0]; if(!f) return;
    var fr=new FileReader();
    fr.onload=function(){
      var o; try{ o=JSON.parse(fr.result); }catch(e){ alert("That file isn't valid JSON."); return; }
      var rows=o&&o.rows; if(!Array.isArray(rows)){ alert("That doesn't look like a ledger backup."); return; }
      var older = o.at && o.at < (JSON.parse(localStorage.getItem(KEY)||"{}").at||0);
      var msg="Replace the ledger with this file? "+rows.length+" rows."+
        (older?"\n\nWARNING: this file is OLDER than what is here now.":"");
      if(!confirm(msg)) return;
      DATA=rows; persist(); go(""); };
    fr.readAsText(f); });
  inp.click();
}

/* ---------- import a report ---------- */
var FIELDS=FACT_KEYS.concat(["catalyst","setup","verdict","buy","sell","wrong","report",
  "name","tick","parent","ptick","ann","first","status","url","sources"]);
function openImport(){
  var d=document.createElement("div"); d.className="modal";
  d.innerHTML='<div class="box"><h3>Import a report</h3>'+
    '<p class="why">Paste the JSON block. Nothing changes until you press Merge.</p>'+
    '<textarea id="impt" placeholder=\'{"id": "mfp", "facts": "…"}\'></textarea>'+
    '<div class="prev" id="impp" hidden></div>'+
    '<div class="row"><button class="btn" id="impx">Cancel</button>'+
    '<button class="btn solid" id="impm">Merge</button></div></div>';
  document.body.appendChild(d);
  var ta=d.querySelector("#impt"), pv=d.querySelector("#impp");
  function close(){ d.remove(); }
  d.addEventListener("click",function(e){ if(e.target===d) close(); });
  d.querySelector("#impx").addEventListener("click",close);
  ta.addEventListener("input",function(){
    var o; try{ o=JSON.parse(ta.value); }catch(e){ pv.hidden=true; return; }
    var arr=Array.isArray(o)?o:[o];
    pv.innerHTML=arr.map(function(x){
      var r=x.id&&byId(x.id);
      if(!r) return "<b>"+esc(x.id||"(no id)")+"</b> — no such row, will be skipped";
      var ks=FIELDS.filter(function(k){return x[k]!==undefined;});
      return "<b>"+esc(r.name)+"</b> — updating: "+(ks.join(", ")||"nothing");
    }).join("<br>"); pv.hidden=false; });
  d.querySelector("#impm").addEventListener("click",function(){
    var o; try{ o=JSON.parse(ta.value); }catch(e){ alert("That isn't valid JSON."); return; }
    var arr=Array.isArray(o)?o:[o], n=0;
    arr.forEach(function(x){
      var r=x.id&&byId(x.id); if(!r) return;
      FIELDS.forEach(function(k){
        if(x[k]===undefined) return;
        if(k==="sources"){ r.sources=r.sources||{};
          Object.keys(x.sources).forEach(function(sk){ r.sources[sk]=x.sources[sk]; }); }
        else r[k]=x[k]; });
      n++; });
    close(); persist(); route();
    if(!n) alert("Nothing matched an existing row."); });
  ta.focus();
}

/* ---------- routing ---------- */
function go(id){ page=id||null; view=page?"research":"list"; route(); }
function route(){
  document.querySelectorAll("nav button").forEach(function(b){
    b.classList.toggle("on", b.dataset.nav===(view==="data"?"data":"list")); });
  if(view==="data") renderData();
  else if(view==="research"&&page) renderResearch(page);
  else renderList();
  window.scrollTo(0,0);
}
document.addEventListener("click",function(e){
  var a=e.target.closest("[data-go]");
  if(a){ e.preventDefault(); go(a.getAttribute("data-go")); return; }
  var n=e.target.closest("nav button");
  if(n){ view=n.dataset.nav; page=null; route(); }
});
app.addEventListener("input",function(e){
  var el=e.target, id=el.dataset&&el.dataset.id; if(!id) return;
  var r=byId(id); if(!r) return; r[el.dataset.k]=el.value; touch(); });
app.addEventListener("change",function(e){
  var el=e.target, id=el.dataset&&el.dataset.id; if(!id) return;
  var r=byId(id); if(!r) return; r[el.dataset.k]=el.value; persist(); });
window.addEventListener("beforeunload",function(){ if(saveTimer){ clearTimeout(saveTimer); persist(true);} });

load(); route();

// If this is running as a claude.ai artifact, save server-side as well as locally.
if(window.claude&&claude.use){
  fetch(location.href,{cache:"no-store"}).then(function(r){return r.text();})
    .then(function(t){ if(/id="seed"/.test(t)) pristine=t; }).catch(function(){});
  claude.use("artifact").then(function(a){ api=a||null; });
  claude.use("downloads").then(function(d){ dl=d||null; });
}
})();
