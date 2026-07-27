// Phase 8.3 Step 4 -- pure decision logic for Manual Create/Edit duplicate
// validation in src/pages/admin/AdminQuestions.jsx's save().
//
// No Supabase calls, no React state, no confirm()/toast(), no payload
// construction, no required-field validation -- exactly the same
// isolation contract as src/lib/contentValidation.js and
// src/lib/questionImport.js. save() itself stays the thin orchestrator
// that fetches data, calls this, and acts on the result -- this module
// only ever decides, never does.
//
// Reuses the real shared Tier A/B functions -- normalization, exact
// comparison, and RPC-row formatting are never reimplemented here.

import { findExactDuplicate, formatNearDuplicateWarnings } from './contentValidation.js'

/**
 * Evaluate whether a Manual Create/Edit save should be blocked (Tier A) or
 * warned (Tier B), given already-fetched data. Never touches Supabase.
 *
 * @param {object} params
 * @param {string} params.question - the entered question text (Tier A
 *   input; normalization happens inside findExactDuplicate itself).
 * @param {string|undefined} params.editingId - the id of the record being
 *   edited, or undefined/null for Create. This is the authoritative
 *   self-exclusion value for BOTH Tier A (via findExactDuplicate's
 *   excludeId, which already only excludes when excludeId != null) and
 *   Tier B: a warning is removed for matching editingId ONLY when
 *   editingId itself is a real (non-null/non-undefined) value -- so a
 *   Create (editingId undefined) never wrongly strips a warning whose
 *   matchedId happens to also be undefined/null, which would otherwise
 *   look like a coincidental "self-match" with no self to match.
 * @param {Array<{id, test_id, question}>} params.existingQuestions -
 *   caller-fetched Tier A candidates. Already expected to be scoped to
 *   the selected test_id by the caller -- this function does not filter
 *   by test_id itself, matching findExactDuplicate's own contract.
 * @param {*} params.nearDuplicateRpcRows - raw rows from the
 *   find_near_duplicate_questions RPC (or [] if not yet called), passed
 *   straight through to formatNearDuplicateWarnings.
 * @returns {{tierAConflict: object|null, tierBWarnings: Array}}
 *   tierAConflict: the matching existing record, or null.
 *   tierBWarnings: formatted Tier B warnings with any self-match (by
 *     editingId) removed, ordered deterministically: similarity
 *     descending, then matchedId ascending, then matchedQuestion
 *     ascending (see the comparator below for exactly how ties resolve).
 *   Never mutates existingQuestions, nearDuplicateRpcRows, or any row
 *   inside them.
 */
export function evaluateQuestionSaveDuplicates({ question, editingId, existingQuestions, nearDuplicateRpcRows }) {
  // Fix 1: findExactDuplicate itself has no defensive check on
  // existingQuestions (it just does `for (const existing of
  // existingQuestions)`), so a non-array value would throw before ever
  // reaching contentValidation.js. Normalizing here, rather than inside
  // findExactDuplicate/contentValidation.js, keeps that shared function's
  // contract unchanged for its other caller (questionImport.js).
  const safeExistingQuestions = Array.isArray(existingQuestions) ? existingQuestions : []

  const tierAConflict = findExactDuplicate(question, safeExistingQuestions, { excludeId: editingId })

  // Fix 2: explicit three-level deterministic comparator, so tie ordering
  // no longer relies on Array.prototype.sort's stability guarantee alone.
  const tierBWarnings = formatNearDuplicateWarnings(nearDuplicateRpcRows)
    .filter(warning => editingId == null || warning.matchedId !== editingId)
    .sort((a, b) => {
      const similarityDifference = b.similarity - a.similarity
      if (similarityDifference !== 0) return similarityDifference
      const idComparison = String(a.matchedId ?? '').localeCompare(String(b.matchedId ?? ''))
      if (idComparison !== 0) return idComparison
      return String(a.matchedQuestion ?? '').localeCompare(String(b.matchedQuestion ?? ''))
    })

  return { tierAConflict, tierBWarnings }
}
