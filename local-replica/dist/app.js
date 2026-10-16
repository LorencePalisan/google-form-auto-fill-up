const $ = id => document.getElementById(id);
let responses = [];
let batch = 'manual';
const labels = ['Strongly Disagree', 'Disagree', 'Agree', 'Strongly Agree'];
SECTIONS.forEach((section, s) => {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend'); legend.textContent = section.name; fieldset.append(legend);
  section.questions.forEach((text, q) => {
    const label = document.createElement('label'); label.className = 'question'; label.textContent = `${q+1}. ${text}`;
    const select = document.createElement('select'); select.id = `answer-${s}-${q}`; select.required = true;
    select.add(new Option('Choose an answer', ''));
    labels.forEach((name,i) => select.add(new Option(`${i+1} — ${name}`, String(i+1))));
    label.append(select); fieldset.append(label);
  });
  $('questions').append(fieldset);
});
function render(message) {
  $('results').replaceChildren();
  PearsonAnalysis.analyze(responses.map(r=>r.flat())).forEach(result => {
    const tr = document.createElement('tr');
    const p = result.p === null ? 'N/A' : result.p < 0.000001 ? '< 0.000001' : result.p.toPrecision(6);
    [result.variable,result.role,result.n,result.r?.toFixed(4) ?? 'N/A',p,
      result.reason || `Demo only: ${result.decision}`].forEach(value => {
      const td=document.createElement('td');td.textContent=value;tr.append(td);
    });
    $('results').append(tr);
  });
  $('export').disabled = !responses.length;
  $('export-results').disabled = !responses.length;
  if (message) $('status').textContent = message;
}
$('generator').addEventListener('submit', event => {
  event.preventDefault();
  const count=Number($('count').value),seed=Number($('seed').value),mode=$('mode').value;
  if (!Number.isInteger(count) || count<2 || count>10000 || !Number.isInteger(seed) || seed<0 || seed>4294967295) return;
  responses=SurveyStats.generate(count,seed,mode,SECTIONS.map(s=>s.questions.length));
  batch=`${mode}; seed=${seed}`;
  render(`${responses.length} synthetic test responses · ${batch}`);
});
$('manual').addEventListener('submit',event=>{
  event.preventDefault();
  responses.push(SECTIONS.map((s,i)=>s.questions.map((_,j)=>Number($(`answer-${i}-${j}`).value))));
  batch += '; manual response added';
  render(`${responses.length} test responses · includes manual test entries`); $('manual').reset();
});
$('clear').addEventListener('click',()=>{responses=[];batch='manual';render('Local batch cleared.');});
$('export').addEventListener('click',()=>{
  const quote=v=>'"'+String(v).replaceAll('"','""')+'"';
  const headers=['DataType','TestRespondentID','Batch',...SECTIONS.flatMap(s=>s.questions.map(q=>`${s.name} [${q}]`))];
  const rows=[headers,...responses.map((r,i)=>['SYNTHETIC TEST ONLY',`TEST-${String(i+1).padStart(4,'0')}`,batch,...r.flat()])];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='synthetic-test-responses.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('export-results').addEventListener('click',()=>{
  const report={dataType:'SYNTHETIC TEST ONLY',batch,significanceLevel:0.05,
    alternative:'two-sided',note:'Demonstration only; not evidence for research findings. Exploratory p-values are unadjusted.',
    results:PearsonAnalysis.analyze(responses.map(r=>r.flat()))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='demo-pearson-results.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
render();
