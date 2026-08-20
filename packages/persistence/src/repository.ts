import type { ExcludedSourceView, NoteCategory, ParsedSourceDocument, RetrievalAttemptView, RunEvent, RuntimeRunResponse, SearchBundle, SearchNoteView, SearchQueryView, UpdateSearchNoteRequest } from "@searchos/contracts";
import { ParsedSourceDocumentSchema, SearchNoteViewSchema } from "@searchos/contracts";
import type { RequestedMode, RunState, RunTrigger } from "@searchos/domain";
import { and, desc, eq, lt } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type SearchOsDatabase = PgliteDatabase<typeof schema>;

export interface DurableRunCheckpoint {
  readonly version: 1;
  readonly question: string;
  readonly requestedMode: RequestedMode;
  readonly parentRunId?: string | null;
  readonly trigger?: RunTrigger;
  readonly response: RuntimeRunResponse;
  readonly updatedAt: string;
}

export interface DurableRunRecord {
  readonly taskId: string;
  readonly runId: string;
  readonly state: RunState;
  readonly heartbeatAt: string | null;
  readonly cancelRequestedAt: string | null;
  readonly checkpoint: DurableRunCheckpoint;
}

function asIsoDateTime(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export async function persistBundle(db: SearchOsDatabase, bundle: SearchBundle): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(schema.searchTasks).values({
      id: bundle.task.id,
      ownerId: bundle.task.ownerId,
      originalQuestion: bundle.task.originalQuestion,
      currentQuestion: bundle.task.currentQuestion,
      latestRunId: bundle.task.latestRunId,
      createdAt: bundle.task.createdAt,
      updatedAt: bundle.task.updatedAt
    }).onConflictDoUpdate({ target: schema.searchTasks.id, set: {
      currentQuestion: bundle.task.currentQuestion,
      latestRunId: bundle.task.latestRunId,
      updatedAt: bundle.task.updatedAt
    } });
    await tx.insert(schema.searchRuns).values({
      id: bundle.run.id,
      taskId: bundle.run.taskId,
      parentRunId: bundle.run.parentRunId,
      trigger: bundle.run.trigger,
      requestedMode: bundle.run.requestedMode,
      selectedMode: bundle.run.selectedMode,
      modeConfidence: bundle.run.modeConfidence,
      state: bundle.run.state,
      currentStage: bundle.run.currentStage,
      stopReason: bundle.run.stopReason,
      partialReason: bundle.run.partialReason,
      startedAt: bundle.run.startedAt,
      completedAt: bundle.run.completedAt,
      cancelledAt: bundle.run.cancelledAt,
      createdAt: bundle.run.createdAt,
      updatedAt: bundle.run.updatedAt
    }).onConflictDoUpdate({ target: schema.searchRuns.id, set: {
      selectedMode: bundle.run.selectedMode,
      modeConfidence: bundle.run.modeConfidence,
      state: bundle.run.state,
      currentStage: bundle.run.currentStage,
      stopReason: bundle.run.stopReason,
      partialReason: bundle.run.partialReason,
      completedAt: bundle.run.completedAt,
      cancelledAt: bundle.run.cancelledAt,
      updatedAt: bundle.run.updatedAt
    } });
    await tx.insert(schema.runEvents).values(bundle.events.map((event) => ({
      id: event.id, runId: event.runId, sequence: event.sequence, eventType: event.eventType,
      fromState: event.fromState, toState: event.toState, summary: event.summary, payloadSummary: event.payloadSummary, createdAt: event.createdAt
    }))).onConflictDoNothing();
    await tx.insert(schema.searchPlans).values({
      id: bundle.plan.id, runId: bundle.plan.runId, version: bundle.plan.version,
      objective: bundle.plan.objective, stopConditions: bundle.plan.stopConditions
    }).onConflictDoNothing();
    await tx.insert(schema.planSteps).values(bundle.plan.steps.map((step) => ({
      id: step.id, planId: bundle.plan.id, goal: step.goal, queryTemplates: step.queryTemplates,
      preferredSourceTypes: step.preferredSourceTypes, completionCriteria: step.completionCriteria,
      priority: step.priority, status: step.status
    }))).onConflictDoNothing();
    await tx.insert(schema.sources).values(bundle.sources.map((source) => ({
      id: source.id, canonicalUrl: source.canonicalUrl, urlHash: `url:${source.id}`,
      sourceType: source.sourceType, title: source.title, publisher: source.publisher,
      domain: source.domain, publishedAt: source.publishedAt, updatedAtSource: source.updatedAtSource,
      language: source.language, isOfficial: source.isOfficial,
      createdAt: source.accessedAt, updatedAt: source.accessedAt
    }))).onConflictDoNothing();
    await tx.insert(schema.sourceSnapshots).values(bundle.snapshots.map((snapshot) => ({
      id: snapshot.id, sourceId: snapshot.sourceId, fetchedAt: snapshot.fetchedAt,
      contentHash: snapshot.contentHash, contentType: snapshot.contentType,
      versionLabel: snapshot.versionLabel, parseStatus: snapshot.parseStatus, parserVersion: snapshot.parserVersion
    }))).onConflictDoNothing();
    await tx.insert(schema.claims).values(bundle.claims.map((claim) => ({
      id: claim.id, runId: claim.runId, statement: claim.statement,
      normalizedStatement: claim.normalizedStatement, statementHash: `claim:${claim.id}`,
      claimType: claim.claimType, importance: claim.importance, status: claim.status, scope: claim.scope
    }))).onConflictDoNothing();
    await tx.insert(schema.evidence).values(bundle.evidence.map((item) => ({
      id: item.id, snapshotId: item.snapshotId, evidenceType: item.evidenceType,
      excerpt: item.excerpt, paraphrase: item.paraphrase, locator: item.locator,
      evidenceHash: item.evidenceHash, extractionMethod: item.extractionMethod,
      extractorVersion: item.extractorVersion, language: item.language
    }))).onConflictDoNothing();
    await tx.insert(schema.claimEvidence).values(bundle.claimEvidence.map((link) => ({
      id: link.id, claimId: link.claimId, evidenceId: link.evidenceId, stance: link.stance,
      relevance: link.relevance, authority: link.authority, primaryContext: link.primaryContext,
      freshness: link.freshness, independenceGroup: link.independenceGroup,
      assessmentNotes: link.assessmentNotes, evaluatorVersion: link.evaluatorVersion, assessedAt: link.assessedAt
    }))).onConflictDoNothing();
    await tx.insert(schema.claimTrustSummaries).values(bundle.trustSummaries).onConflictDoNothing();
    if (bundle.conflicts.length > 0) await tx.insert(schema.conflicts).values(bundle.conflicts).onConflictDoNothing();
    await tx.insert(schema.structuredResults).values({
      runId: bundle.result.runId, status: bundle.result.status, title: bundle.result.title,
      answerSections: bundle.result.answerSections, decisiveClaimIds: bundle.result.decisiveClaimIds,
      keyClaimIds: bundle.result.keyClaimIds, sourceIds: bundle.result.sourceIds,
      overallConfidence: bundle.result.overallConfidence,
      confidenceReasonCodes: bundle.result.confidenceReasonCodes,
      confidenceExplanation: bundle.result.confidenceExplanation, limitations: bundle.result.limitations,
      synthesisVersion: bundle.result.synthesisVersion
    }).onConflictDoNothing();
    await tx.insert(schema.searchNotes).values({
      id: bundle.savedNote.id, ownerId: bundle.savedNote.ownerId, taskId: bundle.savedNote.taskId,
      sourceRunId: bundle.savedNote.sourceRunId, title: bundle.savedNote.title, summary: bundle.savedNote.summary,
      mode: bundle.savedNote.mode, overallConfidence: bundle.savedNote.overallConfidence,
      isSaved: bundle.savedNote.isSaved, isFavorite: bundle.savedNote.isFavorite,
      category: bundle.savedNote.category, myNotes: bundle.savedNote.myNotes,
      searchDate: bundle.savedNote.searchDate, createdAt: bundle.savedNote.createdAt, updatedAt: bundle.savedNote.updatedAt
    }).onConflictDoNothing();
    const revisionId = bundle.savedNote.id;
    await tx.insert(schema.noteRevisions).values({
      id: revisionId, noteId: bundle.savedNote.id, revisionNo: 1, sourceRunId: bundle.savedNote.sourceRunId,
      summary: bundle.savedNote.summary, overallConfidence: bundle.savedNote.overallConfidence,
      createdAt: bundle.savedNote.createdAt
    }).onConflictDoNothing();
    await tx.insert(schema.noteClaims).values(bundle.savedNote.claims.map((claim) => ({
      revisionId, claimId: claim.claimId, statementSnapshot: claim.statementSnapshot,
      trustLevelSnapshot: claim.trustLevelSnapshot, displayOrder: claim.displayOrder, isKey: claim.isKey
    }))).onConflictDoNothing();
  });
}

