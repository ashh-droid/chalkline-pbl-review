#!/usr/bin/env python3
"""Deterministic CSV normalizer. Python standard library only. Run from project root."""
from pathlib import Path
import csv,json,collections,shutil,sys
root=Path(__file__).resolve().parents[1]
raw=root/'original_data'; out=root/'docs'/'data'; out.mkdir(parents=True,exist_ok=True)

def load(pattern):
    files=list(raw.rglob(pattern))
    if not files: raise FileNotFoundError(pattern)
    with files[0].open(newline='',encoding='utf-8-sig') as f: return list(csv.DictReader(f))

def n(x): return int(x or 0)

rows=[]
for month in ['July','August','September']:
    for r in load(f'PBL_School_Response_Data_{month}_2025.csv'):
        classes=[]
        for grade in (6,7,8):
            prefix=f'Average student attendance during the Class {grade} PBL '
            enrolled=n(r[f'Total number of students enrolled in Class {grade}, including all sections'])
            classes.append({'grade':grade,'enrolled':enrolled,
                'science':n(next(v for k,v in r.items() if k.startswith(prefix+'Science session.'))),
                'math':n(next(v for k,v in r.items() if k.startswith(prefix+'Math session.')))})
        rows.append({'month':r['Reporting Month'],'schoolId':r["What is your school's synthetic school code?"],
            'school':r['What is the name of your school?'],'district':r['What is the name of your district?'],
            'block':r['Block Details'],'conducted':r['Was the PBL project conducted in your school this month?']=='Yes',
            'evidence':r['Was evidence submitted for the completed PBL project?']=='Yes',
            'reportedClasses':r['In which class/classes did you conduct the PBL project?'],
            'reportedSubjects':r['Which subject do you teach?'],'classes':classes,
            'sourceRate':float(r['Derived: Overall PBL attendance rate'] or 0),
            'sourceRisk':r['Derived: Risk status']})

def read(s): return load(s)
fin=[{**r,'approved':n(r['approved_budget_units']),'monthly':n(r['monthly_utilized_units']),
       'cumulative':n(r['cumulative_utilized_units']),'sourceRate':float(r['cumulative_utilization_rate'])} 
       for r in read('01_Grant_Profile_and_Finance.csv')]
perf=[{**r,'sourceSchools':n(r['sampled_school_records']), 'sourceCompleted':n(r['schools_completed_pbl']),
        'sourceEvidence':n(r['schools_with_evidence']),'sourceEnrolled':n(r['total_enrollment']),
        'sourceAttendance':n(r['total_attendance'])} for r in read('02_Grant_Performance_and_Report_Material.csv')]
media=[{**r,'url':'media/'+Path(r['relative_path']).name} for r in read('03_Evidence_and_Media_Index.csv')]

for filename,items in [('schools.json',rows),('finance.json',fin),('grants.json',perf),('media.json',media)]:
    (out/filename).write_text(json.dumps(items,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

# Preserve untouched evidence asset bytes.
for p in raw.rglob('*.png'): shutil.copy2(p,root/'docs'/'media'/p.name)

# Baseline import quality report. Source fields are never overwritten.
quality=collections.Counter()
for r in rows:
    en=sum(c['enrolled'] for c in r['classes'])
    at=sum(c['science']+c['math'] for c in r['classes'])
    if abs(at/(2*en) -r['sourceRate'])>0.00011 if en else r['sourceRate']!=0: quality['attendanceFormulaMismatch']+=1
    if r['conducted']:
        grades=[c['grade'] for c in r['classes'] if c['science'] or c['math']]
        reported=r['reportedClasses']
        if any(str(g) not in reported for g in grades):quality['gradeSurveyContradictions']+=1
        if ('Math' not in r['reportedSubjects'] and any(c['math']>0 for c in r['classes'])) or ('Science' not in r['reportedSubjects'] and any(c['science']>0 for c in r['classes'])):
            quality['subjectSurveyContradictions']+=1
quality['rows']=len(rows);quality['schools']=len(set(r['schoolId'] for r in rows));quality['blocks']=len(set(r['block'] for r in rows));quality['districts']=len(set(r['district'] for r in rows))
for r in fin:
    if abs(r['cumulative']/r['approved']-r['sourceRate'])>0.001:quality['financeRateMismatch']+=1
bykey=collections.defaultdict(list)
for r in fin: bykey[(r['grant_id'],r['budget_line'])].append(r)
for seq in bykey.values():
    total=0
    for r in sorted(seq,key=lambda r:r['reporting_month']):
        total+=r['monthly']
        if total!=r['cumulative']:quality['financeRunningTotalMismatch']+=1
(out/'quality.json').write_text(json.dumps(dict(quality),indent=2),encoding='utf-8')
print(dict(quality))
