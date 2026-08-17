
// ═══════════════════════════════════════════════════════════════════════
//  COMPLIANCE — VIEWS
//
//  One screen per control family, each showing the current position and the
//  evidence behind it. Written so an auditor can be walked through it
//  without anyone needing to open a database.
// ═══════════════════════════════════════════════════════════════════════

let compTab = 'controls';
let secF = { q:'', kind:'', severity:'', from:'', to:'' };

const COMP_TABS = [
  ['controls',  'Control status'],
  ['security',  'Security events'],
  ['access',    'Access review'],
  ['incidents', 'Incidents'],
  ['privacy',   'Privacy & DSR'],
  ['retention', 'Retention'],
  ['evidence',  'Evidence pack']
];

function renderCompliance() {
  if (!isAdmin()) return `<div class="empty"><div class="empty-t">Compliance is administrator-only</div>
    <div style="font-size:.85rem">These registers hold personal data and security records.</div></div>`;
  return `
    <div class="f-row" style="margin-bottom:.9rem">
      <div><div class="h1">Compliance</div>
      <div class="p-mu" style="margin:0">Controls, registers and evidence for ISO 27001, ISO 9001 and SOC 2 · references shown against each item</div></div>
    </div>
    <div class="card" style="padding:.4rem">
      <div style="display:flex;gap:.2rem;padding:0 .2rem;border-bottom:1px solid var(--bd);overflow-x:auto">
        ${COMP_TABS.map(([k,l]) => `<div class="inv-tab ${compTab===k?'on':''}" onclick="compTab='${k}';nav('compliance')">${l}</div>`).join('')}
      </div>
      <div style="padding:.8rem .3rem 0">${
        compTab==='controls'  ? compControls()  :
        compTab==='security'  ? compSecurity()  :
        compTab==='access'    ? compAccess()    :
        compTab==='incidents' ? compIncidents() :
        compTab==='privacy'   ? compPrivacy()   :
        compTab==='retention' ? compRetention() : compEvidence()
      }</div>
    </div>`;
}