export async function createDurableRun(db: SearchOsDatabase, input: {
  readonly ownerId: string;
  readonly checkpoint: DurableRunCheckpoint;
}): Promise<void> {
  const { response } = input.checkpoint;
  await db.transaction(async (tx) => {
    await tx.insert(schema.searchTasks).values({
      id: response.taskId,
      ownerId: input.ownerId,
      originalQuestion: input.checkpoint.question,
      currentQuestion: input.checkpoint.question,
      latestRunId: response.runId,
      createdAt: input.checkpoint.updatedAt,
      updatedAt: input.checkpoint.updatedAt
    }).onConflictDoUpdate({ target: schema.searchTasks.id, set: {
      currentQuestion: input.checkpoint.question,
      latestRunId: response.runId,
      updatedAt: input.checkpoint.updatedAt
    } });
    await tx.insert(schema.searchRuns).values({
      id: response.runId,
      taskId: response.taskId,
      parentRunId: input.checkpoint.parentRunId ?? null,
      trigger: input.checkpoint.trigger ?? "INITIAL",
      requestedMode: input.checkpoint.requestedMode,
      selectedMode: null,
      modeConfidence: null,
      state: "CREATED",
      currentStage: "CREATED",
      heartbeatAt: input.checkpoint.updatedAt,
      checkpoint: input.checkpoint,
      startedAt: input.checkpoint.updatedAt,
      createdAt: input.checkpoint.updatedAt,
      updatedAt: input.checkpoint.updatedAt
    });
  });
}

