
// ═══════════════════════════════════════════════════════════════════════
//  COMPLIANCE
//
//  Controls and registers that an ISO 27001 or SOC 2 auditor samples.
//  The tool cannot make Urbeno certified — certification assesses the
//  organisation. What it can do is enforce the technical controls and
//  produce the evidence, which is what this module is for.
//
//  Control references are given inline so an auditor can trace each
//  feature back to the criterion it serves.
// ═══════════════════════════════════════════════════════════════════════

const compliance = {

  // ── CONSENT — ISO 27701 / DPDPA ─────────────────────────────────────
  // A user accepts a specific version of the notice. Bumping PRIVACY.version
  // re-prompts everyone, and the record shows which version they agreed to.
  consentOf(em) {
    return CONSENTS.filter(c => c.em === em).sort((a,b) => b.at.localeCompare(a.at))[0];
  },
  needsConsent(u) {
    const c = this.consentOf(u?.em);
    return !c || c.version !== PRIVACY.version;
  },
  async recordConsent(em, version) {
    const rec = { id: uid('CN'), em, version: version || PRIVACY.version,
                  at: nowISO(), ip: 'recorded server-side in production' };
    CONSENTS.push(rec);
    await audit.log('consent.record', 'user', em, { version: rec.version });
    saveState(); return rec;
  },
  async withdrawConsent(em, reason) {
    const rec = { id: uid('CN'), em, version: PRIVACY.version, at: nowISO(), withdrawn: true, reason };
    CONSENTS.push(rec);
    await audit.log('consent.withdraw', 'user', em, { reason });
    saveState(); return rec;
  },

  // ── DATA SUBJECT REQUESTS — DPDPA / ISO 27701 ───────────────────────
  async raiseDSR(d) {
    const rec = { id: uid('DSR'), ref: `DSR-${String(DSRS.length + 1).padStart(4,'0')}`,
      kind: d.kind, subject: d.subject, cid: d.cid || null, raisedAt: nowISO(),
      raisedBy: me?.em, due: new Date(Date.now() + CFG.dsrDueDays * 86400000).toISOString().slice(0,10),
      note: d.note || '', status: 'open', closedAt: null, outcome: '' };
    DSRS.push(rec);
    await audit.log('dsr.raise', 'dsr', rec.ref, { kind: rec.kind, subject: rec.subject });
    await notify.send(USERS.filter(u => u.role === 'admin').map(u => u.em), 'dsr',
      `Data subject request ${rec.ref} raised — due ${fmtDate(rec.due)}`, null);
    saveState(); return rec;
  },
  async closeDSR(id, outcome) {
    const r = DSRS.find(x => x.id === id); if (!r) throw new Error('Request not found');
    if (!outcome?.trim()) throw new Error('Record what was done to answer this request.');
    r.status = 'closed'; r.closedAt = nowISO(); r.outcome = outcome.trim(); r.closedBy = me?.em;
    await audit.log('dsr.close', 'dsr', r.ref, { outcome: r.outcome });
    saveState(); return r;
  },
  dsrOverdue() {
    const today = new Date().toISOString().slice(0,10);
    return DSRS.filter(d => d.status === 'open' && d.due < today);
  },
  // Everything held about one person, for an access or portability request
  // Everything held about one person, in the shape a DPDPA access request needs.
  // `found` and `summary` let the screen answer in plain language; the rest is
  // the detail that gets exported.
  subjectData(email) {
    const em = String(email).trim().toLowerCase();
    const u = userBy(em);
    const raised = SUBS.filter(s => s.createdBy === em);
    const closures = SUBS.flatMap(s => subInvoices(s).filter(i => i.close?.by === em));
    const consents = CONSENTS.filter(c => c.em === em);
    const audits = AUDIT.filter(a => a.actor === em).length;
    const found = !!u || raised.length > 0 || closures.length > 0 || consents.length > 0 || audits > 0;
    const summary = {
      'Account': u ? `${u.nm} · ${u.role}${u.cid ? ' · ' + clientName(u.cid) : ''}` : 'No account',
      'Status': u ? (u.active ? 'Active' : 'Deactivated') : '—',
      'Last sign-in': u?.lastLoginAt ? fmtDate(u.lastLoginAt) : 'never',
      'Privacy notice accepted': consents.length ? `version ${consents[consents.length-1].version} on ${fmtDate(consents[consents.length-1].at)}` : 'not recorded',
      'Requests raised': raised.length,
      'Closures acknowledged': closures.length,
      'Audit entries attributed': audits,
      'Retention': `Personal data ${CFG.retentionYears.personal} years after the account closes; compliance records ${CFG.retentionYears.compliance} years`
    };
    return {
      found, summary, email: em, generatedAt: nowISO(),
      account: u ? { email: u.em, name: u.nm, role: u.role, organisation: u.cid,
                     siteScope: u.siteIds, lastLogin: u.lastLoginAt, created: u.createdAt } : null,
      consents: CONSENTS.filter(c => c.em === em),
      requestsRaised: SUBS.filter(s => s.createdBy === em).map(s => ({ id: s.id, date: s.date, site: s.siteId })),
      closuresMade: SUBS.flatMap(s => subInvoices(s).filter(i => i.close?.by === em)
                       .map(i => ({ request: s.id, invoice: i.no, at: i.close.at, rating: i.close.rating }))),
      auditEntries: AUDIT.filter(a => a.actor === em).length,
      appearsAsDriverOrTeam: SUBS.flatMap(s => subVehicles(s))
        .filter(v => (v.drv || '').toLowerCase().includes(em.split('@')[0]) ||
                     (v.team || []).some(t => (t.nm || '').toLowerCase().includes(em.split('@')[0])))
        .map(v => v.reg)
    };
  },

  // ── SECURITY INCIDENTS — A.5.24 to A.5.28 ───────────────────────────
  async raiseIncident(d) {
    const rec = { id: uid('IR'), ref: `INC-${String(INCIDENTS.length + 1).padStart(4,'0')}`,
      title: d.title, severity: d.severity, category: d.category,
      detectedAt: d.detectedAt || nowISO().slice(0,10), raisedBy: me?.em, raisedAt: nowISO(),
      description: d.description || '', affected: d.affected || '',
      status: 'open', containedAt: null, closedAt: null, rootCause: '', action: '',
      reportable: !!d.reportable, reportedAt: null };
    INCIDENTS.push(rec);
    await audit.log('incident.raise', 'incident', rec.ref, { severity: rec.severity, category: rec.category });
    await notify.send(USERS.filter(u => u.role === 'admin').map(u => u.em), 'incident',
      `${rec.severity === 'high' ? '🚨' : '⚠️'} Incident ${rec.ref} raised — ${rec.title}`, null);
    saveState(); return rec;
  },
  async updateIncident(id, patch) {
    const r = INCIDENTS.find(x => x.id === id); if (!r) throw new Error('Incident not found');
    const before = { ...r };
    Object.assign(r, patch);
    if (patch.status === 'closed') {
      if (!r.rootCause?.trim()) throw new Error('Record the root cause before closing an incident.');
      if (!r.action?.trim()) throw new Error('Record the corrective action before closing an incident.');
      r.closedAt = nowISO(); r.closedBy = me?.em;
    }
    await audit.log('incident.update', 'incident', r.ref, { before: { status: before.status }, after: patch });
    saveState(); return r;
  },

  // ── ACCESS REVIEW — A.5.18 / CC6.2 ──────────────────────────────────
  // Periodic recertification: someone with authority confirms, per account,
  // that the access it holds is still warranted.
  lastReview() { return REVIEWS.filter(r => r.status === 'closed').sort((a,b) => b.closedAt.localeCompare(a.closedAt))[0]; },
  reviewDue() {
    const last = this.lastReview();
    if (!last) return true;
    return (Date.now() - new Date(last.closedAt)) / 86400000 > CFG.accessReviewDays;
  },
  reviewDueInDays() {
    const last = this.lastReview();
    if (!last) return 0;
    return Math.max(0, CFG.accessReviewDays - Math.floor((Date.now() - new Date(last.closedAt)) / 86400000));
  },
  openReview() { return REVIEWS.find(r => r.status === 'open'); },
  async startReview() {
    if (this.openReview()) throw new Error('A review is already open. Complete it before starting another.');
    const rec = { id: uid('AR'), ref: `AR-${String(REVIEWS.length + 1).padStart(3,'0')}`,
      startedAt: nowISO(), startedBy: me?.em, status: 'open', closedAt: null,
      lines: USERS.filter(u => u.active).map(u => ({
        em: u.em, nm: u.nm, role: u.role, cid: u.cid,
        siteIds: [...(u.siteIds || [])], facIds: [...(u.facIds || [])],
        lastLoginAt: u.lastLoginAt || null,
        decision: null, note: '', decidedAt: null, decidedBy: null
      })) };
    REVIEWS.push(rec);
    await audit.log('review.start', 'review', rec.ref, { accounts: rec.lines.length });
    saveState(); return rec;
  },
  async decideReview(reviewId, em, decision, note) {
    const r = REVIEWS.find(x => x.id === reviewId); if (!r) throw new Error('Review not found');
    const line = r.lines.find(l => l.em === em); if (!line) throw new Error('Account not in this review');
    if (decision === 'revoke' && !note?.trim()) throw new Error('Record why this access is being withdrawn.');
    line.decision = decision; line.note = note || ''; line.decidedAt = nowISO(); line.decidedBy = me?.em;
    if (decision === 'revoke') {
      const u = userBy(em);
      if (u && u.em !== me.em) { u.active = false; await audit.log('user.deactivate', 'user', em, { via: r.ref }); }
    }
    await audit.log('review.decide', 'review', r.ref, { account: em, decision, note });
    saveState(); return line;
  },
  async closeReview(reviewId) {
    const r = REVIEWS.find(x => x.id === reviewId); if (!r) throw new Error('Review not found');
    const undecided = r.lines.filter(l => !l.decision);
    if (undecided.length) throw new Error(`${undecided.length} account${undecided.length>1?'s have':' has'} no decision yet. Every account must be confirmed or withdrawn.`);
    r.status = 'closed'; r.closedAt = nowISO(); r.closedBy = me?.em;
    await audit.log('review.close', 'review', r.ref, {
      confirmed: r.lines.filter(l => l.decision === 'keep').length,
      revoked: r.lines.filter(l => l.decision === 'revoke').length });
    saveState(); return r;
  },

  // ── RETENTION & DISPOSAL — A.5.33 / Rule 12(4) ──────────────────────
  // What is held, how long it must be kept, and what is now past its date.
  retentionRegister() {
    const y = CFG.retentionYears;
    const age = d => d ? (Date.now() - new Date(d)) / (365.25 * 86400000) : 0;
    const rows = [];
    const push = (cls, kind, ref, held, keep, ctx) => rows.push({
      cls, kind, ref, held, keep, years: +age(held).toFixed(2),
      dueFrom: held ? new Date(new Date(held).getTime() + keep * 365.25 * 86400000).toISOString().slice(0,10) : null,
      due: age(held) > keep, ctx });
    for (const s of SUBS) {
      for (const inv of subInvoices(s)) {
        if (inv.mrn)  push('confidential','MRN',            inv.mrn.no,  inv.mrn.dt,  y.compliance, s.id);
        if (inv.recy) push('confidential','Form 6 manifest', inv.recy.f6, inv.recy.dt, y.compliance, s.id);
        for (const c of invCods(inv)) push('confidential','Certificate of destruction', c.no, c.dt, y.certificate, s.id);
        if ((inv.recy?.serials || []).length)
          push('restricted','Device serial records', `${inv.no} · ${inv.recy.serials.length} devices`, inv.recy.dt, y.compliance, s.id);
      }
    }
    push('internal','Audit log', `${AUDIT.length} entries`, AUDIT[0]?.ts, y.audit, 'system');
    push('restricted','Consent records', `${CONSENTS.length} records`, CONSENTS[0]?.at, y.personal, 'system');
    return rows.sort((a,b) => (b.due - a.due) || String(a.dueFrom).localeCompare(String(b.dueFrom)));
  },
  async recordDisposal(d) {
    const rec = { id: uid('DP'), ref: `DIS-${String(DISPOSALS.length + 1).padStart(4,'0')}`,
      kind: d.kind, describes: d.describes, method: d.method, at: nowISO(),
      by: me?.em, approvedBy: d.approvedBy || '', note: d.note || '' };
    DISPOSALS.push(rec);
    await audit.log('retention.dispose', 'retention', rec.ref, { kind: d.kind, method: d.method });
    saveState(); return rec;
  },

  // ── SEGREGATION OF DUTIES — A.5.3 / CC6.3 ───────────────────────────
  // High-risk actions should not be performed by whoever set up the record.
  // The prototype records the conflict rather than blocking it; production
  // should require a second person.
  sodCheck(action, ctx) {
    const conflicts = [];
    if (action === 'force-close' && ctx.inv?.createdBy === me?.em)
      conflicts.push('You raised this invoice and are now force-closing it on the client\'s behalf.');
    if (action === 'capacity-override' && ctx.categoryEditedBy === me?.em)
      conflicts.push('You last changed this category\'s authorised capacity and are now overriding it.');
    if (action === 'cod-upload' && ctx.inv?.recy?.by === me?.em)
      conflicts.push('You recorded the recycling and are now issuing the certificate for it.');
    return conflicts;
  },
  async logSoD(action, conflicts, ref, justification) {
    if (!conflicts.length) return null;
    SECLOG.push({ ts: nowISO(), kind: 'sod', actor: me?.em, action, ref, conflicts });
    await audit.log('sod.override', 'control', ref, { action, conflicts, justification });
    saveState();
  },

  // ── CONTROL STATUS — what the dashboard reports ─────────────────────
  async controlStatus() {
    const chain = await audit.verifyChain();
    const staff = USERS.filter(u => u.active && CFG.mfaRoles.includes(u.role));
    const mfaOn = staff.filter(u => u.mfaSecret).length;
    const stale = USERS.filter(u => u.active && pwExpired(u));
    const noConsent = USERS.filter(u => u.active && u.role === 'client' && compliance.needsConsent(u));
    const ret = this.retentionRegister().filter(r => r.due);
    const openInc = INCIDENTS.filter(i => i.status !== 'closed');
    const od = this.dsrOverdue();
    const st = (ok, warn) => ok ? 'ok' : (warn ? 'warn' : 'fail');
    return [
      { ref:'CC7.2 / A.8.15', nm:'Audit log integrity',
        state: chain.ok ? 'ok' : 'fail',
        detail: chain.ok ? `${chain.count} entries, chain intact` : `Chain broken at entry ${chain.seq} — ${chain.reason}`,
        act: chain.ok ? null : 'Investigate immediately' },
      { ref:'CC6.1 / A.5.17', nm:'Multi-factor on privileged accounts',
        state: st(mfaOn === staff.length, mfaOn > 0),
        detail: `${mfaOn} of ${staff.length} staff accounts enrolled`,
        act: mfaOn < staff.length ? 'Enrol the remaining accounts' : null },
      { ref:'CC6.1 / A.5.17', nm:'Password age',
        state: st(stale.length === 0, stale.length < 3),
        detail: stale.length ? `${stale.length} account${stale.length>1?'s':''} past the rotation period` : 'All within policy',
        act: stale.length ? 'Require a reset on those accounts' : null },
      { ref:'CC6.2 / A.5.18', nm:'Access recertification',
        state: this.reviewDue() ? 'warn' : 'ok',
        detail: this.lastReview() ? `Last completed ${fmtDate(this.lastReview().closedAt)}${this.reviewDue()?'' : ` · next due in ${this.reviewDueInDays()} days`}` : 'Never performed',
        act: this.reviewDue() ? 'Start a review' : null },
      { ref:'A.5.34 / DPDPA', nm:'Privacy notice acceptance',
        state: st(noConsent.length === 0, true),
        detail: noConsent.length ? `${noConsent.length} client user${noConsent.length>1?'s have':' has'} not accepted version ${PRIVACY.version}` : `All current on version ${PRIVACY.version}`,
        act: noConsent.length ? 'They are prompted at next sign-in' : null },
      { ref:'DPDPA', nm:'Data subject requests',
        state: st(od.length === 0, true),
        detail: od.length ? `${od.length} past the ${CFG.dsrDueDays}-day deadline` : `${DSRS.filter(d=>d.status==='open').length} open, none overdue`,
        act: od.length ? 'Answer them now' : null },
      { ref:'A.5.24–A.5.28', nm:'Incident register',
        state: st(openInc.length === 0, true),
        detail: openInc.length ? `${openInc.length} open` : `${INCIDENTS.length} recorded, all closed`,
        act: openInc.length ? 'Progress to containment and closure' : null },
      { ref:'A.5.33 / Rule 12(4)', nm:'Retention and disposal',
        state: st(ret.length === 0, true),
        detail: ret.length ? `${ret.length} record set${ret.length>1?'s':''} past its retention date` : 'Nothing past its date',
        act: ret.length ? 'Review and record disposal' : null },
      { ref:'A.5.12', nm:'Information classification',
        state: 'ok',
        detail: `${Object.keys(FILE_CLASS).length} document types classified`, act: null },
      { ref:'CC6.7 / A.8.13', nm:'Backup and export',
        state: 'warn',
        detail: 'Manual export only — no automated backup in the prototype',
        act: 'Export regularly; automated in production' }
    ];
  },

  // ── EVIDENCE PACK — what an auditor is handed ───────────────────────
  async evidencePack() {
    const chain = await audit.verifyChain();
    return {
      generatedAt: nowISO(), generatedBy: me?.em,
      scope: { product: 'Urb TecTrack', version: CFG.version || '6.4', organisation: CFG.co.nm },
      controls: await this.controlStatus(),
      auditChain: chain,
      counts: {
        auditEntries: AUDIT.length, securityEvents: SECLOG.length,
        users: USERS.length, activeUsers: USERS.filter(u=>u.active).length,
        clients: Object.keys(CLI).length, requests: SUBS.length,
        certificates: SUBS.flatMap(s=>subInvoices(s)).reduce((a,i)=>a+invCods(i).length,0)
      },
      accessReviews: REVIEWS.map(r => ({ ref:r.ref, startedAt:r.startedAt, closedAt:r.closedAt,
        status:r.status, accounts:r.lines.length,
        confirmed:r.lines.filter(l=>l.decision==='keep').length,
        revoked:r.lines.filter(l=>l.decision==='revoke').length })),
      incidents: INCIDENTS.map(i => ({ ref:i.ref, title:i.title, severity:i.severity,
        detectedAt:i.detectedAt, status:i.status, closedAt:i.closedAt, reportable:i.reportable })),
      dsrs: DSRS.map(d => ({ ref:d.ref, kind:d.kind, raisedAt:d.raisedAt, due:d.due,
        status:d.status, closedAt:d.closedAt })),
      disposals: DISPOSALS,
      consents: { version: PRIVACY.version, accepted: CONSENTS.filter(c=>!c.withdrawn).length,
                  withdrawn: CONSENTS.filter(c=>c.withdrawn).length },
      retentionExceptions: this.retentionRegister().filter(r => r.due)
    };
  }
};

// ── Access logging on the paths that expose data ──────────────────────
// Wraps existing behaviour rather than replacing it, so nothing else changes.
(function instrumentAccess() {
  if (typeof files === 'object' && files.get && !files.__instrumented) {
    files.__instrumented = true;
    const origGet = files.get.bind(files);
    files.get = function (id) {
      const f = origGet(id);
      // Only log deliberate retrieval of restricted material, not every render
      if (f && FILE_CLASS[f.kind] === 'restricted' && me) {
        SECLOG.push({ ts: nowISO(), kind: 'access.restricted', actor: me.em, ref: f.name, cls: 'restricted' });
      }
      return f;
    };
  }
})();
