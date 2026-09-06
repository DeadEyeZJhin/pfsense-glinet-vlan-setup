/* ============================================================
   1. DIAGRAM ENGINE — data in, SVG out
   ============================================================ */
const TONE = {
  core :{fill:'var(--node)',   stroke:'var(--accent)',   text:'var(--text)'},
  isp  :{fill:'var(--node)',   stroke:'var(--accent-2)', text:'var(--text)'},
  vlan :{fill:'var(--node)',   stroke:'var(--violet)',   text:'var(--text)'},
  edge :{fill:'var(--node)',   stroke:'var(--node-line)',text:'var(--muted)'},
  good :{fill:'var(--node)',   stroke:'var(--good)',     text:'var(--text)'},
  bad  :{fill:'var(--node)',   stroke:'var(--bad)',      text:'var(--text)'},
  warn :{fill:'var(--node)',   stroke:'var(--warn)',     text:'var(--text)'}
};
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

/* Bundled builds expose an ASSETS map of data URIs; loose files just use the path. */
function assetURL(p){
  try{ return (typeof ASSETS !== 'undefined' && ASSETS[p]) || p; }catch(e){ return p; }
}

/* A node picks up an icon from its own title - no per-node wiring needed.
   First match wins, so the specific patterns come before the generic ones. */
const ICON_RULES = [
  [/napbox|olt|fiber drop|distribution/i, 'napbox'],
  [/modem|\bont\b/i,                     'ont'],
  [/pfsense/i,                            'pfsense'],
  [/jetstream|managed switch|t1500g/i,    'switch-managed'],
  [/gl-ax|flint/i,                        'router'],
  [/unmanaged|switch \/ hub|dumb switch|fan-out/i, 'switch-unmanaged'],
  [/litebeam|dish|p2p|point-to-point/i,   'litebeam'],
  [/panel|sector|compass|e314/i,          'antenna-panel'],
  [/tower|mast|pole/i,                    'tower'],
  [/piso/i,                               'pisowifi'],
  [/pisonet|caf|desktop pc/i,             'pc-desktop'],
  [/cctv|nvr|camera/i,                    'cctv'],
  [/internet|cloud|isp [ab]\b|carrier|\bisp\b/i, 'cloud'],
  [/router|gateway/i,                     'router-small'],
  [/client|user|subscriber|browser|admin segment|mediacon|endpoint/i, 'laptop'],
];
function iconFor(node){
  if(node.icon === false) return null;
  if(node.icon) return node.icon;
  const t = String(node.title || '');
  for(const [re, name] of ICON_RULES) if(re.test(t)) return name;
  return null;
}

function diagram({w,h,nodes,edges=[],caption}){
  const map = {}; nodes.forEach(n=>map[n.id]=n);
  let out = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(caption||'network diagram')}">
  <defs>
    <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="var(--node-line)"/>
    </marker>
    <marker id="ahb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="var(--bad)"/>
    </marker>
    <marker id="ahg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="var(--good)"/>
    </marker>
  </defs>`;

  /* A wireless hop draws no cable. Two WiFi symbols face each other across the
     gap and take turns pulsing, so it reads as a link being talked over. */
  function wifiFan(cx, cy, dir){
    const arcs = [7, 12, 17].map(r =>
      `<path d="M${(-0.8*r).toFixed(1)},${(0.25*r*dir).toFixed(1)}
                Q0,${(1.15*r*dir).toFixed(1)} ${(0.8*r).toFixed(1)},${(0.25*r*dir).toFixed(1)}"
             fill="none" stroke="var(--accent)" stroke-width="2.1"
             stroke-linecap="round"/>`).join('');
    return `<g class="wifi ${dir>0?'tx':'rx'}" transform="translate(${cx},${cy})">${arcs}</g>`;
  }

  // edges first (under nodes)
  edges.forEach(e=>{
    const a=map[e.from], b=map[e.to]; if(!a||!b) return;
    const sx=a.x+a.w/2, sy=a.y+a.h, ex=b.x+b.w/2, ey=b.y;
    const my=sy+Math.max(14,(ey-sy)/2);

    if(e.wifi){
      // each fan sits against its own device and radiates into the gap, so the
      // two face each other with clear air between them
      const cx = (sx+ex)/2, mid = (sy+ey)/2;
      out += wifiFan(cx, sy + 4, 1) + wifiFan(cx, ey - 4, -1);
      if(e.label){
        out += `<text x="${cx+30}" y="${mid+3.5}" text-anchor="start"
                 font-family="var(--mono)" font-size="10.5" font-weight="600"
                 fill="var(--muted)">${esc(e.label)}</text>`;
      }
      return;   // no cable, no arrowhead, no flow dashes
    }
    const d = Math.abs(sx-ex)<1 ? `M${sx},${sy} L${ex},${ey-7}`
                                : `M${sx},${sy} L${sx},${my} L${ex},${my} L${ex},${ey-7}`;
    const col = e.tone==='bad'?'var(--bad)':e.tone==='good'?'var(--good)':'var(--node-line)';
    const mk  = e.tone==='bad'?'ahb':e.tone==='good'?'ahg':'ah';
    out += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.6"
             ${e.dash?'stroke-dasharray="5 4"':''} marker-end="url(#${mk})" opacity=".95"/>`;
    // animated traffic flow: same geometry, opposite dash directions
    if(e.flow!==false){
      out += `<path class="fdn" d="${d}" fill="none" stroke="var(--accent-2)" stroke-width="2.4" opacity=".9"/>`;
      out += `<path class="fup" d="${d}" fill="none" stroke="var(--accent)"   stroke-width="1.8" opacity=".75"/>`;
    }
    if(e.label){
      const lx=(sx+ex)/2, ly=my-6;
      out += `<text x="${lx}" y="${ly}" text-anchor="middle" font-family="var(--mono)" font-size="10.5"
               font-weight="600" fill="${col}">${esc(e.label)}</text>`;
    }
  });

  // nodes
  nodes.forEach(n=>{
    const t = TONE[n.tone||'edge'];
    out += `<g><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="10"
              fill="${t.fill}" stroke="${t.stroke}" stroke-width="1.5"/>`;

    const icon = iconFor(n);
    const lines = [n.title, ...(n.lines||[])].filter(s=>s!=='');
    const lh = 15, total = lines.length*lh;
    let ty = n.y + n.h/2 - total/2 + 11.5;

    let tx = n.x + n.w/2, anchor = 'middle';
    if(icon){
      // icon sits left, text runs beside it
      const size = Math.min(n.h - 10, 46);
      const iy = n.y + (n.h - size)/2;
      out += `<image href="${assetURL('assets/devices/'+icon+'.png')}"
                x="${n.x+9}" y="${iy}" width="${size}" height="${size}"
                preserveAspectRatio="xMidYMid meet"/>`;
      tx = n.x + 9 + size + 11;
      anchor = 'start';
    }

    lines.forEach((ln,i)=>{
      const isTitle = i===0;
      out += `<text x="${tx}" y="${ty}" text-anchor="${anchor}"
               font-family="${isTitle?'var(--sans)':'var(--mono)'}"
               font-size="${isTitle?(icon?'11.8':'12.5'):(icon?'10.2':'10.8')}"
               font-weight="${isTitle?'700':'500'}"
               fill="${isTitle?t.text:'var(--muted)'}">${esc(ln)}</text>`;
      ty += lh;
    });
    if(n.badge){
      out += `<rect x="${n.x+n.w-9}" y="${n.y-9}" width="18" height="18" rx="9" fill="${t.stroke}"/>
              <text x="${n.x+n.w}" y="${n.y+3.5}" text-anchor="middle" font-family="var(--mono)"
               font-size="9.5" font-weight="700" fill="var(--bg)">${esc(n.badge)}</text>`;
    }
    out += `</g>`;
  });
  return out + `</svg>`;
}

/* ---------- Site A ---------- */
/* VLAN ID matches the third octet.  192.168.10.0/24 is deliberately skipped:
   it is the factory default gateway of the E314n antennas (200+ deployed), so
   VLAN 110 / 192.168.110.0/24 takes that first slot instead. */
const VL = [
  {p:'Port 1', v:'VLAN 110', ip:'192.168.110.1'},
  {p:'Port 2', v:'VLAN 20',  ip:'192.168.20.1'},
  {p:'Port 3', v:'VLAN 30',  ip:'192.168.30.1'},
  {p:'Port 4', v:'VLAN 40',  ip:'192.168.40.1'},
  {p:'Port 5', v:'VLAN 50',  ip:'192.168.50.1'}
];
function siteA(){
  const W=1180, colW=214, gap=27, startX=(W-(colW*5+gap*4))/2;
  const nodes=[
    {id:'olt', x:W/2-140, y:8,   w:280, h:50, tone:'isp',  title:'PLDT NAPBOX / OLT', lines:['GPON fiber drop']},
    {id:'mdm', x:W/2-140, y:92,  w:280, h:58, tone:'isp',  title:'PLDT Modem', lines:['UnCGNAT · Bridge mode']},
    {id:'pfs', x:W/2-140, y:184, w:280, h:58, tone:'core', title:'pfSense — edge router', lines:['192.168.2.1 · FQ-CoDel SQM']},
    {id:'sw',  x:W/2-160, y:276, w:320, h:56, tone:'core', title:'TP-Link JetStream T1500G-10PS', lines:['8× GbE + 2× SFP · 802.1Q trunk · STP']}
  ];
  const edges=[
    {from:'olt',to:'mdm'},
    {from:'mdm',to:'pfs',label:'public IP'},
    {from:'pfs',to:'sw',label:'802.1Q trunk'}
  ];
  VL.forEach((v,i)=>{
    const x = startX + i*(colW+gap);
    nodes.push({id:'v'+i, x, y:366, w:colW, h:66, tone:'vlan', title:v.p+' · '+v.v,
                lines:[v.ip, 'DHCP .100–.254']});
    nodes.push({id:'ap'+i, x:x+16, y:472, w:colW-32, h:44, tone:'edge',
                title:'LiteBeam AC Gen2', lines:['AP']});
    nodes.push({id:'st'+i, x:x+16, y:574, w:colW-32, h:44, tone:'edge',
                title:'LiteBeam AC Gen2', lines:['Station']});
    nodes.push({id:'cl'+i, x:x+16, y:654, w:colW-32, h:46, tone:'edge',
                title: i===4 ? 'Unmanaged fan-out' : 'Client segment',
                lines: i===4 ? ['34 ports · fan-out'] : ['Users · tenants · piso Wi-Fi']});
    edges.push({from:'sw',to:'v'+i});
    edges.push({from:'v'+i,to:'ap'+i});
    edges.push({from:'ap'+i,to:'st'+i,label:'5 GHz P2P',wifi:true});
    edges.push({from:'st'+i,to:'cl'+i});
  });
  return diagram({w:W,h:724,nodes,edges,caption:'Site A production topology'});
}

