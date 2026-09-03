const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const file = process.argv[2] || 'e:/db_trainer/index.html';
const html = fs.readFileSync(file, 'utf8');
const errors = [];
const vc = new VirtualConsole(); vc.on('jsdomError', e => { const m = e.message || ''; if (!/scrollTo|getContext/.test(m)) errors.push('JS: ' + m.slice(0, 120)); });
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'http://localhost/' });
const { window } = dom;
window.addEventListener('error', e => errors.push('window error: ' + e.message));

setTimeout(() => {
  const d = window.document, q = s => d.querySelector(s), all = s => [...d.querySelectorAll(s)];
  const click = s => { const el = q(s); if (!el) { errors.push('MISSING ' + s); return null; } el.click(); return el; };

  // вкладки
  const tabs = all('.tab').map(t => t.dataset.tab), panels = all('.panel').map(p => p.id);
  console.log('вкладок:', tabs.length);
  tabs.forEach(t => { if (!panels.includes(t)) errors.push('вкладка без панели: ' + t); });
  all('.tab').forEach(t => { t.click(); const p = d.getElementById(t.dataset.tab); if (!p || !p.classList.contains('active')) errors.push('не переключилась: ' + t.dataset.tab); });

  // --- детектор зависимостей ---
  const from = q('#fd-from'), to = q('#fd-to');
  console.log('детектор: вариантов слева', from.options.length, '| справа', to.options.length, '| строк в таблице', all('#fd-table tbody tr').length);
  const cases = [['1','2','ok'], ['0','4','err'], ['5','6','ok'], ['k','4','ok']];
  cases.forEach(([f, t, want]) => {
    from.value = f; to.value = t; click('#fd-go');
    const cls = q('#fd-msg').className;
    if (!cls.includes(want)) errors.push('детектор: ' + f + '→' + t + ' ожидалось ' + want + ', получено «' + cls + '»');
  });
  from.value = '0'; to.value = '4'; click('#fd-go');
  if (!all('#fd-table tr.fdbad').length) errors.push('детектор: не подсвечены строки-контрпримеры');
  console.log('  контрпримеры подсвечиваются: да');

  // --- частичная: клик по столбцам ---
  let pdKinds = new Set();
  [2, 3, 4, 5, 6].forEach(i => {
    const th = all('#pd-table th')[i]; if (!th) { errors.push('нет столбца ' + i); return; }
    th.click();
    const t = q('#pd-arrows').textContent;
    if (t.includes('частичная')) pdKinds.add('partial');
    if (t.includes('полная')) pdKinds.add('full');
    if (t.includes('транзитивная')) pdKinds.add('trans');
    if (!q('#pd-msg').textContent.length) errors.push('частичная: пустой разбор столбца ' + i);
  });
  console.log('частичная: виды зависимостей показаны —', [...pdKinds].join(', '));
  if (pdKinds.size !== 3) errors.push('частичная: должны быть все три вида (полная, частичная, транзитивная)');

  // --- транзитивная ---
  click('#tr-play'); click('#tr-play');
  if (!q('#tr-vis').textContent.includes('транзитивная')) errors.push('транзит: не выводится вывод о транзитивной зависимости');
  click('#tr-cut');
  if (!all('#tr-vis .cut').length || !q('#tr-msg').className.includes('ok')) errors.push('транзит: разрыв цепочки не сработал');
  console.log('транзит: цепочка проходится и разрывается');

  // --- тренажёр зависимостей ---
  const fdq = all('#fdq-list .qcard');
  console.log('тренажёр зависимостей:', fdq.length, '(exp 8)');
  fdq.forEach(c => { c.querySelector('.qopt').click(); if (!c.querySelector('.qwhy').textContent.length) errors.push('нет разбора в тренажёре зависимостей'); if (!c.querySelector('.qopt.correct')) errors.push('не подсвечен верный ответ'); });
  if (fdq.length !== 8) errors.push('ожидалось 8 ситуаций');

  // --- нормальные формы ---
  const nf = all('#nf-tabs button');
  nf.forEach(b => { b.click(); const t = q('#nf-body').textContent; if (!t.includes('Формально') || !t.includes('По-русски')) errors.push('НФ без формулировки: ' + b.textContent); });
  console.log('нормальных форм:', nf.length, '(exp 5)');

  // --- типы данных ---
  const ty = all('#ty-tabs button');
  ty.forEach(b => { b.click(); const t = q('#ty-body').textContent; ['Что это','Где применять','Где ошибаются','Правило'].forEach(s => { if (!t.includes(s)) errors.push('тип ' + b.textContent + ': нет блока «' + s + '»'); }); if (!q('#ty-body .ty-code')) errors.push('тип ' + b.textContent + ': нет кода'); });
  console.log('типов данных:', ty.length, '(exp 15)');
  const tv = all('#tv-tabs button');
  tv.forEach(b => { b.click(); if (!q('#tv-body table') || !q('#tv-body .note')) errors.push('пара ' + b.textContent + ': нет сравнения'); });
  console.log('пар для сравнения:', tv.length, '(exp 6)');

  // --- семьи SQL ---
  const fam = all('#fam-tabs button'); let famCmds = 0;
  fam.forEach(b => { b.click(); const cmds = all('#fam-cmds button'); famCmds += cmds.length;
    cmds.forEach(c => { c.click(); if (!q('#fam-sql').textContent.length) errors.push('семья ' + b.textContent + ': нет SQL'); if (!q('#fam-msg').textContent.length) errors.push('семья ' + b.textContent + ': нет пояснения'); }); });
  console.log('семей SQL:', fam.length, '(exp 5) | команд всего:', famCmds);
  if (fam.length !== 5) errors.push('ожидалось 5 семей SQL');
  const famq = all('#famq-list .qcard');
  famq.forEach(c => { c.querySelector('.qopt').click(); if (!c.querySelector('.qopt.correct')) errors.push('тренажёр семей: нет верного ответа'); });
  console.log('тренажёр семей:', famq.length, '(exp 12)');

  // --- движок ---
  const eng = all('#eng-toc button');
  eng.forEach(b => { b.click(); if (!q('#eng-body').textContent.length || !q('#eng-msg').textContent.length) errors.push('движок: пустая глава ' + b.textContent); });
  console.log('глав движка:', eng.length, '(exp 8)');
  if (eng.length !== 8) errors.push('ожидалось 8 глав движка');
  eng[3].click(); if (!q('#eng-stage .pg-page')) errors.push('движок: нет схемы страницы 8 КБ');

  // --- MVCC ---
  click('#mv-t1'); const before = all('#mv-heap tbody tr').length;
  click('#mv-upd'); const after = all('#mv-heap tbody tr').length;
  console.log('MVCC: версий до UPDATE', before, '→ после', after);
  if (after !== before + 1) errors.push('MVCC: UPDATE не создал новую версию');
  click('#mv-commit');
  if (!all('#mv-heap tr.mv-dead').length) errors.push('MVCC: старая версия не помечена мёртвой');
  click('#mv-read');
  if (!q('#mv-msg').textContent.includes('1200')) errors.push('MVCC: T1 должна видеть старое значение');
  console.log('  T1 видит старую версию после COMMIT T2: да');
  click('#mv-reset');

  // --- ACID ---
  const ac = all('#ac-tabs button'); let acBtns = 0;
  ac.forEach(b => { b.click(); const bb = all('#ac-btns button'); acBtns += bb.length;
    if (!q('#ac-head').textContent.length || !q('#ac-note').textContent.length) errors.push('ACID: пусто в ' + b.textContent);
    bb.forEach(x => { x.click(); if (!q('#ac-stage').innerHTML.length) errors.push('ACID: пустая сцена'); }); });
  console.log('букв ACID:', ac.length, '(exp 4) | кнопок-опытов:', acBtns);
  if (ac.length !== 4) errors.push('ожидалось 4 буквы ACID');
  ac[0].click(); click('#ac-btns button');
  if (!q('#ac-stage').textContent.includes('1200')) errors.push('ACID: атомарность — сбой без транзакции должен дать 1200');

  // дубли id
  const noScript = html.replace(/<script[\s\S]*?<\/script>/g, '');
  const ids = [...noScript.matchAll(/ id="([\w-]+)"/g)].map(m => m[1]);
  const dup = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  if (dup.length) errors.push('ДУБЛИ ID: ' + dup.join(', '));

  console.log('\n=== ОШИБКИ ===');
  console.log(errors.length ? errors.join('\n') : 'нет');
  window.close();
}, 700);
process.on('uncaughtException', e => { console.log('UNCAUGHT:', e.message); process.exit(1); });
