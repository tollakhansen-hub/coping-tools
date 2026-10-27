/* PDFs stay on-device. Only anonymous route/action/day counts are recorded on button presses. */
(() => {
  'use strict';
  const bar = document.querySelector('[data-guide-actions]');
  const main = document.querySelector('.tool-page main');
  if (!bar || !main) return;
  const getText = element => {
    if (!element) return '';
    const copy = element.cloneNode(true);
    copy.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')));
    return (copy.textContent || '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  };
  const getGuide = () => {
    const sections = [...main.querySelectorAll('.tool-section')].map(section => ({
      stage: getText(section.querySelector('.stage-heading h2')),
      title: getText(section.querySelector('.stage-heading .tool-title')),
      blocks: [...section.querySelectorAll('p,li,h3')].filter(el => !el.closest('.stage-heading')).map(el => ({
        style: el.tagName === 'H3' ? 'h3' : el.tagName === 'LI' ? 'li' : el.classList.contains('prompt') || el.classList.contains('reassurance') ? 'bold' : 'p',
        text: getText(el)
      })).filter(block => block.text)
    }));
    const guide = {title:getText(main.querySelector('h1')),intro:getText(main.querySelector('.route-intro')),sections,urgent:getText(main.querySelector('.urgent-note')),path:window.location.pathname};
    if (!guide.title || !guide.urgent || !sections.length || !/^\/[a-z0-9-]+\/$/.test(guide.path)) throw new Error('Guide content missing');
    return guide;
  };
  const special = {'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
  const escaped = text => {
    let out = '';
    for (const c of text) {
      let code = Object.prototype.hasOwnProperty.call(special,c) ? special[c] : c.codePointAt(0);
      if (code < 32 || code > 255) code = 63;
      if (code === 40 || code === 41 || code === 92) out += '\\';
      out += String.fromCharCode(code);
    }
    return out;
  };
  const width = (str,size) => {
    let w = 0;
    for (const c of str) w += c === ' ' ? .28 : 'ilI.,:;!|'.includes(c) ? .27 : 'mwMW@%'.includes(c) ? .86 : /[A-Z]/.test(c) ? .67 : .52;
    return w * size;
  };
  const wrap = (str,size,max) => {
    const result=[];let line='';
    for (const word of str.trim().split(/\s+/)) {
      if (!word) continue;
      const next=line ? line+' '+word : word;
      if (line && width(next,size)>max) {result.push(line);line=word;} else line=next;
    }
    if (line) result.push(line);
    return result.length ? result : [''];
  };
  function buildPdf(guide) {
    const W=595.28,H=841.89,L=48,R=48,INK='.125 .145 .133',GREEN='.141 .365 .349',MUTED='.35 .38 .36';
    let commands=[],pages=[],y=H-54;
    const put = line => commands.push(line);
    const draw=(str,font,size,color,x,pos) => put('BT /'+font+' '+size+' Tf '+color+' rg 1 0 0 1 '+x.toFixed(2)+' '+pos.toFixed(2)+' Tm ('+escaped(str)+') Tj ET');
    const newPage=()=>{draw('coping.tools  |  '+guide.path,'F1',8.2,MUTED,L,31);pages.push(commands.join('\n')+'\n');commands=[];y=H-54;};
    const ensure=h=>{if(y-h<68)newPage();};
    const para=(str,opt={})=>{
      const size=opt.size||10.6,leading=opt.leading||14.6,x=L+(opt.indent||0),font=opt.bold?'F2':'F1';
      for (const part of String(str).split(/\n\s*\n/)) {
        const lines=wrap(part.replace(/\n/g,' '),size,W-R-x);
        ensure(lines.length*leading+(opt.after===undefined?5:opt.after));
        for(const line of lines){draw(line,font,size,opt.color||INK,x,y);y-=leading;}
        y-=opt.after===undefined?5:opt.after;
      }
    };
    draw('coping.tools','F2',9.5,GREEN,L,y);y-=15;
    put(GREEN+' RG .8 w '+L+' '+y.toFixed(2)+' m '+(W-R)+' '+y.toFixed(2)+' l S');y-=28;
    para(guide.title,{size:21,leading:26,bold:true,after:11});
    para(guide.intro,{size:11,leading:15.2,after:10});
    // Measure each stage before placing its heading. If the complete stage fits
    // on a page, keep it together; otherwise keep the heading with the first
    // instructions and allow the remaining paragraphs to flow naturally.
    const textHeight=(str,size,leading,after,indent=0)=>String(str).split(/\n\s*\n/).reduce(
      (total,part)=>total+wrap(part.replace(/\n/g,' '),size,W-R-L-indent).length*leading+after,0
    );
    for(const section of guide.sections){
      let needed=11+17
        +textHeight(section.stage.toUpperCase(),8.8,12,1)
        +textHeight(section.title,14,18,8);
      for(const block of section.blocks){
        if(block.style==='h3')needed+=6+textHeight(block.text,11.6,16,6);
        else if(block.style==='li')needed+=textHeight('•  '+block.text,10.6,14.6,3,7);
        else needed+=textHeight(block.text,10.6,14.6,5);
      }
      const fullPageSpace=H-54-68;
      ensure(needed+8 <= fullPageSpace ? needed+8 : 150);
      y-=11;
      put(GREEN+' RG .8 w '+L+' '+y.toFixed(2)+' m '+(L+45)+' '+y.toFixed(2)+' l S');y-=17;
      para(section.stage.toUpperCase(),{size:8.8,bold:true,color:GREEN,leading:12,after:1});
      para(section.title,{size:14,bold:true,leading:18,after:8});
      for(const block of section.blocks){
        if(block.style==='h3'){ensure(85);y-=6;para(block.text,{size:11.6,bold:true,leading:16,after:6});}
        else if(block.style==='li')para('•  '+block.text,{indent:7,after:3});
        else para(block.text,{bold:block.style==='bold'});
      }
    }
    ensure(65);y-=14;
    put(GREEN+' RG .8 w '+L+' '+y.toFixed(2)+' m '+(W-R)+' '+y.toFixed(2)+' l S');y-=23;
    para(guide.urgent,{size:10,bold:true,leading:14});
    para('More about this guide: coping.tools'+guide.path,{size:8.6,leading:11,color:MUTED,after:0});
    newPage();
    const objects=['<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
    const kids=[];
    for(const page of pages){
      const streamId=objects.push('<< /Length '+page.length+' >>\nstream\n'+page+'endstream');
      const pageId=objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+streamId+' 0 R >>');
      kids.push(pageId+' 0 R');
    }
    objects[1]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+kids.length+' >>';
    const bytes=[];const add=str=>{for(let i=0;i<str.length;i++)bytes.push(str.charCodeAt(i));};
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const offsets=[0];
    objects.forEach((object,index)=>{offsets.push(bytes.length);add((index+1)+' 0 obj\n'+object+'\nendobj\n');});
    const xref=bytes.length;
    add('xref\n0 '+offsets.length+'\n0000000000 65535 f \n');
    for(let i=1;i<offsets.length;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
    add('trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
    return new Blob([Uint8Array.from(bytes)],{type:'application/pdf'});
  }

  const recordAction = action => {
    // Best effort and never blocks printing or saving. No identifiers are sent.
    try {
      const payload = JSON.stringify({ page: window.location.pathname, action });
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon && navigator.sendBeacon('/api/guide-event', blob)) return;
      if (window.fetch) {
        fetch('/api/guide-event', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
    } catch { /* Counters are optional, printing must still work. */ }
  };
  const print=bar.querySelector('[data-guide-print]');
  const save=bar.querySelector('[data-guide-save]');
  if(print)print.addEventListener('click',()=>{ recordAction('print'); window.print(); });
  if(save && typeof Blob!=='undefined' && URL.createObjectURL){
    save.addEventListener('click',()=>{
      try{
        const guide=getGuide(),url=URL.createObjectURL(buildPdf(guide)),a=document.createElement('a');
        a.href=url;a.download='coping-tools-'+guide.path.slice(1,-1)+'.pdf';
        document.body.appendChild(a);a.click();recordAction('pdf');a.remove();
        window.setTimeout(()=>URL.revokeObjectURL(url),10000);
      }catch(error){console.error('Guide PDF unavailable.',error);window.alert('The PDF could not be saved. Try Print and choose Save as PDF.');}
    });
  }else if(save)save.remove();
  bar.hidden=false;
})();
