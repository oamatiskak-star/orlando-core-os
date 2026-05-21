# 📧 OSM (Orlando Service Management) - Mail Intelligence System
## Project Tracker: Intelligent Mail Approval & Dashboard System

**Project Owner:** Orlando Amatiskak  
**Created:** 2026-05-21  
**Status:** 🔴 In Planning → Implementation Phase  
**Branch:** `claude/construction-document-concept-ZJAeK`

---

## 🎯 Project Overview

**Goal:** Transform Orlando Core OS dashboard into an intelligent mail management system where Orlando can handle email approvals with AI-generated concept responses in < 5 minutes per item.

**Key Requirements (CONFIRMED):**
- ✅ Auto-approve at confidence > 0.8
- ✅ Pending approvals as PRIMARY dashboard widget (first thing visible)
- ✅ All templates: Documenten, Factuur, Leverancier, Advocaat
- ✅ Orlando is sole approver
- ✅ Dashboard branded as "Orlando Service Management"

---

## 📋 Implementation Phases

### Phase 1: Dashboard Widget - "Pending Mail Approvals" 🟢 **NEXT**
**Priority:** CRITICAL (must be first visible widget)  
**Estimated:** 5-7 days

**Deliverables:**
- [ ] Rename main dashboard to "Orlando Service Management"
- [ ] Create `PendingApprovalsWidget.tsx` component
- [ ] Position as PRIMARY widget (top-left, no scroll needed)
- [ ] Real-time updates via Supabase subscription
- [ ] Quick action buttons: Approve | Reject | Edit
- [ ] Color badges: Green (auto-approved) | Yellow (pending) | Red (needs review)
- [ ] Display top 10 pending drafts with confidence scores

**Files:**
- `/frontend/app/dashboard/page.tsx` (update & rename)
- `/frontend/app/dashboard/mail/_components/PendingApprovalsWidget.tsx` (NEW)
- `/frontend/app/dashboard/mail/_components/MailBadges.tsx` (NEW - reusable badge components)

---

### Phase 2: Template System & Reply Generator v2 🟡 **PLANNED**
**Priority:** HIGH  
**Estimated:** 7-10 days

**Deliverables:**
- [ ] Create mail templates migration (040)
- [ ] Seed 4 template categories:
  - Documenten Aanvraag (document requests like statuten)
  - Factuur Bevestiging (invoice acknowledgments)
  - Leverancier Offerte (supplier offers)
  - Advocaat/Juridisch (legal correspondence)
- [ ] Implement `reply-generator-v2.ts` with template awareness
- [ ] Template placeholder system ({{company}}, {{documents_requested}}, etc.)
- [ ] Confidence scoring refinement

**Files:**
- `/supabase/migrations/041_mail_templates.sql` (NEW)
- `/mail-engine/src/ai/reply-generator-v2.ts` (NEW)
- `/mail-engine/src/intake/processor.ts` (MODIFY - add template selection)

---

### Phase 3: Full Mail Management Dashboard 🟡 **PLANNED**
**Priority:** HIGH  
**Estimated:** 5-7 days

**Deliverables:**
- [ ] Create `/dashboard/mail/pending` - Full pending approvals page
- [ ] Create `/dashboard/mail/sent` - Sent mail history
- [ ] Create `/dashboard/mail/templates` - Template gallery
- [ ] Draft editor modal with:
  - Original email (read-only)
  - AI analysis display
  - Edit capabilities
  - Template selector
  - Sandbox preview
- [ ] Bulk approve/reject functionality
- [ ] Filters: company, priority, category, confidence threshold

**Files:**
- `/frontend/app/dashboard/mail/page.tsx` (NEW)
- `/frontend/app/dashboard/mail/pending/page.tsx` (NEW)
- `/frontend/app/dashboard/mail/_components/DraftEditor.tsx` (NEW)
- `/frontend/app/dashboard/mail/_components/MailTable.tsx` (NEW)

---

### Phase 4: Auto-Approval & Escalation Logic 🟡 **PLANNED**
**Priority:** MEDIUM  
**Estimated:** 5-7 days

**Deliverables:**
- [ ] Implement confidence-based routing:
  - > 0.8: Auto-approve & send
  - 0.5-0.8: Pending on dashboard
  - < 0.5 or legal: Escalation with question
- [ ] Orchestrator task integration
- [ ] Audit logging for all actions
- [ ] Fast approval API route for dashboard quick actions
- [ ] Email versioning & modification tracking

**Files:**
- `/mail-engine/src/intake/processor.ts` (MODIFY - escalation logic)
- `/frontend/app/api/mail/drafts/[draftId]/approve/fast/route.ts` (NEW)
- `/frontend/app/api/mail/templates/suggest/route.ts` (NEW)

---

### Phase 5: Document Template Library 🟡 **PLANNED**
**Priority:** MEDIUM  
**Estimated:** 3-5 days

**Deliverables:**
- [ ] Create document templates migration
- [ ] Seed common templates:
  - Statuten BV (for companies)
  - Contract templates
  - Offerte templates
- [ ] Document request detection in mail analysis
- [ ] Dashboard widget showing requested documents
- [ ] Template suggestion when document is requested

**Files:**
- `/supabase/migrations/042_document_templates.sql` (NEW)

---

## 🔄 Current Status

| Phase | Status | Owner | ETA |
|-------|--------|-------|-----|
| Planning | ✅ Complete | Claude | 2026-05-21 |
| Phase 1 | 🔴 Ready | Claude | 2026-05-28 |
| Phase 2 | ⬜ Queued | Claude | 2026-06-04 |
| Phase 3 | ⬜ Queued | Claude | 2026-06-11 |
| Phase 4 | ⬜ Queued | Claude | 2026-06-18 |
| Phase 5 | ⬜ Queued | Claude | 2026-06-25 |

---

## 📊 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Response time to mail | < 5 min | Time from draft creation to approval |
| Draft approval rate | > 80% | Approved vs total pending |
| AI confidence accuracy | > 85% | Approved high-conf vs rejected low-conf |
| Template reuse rate | > 60% | Templates used vs total drafts |
| Dashboard load time | < 2 sec | Widget load with 100+ pending |
| Auto-approval rate | > 40% | Auto-sent (>0.8) vs manual approval |

---

## 🗂️ Related Issues/Cases

**Case Study: NOTRS Nederland - Statuten Request**
- Issue: Notaris requesting statuten for Bouwproffs Holding BV
- Current: Orlando manually responds
- With OSM: "Documenten Aanvraag" template auto-generates response
- Outcome: Response ready in < 2 minutes, Orlando approves 1-click

**Use Cases to Support:**
1. Document requests (statuten, contracts, blueprints)
2. Invoice confirmations
3. Supplier quotation responses
4. Legal correspondence (via advocaat agent)
5. Support/service requests

---

## 🚀 Next Steps

**Immediate (Today):**
- [ ] Review & approve plan with Orlando ✓
- [ ] Create project tracker (THIS FILE) ✓
- [ ] Begin Phase 1 implementation

**Phase 1 Start (Tomorrow):**
- [ ] Rename dashboard to OSM
- [ ] Create PendingApprovalsWidget
- [ ] Test with existing mail_drafts data

---

## 📝 Notes

- Leveraging existing mail-engine infrastructure (classifier, reply-generator, legal-agent)
- Reusing orchestrator patterns for escalation
- Building on proven dashboard component patterns
- Zero breaking changes to existing functionality
- All changes logged to audit trail for compliance

---

**Last Updated:** 2026-05-21  
**Updated By:** Claude Code Agent  
**Approval Status:** ⏳ Pending Orlando Review

