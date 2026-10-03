import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createApplication } from '../../server/application.mjs'

let application
let origin
let workspaceId
let adminId
let marketPack
let diagnosis
let dataset
const json = async (path, options = {}) => {
  const response = await fetch(`${origin}${path}`, { headers: { 'content-type': 'application/json', ...(options.headers ?? {}) }, ...options })
  return { response, body: await response.json() }
}
const auth = () => ({ 'x-user-id': adminId, 'x-workspace-id': workspaceId })

before(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'geo-content-studio-'))
  application = createApplication({ config: { projectRoot: process.cwd(), dataDir, dbPath: join(dataDir, 'harness.sqlite'), port: 0 } })
  await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${application.server.address().port}`
  const seed = await json('/api/development/sample-workspace', { method: 'POST' })
  workspaceId = seed.body.sample.workspace.id; adminId = seed.body.sample.administrator.id
  const packs = await json(`/api/workspaces/${workspaceId}/market-packs`, { headers: auth() })
  marketPack = packs.body.marketPacks.find((item) => item.locale === 'zh-CN')
  const dashboard = await json(`/api/workspaces/${workspaceId}/market-packs/${marketPack.id}/dashboard`, { headers: auth() })
  diagnosis = dashboard.body.dashboard.diagnoses[0]; dataset = dashboard.body.dashboard.context.dataset
})
after(async () => { await new Promise((resolve) => application.server.close(resolve)); const dataDir = application.config.dataDir; application.database.close(); rmSync(dataDir, { recursive: true, force: true }) })

describe('content strategy, review and publication workflow', () => {
  it('keeps strategy, draft, proof and retest linked to the immutable baseline dataset', async () => {
    const invalidStrategy = await json(`/api/workspaces/${workspaceId}/content-strategies`, { method: 'POST', headers: auth(), body: JSON.stringify({ logicalKey: 'invalid-scope', diagnosisId: diagnosis.id, marketPackId: marketPack.id, targetQueryIds: ['not-in-diagnosis'], channels: [marketPack.channels[0]], title: 'Invalid', objective: 'Must reject scope mismatch', strategy: {} }) })
    assert.equal(invalidStrategy.response.status, 409)
    const strategy = await json(`/api/workspaces/${workspaceId}/content-strategies`, { method: 'POST', headers: auth(), body: JSON.stringify({ logicalKey: 'content-workflow', diagnosisId: diagnosis.id, marketPackId: marketPack.id, targetQueryIds: diagnosis.queryIds, channels: [marketPack.channels[0]], title: 'Evidence-first content strategy', objective: 'Address verified citation and answer gaps without outcome claims.', strategy: { prohibitedClaims: ['No citation or ranking guarantees'], acceptanceCriteria: ['Ground every material claim in the approved evidence pack.'] } }) })
    assert.equal(strategy.response.status, 201); assert.equal(strategy.body.strategy.status, 'needs-review')
    const preApprovalBrief = await json(`/api/workspaces/${workspaceId}/content-briefs`, { method: 'POST', headers: auth(), body: JSON.stringify({ logicalKey: 'blocked-brief', diagnosisId: diagnosis.id, marketPackId: marketPack.id, targetQueryIds: diagnosis.queryIds, channel: marketPack.channels[0], contentType: 'faq', title: 'Blocked until strategy review', strategyId: strategy.body.strategy.id }) })
    assert.equal(preApprovalBrief.response.status, 409)
    const reviewedStrategy = await json(`/api/workspaces/${workspaceId}/content-strategies/${strategy.body.strategy.id}/review`, { method: 'POST', headers: auth(), body: JSON.stringify({ status: 'approved', reviewComment: 'Scope and evidence chain reviewed.' }) })
    assert.equal(reviewedStrategy.response.status, 200); assert.equal(reviewedStrategy.body.strategy.status, 'approved')
    const brief = await json(`/api/workspaces/${workspaceId}/content-briefs`, { method: 'POST', headers: auth(), body: JSON.stringify({ logicalKey: 'strategy-bound-brief', diagnosisId: diagnosis.id, marketPackId: marketPack.id, targetQueryIds: diagnosis.queryIds, channel: marketPack.channels[0], contentType: 'faq', title: 'Source-cited knowledge-base FAQ', strategyId: strategy.body.strategy.id }) })
    assert.equal(brief.response.status, 201)
    const approvedBrief = await json(`/api/workspaces/${workspaceId}/content-briefs/${brief.body.brief.id}/review`, { method: 'POST', headers: auth(), body: JSON.stringify({ status: 'approved', reviewComment: 'Brief facts and channel rules reviewed.' }) })
    assert.equal(approvedBrief.response.status, 200)
    const draft = await json(`/api/workspaces/${workspaceId}/content-briefs/${brief.body.brief.id}/drafts`, { method: 'POST', headers: auth(), body: JSON.stringify({ logicalKey: 'strategy-bound-draft', title: 'Source-cited knowledge-base FAQ', templateOnly: true }) })
    assert.equal(draft.response.status, 201); assert.equal(draft.body.draft.status, 'needs-review')
    for (const claim of draft.body.claimValidations) {
      if (claim.status === 'unresolved') {
        const reviewed = await json(`/api/workspaces/${workspaceId}/content-drafts/${draft.body.draft.id}/claims/${claim.id}/resolve`, { method: 'POST', headers: auth(), body: JSON.stringify({ status: 'supported', evidenceRefs: [`content-brief://${brief.body.brief.id}`], resolutionComment: 'Verified against approved Brief.' }) })
        assert.equal(reviewed.response.status, 200)
      }
    }
    const approvedDraft = await json(`/api/workspaces/${workspaceId}/content-drafts/${draft.body.draft.id}/review`, { method: 'POST', headers: auth(), body: JSON.stringify({ status: 'approved', reviewComment: 'All detected claims are evidence-supported.' }) })
    assert.equal(approvedDraft.response.status, 200); assert.ok(approvedDraft.body.approvedSnapshot)
    const proof = await json(`/api/workspaces/${workspaceId}/artifacts`, { method: 'POST', headers: auth(), body: JSON.stringify({ kind: 'publication-proof', payload: { url: 'https://example.test/source-cited-faq', reviewer: 'editor' } }) })
    assert.equal(proof.response.status, 201)
    const publication = await json(`/api/workspaces/${workspaceId}/content-publications`, { method: 'POST', headers: auth(), body: JSON.stringify({ approvedSnapshotId: approvedDraft.body.approvedSnapshot.id, channel: marketPack.channels[0], publishedUrl: 'https://example.test/source-cited-faq', publishedAt: '2026-09-29T09:00:00.000Z', proofArtifactId: proof.body.artifact.id, targetQueryIds: diagnosis.queryIds, notes: 'Human-confirmed publication record.' }) })
    assert.equal(publication.response.status, 201); assert.equal(publication.body.publication.datasetId, dataset.id); assert.equal(publication.body.publication.status, 'registered')
    const unscheduledObservation = await json(`/api/workspaces/${workspaceId}/content-publications/${publication.body.publication.id}/observation`, { headers: auth() })
    assert.equal(unscheduledObservation.response.status, 200); assert.equal(unscheduledObservation.body.observation.status, 'not-scheduled')
    const retest = await json(`/api/workspaces/${workspaceId}/content-publications/${publication.body.publication.id}/retest`, { method: 'POST', headers: auth(), body: JSON.stringify({ scheduledFor: '2026-10-06T09:00:00.000Z', cadence: 'weekly', notes: 'Follow-up observation, not a replacement baseline.' }) })
    assert.equal(retest.response.status, 200); assert.equal(retest.body.publication.status, 'retest-planned'); assert.equal(retest.body.publication.retestPlan.datasetId, dataset.id); assert.deepEqual(retest.body.publication.retestPlan.targetQueryIds, diagnosis.queryIds); assert.match(retest.body.boundary, /not a replacement baseline/i)
    const scheduledObservation = await json(`/api/workspaces/${workspaceId}/content-publications/${publication.body.publication.id}/observation`, { headers: auth() })
    assert.equal(scheduledObservation.response.status, 200); assert.equal(scheduledObservation.body.observation.status, 'scheduled')

    const sourceRun = application.repository.getAssessmentRun(publication.body.publication.sourceAssessmentRunId)
    const followUp = application.repository.createAssessmentRun({ workspaceId, actorId: adminId, label: 'Post-publication same-scope retest', datasetId: sourceRun.datasetId, marketPackId: sourceRun.marketPackId, locale: sourceRun.locale, providers: sourceRun.providers, queryIds: sourceRun.cohortQueryIds })
    const sourceObservations = application.repository.listAssessmentObservations(workspaceId, sourceRun.id)
    for (const item of sourceObservations) {
      application.repository.importObservation({ workspaceId, actorId: adminId, assessmentRunId: followUp.id, queryId: item.queryId, providerId: item.providerId, modelIdentity: item.modelIdentity || 'controlled-manual-retest', collectedAt: new Date().toISOString(), sourceRef: `manual://retest/${item.id}`, rawArtifactId: item.rawArtifactId, supportingArtifactId: item.supportingArtifactId, citations: item.citations, analysis: item.analysis })
    }
    const readyObservation = await json(`/api/workspaces/${workspaceId}/content-publications/${publication.body.publication.id}/observation`, { headers: auth() })
    assert.equal(readyObservation.response.status, 200); assert.equal(readyObservation.body.observation.status, 'ready')
    assert.equal(readyObservation.body.observation.observation.comparable, true)
    assert.equal(readyObservation.body.observation.observation.baseline.mentionRate.rate, readyObservation.body.observation.observation.followUp.mentionRate.rate)
    assert.match(readyObservation.body.observation.boundary, /does not establish/i)
  })
})