export async function writeDurableRunCheckpoint(db: SearchOsDatabase, checkpoint: DurableRunCheckpoint): Promise<void> {
  const response = checkpoint.response;
  const terminal = ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(response.status);
  await db.update(schema.searchRuns).set({
    state: response.currentStage,
    currentStage: response.currentStage,
    heartbeatAt: checkpoint.updatedAt,
    checkpoint,
    errorCode: response.error?.code ?? null,
    errorDetail: response.error?.publicMessage ?? null,
    completedAt: terminal && response.status !== "CANCELLED" ? checkpoint.updatedAt : null,
    cancelledAt: response.status === "CANCELLED" ? checkpoint.updatedAt : null,
    updatedAt: checkpoint.updatedAt
  }).where(eq(schema.searchRuns.id, response.runId));
}

export async function appendDurableRunEvent(db: SearchOsDatabase, event: RunEvent): Promise<void> {
  await db.insert(schema.runEvents).values({
    id: event.id,
    runId: event.runId,
    sequence: event.sequence,
    eventType: event.eventType,
    fromState: event.fromState,
    toState: event.toState,
    summary: event.summary,
    payloadSummary: event.payloadSummary,
    createdAt: event.createdAt
  }).onConflictDoNothing();
}

export async function requestDurableRunCancellation(db: SearchOsDatabase, runId: string, requestedAt: string): Promise<void> {
  await db.update(schema.searchRuns).set({ cancelRequestedAt: requestedAt, updatedAt: requestedAt }).where(eq(schema.searchRuns.id, runId));
}