/* ---------- Site B — same chain as Site A, minus the JetStream ---------- */
const VLB = [
  {p:'Port 1', v:'VLAN 1',  ip:'192.168.8.1',   d:'Admin / mgmt', e:'Admin + monitoring'},
  {p:'Port 2', v:'VLAN 20', ip:'192.168.20.1',  d:'DHCP .100–.253', e:'Users · tenants · piso Wi-Fi'},
  {p:'Port 3', v:'VLAN 30', ip:'192.168.30.1',  d:'DHCP .100–.253', e:'Users · tenants · piso Wi-Fi'},
  {p:'Port 4', v:'VLAN 40', ip:'192.168.40.1',  d:'DHCP .100–.253', e:'Users · tenants · piso Wi-Fi'}
];
function siteB(){
  const W=980, colW=214, gap=32, startX=(W-(colW*4+gap*3))/2;
  const nodes=[
    {id:'olt', x:W/2-140, y:8,   w:280, h:50, tone:'isp',  title:'PLDT NAPBOX / OLT', lines:['GPON fiber drop']},
    {id:'mdm', x:W/2-140, y:92,  w:280, h:58, tone:'isp',  title:'PLDT Modem', lines:['UnCGNAT done · CPE routed']},
    {id:'gl',  x:W/2-170, y:184, w:340, h:62, tone:'core', title:'GL-AX1800 (Flint)',
     lines:['router + switch + SQM in one box','FQ-CoDel · STP · GoodCloud']}
  ];
  const edges=[
    {from:'olt',to:'mdm'},
    {from:'mdm',to:'gl',label:'public IP'}
  ];
  VLB.forEach((v,i)=>{
    const x = startX + i*(colW+gap);
    nodes.push({id:'v'+i, x, y:302, w:colW, h:66, tone:'vlan', title:v.p+' · '+v.v, lines:[v.ip, v.d]});
    nodes.push({id:'ap'+i, x:x+16, y:408, w:colW-32, h:44, tone:'edge', title:'LiteBeam AC Gen2', lines:['AP']});
    nodes.push({id:'st'+i, x:x+16, y:510, w:colW-32, h:44, tone:'edge', title:'LiteBeam AC Gen2', lines:['Station']});
    nodes.push({id:'cl'+i, x:x+16, y:590, w:colW-32, h:46, tone:'edge', title: i===0?'Admin segment':'Client segment', lines:[v.e]});
    edges.push({from:'gl',to:'v'+i});
    edges.push({from:'v'+i,to:'ap'+i});
    edges.push({from:'ap'+i,to:'st'+i,label:'5 GHz P2P',wifi:true});
    edges.push({from:'st'+i,to:'cl'+i});
  });
  return diagram({w:W,h:660,nodes,edges,caption:'Site B topology — GL-AX1800'});
}

/* ---------- CGNAT ---------- */
function cgnatOn(){
  return diagram({w:460,h:400,caption:'behind CGNAT',nodes:[
    {id:'net',x:130,y:6,  w:200,h:44,tone:'edge',title:'Internet',lines:[]},
    {id:'cg', x:90, y:88, w:280,h:58,tone:'bad', title:'Carrier CGNAT gateway',lines:['shared 100.64.0.0/10']},
    {id:'rt', x:110,y:186,w:240,h:52,tone:'warn',title:'Your router',lines:['no public IP of its own']},
    {id:'cl', x:110,y:278,w:240,h:52,tone:'edge',title:'Clients / NVR / server',lines:['unreachable from outside']}
  ],edges:[
    {from:'net',to:'cg',tone:'bad',label:'inbound blocked'},
    {from:'cg',to:'rt'},{from:'rt',to:'cl'}
  ]});
}
function cgnatOff(){
  return diagram({w:460,h:400,caption:'with UnCGNAT',nodes:[
    {id:'net',x:130,y:6,  w:200,h:44,tone:'edge',title:'Internet',lines:[]},
    {id:'mdm',x:90, y:88, w:280,h:58,tone:'good',title:'ISP modem — bridge mode',lines:['public IP passed through']},
    {id:'rt', x:110,y:186,w:240,h:52,tone:'core',title:'pfSense / GL-AX1800',lines:['holds the public IP']},
    {id:'cl', x:110,y:278,w:240,h:52,tone:'edge',title:'NVR · VPN · game host',lines:['reachable · port forward OK']}
  ],edges:[
    {from:'net',to:'mdm',tone:'good',label:'inbound allowed'},
    {from:'mdm',to:'rt',tone:'good'},{from:'rt',to:'cl',tone:'good'}
  ]});
}

/* ---------- flat vs vlan ---------- */
function flat(){
  const W=520;
  const nodes=[
    {id:'r', x:W/2-130,y:6,  w:260,h:50,tone:'warn',title:'Router',lines:['192.168.1.1 · one /24']},
    {id:'s', x:W/2-140,y:96, w:280,h:50,tone:'bad', title:'Unmanaged switch',lines:['no VLAN · no STP']}
  ];
  const kids=['Piso Wi-Fi A','Piso Wi-Fi B','MediaCon','Admin PC'];
  const cw=112,gp=13,sx=(W-(cw*4+gp*3))/2;
  const edges=[{from:'r',to:'s'}];
  kids.forEach((k,i)=>{
    nodes.push({id:'k'+i,x:sx+i*(cw+gp),y:196,w:cw,h:48,tone:'bad',title:k,lines:['192.168.1.x']});
    edges.push({from:'s',to:'k'+i,tone:'bad'});
  });
  let svg = diagram({w:W,h:296,nodes,edges,caption:'flat network'});
  svg = svg.replace('</svg>',
    `<rect x="14" y="182" width="${W-28}" height="76" rx="12" fill="none"
      stroke="var(--bad)" stroke-width="1.4" stroke-dasharray="6 5" opacity=".85"/>
     <text x="${W/2}" y="278" text-anchor="middle" font-family="var(--mono)" font-size="10.5"
      font-weight="700" fill="var(--bad)">ONE BROADCAST DOMAIN — everyone hears everyone</text></svg>`);
  return svg;
}
function vlan(){
  const W=520;
  const nodes=[
    {id:'r', x:W/2-130,y:6,  w:260,h:50,tone:'core',title:'pfSense',lines:['inter-VLAN firewall']},
    {id:'s', x:W/2-140,y:96, w:280,h:50,tone:'good',title:'JetStream managed',lines:['802.1Q · STP']}
  ];
  const kids=[['Piso A','VLAN 10'],['Piso B','VLAN 20'],['MediaCon','VLAN 30'],['Admin','VLAN 40']];
  const cw=112,gp=13,sx=(W-(cw*4+gp*3))/2;
  const edges=[{from:'r',to:'s'}];
  kids.forEach((k,i)=>{
    nodes.push({id:'k'+i,x:sx+i*(cw+gp),y:196,w:cw,h:48,tone:'good',title:k[0],lines:[k[1]]});
    edges.push({from:'s',to:'k'+i,tone:'good'});
  });
  let svg = diagram({w:W,h:296,nodes,edges,caption:'segmented network'});
  let walls='';
  for(let i=0;i<3;i++){
    const x = sx + cw + gp/2 + i*(cw+gp);
    walls += `<line x1="${x}" y1="188" x2="${x}" y2="252" stroke="var(--good)" stroke-width="1.4" stroke-dasharray="4 4"/>`;
  }
  svg = svg.replace('</svg>', walls +
    `<text x="${W/2}" y="278" text-anchor="middle" font-family="var(--mono)" font-size="10.5"
      font-weight="700" fill="var(--good)">FOUR BROADCAST DOMAINS — walls between groups</text></svg>`);
  return svg;
}

/* ---------- flow paths ---------- */
function flowBad(){
  return diagram({w:520,h:376,caption:'flow without SQM',nodes:[
    {id:'c', x:140,y:6,  w:240,h:46,tone:'edge',title:'Clients',lines:['game + download mixed']},
    {id:'r', x:140,y:88, w:240,h:46,tone:'warn',title:'Router (no shaping)',lines:['forwards blindly']},
    {id:'m', x:110,y:170,w:300,h:62,tone:'bad', title:'ISP modem — dumb FIFO buffer',lines:['QUEUE FORMS HERE','300–1500 ms of stored packets']},
    {id:'i', x:140,y:268,w:240,h:46,tone:'edge',title:'Internet',lines:['']}
  ],edges:[
    {from:'c',to:'r'},{from:'r',to:'m',tone:'bad',label:'link saturated'},{from:'m',to:'i',tone:'bad',label:'+ huge delay'}
  ]});
}
function flowGood(){
  return diagram({w:520,h:376,caption:'flow with SQM',nodes:[
    {id:'c', x:140,y:6,  w:240,h:46,tone:'edge',title:'Clients',lines:['game + download mixed']},
    {id:'r', x:100,y:88, w:320,h:66,tone:'good',title:'pfSense — FQ-CoDel SQM',lines:['QUEUE FORMS HERE','per-flow queues · 5 ms target']},
    {id:'m', x:140,y:190,w:240,h:46,tone:'edge',title:'ISP modem',lines:['stays empty · never bottleneck']},
    {id:'i', x:140,y:268,w:240,h:46,tone:'edge',title:'Internet',lines:['']}
  ],edges:[
    {from:'c',to:'r'},{from:'r',to:'m',tone:'good',label:'shaped ~90% line rate'},{from:'m',to:'i',tone:'good',label:'low, stable delay'}
  ]});
}

