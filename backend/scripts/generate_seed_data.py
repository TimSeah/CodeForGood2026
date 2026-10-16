# Regenerates src/lib/db/seed-data.ts from the Case-Allocation workbook (stdlib only, no openpyxl).
# Usage (from backend/):  python scripts/generate_seed_data.py ../docs/data/Case-Allocation.xlsx > src/lib/db/seed-data.ts
import sys, re, json, zipfile, html
sys.stdout.reconfigure(encoding='utf-8')


def cells(f, sheet_index):
    z=zipfile.ZipFile(f)
    ss=[html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>',si,re.S))) for si in re.findall(r'<si>(.*?)</si>',z.read('xl/sharedStrings.xml').decode(),re.S)]
    x=z.read(f'xl/worksheets/sheet{sheet_index}.xml').decode()
    rows={}
    for rnum,row in re.findall(r'<row [^>]*r="(\d+)"[^>]*>(.*?)</row>',x,re.S):
        d={}
        for attrs,body in re.findall(r'<c ([^>]*?)(?:/>|>(.*?)</c>)',row,re.S):
            v=re.search(r'<v>(.*?)</v>',body or ''); t=re.search(r't="(\w+)"',attrs)
            col=re.match(r'r="([A-Z]+)',re.search(r'r="\w+"',attrs).group(0)).group(1)
            if not v: continue
            d[col]=ss[int(v.group(1))] if t and t.group(1)=='s' else v.group(1)
        rows[int(rnum)]=d
    return rows
rows=cells(sys.argv[1],1)
def to24(t,slot):
    h,m=t.strip().split(':'); h=int(h)
    if slot=='PM' and h<12: h+=12
    return f'{h:02d}:{m}'
def times(raw,slot):
    if not raw or not raw.strip(): return ('08:30','12:00') if slot=='AM' else ('14:00','17:30')
    raw=raw.split('|')[0]
    a,b=re.split(r'\s*-\s*',raw.strip())[:2]
    return to24(a,slot),to24(b,slot)
therapists=[]; patterns=[]; off=[]
for r in sorted(rows):
    d=rows[r]
    if 'A' in d and d.get('A','').isdigit() and 'B' in d:
        name=d['B'].replace('(PT)','').strip()
        pt='(PT)' in d['B']
        therapists.append(dict(name=name,rank=d.get('C','').strip('[] '),isPartTime=pt,homeArea=d.get('D','').strip()))
        for slot,row in (('AM',d),('PM',rows.get(r+1,{}))):
            for days,tc,sc in (('MWF','E','F'),('TT','G','H')):
                stu=row.get(sc,'').strip()
                if stu.lower()=='x': off.append(dict(therapist=name,days=days,slot=slot)); continue
                if not stu or stu.lower().startswith('replacement'): continue
                loc='clinic'
                m=re.search(r'\((home|school)\)',stu,re.I)
                if m: loc=m.group(1).lower(); stu=re.sub(r'\s*\(.*?\)','',stu).strip()
                st,en=times(row.get(tc),slot)
                for s in stu.split('/'):
                    patterns.append(dict(therapist=name,days=days,slot=slot,start=st,end=en,student=s.strip(),location=loc))
students=sorted({p['student'] for p in patterns})
print('// AUTO-GENERATED from docs/data/Case-Allocation.xlsx ("July 2031 Allocation" sheet).')
print('// Weekly recurring pattern: MWF = Mon/Wed/Fri, TT = Tue/Thu. Regenerate rather than hand-edit if the sheet changes.')
print('// Note: "Brock/Luke" style entries (alternating children) are expanded into one row per child.\n')
print('import type { Location, Rank, Slot } from "@/lib/types";\n')
print('export const SEED_THERAPISTS: { name: string; rank: Rank; isPartTime: boolean; homeArea: string }[] = ' + json.dumps(therapists,indent=2,ensure_ascii=False) + ';\n')
print('export const SEED_STUDENTS: string[] = ' + json.dumps(students,ensure_ascii=False) + ';\n')
print('export const SEED_WEEKLY_PATTERN: {\n  therapist: string;\n  days: "MWF" | "TT";\n  slot: Slot;\n  start: string;\n  end: string;\n  student: string;\n  location: Location;\n}[] = ' + json.dumps(patterns,indent=2,ensure_ascii=False) + ';')
print('\n// Slots a (part-time) therapist does not work, marked "x" in the sheet.')
print('export const SEED_OFF_SLOTS: { therapist: string; days: "MWF" | "TT"; slot: Slot }[] = ' + json.dumps(off,indent=2,ensure_ascii=False) + ';')