export async function readDurableRun(db: SearchOsDatabase, runId: string): Promise<DurableRunRecord | undefined> {
  const rows = await db.select({
    taskId: schema.searchRuns.taskId,
    runId: schema.searchRuns.id,
    state: schema.searchRuns.state,
    heartbeatAt: schema.searchRuns.heartbeatAt,
    cancelRequestedAt: schema.searchRuns.cancelRequestedAt,
    checkpoint: schema.searchRuns.checkpoint
  }).from(schema.searchRuns).where(eq(schema.searchRuns.id, runId)).limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return {
    taskId: row.taskId,
    runId: row.runId,
    state: row.state,
    heartbeatAt: row.heartbeatAt ? asIsoDateTime(row.heartbeatAt) : null,
    cancelRequestedAt: row.cancelRequestedAt ? asIsoDateTime(row.cancelRequestedAt) : null,
    checkpoint: row.checkpoint as DurableRunCheckpoint
  };
}

export async function readDurableRunByTask(db: SearchOsDatabase, taskId: string): Promise<DurableRunRecord | undefined> {
  const rows = await db.select({ runId: schema.searchTasks.latestRunId }).from(schema.searchTasks).where(eq(schema.searchTasks.id, taskId)).limit(1);
  return rows[0]?.runId ? readDurableRun(db, rows[0].runId) : undefined;
}