/* ---------- typical setup ---------- */
function typical(){
  const W=1080;
  const nodes=[
    {id:'olt',x:W/2-130,y:6,  w:260,h:46,tone:'edge',title:'PLDT fiber / OLT',lines:[]},
    {id:'cg', x:W/2-150,y:84, w:300,h:62,tone:'bad', title:'PLDT modem — CGNAT',
     lines:['NAT #1 · WAN is shared 100.64.x.x','LAN gateway 192.168.1.1'],badge:'1'},
    {id:'r1', x:W/2-150,y:172,w:300,h:62,tone:'bad', title:'Consumer router (NAT)',
     lines:['NAT #2 · 192.168.0.1 — or 192.168.1.1','same subnet as the modem = conflict'],badge:'2'},
    {id:'sw', x:W/2-150,y:260,w:300,h:52,tone:'bad', title:'Unmanaged switch / hub',lines:['no VLAN · no STP']},
    {id:'ap', x:W/2-150,y:348,w:300,h:48,tone:'warn',title:'P2P Gen2 — AP',lines:['bridged, unshaped']},
    {id:'st', x:W/2-150,y:456,w:300,h:48,tone:'warn',title:'P2P Gen2 — Station',lines:['bridged, unshaped']},
    {id:'r2', x:W/2-150,y:538,w:300,h:56,tone:'bad', title:'Far-end router (NAT)',lines:['NAT #3 · 192.168.1.1 again'],badge:'3'},
    {id:'c1', x:W/2-330,y:630,w:280,h:56,tone:'bad', title:'Client router (NAT)',lines:['NAT #4 · another 192.168.1.1'],badge:'4'},
    {id:'c2', x:W/2+50, y:630,w:280,h:56,tone:'bad', title:'Piso Wi-Fi vendo (NAT)',lines:['NAT #4 · own DHCP'],badge:'4'}
  ];
  const edges=[
    {from:'olt',to:'cg'},{from:'cg',to:'r1',tone:'bad'},{from:'r1',to:'sw',tone:'bad'},
    {from:'sw',to:'ap',tone:'bad'},
    {from:'ap',to:'st',label:'5 GHz P2P',wifi:true},
    {from:'st',to:'r2',tone:'bad'},
    {from:'r2',to:'c1',tone:'bad'},{from:'r2',to:'c2',tone:'bad'}
  ];
  let svg = diagram({w:W,h:710,nodes,edges,caption:'typical setup'});
  svg = svg.replace('</svg>',
   `<text x="26" y="118" font-family="var(--mono)" font-size="11" font-weight="700" fill="var(--bad)">NO PUBLIC IP</text>
    <text x="26" y="204" font-family="var(--mono)" font-size="11" font-weight="700" fill="var(--bad)">NO FQ-CODEL</text>
    <text x="26" y="290" font-family="var(--mono)" font-size="11" font-weight="700" fill="var(--bad)">NO VLAN / NO STP</text>
    <text x="26" y="572" font-family="var(--mono)" font-size="11" font-weight="700" fill="var(--bad)">NO VISIBILITY</text>
    <text x="${W-26}" y="684" text-anchor="end" font-family="var(--mono)" font-size="11.5" font-weight="700"
     fill="var(--bad)">4 NAT LAYERS · 1 FLAT NETWORK · 0 QUEUE CONTROL</text></svg>`);
  return svg;
}

/* ---------- uplink / downlink illustration ---------- */
function pillars(){
  const W=760;
  return diagram({w:W,h:514,caption:'uplink and downlink on the same path',nodes:[
    {id:'net',x:W/2-150,y:6,  w:300,h:46,tone:'edge',title:'Internet',lines:[]},
    {id:'isp',x:W/2-150,y:86, w:300,h:52,tone:'isp', title:'ISP fiber · 600 Mbps',lines:['PLDT Plan 1899']},
    {id:'rtr',x:W/2-180,y:178,w:360,h:62,tone:'core',title:'pfSense / GL-AX1800',
     lines:['FQ-CoDel shapes BOTH directions','download queue + upload queue']},
    {id:'ap', x:W/2-150,y:284,w:300,h:46,tone:'edge',title:'LiteBeam AC Gen2',lines:['AP']},
    {id:'st', x:W/2-150,y:390,w:300,h:46,tone:'edge',title:'LiteBeam AC Gen2',lines:['Station']},
    {id:'cli',x:W/2-150,y:462,w:300,h:46,tone:'edge',title:'Clients',lines:['office · home · piso Wi-Fi']}
  ],edges:[
    {from:'net',to:'isp'},
    {from:'isp',to:'rtr',label:'down ▼   up ▲'},
    {from:'rtr',to:'ap',label:'shaped both ways'},
    {from:'ap',to:'st',label:'5 GHz P2P',wifi:true},
    {from:'st',to:'cli'}
  ]});
}


/* ---------- DUAL WAN: load balancing vs failover vs per-VLAN pinning ---------- */
function dualWanLB(){
  const W=520;
  return diagram({w:W,h:410,caption:'two ISPs load balanced',nodes:[
    {id:'a', x:24, y:6,  w:210,h:52,tone:'isp', title:'ISP A — PLDT',  lines:['public IP  A.A.A.A']},
    {id:'b', x:286,y:6,  w:210,h:52,tone:'isp', title:'ISP B — 2nd line',lines:['public IP  B.B.B.B']},
    {id:'lb',x:W/2-170,y:110,w:340,h:62,tone:'bad',title:'Router doing LOAD BALANCING',
     lines:['picks a WAN per connection','source IP changes mid-session']},
    {id:'c', x:W/2-170,y:214,w:340,h:46,tone:'edge',title:'One client · one browser',lines:[]},
    {id:'s1',x:24, y:308,w:210,h:56,tone:'bad',title:'Login sent from A.A.A.A',lines:['bank sees IP #1']},
    {id:'s2',x:286,y:308,w:210,h:56,tone:'bad',title:'Next click from B.B.B.B',lines:['bank sees IP #2 → logout']}
  ],edges:[
    {from:'a',to:'lb',tone:'bad'},{from:'b',to:'lb',tone:'bad'},
    {from:'lb',to:'c',tone:'bad'},
    {from:'c',to:'s1',tone:'bad'},{from:'c',to:'s2',tone:'bad'}
  ]});
}
function dualWanFail(){
  const W=520;
  return diagram({w:W,h:410,caption:'failover only',nodes:[
    {id:'a', x:24, y:6,  w:210,h:52,tone:'good',title:'ISP A — primary', lines:['public IP  A.A.A.A']},
    {id:'b', x:286,y:6,  w:210,h:52,tone:'edge',title:'ISP B — standby', lines:['idle until A dies']},
    {id:'r', x:W/2-170,y:110,w:340,h:62,tone:'good',title:'Router doing FAILOVER',
     lines:['one active WAN at a time','FQ-CoDel owns that one queue']},
    {id:'c', x:W/2-170,y:214,w:340,h:46,tone:'edge',title:'One client · one browser',lines:[]},
    {id:'s', x:W/2-170,y:300,w:340,h:64,tone:'good',title:'Every session from A.A.A.A',
     lines:['stable source IP','banking, games, logins all normal']}
  ],edges:[
    {from:'a',to:'r',tone:'good'},{from:'b',to:'r',dash:true,flow:false,label:'standby'},
    {from:'r',to:'c',tone:'good'},{from:'c',to:'s',tone:'good'}
  ]});
}
function dualWanPin(){
  const W=980;
  const nodes=[
    {id:'a', x:120,y:6,  w:280,h:52,tone:'isp', title:'ISP A',lines:['public IP  A.A.A.A']},
    {id:'b', x:580,y:6,  w:280,h:52,tone:'isp', title:'ISP B',lines:['public IP  B.B.B.B']},
    {id:'r', x:W/2-200,y:112,w:400,h:64,tone:'core',title:'Policy routing — pinned per VLAN',
     lines:['a client group always leaves the same WAN','no IP hopping inside a session']}
  ];
  const groups=[['VLAN 20','→ always ISP A'],['VLAN 30','→ always ISP A'],
                ['VLAN 40','→ always ISP B'],['VLAN 50','→ always ISP B']];
  const cw=196,gp=22,sx=(W-(cw*4+gp*3))/2;
  const edges=[{from:'a',to:'r'},{from:'b',to:'r'}];
  groups.forEach((g,i)=>{
    nodes.push({id:'g'+i,x:sx+i*(cw+gp),y:222,w:cw,h:58,tone:'good',title:g[0],lines:[g[1]]});
    edges.push({from:'r',to:'g'+i,tone:'good'});
  });
  return diagram({w:W,h:300,nodes,edges,caption:'per-VLAN WAN pinning'});
}


