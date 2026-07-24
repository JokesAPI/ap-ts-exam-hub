// Phase 8.3 Step 5 -- pure decision logic for Tier A duplicate validation
// before Publish/Bulk Publish in src/pages/admin/AdminQuestions.jsx's
// bulkSetStatus('published').
//
// No Supabase calls, no React state, no toast, no confirm(), no payload
// construction -- same isolation contract as contentValidation.js,
// questionImport.js, and adminQuestionValidation.js. bulkSetStatus() stays
// the thin orchestrator that fetches data, calls this, and acts on the
// result -- this module only ever decides, never does.
//
// Reuses the real shared findExactDuplicates -- normalization and exact
// comparison are never reimplemented here. findExactDuplicates already
// distinguishes "matches an externally-supplied record" from "matches an
// earlier row in the same batch", which maps directly onto this module's
// two conflict types: a selected question can conflict with an
// already-published DB row ('published'), or with an earlier selected
// question in the same publish operation ('selection').

import { findExactDuplicates } from './contentValidation.js'

/**
 * Look up the already-published questions for one resolved test_id.
 * Same defensive contract as questionImport.js's (unexported)
 * getExistingQuestionsForTestId -- plain object or Map, missing key or
 * any non-array value safely returns [], never throws.
 */
function getPublishedQuestionsForTestId(publishedQuestionsByTestId, testId) {
  if (publishedQuestionsByTestId instanceof Map) {
    const value = publishedQuestionsByTestId.get(testId)
    return Array.isArray(value) ? value : []
  }
  if (publishedQuestionsByTestId && typeof publishedQuestionsByTestId === 'object') {
    const value = publishedQuestionsByTestId[testId]
    return Array.isArray(value) ? value : []
  }
  return []
}

/**
 * Evaluate Tier A publish conflicts for a batch of selected questions
 * about to be published, given already-fetched data. Never touches
 * Supabase.
 *
 * @param {object} params
 * @param {Array<{id, test_id, question, status}>} params.selectedQuestions -
 *   the complete fetched rows for every currently-selected id. A non-array
 *   value is treated as []; an individual malformed entry (not an object)
 *   is skipped rather than throwing.
 * @param {*} params.publishedQuestionsByTestId - plain object or Map,
 *   keyed by exact test_id, of already-published rows. Missing keys or
 *   invalid values behave as no published data for that test_id (see
 *   getPublishedQuestionsForTestId). Safe against prototype-risk keys
 *   ("__proto__", "constructor", "toString", etc.) both because Map keys
 *   never collide with inherited properties, and because a plain-object
 *   lookup here is only ever read through Array.isArray-checked values.
 * @returns {Array<{
 *   selectedId, selectedQuestion, testId,
 *   conflictType: 'published'|'selection',
 *   matchedPublishedId: string|null|undefined,
 *   matchedSelectedId: string|null|undefined,
 *   matchedSelectedQuestion: string|null,
 * }>} in the same order as selectedQuestions. A selected row matching its
 *   OWN already-published self (same REAL id) is never reported -- only
 *   non-null/non-undefined ids participate in self-exclusion, since two
 *   distinct rows that both happen to be missing an id are not "the same
 *   record" just because they're both missing one; a published row with a
 *   missing id is always left available for ordinary text-based
 *   comparison, never auto-excluded. A 'published' conflict always takes
 *   priority over a 'selection' conflict on the same row
 *   (findExactDuplicates' own priority, reused unchanged). A 'selection'
 *   conflict is never reported against an "earlier" entry that shares the
 *   same REAL id as the current row (i.e. the same underlying record
 *   appearing twice in the input, not two genuinely distinct records) --
 *   that is not a real duplicate, just a repeated reference; null/undefined
 *   are never treated as identity values for this check either. Missing
 *   id values are preserved exactly as given in the output (undefined
 *   stays undefined, null stays null) -- never normalized into an
 *   invented string. Never mutates selectedQuestions,
 *   publishedQuestionsByTestId, or any row inside them.
 */
export function evaluatePublishConflicts({ selectedQuestions, publishedQuestionsByTestId }) {
  const safeSelected = Array.isArray(selectedQuestions) ? selectedQuestions : []

  // Group selected questions by test_id, preserving original order and
  // index within each group -- findExactDuplicates needs group-local
  // order, and we need to convert its group-local indexes back to the
  // original selectedQuestions position for deterministic output order.
  const groups = new Map() // testId -> [{ originalIndex, id, question }]
  safeSelected.forEach((row, originalIndex) => {
    if (!row || typeof row !== 'object') return // malformed entry: skip, never throw, never false-conflict
    const testId = row.test_id
    if (!groups.has(testId)) groups.set(testId, [])
    groups.get(testId).push({ originalIndex, id: row.id, question: row.question })
  })

  const conflictsByOriginalIndex = new Array(safeSelected.length).fill(null)

  for (const [testId, group] of groups) {
    // Self-exclusion: a selected row that already IS a published row must
    // never be compared against its own record. Only REAL ids (not null
    // or undefined) participate -- two distinct rows that both happen to
    // have a missing id are not "the same record" just because they're
    // both missing one, so a missing published id is always left
    // available for ordinary text-based comparison, never auto-excluded.
    const selectedIdsInGroup = new Set(
      group
        .map(candidate => candidate.id)
        .filter(id => id !== null && id !== undefined)
    )
    const publishedCandidates = getPublishedQuestionsForTestId(publishedQuestionsByTestId, testId)
      .filter(published => published?.id == null || !selectedIdsInGroup.has(published.id))

    const inputQuestions = group.map(candidate => candidate.question)
    const conflicts = findExactDuplicates(inputQuestions, publishedCandidates)

    for (const conflict of conflicts) {
      const candidate = group[conflict.index]

      if (conflict.conflictType === 'existing') {
        conflictsByOriginalIndex[candidate.originalIndex] = {
          selectedId: candidate.id,
          selectedQuestion: candidate.question,
          testId,
          conflictType: 'published',
          matchedPublishedId: conflict.matched.id,
          matchedSelectedId: null,
          matchedSelectedQuestion: null,
        }
      } else {
        const matchedCandidate = group[conflict.matchedInputIndex]
        // Same real id referenced twice in the input (not two distinct
        // records) is not a real duplicate -- skip it. null/undefined are
        // never treated as identity values here: two rows that both
        // happen to be missing an id are NOT "the same record" just
        // because they're both missing one.
        const sameRealRecord =
          candidate.id != null &&
          matchedCandidate.id != null &&
          matchedCandidate.id === candidate.id
        if (sameRealRecord) continue

        conflictsByOriginalIndex[candidate.originalIndex] = {
          selectedId: candidate.id,
          selectedQuestion: candidate.question,
          testId,
          conflictType: 'selection',
          matchedPublishedId: null,
          matchedSelectedId: matchedCandidate.id,
          matchedSelectedQuestion: matchedCandidate.question,
        }
      }
    }
  }

  return conflictsByOriginalIndex.filter(Boolean)
}