export async function listStaleDurableRuns(db: SearchOsDatabase, staleBefore: string): Promise<DurableRunRecord[]> {
  const rows = await db.select({ id: schema.searchRuns.id }).from(schema.searchRuns).where(lt(schema.searchRuns.heartbeatAt, staleBefore));
  const records = await Promise.all(rows.map((row) => readDurableRun(db, row.id)));
  return records.filter((record): record is DurableRunRecord => record !== undefined && !["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(record.state));
}

export async function listSavedNotes(db: SearchOsDatabase, ownerId: string): Promise<SearchNoteView[]> {
  const rows = await db.select({ id: schema.searchNotes.id }).from(schema.searchNotes)
    .where(and(eq(schema.searchNotes.ownerId, ownerId), eq(schema.searchNotes.isSaved, true)))
    .orderBy(desc(schema.searchNotes.updatedAt));
  const notes = await Promise.all(rows.map((row) => readNote(db, row.id, ownerId).catch(() => undefined)));
  return notes.filter((note): note is SearchNoteView => Boolean(note));
}

export async function findRunIdBySavedNote(db: SearchOsDatabase, noteId: string, ownerId: string): Promise<string | undefined> {
  const rows = await db.select({ runId: schema.searchNotes.sourceRunId }).from(schema.searchNotes)
    .where(and(eq(schema.searchNotes.id, noteId), eq(schema.searchNotes.ownerId, ownerId), eq(schema.searchNotes.isSaved, true))).limit(1);
  return rows[0]?.runId;
}

export async function persistRuntimeArtifacts(db: SearchOsDatabase, input: {
  queries: readonly SearchQueryView[];
  attempts: readonly RetrievalAttemptView[];
  documents: readonly ParsedSourceDocument[];
  excludedSources: readonly ExcludedSourceView[];
}): Promise<void> {
  await db.transaction(async (tx) => {
    if (input.queries.length) await tx.insert(schema.searchQueries).values(input.queries.map((query) => ({ ...query }))).onConflictDoNothing();
    if (input.attempts.length) await tx.insert(schema.retrievalAttempts).values(input.attempts.map((attempt) => ({ ...attempt }))).onConflictDoNothing();
    if (input.documents.length) await tx.insert(schema.sourceDocuments).values(input.documents.map((document) => ({
      snapshotId: document.snapshotId,
      title: document.title,
      normalizedText: document.normalizedText,
      blocks: document.blocks,
      truncated: document.truncated,
      parserVersion: document.parserVersion
    }))).onConflictDoNothing();
    if (input.excludedSources.length) await tx.insert(schema.excludedSources).values(input.excludedSources.map((item) => ({
      id: item.id, runId: item.runId, sourceUrl: item.url, stage: item.stage,
      reasonCode: item.reasonCode, publicSummary: item.publicSummary, createdAt: item.createdAt
    }))).onConflictDoNothing();
  });
}

export async function readSourceDocument(db: SearchOsDatabase, snapshotId: string): Promise<ParsedSourceDocument> {
  const rows = await db.select().from(schema.sourceDocuments).where(eq(schema.sourceDocuments.snapshotId, snapshotId)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("SourceDocument not found.");
  return ParsedSourceDocumentSchema.parse({
    snapshotId: row.snapshotId, title: row.title, normalizedText: row.normalizedText,
    blocks: row.blocks, truncated: row.truncated, parserVersion: row.parserVersion
  });
}

export async function saveNoteFromRun(
  db: SearchOsDatabase,
  noteId: string,
  ownerId: string,
  savedAt: string,
  suggestedCategory: NoteCategory = "INBOX"
): Promise<SearchNoteView> {
  await db.update(schema.searchNotes).set({ isSaved: true, category: suggestedCategory, updatedAt: savedAt }).where(and(
    eq(schema.searchNotes.id, noteId),
    eq(schema.searchNotes.ownerId, ownerId),
    eq(schema.searchNotes.isSaved, false)
  ));
  return readNote(db, noteId, ownerId);
}

export async function updateMyNotes(db: SearchOsDatabase, noteId: string, ownerId: string, body: string, updatedAt: string): Promise<SearchNoteView> {
  return updateNoteFields(db, noteId, ownerId, { myNotes: body }, updatedAt);
}

export async function updateNoteFields(
  db: SearchOsDatabase,
  noteId: string,
  ownerId: string,
  patch: UpdateSearchNoteRequest,
  updatedAt: string
): Promise<SearchNoteView> {
  const changes: Partial<typeof schema.searchNotes.$inferInsert> = { updatedAt };
  if (patch.myNotes !== undefined) changes.myNotes = patch.myNotes;
  if (patch.isFavorite !== undefined) changes.isFavorite = patch.isFavorite;
  if (patch.category !== undefined) changes.category = patch.category;
  await db.update(schema.searchNotes).set(changes).where(and(
    eq(schema.searchNotes.id, noteId),
    eq(schema.searchNotes.ownerId, ownerId),
    eq(schema.searchNotes.isSaved, true)
  ));
  return readNote(db, noteId, ownerId);
}

export async function readNote(db: SearchOsDatabase, noteId: string, ownerId: string): Promise<SearchNoteView> {
  const rows = await db.select().from(schema.searchNotes).where(and(eq(schema.searchNotes.id, noteId), eq(schema.searchNotes.ownerId, ownerId))).limit(1);
  const note = rows[0];
  if (!note || note.deletedAt) throw new Error("SearchNote not found.");
  const claims = await db
    .select({
      claimId: schema.noteClaims.claimId,
      statementSnapshot: schema.noteClaims.statementSnapshot,
      trustLevelSnapshot: schema.noteClaims.trustLevelSnapshot,
      displayOrder: schema.noteClaims.displayOrder,
      isKey: schema.noteClaims.isKey
    })
    .from(schema.noteClaims)
    .innerJoin(schema.noteRevisions, eq(schema.noteClaims.revisionId, schema.noteRevisions.id))
    .where(and(eq(schema.noteRevisions.noteId, noteId), eq(schema.noteRevisions.revisionNo, note.currentRevisionNo)));
  return SearchNoteViewSchema.parse({
    id: note.id, ownerId: note.ownerId, taskId: note.taskId, sourceRunId: note.sourceRunId,
    title: note.title, summary: note.summary, mode: note.mode, overallConfidence: note.overallConfidence,
    claims, createdAt: asIsoDateTime(note.createdAt), isSaved: note.isSaved, isFavorite: note.isFavorite,
    category: note.category, myNotes: note.myNotes,
    updatedAt: asIsoDateTime(note.updatedAt), searchDate: asIsoDateTime(note.searchDate)
  });
}

export async function softDeleteNote(db: SearchOsDatabase, noteId: string, ownerId: string, deletedAt: string): Promise<void> {
  await db.update(schema.searchNotes).set({ deletedAt, updatedAt: deletedAt }).where(and(eq(schema.searchNotes.id, noteId), eq(schema.searchNotes.ownerId, ownerId)));
}