// ── CONTROL STATUS ─────────────────────────────────────────────────────
function compControls() {
  // controlStatus() is async; render a placeholder and fill it in
  setTimeout(async () => {
    const el = $('cs-body'); if (!el) return;
    const rows = await compliance.controlStatus();
    const dot = st => st==='ok' ? '<span class="badge bg-g">Operating</span>'
              : st==='warn' ? '<span class="badge bg-am">Needs attention</span>'
              : '<span class="badge bg-rd">Not operating</span>';
    const bad = rows.filter(r => r.state !== 'ok').length;
    el.innerHTML = `
      <div class="stats" style="margin-bottom:.8rem">
        <div class="stat"><div class="stat-l">Controls tracked</div><div class="stat-v">${rows.length}</div></div>
        <div class="stat"><div class="stat-l">Operating</div><div class="stat-v" style="color:var(--g)">${rows.filter(r=>r.state==='ok').length}</div></div>
        <div class="stat"><div class="stat-l">Need attention</div><div class="stat-v" style="color:${bad?'var(--am)':'var(--g2)'}">${bad}</div></div>
      </div>
      <div class="tw"><table>
        <thead><tr><th>Reference</th><th>Control</th><th>State</th><th>Position</th><th>What to do</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td class="mono dim" style="white-space:nowrap">${esc(r.ref)}</td>
          <td><b>${esc(r.nm)}</b></td>
          <td>${dot(r.state)}</td>
          <td style="font-size:.82rem">${esc(r.detail)}</td>
          <td style="font-size:.82rem">${r.act ? esc(r.act) : '<span class="dim">—</span>'}</td>
        </tr>`).join('')}</tbody></table></div>`;
  }, 0);
  return `<div id="cs-body"><div class="dim" style="padding:1rem">Checking controls…</div></div>
    <div class="card" style="background:var(--am2);border-color:#fcd34d;margin-top:.7rem">
      <div class="section-hd" style="border-color:#fcd34d;color:var(--am)">What this page does and does not tell you</div>
      <div style="font-size:.83rem;line-height:1.6;color:var(--g2)">
        These are the controls that live <b>inside the application</b> and can therefore be checked automatically.
        Certification also assesses matters this tool cannot see — how Urbeno vets suppliers, trains people, secures
        the facility, manages change, and recovers from disaster. Those sit in the management system, not here.
        The gap assessment document lists them and says who owns each one.
      </div>
    </div>`;
}

// ── SECURITY EVENTS ────────────────────────────────────────────────────
function compSecurity() {
  const rows = secLog.list(secF);
  const sev = s => s==='high' ? '<span class="badge bg-rd">High</span>'
            : s==='warn' ? '<span class="badge bg-am">Warning</span>'
            : '<span class="badge bg-gy">Info</span>';
  const highs = secLog.list({ severity:'high' }).length;
  return `
    <div class="stats" style="margin-bottom:.8rem">
      <div class="stat"><div class="stat-l">Events recorded</div><div class="stat-v">${SECLOG.length}</div><div class="stat-t">retained ${CFG.retentionYears.security} years</div></div>
      <div class="stat"><div class="stat-l">High severity</div><div class="stat-v" style="color:${highs?'var(--rd)':'var(--g2)'}">${highs}</div><div class="stat-t">alerted to admins</div></div>
      <div class="stat"><div class="stat-l">Failed sign-ins</div><div class="stat-v">${secLog.list({kind:'auth.failed'}).length}</div></div>
      <div class="stat"><div class="stat-l">Access denied</div><div class="stat-v">${secLog.list({kind:'access.denied'}).length}</div></div>
    </div>
    <div class="card">
      <div class="fr4">
        <div class="fg"><label>Search</label><input type="text" value="${esc(secF.q)}" placeholder="user, kind, detail…" oninput="secF.q=this.value;nav('compliance')"></div>
        <div class="fg"><label>Kind</label><select onchange="secF.kind=this.value;nav('compliance')">
          <option value="">All kinds</option>
          ${secLog.kinds().map(k => `<option value="${esc(k)}" ${secF.kind===k?'selected':''}>${esc(k)}</option>`).join('')}
        </select></div>
        <div class="fg"><label>Severity</label><select onchange="secF.severity=this.value;nav('compliance')">
          <option value="">All</option>
          ${['high','warn','info'].map(v => `<option value="${v}" ${secF.severity===v?'selected':''}>${v}</option>`).join('')}
        </select></div>
        <div class="fg"><label style="visibility:hidden">x</label>
          <button class="btn bs" style="width:100%;justify-content:center" onclick="secF={q:'',kind:'',severity:'',from:'',to:''};nav('compliance')">Clear</button></div>
      </div>
      <button class="btn bs bsm" onclick="exportSecLog()">⬇ Export CSV</button>
    </div>
    <div class="card" style="padding:.4rem">
      ${!rows.length ? '<div class="empty"><div class="empty-t">No events match</div></div>' :
      `<div class="tw"><table>
        <thead><tr><th>When</th><th>Severity</th><th>Event</th><th>Account</th><th>Detail</th></tr></thead>
        <tbody>${rows.slice(0,200).map(e => `<tr>
          <td class="dim" style="white-space:nowrap">${fmtTS(e.ts)}</td>
          <td>${sev(e.severity)}</td>
          <td class="mono" style="font-size:.78rem">${esc(e.kind)}</td>
          <td style="font-size:.8rem">${esc(e.em)}</td>
          <td class="dim" style="font-size:.75rem;max-width:280px;word-break:break-word">${esc(JSON.stringify(e.detail).slice(0,120))}</td>
        </tr>`).join('')}</tbody></table></div>
      ${rows.length>200?`<div class="dim" style="font-size:.74rem;padding:.3rem .5rem">Showing 200 of ${rows.length} — export for the full set</div>`:''}`}
    </div>`;
}
function exportSecLog() {
  const rows = secLog.list(secF);
  const q = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const csv = [['Timestamp','Severity','Event','Account','Detail'].map(q).join(','),
    ...rows.map(e => [fmtTS(e.ts), e.severity, e.kind, e.em, JSON.stringify(e.detail)].map(q).join(','))].join('\n');
  const b = new Blob([csv], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = `urbeno-security-events-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  toast(`✓ ${rows.length} events exported`);
}