/* ---------- what clients actually do to a site, with and without STP ---------- */
function loopBad(){
  const W=520;
  const nodes=[
    {id:'sw', x:W/2-160,y:6,  w:320,h:52,tone:'bad',title:'Unmanaged switch / hub',
     lines:['no STP · no VLAN · no DHCP guard']}
  ];
  const kids=[
    ['Client resets router','DHCP on · 192.168.1.1'],
    ['Modem added as a "router"','2nd DHCP server'],
    ['WAN cable moved to LAN','loop created']
  ];
  const cw=152,gp=14,sx=(W-(cw*3+gp*2))/2;
  const edges=[];
  kids.forEach((k,i)=>{
    nodes.push({id:'k'+i,x:sx+i*(cw+gp),y:130,w:cw,h:56,tone:'bad',title:k[0],lines:[k[1]]});
    edges.push({from:'sw',to:'k'+i,tone:'bad'});
  });
  nodes.push({id:'out',x:W/2-190,y:250,w:380,h:58,tone:'bad',
              title:'Broadcast storm floods every segment',
              lines:['wrong gateways handed out site-wide']});
  kids.forEach((k,i)=>edges.push({from:'k'+i,to:'out',tone:'bad',flow:false}));
  let svg = diagram({w:W,h:360,nodes,edges,caption:'site without loop protection'});
  return svg.replace('</svg>',
    `<text x="${W/2}" y="340" text-anchor="middle" font-family="var(--mono)" font-size="11.5"
      font-weight="700" fill="var(--bad)">WHOLE SITE DOWN — until someone drives out and finds the cable</text></svg>`);
}
function loopGood(){
  const W=520;
  const nodes=[
    {id:'sw', x:W/2-170,y:6,  w:340,h:58,tone:'good',title:'pfSense + JetStream / GL-AX1800',
     lines:['STP on every port · VLAN per group','DHCP served only by the router']}
  ];
  const kids=[
    ['Same reset router','port blocked'],
    ['Same rogue modem','DHCP stays in its VLAN'],
    ['Same miscabled loop','detected in under a second']
  ];
  const cw=152,gp=14,sx=(W-(cw*3+gp*2))/2;
  const edges=[];
  kids.forEach((k,i)=>{
    nodes.push({id:'k'+i,x:sx+i*(cw+gp),y:136,w:cw,h:56,tone:'good',title:k[0],lines:[k[1]]});
    edges.push({from:'sw',to:'k'+i,tone:'good'});
  });
  nodes.push({id:'out',x:W/2-190,y:256,w:380,h:58,tone:'good',
              title:'Damage stops at that one port',
              lines:['every other VLAN keeps working normally']});
  kids.forEach((k,i)=>edges.push({from:'k'+i,to:'out',tone:'good',flow:false}));
  let svg = diagram({w:W,h:360,nodes,edges,caption:'site with loop protection'});
  return svg.replace('</svg>',
    `<text x="${W/2}" y="340" text-anchor="middle" font-family="var(--mono)" font-size="11.5"
      font-weight="700" fill="var(--good)">ONE GROUP AFFECTED — fixed remotely, no site visit</text></svg>`);
}

const DIAGRAMS = {siteA,siteB,cgnatOn,cgnatOff,flat,vlan,flowBad,flowGood,typical,pillars,dualWanLB,dualWanFail,dualWanPin,loopBad,loopGood};
document.querySelectorAll('[data-diagram]').forEach(el=>{
  const fn = DIAGRAMS[el.dataset.diagram];
  if(fn) el.innerHTML = fn();
});

/* ============================================================
   2. DECK NAVIGATION
   ============================================================ */
const allSlides = [...document.querySelectorAll('.slide')];
const rail = document.getElementById('rail');
const counter = document.getElementById('counter');
const prog = document.getElementById('prog');
let slides = allSlides, dots = [], idx = 0;

/* Slides carry data-deck="full" or "budget"; no attribute means "in both decks". */
let deckMode = 'full';
function applyDeck(mode, jumpTo){
  deckMode = mode;
  allSlides.forEach(s=>{
    const d = s.dataset.deck;
    s.classList.toggle('off-deck', !!d && d !== mode);
    s.classList.remove('on');          // never leave a stale active slide behind
  });
  slides = allSlides.filter(s=>!s.classList.contains('off-deck'));

  rail.innerHTML = '';
  slides.forEach((s,i)=>{
    const b = document.createElement('button');
    b.dataset.t = (i+1).toString().padStart(2,'0') + ' · ' + (s.dataset.title||'');
    b.addEventListener('click',()=>go(i));
    rail.appendChild(b);
  });
  dots = [...rail.children];

  document.querySelectorAll('[data-deckbtn]').forEach(b=>{
    b.classList.toggle('on', b.dataset.deckbtn === mode);
  });
  document.body.dataset.deck = mode;
  try{ localStorage.setItem('nt-deck', mode); }catch(e){}
  go(jumpTo ?? 0);
}

function go(i){
  idx = Math.max(0, Math.min(slides.length-1, i));
  slides.forEach((s,k)=>s.classList.toggle('on', k===idx));
  dots.forEach((d,k)=>d.classList.toggle('on', k===idx));
  counter.innerHTML = '<b>'+String(idx+1).padStart(2,'0')+'</b> / '+slides.length;
  prog.style.width = ((idx)/(slides.length-1)*100)+'%';
  slides[idx].scrollTop = 0;
  if(location.hash !== '#'+(idx+1)) history.replaceState(null,'','#'+(idx+1));
}
document.getElementById('nextBtn').onclick = ()=>go(idx+1);
document.getElementById('prevBtn').onclick = ()=>go(idx-1);

addEventListener('keydown', e=>{
  if(e.target.matches('input,textarea')) return;
  const k = e.key;
  if(k==='ArrowRight'||k==='PageDown'||k===' ') {e.preventDefault(); go(idx+1);}
  else if(k==='ArrowLeft'||k==='PageUp'){e.preventDefault(); go(idx-1);}
  else if(k==='Home'){go(0);}
  else if(k==='End'){go(slides.length-1);}
  else if(k.toLowerCase()==='t'){toggleTheme();}
  else if(k.toLowerCase()==='n'){document.body.classList.toggle('notes');}
  else if(k.toLowerCase()==='f'){toggleFs();}
  else if(k.toLowerCase()==='l'){cycleFlow();}
  else if(k.toLowerCase()==='p'){e.preventDefault(); print();}
});

/* touch swipe */
let tx=0,ty=0;
addEventListener('touchstart',e=>{tx=e.changedTouches[0].clientX;ty=e.changedTouches[0].clientY;},{passive:true});
addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty;
  if(Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.6) go(idx + (dx<0?1:-1));
},{passive:true});

function toggleFs(){
  if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}
document.getElementById('fsBtn')?.addEventListener('click', toggleFs);
document.getElementById('notesBtn')?.addEventListener('click', ()=>document.body.classList.toggle('notes'));

let startDeck = 'full';
try{ const d = localStorage.getItem('nt-deck'); if(d==='full'||d==='budget') startDeck = d; }catch(e){}
if(document.querySelector('[data-deckbtn]')){
  document.querySelectorAll('[data-deckbtn]').forEach(b=>
    b.addEventListener('click',()=>applyDeck(b.dataset.deckbtn)));
  applyDeck(startDeck, (parseInt(location.hash.slice(1))-1) || 0);
}else{
  applyDeck('full', (parseInt(location.hash.slice(1))-1) || 0);
}

/* deep links: /index.html#7 jumps to slide 7 even without a reload */
addEventListener('hashchange', ()=>{
  const n = parseInt(location.hash.slice(1));
  if(!isNaN(n) && n-1 !== idx) go(n-1);
});

/* ============================================================
   3. THEME
   ============================================================ */
