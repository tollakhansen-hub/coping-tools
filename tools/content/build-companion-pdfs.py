#!/usr/bin/env python3
"""Generate the six companion downloads from the canonical HTML, never duplicate copy."""
from pathlib import Path
import argparse
from xml.sax.saxutils import escape
from bs4 import BeautifulSoup
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path(__file__).resolve().parents[2]
FONT_DIR=ROOT/'tools/content/fonts'
pdfmetrics.registerFont(TTFont('CareSans',str(FONT_DIR/'LiberationSans-Regular.ttf')))
pdfmetrics.registerFont(TTFont('CareSans-Bold',str(FONT_DIR/'LiberationSans-Bold.ttf')))
pdfmetrics.registerFontFamily('CareSans',normal='CareSans',bold='CareSans-Bold')
STYLE={
 'title':ParagraphStyle('title',fontName='CareSans-Bold',fontSize=17,leading=21,spaceAfter=12),
 'heading':ParagraphStyle('heading',fontName='CareSans-Bold',fontSize=11.5,leading=14,spaceBefore=8,spaceAfter=4,keepWithNext=True),
 'body':ParagraphStyle('body',fontName='CareSans',fontSize=11.5,leading=15,spaceAfter=7,allowWidows=0,allowOrphans=0),
 'kicker':ParagraphStyle('kicker',fontName='CareSans',fontSize=10,leading=13,spaceAfter=6,textColor=colors.HexColor('#245d59')),
}
def inline(node):
 return ''.join('<b>'+escape(c.get_text())+'</b>' if getattr(c,'name',None)=='strong' else escape(c.get_text() if getattr(c,'name',None) else str(c)) for c in node.children)
def section_story(section,title):
 story=[Paragraph(escape(title),STYLE['kicker']),Paragraph(escape(section.summary.get_text(' ',strip=True)),STYLE['title'])]
 for part in section.select('.care-part'):
  for block in part.find_all(['h3','p'],recursive=False):
   para=Paragraph(inline(block),STYLE['heading' if block.name=='h3' else 'body'])
   story.append(KeepTogether([para]) if block.name=='p' and block.find('strong') else para)
 return story

def main():
 parser=argparse.ArgumentParser()
 parser.add_argument('--date',required=True,help='Content/output version date, YYYY-MM-DD')
 parser.add_argument('--language',choices=['en','es'],default='en')
 args=parser.parse_args()
 from datetime import date
 date.fromisoformat(args.date)
 spanish=args.language=='es'
 site_root=ROOT/'es' if spanish else ROOT
 url='https://coping.tools/'+('es/' if spanish else '')+'practical-support/'
 date_label='Actualizado' if spanish else 'Updated'
 filename_prefix='es-' if spanish else ''
 page=BeautifulSoup((site_root/'practical-support/index.html').read_text(),'html.parser')
 title=page.h1.get_text(' ',strip=True)
 sections=page.select('details.care-disclosure:not(.evidence)')
 assert len(sections)==5
 def footer(canvas,doc):
  canvas.saveState();canvas.setStrokeColor(colors.HexColor('#cdc9bf'));canvas.line(42,39,A4[0]-42,39)
  canvas.setFont('CareSans',8);canvas.setFillColor(colors.HexColor('#4f554f'))
  canvas.drawString(42,27,f'{date_label} {args.date} | {url.removeprefix("https://")}')
  canvas.linkURL(url,(42,23,320,36),relative=0)
  canvas.drawRightString(A4[0]-42,27,str(doc.page));canvas.restoreState()
 def build(name,selected):
  story=[]
  for index,section in enumerate(selected):
   if index:story.append(PageBreak())
   story.extend(section_story(section,title))
  SimpleDocTemplate(str(site_root/'pdf'/f'{filename_prefix}{name}'),pagesize=A4,leftMargin=42,rightMargin=42,topMargin=35,bottomMargin=49,title=title,author='coping.tools',invariant=1).build(story,onFirstPage=footer,onLaterPages=footer)
 for i,section in enumerate(sections,1):build(f'practical-support-section-{i}.pdf',[section])
 build('practical-support-all-five.pdf',sections)
if __name__=='__main__':main()