// ── ACCESS REVIEW ──────────────────────────────────────────────────────
function compAccess() {
  const open = compliance.openReview();
  const last = compliance.lastReview();
  const due = compliance.reviewDue();
  if (open) {
    const done = open.lines.filter(l => l.decision).length;
    return `
      <div class="card" style="background:${done===open.lines.length?'var(--g3)':'var(--am2)'};border-color:${done===open.lines.length?'var(--g4)':'#fcd34d'}">
        <div class="card-hd"><div class="card-ttl">Review ${esc(open.ref)} in progress</div>
          <span class="badge ${done===open.lines.length?'bg-g':'bg-am'}">${done} of ${open.lines.length} decided</span>
          <div class="spacer"></div>
          <button class="btn bp bsm" onclick="closeReviewM('${open.id}')" ${done<open.lines.length?'disabled':''}>Complete review</button></div>
        <div style="font-size:.83rem;color:var(--g2)">Started ${fmtTS(open.startedAt)} by ${esc(userBy(open.startedBy)?.nm||open.startedBy)}.
          Confirm each account still needs the access it holds, or withdraw it. Withdrawing deactivates the account immediately.</div>
      </div>
      <div class="card" style="padding:.4rem">
        <div class="tw"><table>
          <thead><tr><th>Account</th><th>Role</th><th>Scope</th><th>Last sign-in</th><th>Decision</th><th></th></tr></thead>
          <tbody>${open.lines.map(l => `<tr>
            <td><b>${esc(l.nm)}</b><div class="dim" style="font-size:.72rem">${esc(l.em)}</div></td>
            <td><span class="badge ${l.role==='admin'?'bg-rd':l.role==='factory'?'bg-bl':'bg-gy'}">${esc(l.role)}</span></td>
            <td style="font-size:.78rem">${l.cid ? esc(clientName(l.cid)) : 'Urbeno'}
              <div class="dim" style="font-size:.7rem">${l.siteIds?.length ? l.siteIds.join(', ') : l.facIds?.length ? l.facIds.join(', ') : 'all'}</div></td>
            <td class="dim" style="font-size:.78rem">${l.lastLoginAt ? fmtDate(l.lastLoginAt) : 'never'}</td>
            <td>${l.decision === 'keep' ? '<span class="badge bg-g">Confirmed</span>'
                 : l.decision === 'revoke' ? '<span class="badge bg-rd">Withdrawn</span>'
                 : '<span class="badge bg-am">Undecided</span>'}
              ${l.note ? `<div class="dim" style="font-size:.7rem">${esc(l.note)}</div>` : ''}</td>
            <td style="white-space:nowrap">${l.decision ? '' :
              `<button class="btn bg-btn bsm" onclick="decideAccess('${open.id}','${l.em}','keep')">Confirm</button>
               <button class="btn brd bsm" onclick="revokeAccessM('${open.id}','${l.em}')">Withdraw</button>`}</td>
          </tr>`).join('')}</tbody></table></div>
      </div>`;
  }
  return `
    <div class="card" style="background:${due?'var(--am2)':'var(--g3)'};border-color:${due?'#fcd34d':'var(--g4)'}">
      <div class="card-hd"><div class="card-ttl">${due ? 'An access review is due' : 'Access recertification is current'}</div>
        <div class="spacer"></div>
        <button class="btn bp" onclick="startReviewM()">Start a review</button></div>
      <div style="font-size:.83rem;color:var(--g2)">
        ${last ? `Last completed ${fmtDate(last.closedAt)} by ${esc(userBy(last.closedBy)?.nm||last.closedBy)} — ${last.lines.filter(l=>l.decision==='keep').length} confirmed, ${last.lines.filter(l=>l.decision==='revoke').length} withdrawn.`
               : 'No review has been performed yet.'}
        Policy is every ${CFG.accessReviewDays} days.${due ? '' : ` Next due in ${compliance.reviewDueInDays()} days.`}
      </div>
    </div>
    ${REVIEWS.filter(r=>r.status==='closed').length ? `<div class="card" style="padding:.4rem">
      <div style="padding:.4rem .5rem;font-weight:700;font-size:.88rem;color:var(--g2)">Previous reviews</div>
      <div class="tw"><table>
        <thead><tr><th>Reference</th><th>Started</th><th>Completed</th><th>Accounts</th><th>Confirmed</th><th>Withdrawn</th><th>By</th></tr></thead>
        <tbody>${REVIEWS.filter(r=>r.status==='closed').reverse().map(r => `<tr>
          <td class="mono"><b>${esc(r.ref)}</b></td><td class="dim">${fmtDate(r.startedAt)}</td>
          <td class="dim">${fmtDate(r.closedAt)}</td><td class="mono">${r.lines.length}</td>
          <td class="mono">${r.lines.filter(l=>l.decision==='keep').length}</td>
          <td class="mono">${r.lines.filter(l=>l.decision==='revoke').length}</td>
          <td class="dim">${esc(userBy(r.closedBy)?.nm||r.closedBy||'')}</td>
        </tr>`).join('')}</tbody></table></div></div>` : ''}`;
}
async function startReviewM() {
  try { const r = await compliance.startReview();
    toast(`✓ ${r.ref} started — ${r.lines.length} accounts to certify`); nav('compliance'); }
  catch (e) { alert(e.message); }
}
async function decideAccess(id, em, d) {
  try { await compliance.decideReview(id, em, d, ''); nav('compliance'); }
  catch (e) { alert(e.message); }
}
function revokeAccessM(id, em) {
  const u = userBy(em);
  openM(`Withdraw access — ${esc(u?.nm||em)}`, `
    <p style="font-size:.86rem;margin-bottom:.8rem">This deactivates the account immediately. They will not be able to sign in.</p>
    <div class="fg"><label>Why is this access no longer needed? *</label>
      <textarea id="rv-note" style="min-height:60px" placeholder="e.g. Left the company on 12 August; confirmed with their manager."></textarea></div>
  `, 'Withdraw access', async () => {
    const n = $('rv-note').value.trim();
    if (!n) throw new Error('Record why the access is being withdrawn.');
    await compliance.decideReview(id, em, 'revoke', n);
    closeM(); toast('Access withdrawn'); nav('compliance');
  });
}
function closeReviewM(id) {
  const r = REVIEWS.find(x => x.id === id);
  openM(`Complete review ${esc(r.ref)}`, `
    <p style="font-size:.86rem">Completing the review records it as evidence that every account was examined on this date.</p>
    <div class="card" style="background:var(--g5);margin-top:.6rem">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.4rem">
        <div class="tile"><div class="tile-l">Accounts</div><div class="tile-v">${r.lines.length}</div></div>
        <div class="tile"><div class="tile-l">Confirmed</div><div class="tile-v">${r.lines.filter(l=>l.decision==='keep').length}</div></div>
        <div class="tile"><div class="tile-l">Withdrawn</div><div class="tile-v">${r.lines.filter(l=>l.decision==='revoke').length}</div></div>
      </div></div>
  `, 'Complete review', async () => {
    await compliance.closeReview(id);
    closeM(); toast('✓ Review completed and recorded'); nav('compliance');
  });
}