const root = document.documentElement;
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');
function applyTheme(t){
  root.dataset.theme = t;
  if(themeIcon)  themeIcon.src = t==='dark' ? 'assets/sun.png' : 'assets/moon.png';
  if(themeLabel) themeLabel.textContent = t==='dark' ? 'Light' : 'Dark';
  try{ localStorage.setItem('nt-theme', t); }catch(e){}
}
function toggleTheme(){ applyTheme(root.dataset.theme==='dark'?'light':'dark'); }
document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
let saved = null;
try{ saved = localStorage.getItem('nt-theme'); }catch(e){}
applyTheme(saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

/* ============================================================
   3b. TRAFFIC-FLOW ANIMATION MODE
   ============================================================ */
const FLOW_MODES = ['both','flow-dn','flow-up','flow-off'];
const FLOW_LABEL = {both:'Flow: both', 'flow-dn':'Flow: down', 'flow-up':'Flow: up', 'flow-off':'Flow: off'};
let flowIdx = 0;
function applyFlow(){
  const m = FLOW_MODES[flowIdx];
  document.body.classList.remove('flow-dn','flow-up','flow-off');
  if(m!=='both') document.body.classList.add(m);
  const lab = document.getElementById('flowLabel');
  if(lab) lab.textContent = FLOW_LABEL[m];
  try{ localStorage.setItem('nt-flow', m); }catch(e){}
}
function cycleFlow(){ flowIdx = (flowIdx+1) % FLOW_MODES.length; applyFlow(); }
document.getElementById('flowBtn')?.addEventListener('click', cycleFlow);
try{
  const sv = localStorage.getItem('nt-flow');
  if(sv && FLOW_MODES.includes(sv)) flowIdx = FLOW_MODES.indexOf(sv);
}catch(e){}
applyFlow();

/* ============================================================
   4. CONSTELLATION BACKGROUND
   ============================================================ */
(function(){
  const cv = document.getElementById('stars'), ctx = cv.getContext('2d');
  let W,H,dpr,stars=[];
  function css(v){ return getComputedStyle(root).getPropertyValue(v).trim(); }
  function resize(){
    dpr = Math.min(devicePixelRatio||1, 2);
    W = cv.width = innerWidth*dpr; H = cv.height = innerHeight*dpr;
    cv.style.width = innerWidth+'px'; cv.style.height = innerHeight+'px';
    const n = Math.round(innerWidth*innerHeight/9000);
    stars = Array.from({length:Math.min(n,190)},()=>({
      x:Math.random()*W, y:Math.random()*H,
      r:(Math.random()*1.5+.35)*dpr,
      vx:(Math.random()-.5)*.09*dpr, vy:(Math.random()-.5)*.09*dpr,
      ph:Math.random()*Math.PI*2, sp:.6+Math.random()*1.4,
      hot:Math.random()<.16
    }));
  }
  resize(); addEventListener('resize',resize);
  let t=0;
  (function loop(){
    t+=.016;
    ctx.clearRect(0,0,W,H);
    const base = css('--star') || '#cfd8ee';
    const acc  = css('--accent') || '#FF7A18';
    const link = root.dataset.theme==='light' ? 'rgba(80,100,140,' : 'rgba(190,210,255,';
    const maxD = 128*dpr;
    for(let i=0;i<stars.length;i++){
      const a = stars[i];
      a.x+=a.vx; a.y+=a.vy;
      if(a.x<0)a.x=W; if(a.x>W)a.x=0; if(a.y<0)a.y=H; if(a.y>H)a.y=0;
      for(let j=i+1;j<stars.length;j++){
        const b=stars[j], dx=a.x-b.x, dy=a.y-b.y, d=Math.hypot(dx,dy);
        if(d<maxD){
          ctx.strokeStyle = link + (0.16*(1-d/maxD)) + ')';
          ctx.lineWidth = .6*dpr;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
      const tw = .45 + .55*Math.abs(Math.sin(a.ph + t*a.sp));
      ctx.globalAlpha = (root.dataset.theme==='light' ? .38 : .72) * tw;
      ctx.fillStyle = a.hot ? acc : base;
      ctx.beginPath(); ctx.arc(a.x,a.y,a.r,0,6.2832); ctx.fill();
      if(a.hot){
        ctx.globalAlpha = .16*tw;
        ctx.beginPath(); ctx.arc(a.x,a.y,a.r*4.5,0,6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(loop);
  })();
})();

/* ============================================================
   5. FQ-CoDel vs FIFO SIMULATOR
   ============================================================ */
(function(){
  if(!document.getElementById('simFifo') || !document.getElementById('simFq')) return;
  const SERVICE_HZ = 46;        // packets the WAN link can drain per second
  const BULK_BASE  = 62;        // normal bulk load (slightly oversubscribed)
  const BULK_HEAVY = 200;       // "add heavy load" button
  let   BULK_HZ    = BULK_BASE;
  const GAME_HZ    = 9;         // interactive flow
  const FIFO_CAP   = 60;        // oversized dumb buffer -> ~1.3 s of bufferbloat
  const CODEL_TGT  = 18;        // CoDel keeps the bulk queue this short
  const GAME_CAP   = 6;

  function Lane(canvasId, mode, out){
    const cv = document.getElementById(canvasId), ctx = cv.getContext('2d');
    return {
      cv, ctx, mode, out,
      q: [], qb: [], qg: [],        // fifo queue / bulk queue / game queue
      moving: [], drops: [],
      clock:0,                      // simulation clock (immune to tab throttling)
      accB:0, accG:0, accS:0,
      latEma: 0, jit: 0, lastLat: null,
      resize(){
        const dpr = Math.min(devicePixelRatio||1,2);
        this.w = cv.clientWidth; this.h = cv.clientHeight;
        cv.width = this.w*dpr; cv.height = this.h*dpr;
        ctx.setTransform(dpr,0,0,dpr,0,0);
      }
    };
  }

  const fifo = Lane('simFifo','fifo',{l:'fifoLat',q:'fifoQ',j:'fifoJit'});
  const fq   = Lane('simFq','fq',    {l:'fqLat', q:'fqQ', j:'fqJit'});
  const lanes=[fifo,fq];
  function sizeAll(){ lanes.forEach(L=>L.resize()); }
  sizeAll(); addEventListener('resize',sizeAll);

  let running = true, last = performance.now();

  function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  function spawn(L, flow){
    L.moving.push({flow, t:0, y: flow==='bulk' ? 0.30 : 0.72, x:0, state:'in'});
  }

  function enqueue(L, pkt){
    pkt.t = L.clock;                       // sojourn starts when it hits the queue
    if(L.mode==='fifo'){
      if(L.q.length >= FIFO_CAP){ L.drops.push({x:.44,y:pkt.y,t:L.clock}); return; }
      L.q.push(pkt);
    }else{
      const q = pkt.flow==='bulk' ? L.qb : L.qg;
      // CoDel: drop from the bulk queue once the sojourn target is exceeded
      if(pkt.flow==='bulk' && q.length > CODEL_TGT){ L.drops.push({x:.44,y:pkt.y,t:L.clock}); return; }
      if(pkt.flow==='game' && q.length > GAME_CAP){ L.drops.push({x:.44,y:pkt.y,t:L.clock}); return; }
      q.push(pkt);
    }
  }

  function dequeue(L){
    let pkt=null;
    if(L.mode==='fifo'){
      pkt = L.q.shift();
    }else{
      // fq_codel: sparse (interactive) flow gets priority, bulk fills the rest
      if(L.qg.length) pkt = L.qg.shift();
      else if(L.qb.length) pkt = L.qb.shift();
    }
    if(!pkt) return;
    if(pkt.flow==='game'){
      // measured sojourn of this packet -> feeds the jitter figure
      const ms = L.clock - pkt.t;
      if(L.lastLat!==null) L.jit = L.jit*0.9 + Math.abs(ms - L.lastLat)*0.1;
      L.lastLat = ms;
    }
    pkt.state='out'; pkt.x=0.50;
    L.moving.push(pkt);
  }

  function step(L, dt){
    L.clock += dt;
    L.accB += dt*BULK_HZ/1000; L.accG += dt*GAME_HZ/1000; L.accS += dt*SERVICE_HZ/1000;
    while(L.accB>=1){ L.accB--; spawn(L,'bulk'); }
    while(L.accG>=1){ L.accG--; spawn(L,'game'); }
    while(L.accS>=1){ L.accS--; dequeue(L); }

    // queuing delay an interactive packet would see if it arrived right now:
    // FIFO -> it waits behind the whole buffer.  FQ-CoDel -> only behind its own flow.
    const ahead = L.mode==='fifo' ? L.q.length : L.qg.length + 1;
    const delay = ahead / SERVICE_HZ * 1000;
    L.latEma = L.latEma ? L.latEma*0.92 + delay*0.08 : delay;

    const speedIn = dt/1000*0.55, speedOut = dt/1000*0.75;
    for(let i=L.moving.length-1;i>=0;i--){
      const p=L.moving[i];
      if(p.state==='in'){
        p.x += speedIn;
        if(p.x>=0.42){ L.moving.splice(i,1); enqueue(L,p); }
      }else{
        p.x += speedOut;
        if(p.x>1.05) L.moving.splice(i,1);
      }
    }
    L.drops = L.drops.filter(d=> L.clock-d.t < 550);
  }

  function draw(L){
    const {ctx,w,h} = L; ctx.clearRect(0,0,w,h);
    const acc = css('--accent'), acc2 = css('--accent-2'), bad = css('--bad'),
          dim = css('--dim'), stroke = css('--stroke-strong'), muted = css('--muted');
    const qx = w*0.44, qw = w*0.10;

    // rails
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.setLineDash([4,5]);
    [0.30,0.72].forEach(f=>{ ctx.beginPath(); ctx.moveTo(w*0.03,h*f); ctx.lineTo(qx,h*f); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(qx+qw,h*0.51); ctx.lineTo(w*0.98,h*0.51); ctx.stroke();
    ctx.setLineDash([]);

    // labels
    ctx.font = '600 9.5px ui-monospace,monospace'; ctx.textAlign='left';
    ctx.fillStyle = acc2; ctx.fillText('BULK DOWNLOAD', w*0.03, h*0.30-9);
    ctx.fillStyle = acc;  ctx.fillText('GAME / VOICE',  w*0.03, h*0.72-9);
    ctx.fillStyle = dim;  ctx.textAlign='right'; ctx.fillText('WAN →', w*0.98, h*0.51-9);

    // buffer box
    const qlen = L.mode==='fifo' ? L.q.length : (L.qb.length + L.qg.length);
    const cap  = L.mode==='fifo' ? FIFO_CAP : CODEL_TGT+GAME_CAP;
    const fill = Math.min(1, qlen/cap);
    ctx.strokeStyle = L.mode==='fifo' ? bad : css('--good'); ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.roundRect(qx, h*0.12, qw, h*0.78, 7); ctx.stroke();
    ctx.fillStyle = (L.mode==='fifo'?bad:css('--good')) + '';
    ctx.globalAlpha = .18;
    const fh = (h*0.78-4)*fill;
    ctx.beginPath(); ctx.roundRect(qx+2, h*0.90-2-fh, qw-4, fh, 5); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.textAlign='center'; ctx.font='600 9px ui-monospace,monospace'; ctx.fillStyle=muted;
    ctx.fillText(L.mode==='fifo'?'FIFO BUFFER':'FQ-CODEL', qx+qw/2, h*0.12-7);

    // queued packets stacked in the box
    const rows = Math.min(qlen, 34);
    for(let i=0;i<rows;i++){
      const src = L.mode==='fifo' ? L.q[i] : (i<L.qg.length ? L.qg[i] : L.qb[i-L.qg.length]);
      if(!src) break;
      ctx.fillStyle = src.flow==='game' ? acc : acc2;
      const yy = h*0.885 - i*(h*0.75/34) - 4;
      ctx.fillRect(qx+3, yy, qw-6, h*0.75/34 - 2.5);
    }

    // moving packets
    L.moving.forEach(p=>{
      ctx.fillStyle = p.flow==='game' ? acc : acc2;
      const px = p.state==='in' ? w*0.03 + p.x*(qx-w*0.03)/0.42 : qx+qw + (p.x-0.50)*(w*0.98-qx-qw)/0.55;
      const py = p.state==='in' ? h*p.y : h*0.51;
      ctx.beginPath(); ctx.roundRect(px-4, py-3.2, 8.5, 6.4, 2); ctx.fill();
    });

    // drops
    L.drops.forEach(d=>{
      const a = 1-(L.clock-d.t)/550;
      ctx.globalAlpha = a; ctx.strokeStyle = bad; ctx.lineWidth=1.6;
      const px = w*d.x, py = h*d.y, s=4+6*(1-a);
      ctx.beginPath(); ctx.moveTo(px-s,py-s); ctx.lineTo(px+s,py+s);
      ctx.moveTo(px+s,py-s); ctx.lineTo(px-s,py+s); ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  function readout(L){
    const ms = Math.round(L.latEma);
    document.getElementById(L.out.l).textContent = (ms?ms:'—') + ' ms';
    document.getElementById(L.out.q).textContent =
      L.mode==='fifo' ? L.q.length : (L.qb.length + L.qg.length);
    document.getElementById(L.out.j).textContent = (L.jit?Math.round(L.jit):'—') + ' ms';
  }

  let acc = 0;
  function frame(now){
    const dt = Math.min(60, now-last); last = now;
    if(running){ lanes.forEach(L=>step(L, dt)); }
    lanes.forEach(L=>draw(L));
    acc += dt;
    if(acc>140){ acc=0; lanes.forEach(readout); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.getElementById('simToggle').onclick = ()=>{
    running = !running;
    document.getElementById('simToggleLabel').textContent = running ? 'Pause' : 'Resume';
  };
  document.getElementById('simBurst').onclick = ()=>{
    BULK_HZ = BULK_HZ > BULK_BASE ? BULK_BASE : BULK_HEAVY;
    document.getElementById('simBurst').lastChild.textContent =
      BULK_HZ > BULK_BASE ? 'Normal load' : 'Add heavy load';
  };
})();

/* ============================================================
   7. RACK BUILD — a stack assembling itself, one device at a time
   Driven by a spec, so the same engine runs several animations:
   the wireless P2P build for each tier, and the indoor build that
   re-labels itself for a home, an office or a business.
   ============================================================ */
const RK = {
  wan:'#4EA8FF', v10:'#A78BFA', v20:'#34D399', v30:'#FBBF24',
  v40:'#F472B6', pwr:'#FF7A18'
};

/* ---------------------------------------------------------------- specs */
function specP2P(core){
  const isFull = core === 'pfsense';
  /* The GL-AX artwork is two antennas above a body. A cable aimed at the top
     of its box lands in the transparent gap between them, so the WAN run
     stops on the body instead. */
  const coreY   = isFull ? 178 : 168;
  const coreH   = isFull ? 66  : 156;
  const bodyTop = isFull ? coreY : coreY + 90;
  const coreMid = isFull ? coreY + coreH/2 : coreY + 118;

  const D = [
    ['ont','ont', 120, 26, 190, 100, 'PLDT modem', isFull ? 'UnCGNAT · bridge' : 'UnCGNAT · routed'],
    isFull ? ['core','pfsense', 120, coreY, 190, coreH, 'pfSense','192.168.2.1 · SQM']
           : ['core','router',  120, coreY, 170, coreH, 'GL-AX1800','192.168.8.1 · SQM'],
    ['poe1','poe-injector', 420, 157, 74, 90, 'PoE',''],
    ['poe2','poe-injector', 420, 277, 74, 90, 'PoE',''],
    ['poe3','poe-injector', 420, 397, 74, 90, 'PoE',''],
    ['lb1','litebeam', 904, 130, 104, 143, '','',
      ['VLAN 110','192.168.110.100–.254', RK.v10]],
    ['lb2','litebeam', 904, 250, 104, 143, '','',
      ['VLAN 20','192.168.20.100–.254', RK.v20]],
    ['lb3','litebeam', 904, 370, 104, 143, '','',
      ['VLAN 30','192.168.30.100–.254', RK.v30]],
    ['ups1','ups', 120, 640, 78, 118, 'UPS','']
  ];

  const outY = isFull ? 300 : coreMid;          // where VLAN runs leave the core
  const W = [
    ['w-ont-core','v',[215,126,215,bodyTop], RK.wan],
    ['w-c-poe1','s',[isFull?310:290, outY-14, 420,202,344], RK.v10],
    ['w-poe1-lb','v',[494,202,904,202], RK.v10],
    ['w-c-poe2','s',[isFull?310:290, outY,    420,322,362], RK.v20],
    ['w-poe2-lb','v',[494,322,904,322], RK.v20],
    ['w-c-poe3','s',[isFull?310:290, outY+14, 420,442,380], RK.v30],
    ['w-poe3-lb','v',[494,442,904,442], RK.v30],
    /* one power spine up the left edge, so both UPS visibly feed the stack */
    /* one bus up the left edge with a stub into every powered box */
    ['w-ups1','raw', 'M159,640 L159,606 L100,606'
       + (isFull ? ' L100,516 L120,516 M100,516 L100,335 L120,335 M100,335' : ' L100,507 L120,507 M100,507')
       + ' L100,'+Math.round(coreMid)+' L120,'+Math.round(coreMid)
       + ' M100,'+Math.round(coreMid)+' L100,76 L120,76', RK.pwr]
  ];

  const T = [
    [699,192, RK.v10,'VLAN 110'], [699,312, RK.v20,'VLAN 20'],
    [699,432, RK.v30,'VLAN 30'],  [104,628, RK.pwr,'UPS bus']
  ];
  const TAGOF = {'w-c-poe1':'VLAN 110','w-c-poe2':'VLAN 20','w-c-poe3':'VLAN 30'};

  if(isFull){
    D.push(['js','switch-managed', 120, 300, 190, 70, 'JetStream','T1500G-10PS · VLANs']);
    D.push(['usw','switch-unmanaged', 120, 470, 190, 92, 'Unmanaged switch','edge fan-out']);
    D.push(['poe4','poe-injector', 420, 560, 74, 90, 'PoE','']);
    D.push(['lb4','litebeam', 560, 533, 104, 143, '','',
      ['VLAN 40','192.168.40.100–.254', RK.v40]]);
    D.push(['ups2','ups', 218, 640, 78, 118, 'UPS','']);
    W.push(['w-core-js','v',[215,244,215,300], RK.wan]);
    W.push(['w-js-usw','v',[215,370,215,470], RK.v40]);
    W.push(['w-usw-poe4','s',[310,562,420,605,362], RK.v40]);
    W.push(['w-poe4-lb4','v',[494,605,560,605], RK.v40]);
    W.push(['w-ups2','raw','M257,640 L257,606 L100,606', RK.pwr]);
    T.push([228,428, RK.v40,'VLAN 40']);
    TAGOF['w-js-usw'] = 'VLAN 40';
  }else{
    D.push(['pc','pc-desktop', 120, 452, 190, 110, 'Admin PC','VLAN 1 · 192.168.8.x']);
    W.push(['w-core-pc','v',[215,coreY+coreH,215,452], RK.wan]);
  }

  return {
    W:1240, H:800, mast:{x:690,y:88,w:520,h:548},
    dev:D, wire:W, tag:T, tagof:TAGOF,
    busy: isFull ? [318,292,'Configuring VLANs'] : [300,236,'Configuring VLANs'],
    steps: (S, a, api) => {
      const {show, wireOn, flowOn, glow, tagOn, busyOn, busyOff, finishGlow} = api;
      a(200,  ()=> show('ont'));
      a(1000, ()=> wireOn('w-ont-core'));
      a(1700, ()=> show('core'));
      a(2300, ()=> { glow('ont','core'); flowOn('w-ont-core'); });
      let t = 2900;
      if(isFull){
        a(t, ()=> wireOn('w-core-js')); t += 700;
        a(t, ()=> show('js'));          t += 500;
        a(t, ()=> busyOn());            t += 2000;
        a(t, ()=> { busyOff(); glow('js'); flowOn('w-core-js'); }); t += 600;
      }else{
        a(t, ()=> busyOn());  t += 2000;
        a(t, ()=> busyOff()); t += 400;
      }
      a(t, ()=> wireOn('w-c-poe1','w-c-poe2','w-c-poe3'));   t += 800;
      a(t, ()=> show('poe1','poe2','poe3'));                 t += 600;
      a(t, ()=> wireOn('w-poe1-lb','w-poe2-lb','w-poe3-lb'));t += 600;
      a(t, ()=> show('mast'));                               t += 500;
      a(t, ()=> show('lb1','lb2','lb3'));                    t += 700;
      a(t, ()=> { glow('poe1','poe2','poe3','lb1','lb2','lb3','mast');
                  flowOn('w-c-poe1','w-c-poe2','w-c-poe3',
                         'w-poe1-lb','w-poe2-lb','w-poe3-lb'); }); t += 900;
      if(isFull){
        a(t, ()=> wireOn('w-js-usw'));  t += 700;
        a(t, ()=> show('usw'));         t += 500;
        a(t, ()=> { glow('usw'); flowOn('w-js-usw'); }); t += 600;
        a(t, ()=> wireOn('w-usw-poe4'));t += 600;
        a(t, ()=> show('poe4'));        t += 500;
        a(t, ()=> wireOn('w-poe4-lb4'));t += 600;
        a(t, ()=> show('lb4'));         t += 600;
        a(t, ()=> { glow('poe4','lb4'); flowOn('w-usw-poe4','w-poe4-lb4'); }); t += 800;
        a(t, ()=> { show('ups1','ups2'); wireOn('w-ups1','w-ups2'); tagOn('UPS bus'); }); t += 1100;
      }else{
        a(t, ()=> wireOn('w-core-pc')); t += 700;
        a(t, ()=> show('pc'));          t += 500;
        a(t, ()=> { glow('pc'); flowOn('w-core-pc'); }); t += 700;
        a(t, ()=> { show('ups1'); wireOn('w-ups1'); tagOn('UPS bus'); }); t += 1100;
      }
      a(t, ()=> finishGlow());
      return t + 1200;
    }
  };
}

/* four VLANs indoors; only the endpoints and the words change per scenario.
   via  - a device the port has to pass through (a PoE injector)
   wifi - this port is an access point, so it radiates to real clients */
const SCENARIOS = {
  home: {
    blurb: 'One fibre line, four separate networks in the house. The people renting a room never touch your machines, and guests never touch either.',
    rows: [
      {art:'pc-desktop', title:'Your own PC', addr:'VLAN 10 · 192.168.10.x', col:RK.v10,
       why:'Admin only. Reaches the router console; nothing else reaches it.'},
      {art:'router', title:'Family Wi-Fi', addr:'VLAN 20 · 192.168.20.x', col:RK.v20,
       why:'Phones, TVs, consoles. Where FQ-CoDel earns its keep at 8 pm.',
       wifi:['phone','laptop']},
      {art:'router-small', title:'Guest Wi-Fi', addr:'VLAN 30 · 192.168.30.x', col:RK.v30,
       why:'Visitors get internet and nothing else. No shared folders, no printers.',
       wifi:['phone']},
      {art:'router-small', title:'House for rent', addr:'VLAN 40 · 192.168.40.x', col:RK.v40,
       why:'A tenant is a stranger on your network. Their own /24, their own share.',
       wifi:['laptop','phone']}
    ]
  },
  office: {
    blurb: 'The CCTV recorder and the staff laptops have no business seeing each other. Four VLANs make that the default rather than something you have to remember.',
    rows: [
      {art:'pc-desktop', title:'Admin workstation', addr:'VLAN 10 · 192.168.10.x', col:RK.v10,
       why:'Yours. Router, switch and NVR consoles live here and only here.'},
      {art:'laptop', title:'Office 1 · staff', addr:'VLAN 20 · 192.168.20.x', col:RK.v20,
       why:'Work machines and the shared drive. One infected laptop stays in this /24.'},
      {art:'router', title:'Office Wi-Fi', addr:'VLAN 30 · 192.168.30.x', col:RK.v30,
       why:'Phones and visitors, kept away from the machines holding your files.',
       wifi:['phone','laptop']},
      {art:'cctv', title:'CCTV / NVR', addr:'VLAN 40 · 192.168.40.x', col:RK.v40,
       why:'Cameras are the least patched things you own. Isolate them, then port-forward the NVR through UnCGNAT.'}
    ]
  },
  business: {
    blurb: 'Multiple floors or a second building. VLAN 40 leaves the wall and crosses to the annex over a point-to-point link, still tagged, still shaped.',
    rows: [
      {art:'laptop', title:'Meeting rooms / other floor', addr:'VLAN 10 · 192.168.10.x', col:RK.v10,
       why:'Presentation gear and hot desks. Reset it any time without touching the rest.'},
      {art:'router', title:'Worker Wi-Fi', addr:'VLAN 20 · 192.168.20.x', col:RK.v20,
       why:'Comms and handhelds. Capped so a big download never starves the tills.',
       wifi:['phone','phone']},
      {art:'cctv', title:'Records + CCTV', addr:'VLAN 30 · 192.168.30.x', col:RK.v30,
       why:'Documents and cameras behind their own rules. Staff Wi-Fi cannot reach it.'},
      {art:'litebeam', title:'PoE → LiteBeam to the annex', addr:'VLAN 40 · 192.168.40.x', col:RK.v40,
       why:'The same VLAN tag rides the wireless hop, so the far building is a floor of this network.',
       via:'poe-injector'}
    ]
  }
};

function specIndoor(core, scen){
  const S = SCENARIOS[scen];
  const isFull = core === 'pfsense';
  const coreY   = isFull ? 180 : 168;
  const coreH   = isFull ? 66  : 156;
  const bodyTop = isFull ? coreY : coreY + 90;
  const coreMid = isFull ? coreY + coreH/2 : coreY + 118;
  const coreR   = isFull ? 300 : 288;

  const D = [
    ['ont','ont', 110, 26, 190, 100, 'PLDT modem', isFull ? 'UnCGNAT · bridge' : 'UnCGNAT · routed'],
    isFull ? ['core','pfsense', 110, coreY, 190, coreH, 'pfSense','192.168.2.1 · SQM']
           : ['core','router',  118, coreY, 170, coreH, 'GL-AX1800','192.168.8.1 · SQM'],
    /* the UPS sits just under the box it protects, not stranded at the
       bottom of the canvas */
    ['ups1','ups', 126, Math.round(coreY+coreH+78), 78, 118, 'UPS','']
  ];
  /* +78 clears the core's caption and its address line, which sit at +15 and +28 */
  const upsY = Math.round(coreY + coreH + 78);
  const Wr = [
    ['w-ont-core','v',[205,126,205,bodyTop], RK.wan],
    ['w-ups1','raw','M165,'+upsY+' L165,'+(upsY-20)+' L92,'+(upsY-20)
       +' L92,'+Math.round(coreMid)+' L'+(isFull?110:118)+','+Math.round(coreMid)
       +' M92,'+Math.round(coreMid)+' L92,76 L110,76', RK.pwr]
  ];
  const T = [[96, upsY-8, RK.pwr,'UPS bus']];
  const TAGOF = {};
  const y0 = 60, dy = 150;

  S.rows.forEach((r,i)=>{
    const y = y0 + i*dy, cy = y + 59;
    /* each VLAN leaves the core at its own height and turns on its own
       column, so four parallel runs never share a segment */
    const outY = coreMid + (i - 1.5) * 15;
    const busX = 336 + i*18;
    if(r.via){
      D.push(['v'+i, r.via, 396, cy-45, 62, 76, '', '']);
      Wr.push(['w-e'+i, 's', [coreR, outY, 396, cy, busX], r.col]);
      Wr.push(['w-x'+i, 'v', [458, cy, 500, cy], r.col]);
      D.push(['e'+i, r.art, 500, y, 120, 118, '', '',
              [r.title, r.addr, r.col], r.why]);
    }else{
      Wr.push(['w-e'+i, 's', [coreR, outY, 500, cy, busX], r.col]);
      D.push(['e'+i, r.art, 500, y, 120, 118, '', '',
              [r.title, r.addr, r.col], r.why]);
    }
    if(r.wifi){
      D.push(['ap'+i, null, 0,0,0,0, '','', null, null,
              {wifi:[858, cy], clients:r.wifi, cy:cy, col:r.col}]);
    }
    TAGOF['w-e'+i] = r.addr.split(' · ')[0];
    T.push([busX+6, y+40, r.col, r.addr.split(' · ')[0]]);
  });

  return {
    W:1240, H:770, dev:D, wire:Wr, tag:T, tagof:TAGOF,
    busy: isFull ? [300,198,'Configuring VLANs'] : [300,236,'Configuring VLANs'],
    blurb: S.blurb,
    steps: (Sq, a, api) => {
      const {show, wireOn, flowOn, glow, tagOn, busyOn, busyOff, finishGlow} = api;
      a(200,  ()=> show('ont'));
      a(1000, ()=> wireOn('w-ont-core'));
      a(1700, ()=> show('core'));
      a(2300, ()=> { glow('ont','core'); flowOn('w-ont-core'); });
      a(2900, ()=> busyOn());
      let t = 4900;
      a(t, ()=> busyOff()); t += 400;
      S.rows.forEach((r,i)=>{
        a(t, ()=> wireOn('w-e'+i)); t += 560;
        if(r.via){
          a(t, ()=> show('v'+i));                       t += 420;
          a(t, ()=> wireOn('w-x'+i));                   t += 420;
        }
        a(t, ()=> show('e'+i));                         t += 480;
        a(t, ()=> { glow('e'+i); if(r.via) glow('v'+i);
                    flowOn('w-e'+i); if(r.via) flowOn('w-x'+i); }); t += 420;
        if(r.wifi){ a(t, ()=> show('ap'+i)); t += 460; }
      });
      a(t, ()=> { show('ups1'); wireOn('w-ups1'); tagOn('UPS bus'); }); t += 1100;
      a(t, ()=> finishGlow());
      return t + 1200;
    }
  };
}

/* ---------------------------------------------------------------- engine */
function makeRack(host, spec){
  const A = p => assetURL('assets/flat/' + p + '.png');
  const seg = (k, v) => {
    if(k === 'raw') return v;                    // explicit path, for the power spine
    if(k === 'v'){
      const [x1,y1,x2,y2] = v;
      return (Math.abs(x1-x2) < 1 || Math.abs(y1-y2) < 1)
        ? `M${x1},${y1} L${x2},${y2}`
        : `M${x1},${y1} L${x1},${(y1+y2)/2} L${x2},${(y1+y2)/2} L${x2},${y2}`;
    }
    const [x1,y1,x2,y2,mx] = v;
    return `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`;
  };

  /* a Wi-Fi fan opening to the right, plus the clients it serves */
  function apGroup(cfg){
    const [x, y] = cfg.wifi;
    let s = '';
    [13,21,29].forEach(r=>{
      s += `<path d="M${(x+0.25*r).toFixed(1)},${(y-0.8*r).toFixed(1)}
                     Q${(x+1.2*r).toFixed(1)},${y} ${(x+0.25*r).toFixed(1)},${(y+0.8*r).toFixed(1)}"
              fill="none" stroke="${cfg.col}" stroke-width="2.1" stroke-linecap="round"/>`;
    });
    let cx = x + 52;
    cfg.clients.forEach(c=>{
      const w = c === 'phone' ? 42 : 96, h = c === 'phone' ? 76 : 78;
      s += `<image href="${A(c)}" x="${cx}" y="${y-h/2}" width="${w}" height="${h}"
              preserveAspectRatio="xMidYMid meet"/>`;
      cx += w + 12;
    });
    return `<g class="wifi tx">${s}</g>`;
  }

  let svg = `<svg viewBox="0 0 ${spec.W} ${spec.H}" role="img"
      aria-label="Network stack assembling itself: each device is wired, powered and brought online before the next one joins">`;

  if(spec.mast){
    svg += `<image class="rk-mast rk-dev" data-id="mast" href="${A('mast')}"
              x="${spec.mast.x}" y="${spec.mast.y}" width="${spec.mast.w}"
              height="${spec.mast.h}" preserveAspectRatio="xMidYMax meet"/>`;
  }

  spec.wire.forEach(([id,kind,v,col])=>{
    const d = seg(kind, v);
    svg += `<path class="rk-wire" data-id="${id}" d="${d}" fill="none" stroke="${col}"
              stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".38"/>`
         + `<path class="rk-flow" data-id="${id}" d="${d}" fill="none" stroke="${col}"
              stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  });

  spec.dev.forEach(([id,art,x,y,w,h,cap,sub,side,why,ap])=>{
    svg += `<g class="rk-dev" data-id="${id}">`;
    if(ap){ svg += apGroup(ap); }
    if(art){
      svg += `<image href="${A(art)}" x="${x}" y="${y}" width="${w}" height="${h}"
                preserveAspectRatio="xMidYMid meet"/>`;
    }
    if(cap){
      svg += `<text x="${x+w/2}" y="${y+h+15}" text-anchor="middle" font-family="var(--sans)"
               font-size="11.5" font-weight="700" fill="var(--text)">${esc(cap)}</text>`;
      if(sub) svg += `<text x="${x+w/2}" y="${y+h+28}" text-anchor="middle"
               font-family="var(--mono)" font-size="9.6" fill="var(--muted)">${esc(sub)}</text>`;
    }
    if(side){
      const cy = y + h/2;
      svg += `<text x="${x+w+12}" y="${cy-(why?10:3)}" text-anchor="start" font-family="var(--sans)"
               font-size="11.5" font-weight="700" fill="${side[2]}">${esc(side[0])}</text>`
           + `<text x="${x+w+12}" y="${cy+(why?4:11)}" text-anchor="start" font-family="var(--mono)"
               font-size="9.6" fill="var(--muted)">${esc(side[1])}</text>`;
      if(why){
        const words = why.split(' ');
        let line = '', lines = [];
        words.forEach(wd=>{
          if((line + ' ' + wd).trim().length > 38){ lines.push(line.trim()); line = wd; }
          else line += ' ' + wd;
        });
        if(line.trim()) lines.push(line.trim());
        lines.slice(0,3).forEach((ln,k)=>{
          svg += `<text x="${x+w+12}" y="${cy+20+k*12}" text-anchor="start"
                   font-family="var(--sans)" font-size="10.2" fill="var(--dim)">${esc(ln)}</text>`;
        });
      }
    }
    svg += `</g>`;
  });

  spec.tag.forEach(([x,y,col,txt])=>{
    svg += `<text class="rk-tag" data-id="tag-${txt}" x="${x}" y="${y}" font-family="var(--mono)"
             font-size="10" font-weight="600" fill="${col}" opacity=".92">${esc(txt)}</text>`;
  });

  if(spec.busy){
    const [bx,by,btxt] = spec.busy;
    svg += `<g class="rk-busy" data-id="busy">
        <rect x="${bx}" y="${by}" width="150" height="30" rx="15"
              fill="var(--panel-solid)" stroke="var(--accent)" stroke-width="1.3"/>
        <g transform="translate(${bx+19},${by+15})"><g class="rk-gear">
          <circle r="6.5" fill="none" stroke="var(--accent)" stroke-width="2"/>
          <path d="M0,-10 V-7 M0,7 V10 M-10,0 H-7 M7,0 H10
                   M-7.1,-7.1 L-5,-5 M5,5 L7.1,7.1 M7.1,-7.1 L5,-5 M-5,5 L-7.1,7.1"
                stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
        </g></g>
        <text x="${bx+34}" y="${by+19}" font-family="var(--mono)" font-size="10"
              font-weight="600" fill="var(--accent)">${esc(btxt)}</text>
      </g>`;
  }

  host.innerHTML = svg + `</svg>`;

  const all = s => [...host.querySelectorAll(s)];
  const el  = id => host.querySelector(`[data-id="${id}"]`);

  all('.rk-wire').forEach(p=>{
    const L = p.getTotalLength();
    p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
  });
  all('.rk-flow').forEach(p=>{
    const L = p.getTotalLength(), dash = 13, gap = Math.max(46, L/2);
    p.style.strokeDasharray = dash + ' ' + gap;
    p.style.setProperty('--len', (dash+gap) + 'px');
    p.style.setProperty('--dur', ((dash+gap)/130).toFixed(2) + 's');
  });

  const S = [];
  const a = (t, fn) => S.push([t, fn]);
  const api = {
    show:  (...ids)=> ids.forEach(i=> el(i) && el(i).classList.add('on')),
    glow:  (...ids)=> ids.forEach(i=> el(i) && el(i).classList.add('lit')),
    wireOn:(...ids)=> ids.forEach(i=>{
      const p = host.querySelector(`path.rk-wire[data-id="${i}"]`);
      if(p) p.style.strokeDashoffset = 0;
    }),
    flowOn:(...ids)=> ids.forEach(i=>{
      const p = host.querySelector(`path.rk-flow[data-id="${i}"]`);
      if(p) p.classList.add('on');
      const key = spec.tagof && spec.tagof[i];
      if(key){ const t = el('tag-'+key); if(t) t.classList.add('on'); }
    }),
    tagOn: txt => { const t = el('tag-'+txt); if(t) t.classList.add('on'); },
    busyOn:  ()=> el('busy') && el('busy').classList.add('on'),
    busyOff: ()=> el('busy') && el('busy').classList.remove('on'),
    finishGlow: ()=> host.classList.add('done')
  };
  const total = spec.steps(S, a, api);

  let timers = [], playing = false;
  const panel = host.closest('.rackpanel') || host.parentNode;
  const lbl = panel.querySelector('[data-replay-label]');

  function reset(){
    timers.forEach(clearTimeout); timers = [];
    host.classList.remove('done');
    all('.rk-dev').forEach(e=>e.classList.remove('on','lit'));
    all('.rk-flow').forEach(e=>e.classList.remove('on'));
    all('.rk-tag').forEach(e=>e.classList.remove('on'));
    all('.rk-busy').forEach(e=>e.classList.remove('on'));
    all('.rk-wire').forEach(p=>{ p.style.strokeDashoffset = p.getTotalLength(); });
  }
  function finish(){
    timers.forEach(clearTimeout); timers = [];
    S.forEach(([,fn])=>fn());
    api.busyOff(); host.classList.add('done');
    playing = false; if(lbl) lbl.textContent = 'Replay';
  }
  function play(){
    reset(); playing = true; if(lbl) lbl.textContent = 'Skip to end';
    timers = S.map(([t,fn])=>setTimeout(fn, t));
    timers.push(setTimeout(()=>{ playing = false; if(lbl) lbl.textContent = 'Replay'; }, total));
  }
  return {play, finish, reset, toggle: ()=> playing ? finish() : play()};
}

/* ---------------------------------------------------------------- wiring */
(function(){
  const slides = [...document.querySelectorAll('.rackslide')];
  if(!slides.length) return;

  slides.forEach(root=>{
    const core = root.dataset.core;
    const panels = [...root.querySelectorAll('.rackpanel')];
    const insts = [];
    let scen = 'home';

    function buildPanel(i){
      const host = panels[i].querySelector('.rackwrap');
      const spec = i === 0 ? specP2P(core) : specIndoor(core, scen);
      insts[i] = makeRack(host, spec);
      const note = panels[i].querySelector('[data-blurb]');
      if(note && spec.blurb) note.textContent = spec.blurb;
      return insts[i];
    }

    panels.forEach((p,i)=>{
      const rp = p.querySelector('[data-replay]');
      if(rp) rp.addEventListener('click', ()=> insts[i] && insts[i].toggle());
    });

    root.querySelectorAll('[data-anim]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const i = +b.dataset.anim;
        root.querySelectorAll('[data-anim]').forEach(x=>x.classList.toggle('on', x===b));
        panels.forEach((p,k)=>p.classList.toggle('on', k===i));
        if(!insts[i]) buildPanel(i);
        insts[i].play();
      });
    });

    root.querySelectorAll('[data-scen]').forEach(b=>{
      b.addEventListener('click', ()=>{
        scen = b.dataset.scen;
        root.querySelectorAll('[data-scen]').forEach(x=>x.classList.toggle('on', x===b));
        buildPanel(1).play();
      });
    });

    let started = false;
    const kick = ()=>{
      if(started || !root.classList.contains('on')) return;
      started = true;
      const inst = buildPanel(0);
      if(matchMedia('(prefers-reduced-motion: reduce)').matches) inst.finish();
      else inst.play();
    };
    new MutationObserver(kick).observe(root, {attributes:true, attributeFilter:['class']});
    kick();
  });
})();