// ── INCIDENTS ──────────────────────────────────────────────────────────
function compIncidents() {
  const open = INCIDENTS.filter(i => i.status !== 'closed');
  return `
    <div class="f-row" style="margin-bottom:.7rem">
      <div style="font-size:.85rem;color:var(--g2)">Security incidents under ISO 27001 A.5.24–A.5.28.
        Anything reportable under DPDPA must also go to the Board and the affected clients.</div>
      <div class="spacer"></div>
      <button class="btn bp" onclick="incidentM()">+ Record an incident</button>
    </div>
    ${!INCIDENTS.length ? '<div class="empty"><div class="empty-t">No incidents recorded</div><div style="font-size:.85rem">An empty register is only credible if people know how to raise one. Cover it in induction.</div></div>' :
    `<div class="card" style="padding:.4rem">
      <div class="tw"><table>
        <thead><tr><th>Reference</th><th>Title</th><th>Severity</th><th>Detected</th><th>Status</th><th>Reportable</th><th></th></tr></thead>
        <tbody>${[...INCIDENTS].reverse().map(i => `<tr>
          <td class="mono"><b>${esc(i.ref)}</b></td>
          <td>${esc(i.title)}<div class="dim" style="font-size:.72rem">${esc((i.summary||'').slice(0,70))}</div></td>
          <td><span class="badge ${i.severity==='high'?'bg-rd':i.severity==='medium'?'bg-am':'bg-gy'}">${esc(i.severity)}</span></td>
          <td class="dim">${fmtDate(i.detectedAt)}</td>
          <td><span class="badge ${i.status==='closed'?'bg-g':i.status==='contained'?'bg-bl':'bg-am'}">${esc(i.status)}</span></td>
          <td>${i.reportable ? '<span class="badge bg-rd">Yes</span>' : '<span class="dim">No</span>'}</td>
          <td><button class="btn bs bsm" onclick="incidentM('${i.id}')">Open</button></td>
        </tr>`).join('')}</tbody></table></div>
    </div>`}`;
}
function incidentM(id) {
  const i = id ? INCIDENTS.find(x => x.id === id) : null;
  openM(i ? `Incident ${esc(i.ref)}` : 'Record a security incident', `
    <div class="fr2">
      <div class="fg"><label>Title *</label><input type="text" id="in-t" value="${esc(i?.title||'')}" placeholder="e.g. Certificate emailed to the wrong client"></div>
      <div class="fg"><label>Detected on *</label><input type="date" id="in-d" value="${i?.detectedAt?.slice(0,10)||new Date().toISOString().slice(0,10)}"></div>
      <div class="fg"><label>Severity *</label><select id="in-s">
        ${['low','medium','high'].map(v => `<option value="${v}" ${i?.severity===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="fg"><label>Status *</label><select id="in-st">
        ${['open','contained','closed'].map(v => `<option value="${v}" ${i?.status===v?'selected':''}>${v}</option>`).join('')}</select></div>
    </div>
    <div class="fg"><label>What happened *</label>
      <textarea id="in-sum" style="min-height:58px">${esc(i?.summary||'')}</textarea></div>
    <label style="display:flex;align-items:center;gap:.45rem;font-size:.85rem;font-weight:600;margin-bottom:.6rem;cursor:pointer">
      <input type="checkbox" id="in-rep" ${i?.reportable?'checked':''}>
      <span>Reportable to the Data Protection Board or a client under DPDPA</span></label>
    <div class="fg"><label>Root cause ${i?.status==='closed'?'*':'<span class="hint">required before closing</span>'}</label>
      <textarea id="in-rc" style="min-height:52px">${esc(i?.rootCause||'')}</textarea></div>
    <div class="fg"><label>Corrective action ${i?.status==='closed'?'*':'<span class="hint">required before closing</span>'}</label>
      <textarea id="in-act" style="min-height:52px">${esc(i?.action||'')}</textarea></div>
  `, i ? 'Save' : 'Record incident', async () => {
    const d = { title:$('in-t').value.trim(), detectedAt:$('in-d').value,
                severity:$('in-s').value, status:$('in-st').value,
                summary:$('in-sum').value.trim(), reportable:$('in-rep').checked,
                rootCause:$('in-rc').value.trim(), action:$('in-act').value.trim() };
    if (!d.title || !d.summary) throw new Error('A title and a description of what happened are both required.');
    if (i) await compliance.updateIncident(i.id, d);
    else await compliance.raiseIncident(d);
    closeM(); toast(i ? '✓ Incident updated' : '✓ Incident recorded'); nav('compliance');
  }, true);
}

// ── PRIVACY & DSR ──────────────────────────────────────────────────────
function compPrivacy() {
  const open = DSRS.filter(d => d.status === 'open');
  const overdue = compliance.dsrOverdue();
  const noConsent = USERS.filter(u => u.active && u.role === 'client' && compliance.needsConsent(u));
  return `
    <div class="stats" style="margin-bottom:.8rem">
      <div class="stat"><div class="stat-l">Notice version</div><div class="stat-v">${esc(PRIVACY.version)}</div><div class="stat-t">effective ${fmtDate(PRIVACY.effective)}</div></div>
      <div class="stat"><div class="stat-l">Accepted</div><div class="stat-v">${CONSENTS.filter(c=>!c.withdrawn).length}</div></div>
      <div class="stat"><div class="stat-l">Not yet accepted</div><div class="stat-v" style="color:${noConsent.length?'var(--am)':'var(--g2)'}">${noConsent.length}</div><div class="stat-t">prompted at sign-in</div></div>
      <div class="stat"><div class="stat-l">Open requests</div><div class="stat-v">${open.length}</div><div class="stat-t">${overdue.length} overdue</div></div>
    </div>
    <div class="f-row" style="margin-bottom:.6rem">
      <div style="font-size:.85rem;color:var(--g2)">A data principal may ask what Urbeno holds about them, ask for it to be corrected, or ask for it to be erased. The deadline is ${CFG.dsrDueDays} days.</div>
      <div class="spacer"></div>
      <button class="btn bp" onclick="dsrM()">+ Log a request</button>
    </div>
    ${!DSRS.length ? '<div class="empty"><div class="empty-t">No requests logged</div></div>' :
    `<div class="card" style="padding:.4rem">
      <div class="tw"><table>
        <thead><tr><th>Reference</th><th>Kind</th><th>Subject</th><th>Raised</th><th>Due</th><th>Status</th><th></th></tr></thead>
        <tbody>${[...DSRS].reverse().map(x => {
          const late = x.status==='open' && x.due < new Date().toISOString().slice(0,10);
          return `<tr>
            <td class="mono"><b>${esc(x.ref)}</b></td><td>${esc(x.kind)}</td>
            <td style="font-size:.82rem">${esc(x.subject)}</td>
            <td class="dim">${fmtDate(x.raisedAt)}</td>
            <td class="${late?'err':'dim'}">${fmtDate(x.due)}</td>
            <td><span class="badge ${x.status==='closed'?'bg-g':late?'bg-rd':'bg-am'}">${late?'overdue':esc(x.status)}</span></td>
            <td>${x.status==='open' ? `<button class="btn bp bsm" onclick="closeDSRM('${x.id}')">Answer</button>`
                 : `<span class="dim" style="font-size:.75rem">${esc((x.outcome||'').slice(0,40))}</span>`}</td>
          </tr>`;
        }).join('')}</tbody></table></div>
    </div>`}
    <div class="card">
      <div class="section-hd">What we hold about a person</div>
      <div class="fg" style="max-width:420px"><label>Look up by email</label>
        <input type="email" id="sd-em" placeholder="person@company.com" onkeydown="if(event.key==='Enter')lookupSubject()"></div>
      <button class="btn bs bsm" onclick="lookupSubject()">Look up</button>
      <div id="sd-out" style="margin-top:.6rem"></div>
    </div>`;
}
function lookupSubject() {
  const em = $('sd-em').value.trim();
  if (!em) return;
  const d = compliance.subjectData(em);
  $('sd-out').innerHTML = `
    <div class="card" style="background:var(--g5)">
      <div style="font-weight:700;font-size:.87rem;color:var(--g2);margin-bottom:.4rem">Held for ${esc(em)}</div>
      ${!d.found ? '<div class="dim" style="font-size:.85rem">No account or record found for that address.</div>' :
      `<div class="tw"><table><tbody>
        ${Object.entries(d.summary).map(([k,v]) => `<tr><td style="font-weight:600">${esc(k)}</td><td>${esc(String(v))}</td></tr>`).join('')}
      </tbody></table></div>
      <button class="btn bs bsm" style="margin-top:.5rem" onclick="exportSubject('${esc(em)}')">⬇ Export as JSON</button>`}
    </div>`;
}
function exportSubject(em) {
  const d = compliance.subjectData(em);
  const b = new Blob([JSON.stringify(d, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = `subject-data-${em.replace(/[^\w]/g,'-')}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  audit.log('dsr.export', 'user', em, {});
  toast('✓ Exported');
}
function dsrM() {
  openM('Log a data subject request', `
    <div class="fr2">
      <div class="fg"><label>Kind *</label><select id="ds-k">
        ${['access','correction','erasure','withdrawal of consent','grievance'].map(v => `<option value="${v}">${v}</option>`).join('')}</select></div>
      <div class="fg"><label>Who asked *</label><input type="text" id="ds-sub" placeholder="Name or email"></div>
    </div>
    <div class="fg"><label>What they asked for</label><textarea id="ds-n" style="min-height:56px"></textarea></div>
    <div style="background:var(--bl2);padding:.5rem .75rem;border-radius:8px;font-size:.79rem;color:var(--bl)">
      The clock starts today. This must be answered within ${CFG.dsrDueDays} days.
    </div>
  `, 'Log request', async () => {
    const sub = $('ds-sub').value.trim();
    if (!sub) throw new Error('Record who made the request.');
    await compliance.raiseDSR({ kind:$('ds-k').value, subject:sub, note:$('ds-n').value.trim() });
    closeM(); toast('✓ Request logged'); nav('compliance');
  });
}
function closeDSRM(id) {
  const r = DSRS.find(x => x.id === id);
  openM(`Answer ${esc(r.ref)}`, `
    <div class="card" style="background:var(--g5);margin-bottom:.7rem">
      <div style="font-size:.85rem"><b>${esc(r.kind)}</b> — ${esc(r.subject)}</div>
      ${r.note ? `<div class="dim" style="font-size:.8rem;margin-top:.25rem">${esc(r.note)}</div>` : ''}
      <div class="dim" style="font-size:.75rem;margin-top:.25rem">Raised ${fmtDate(r.raisedAt)} · due ${fmtDate(r.due)}</div>
    </div>
    <div class="fg"><label>What was done *</label>
      <textarea id="dc-o" style="min-height:70px" placeholder="e.g. Exported their account record and submission history and sent it to the address on file on 14 August."></textarea></div>
  `, 'Record and close', async () => {
    await compliance.closeDSR(id, $('dc-o').value);
    closeM(); toast('✓ Request answered and recorded'); nav('compliance');
  });
}

// ── RETENTION ──────────────────────────────────────────────────────────
function compRetention() {
  const reg = compliance.retentionRegister();
  const due = reg.filter(r => r.due);
  const cls = c => `<span class="badge ${c==='restricted'?'bg-rd':c==='confidential'?'bg-am':c==='internal'?'bg-bl':'bg-gy'}">${esc(DATA_CLASSES[c]?.nm||c)}</span>`;
  return `
    <div class="stats" style="margin-bottom:.8rem">
      <div class="stat"><div class="stat-l">Record sets tracked</div><div class="stat-v">${reg.length}</div></div>
      <div class="stat"><div class="stat-l">Past retention date</div><div class="stat-v" style="color:${due.length?'var(--am)':'var(--g2)'}">${due.length}</div></div>
      <div class="stat"><div class="stat-l">Disposals recorded</div><div class="stat-v">${DISPOSALS.length}</div></div>
    </div>
    <div class="card">
      <div class="section-hd">Retention policy</div>
      <div class="tw"><table>
        <thead><tr><th>Record type</th><th>Kept for</th><th>Why</th></tr></thead>
        <tbody>
          <tr><td>Compliance records — MRN, Form 6, manifests</td><td class="mono">${CFG.retentionYears.compliance} years</td><td class="dim">Rule 12(4), E-Waste (Management) Rules 2022</td></tr>
          <tr><td>Certificates of destruction</td><td class="mono">${CFG.retentionYears.certificate} years</td><td class="dim">Client contractual assurance</td></tr>
          <tr><td>Audit log</td><td class="mono">${CFG.retentionYears.audit} years</td><td class="dim">ISO 27001 A.8.15 · evidential</td></tr>
          <tr><td>Personal data — consents, contacts</td><td class="mono">${CFG.retentionYears.personal} years</td><td class="dim">DPDPA storage limitation</td></tr>
          <tr><td>Security events</td><td class="mono">${CFG.retentionYears.security} years</td><td class="dim">ISO 27001 A.8.15</td></tr>
        </tbody></table></div>
    </div>
    ${due.length ? `<div class="card" style="background:var(--am2);border-color:#fcd34d">
      <div class="card-hd"><div class="card-ttl" style="color:var(--am)">Past their retention date</div>
        <span class="badge bg-am">${due.length}</span><div class="spacer"></div>
        <button class="btn bp bsm" onclick="disposalM()">Record a disposal</button></div>
      <div style="font-size:.82rem;color:var(--g2)">Nothing is deleted automatically. Review, decide, and record what was done — the record of disposal is itself evidence.</div>
    </div>` : ''}
    <div class="card" style="padding:.4rem">
      <div class="tw"><table>
        <thead><tr><th>Class</th><th>Record</th><th>Reference</th><th>Held from</th><th>Age</th><th>Keep until</th></tr></thead>
        <tbody>${reg.slice(0,120).map(r => `<tr style="${r.due?'background:var(--am2)':''}">
          <td>${cls(r.cls)}</td><td>${esc(r.kind)}</td>
          <td class="mono" style="font-size:.78rem">${esc(r.ref)}<div class="dim" style="font-size:.7rem">${esc(r.ctx)}</div></td>
          <td class="dim">${r.held?fmtDate(r.held):'—'}</td>
          <td class="mono">${r.years} yr</td>
          <td class="${r.due?'warn':'dim'}">${r.dueFrom?fmtDate(r.dueFrom):'—'}</td>
        </tr>`).join('')}</tbody></table></div>
      ${reg.length>120?`<div class="dim" style="font-size:.74rem;padding:.3rem .5rem">Showing 120 of ${reg.length}</div>`:''}
    </div>
    ${DISPOSALS.length ? `<div class="card" style="padding:.4rem">
      <div style="padding:.4rem .5rem;font-weight:700;font-size:.88rem;color:var(--g2)">Disposal register</div>
      <div class="tw"><table>
        <thead><tr><th>Reference</th><th>What</th><th>Method</th><th>When</th><th>By</th><th>Approved by</th></tr></thead>
        <tbody>${[...DISPOSALS].reverse().map(x => `<tr>
          <td class="mono"><b>${esc(x.ref)}</b></td><td>${esc(x.describes)}</td><td>${esc(x.method)}</td>
          <td class="dim">${fmtDate(x.at)}</td><td class="dim">${esc(userBy(x.by)?.nm||x.by||'')}</td>
          <td class="dim">${esc(x.approvedBy||'—')}</td>
        </tr>`).join('')}</tbody></table></div></div>` : ''}`;
}
function disposalM() {
  openM('Record a disposal', `
    <p class="dim" style="font-size:.83rem;margin-bottom:.8rem">Records the decision and the method. ISO 27001 A.5.33 and A.8.10.</p>
    <div class="fr2">
      <div class="fg"><label>Record type *</label><input type="text" id="dp-k" placeholder="e.g. Weighment photographs"></div>
      <div class="fg"><label>Method *</label><select id="dp-m">
        ${['Secure deletion','Cryptographic erasure','Physical destruction','Anonymisation','Archived offline'].map(v=>`<option value="${v}">${v}</option>`).join('')}</select></div>
    </div>
    <div class="fg"><label>What exactly was disposed of *</label>
      <input type="text" id="dp-d" placeholder="e.g. 412 pickup photographs from FY 2020-21"></div>
    <div class="fg"><label>Approved by *</label><input type="text" id="dp-a" placeholder="Name and role of the approver"></div>
    <div class="fg"><label>Note</label><input type="text" id="dp-n"></div>
  `, 'Record disposal', async () => {
    const k=$('dp-k').value.trim(), d=$('dp-d').value.trim(), a=$('dp-a').value.trim();
    if (!k||!d||!a) throw new Error('Record type, what was disposed of, and who approved it are all required.');
    await compliance.recordDisposal({ kind:k, describes:d, method:$('dp-m').value, approvedBy:a, note:$('dp-n').value.trim() });
    closeM(); toast('✓ Disposal recorded'); nav('compliance');
  });
}

// ── EVIDENCE PACK ──────────────────────────────────────────────────────
function compEvidence() {
  return `
    <div class="card">
      <div class="section-hd">Evidence pack</div>
      <p style="font-size:.86rem;color:var(--g2);margin-bottom:.6rem">
        A single export covering control status, audit-chain verification, access reviews, incidents,
        data subject requests, disposals and consent counts — dated and attributed. This is what to hand an
        auditor at the start of fieldwork so they can decide what to sample.
      </p>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap">
        <button class="btn bp" onclick="downloadEvidence()">⬇ Evidence pack (JSON)</button>
        <button class="btn bs" onclick="downloadEvidencePDF()">⬇ Evidence summary (PDF)</button>
        <button class="btn bs" onclick="verifyAuditChain()">Verify audit chain now</button>
      </div>
      <div id="ev-out" style="margin-top:.7rem"></div>
    </div>
    <div class="card">
      <div class="section-hd">Full data export — A.8.13</div>
      <p style="font-size:.86rem;color:var(--g2);margin-bottom:.6rem">
        Everything the tool holds, as JSON. In the prototype this is also your only backup, so take one
        before any significant change. Production replaces this with automated backups and a tested restore.
      </p>
      <button class="btn bs" onclick="downloadFullBackup()">⬇ Full data export</button>
    </div>`;
}
async function verifyAuditChain() {
  const r = await audit.verifyChain();
  $('ev-out').innerHTML = r.ok
    ? `<div class="card" style="background:var(--g3);border-color:var(--g4);margin:0">
        <b style="color:var(--g2)">Chain intact.</b> ${r.count} entries verified, from ${fmtTS(r.from)} to ${fmtTS(r.to)}.
        <div class="dim mono" style="font-size:.74rem;margin-top:.25rem">head ${esc(r.head)}…</div></div>`
    : `<div class="card" style="background:var(--rd2);border-color:#fecaca;margin:0">
        <b style="color:var(--rd)">Chain broken at entry ${r.seq}.</b> ${esc(r.reason)}.
        <div style="font-size:.83rem;margin-top:.3rem">Treat this as a security incident and record it.</div></div>`;
  toast(r.ok ? '✓ Audit chain verified' : '⚠ Audit chain broken');
}
async function downloadEvidence() {
  const pack = await compliance.evidencePack();
  const b = new Blob([JSON.stringify(pack, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `urbeno-evidence-pack-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  await audit.log('evidence.export', 'compliance', 'pack', {});
  toast('✓ Evidence pack exported');
}
function downloadFullBackup() {
  const dump = { exportedAt: nowISO(), exportedBy: me?.em, schema: SCHEMA,
    SUBS, CLI, USERS: USERS.map(u => ({ ...u, pwHash:'[redacted]', salt:'[redacted]', mfaSecret: u.mfaSecret?'[redacted]':null })),
    FACTORIES, MD, CATEGORY_MASTER, TREES, TEMPLATES, AUDIT, SECLOG,
    CONSENTS, DSRS, INCIDENTS, REVIEWS, DISPOSALS, EMAILS, NOTIF };
  const b = new Blob([JSON.stringify(dump, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `urbeno-full-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  audit.log('data.export', 'system', 'full', { note:'credentials redacted' });
  toast('✓ Full export downloaded — credentials are redacted');
}

// ── MFA ENROLMENT ──────────────────────────────────────────────────────
async function mfaEnrolM() {
  const secret = mfa.newSecret();
  const code = await mfa.codeFor(secret);
  openM('Set up two-factor authentication', `
    <p style="font-size:.86rem;margin-bottom:.7rem">Add this secret to your authenticator app, then enter the six-digit code it shows to confirm the two are in step.</p>
    <div class="fg"><label>Secret</label>
      <input type="text" value="${secret}" readonly class="mono" style="letter-spacing:.12em;background:var(--g5)"></div>
    <div style="background:var(--am2);padding:.5rem .75rem;border-radius:8px;font-size:.78rem;color:var(--am);margin-bottom:.7rem">
      <b>Prototype only:</b> the current code is <span class="mono" style="font-size:1rem;font-weight:800">${code}</span>.
      In production this is never shown — it comes from your authenticator, and the secret is delivered as a QR code.
    </div>
    <div class="fg"><label>Code from your authenticator *</label>
      <input type="text" id="mf-c" maxlength="6" class="mono" placeholder="000000"
        style="font-size:1.1rem;letter-spacing:.2em;text-align:center"></div>
  `, 'Confirm and enable', async () => {
    await mfa.enrol(me.em, secret, $('mf-c').value);
    closeM(); toast('✓ Two-factor enabled'); nav('profile');
  });
}
function mfaDisableM() {
  openM('Remove two-factor authentication', `
    <div style="background:var(--rd2);padding:.55rem .8rem;border-radius:8px;font-size:.83rem;color:var(--rd);margin-bottom:.8rem">
      ${mfa.required(me) ? 'Your role requires a second factor. Removing it will show as a failed control until it is set up again.'
                         : 'Your account will be protected by a password alone.'}
    </div>
    <div class="fg"><label>Why is it being removed? *</label>
      <textarea id="mf-r" style="min-height:56px" placeholder="e.g. Changing phone; will re-enrol today."></textarea></div>
  `, 'Remove', async () => {
    await mfa.disable(me.em, $('mf-r').value);
    closeM(); toast('Two-factor removed'); nav('profile');
  });
}

// ── CONSENT GATE — shown once per notice version ───────────────────────
function consentGate() {
  if (!me || !compliance.needsConsent(me)) return;
  openM(`Privacy notice — version ${PRIVACY.version}`, `
    <p style="font-size:.87rem;margin-bottom:.7rem">Before continuing, please read how Urbeno handles your information. This takes a minute and is recorded against your account.</p>
    <div style="background:var(--g5);border:1px solid var(--bd);border-radius:8px;padding:.8rem;max-height:300px;overflow-y:auto;font-size:.83rem;line-height:1.65">
      <b>What we hold.</b> Your name, work email and telephone number, the sites you are assigned to, and a record of what you do in this portal — the requests you raise, the documents you download and the certificates you acknowledge.<br><br>
      <b>Why.</b> To operate the e-waste collection service you have asked for, and to keep the records the E-Waste (Management) Rules, 2022 require us to keep.<br><br>
      <b>How long.</b> Compliance records for ${CFG.retentionYears.compliance} years and certificates for ${CFG.retentionYears.certificate} years, because the Rules require it. Your personal contact details for ${CFG.retentionYears.personal} years after your account closes.<br><br>
      <b>Who sees it.</b> Urbeno staff who need it to run the service. Your own colleagues at ${esc(clientName(me.cid) || 'your organisation')} with access to the same sites. Regulators, where the law requires. We do not sell it and we do not use it for advertising.<br><br>
      <b>Your rights.</b> You may ask what we hold about you, ask us to correct it, ask us to erase it where the law allows, and withdraw consent. Write to ${esc(CFG.co.email)} and we will answer within ${CFG.dsrDueDays} days.<br><br>
      <b>Grievances.</b> ${esc(PRIVACY.owner)} is accountable for this notice. If we do not resolve a complaint you may escalate to the Data Protection Board of India.<br><br>
      <span class="dim">Version ${PRIVACY.version}, effective ${fmtDate(PRIVACY.effective)}.</span>
    </div>
    <label style="display:flex;align-items:flex-start;gap:.5rem;font-size:.86rem;font-weight:600;margin-top:.8rem;cursor:pointer">
      <input type="checkbox" id="cg-ok" style="margin-top:.2rem">
      <span>I have read this notice and accept it.</span></label>
  `, 'Accept and continue', async () => {
    if (!$('cg-ok').checked) throw new Error('Please confirm you have read the notice.');
    await compliance.recordConsent(me.em, PRIVACY.version);
    closeM(); toast('Thank you — recorded against your account');
  });
}
