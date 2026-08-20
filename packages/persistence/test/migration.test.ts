import { PGlite } from "@electric-sql/pglite";
import { quickPythonDictBundle } from "@searchos/fixtures";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendDurableRunEvent, createDurableRun, listSavedNotes, listStaleDurableRuns, persistBundle, readDurableRun,
  readNote, saveNoteFromRun, softDeleteNote, updateMyNotes, updateNoteFields, writeDurableRunCheckpoint, type DurableRunCheckpoint,
  type SearchOsDatabase
} from "../src/repository";
import * as schema from "../src/schema";

describe("PostgreSQL migration and repository", () => {
  let client: PGlite;
  let db: SearchOsDatabase;

  beforeEach(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "packages/persistence/drizzle" });
  }, 30_000);

  afterEach(async () => {
    await client.close();
  });

  it("migrates an empty PostgreSQL-compatible database", async () => {
    const tableRows = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'"
    );
    expect(tableRows.rows.map((row) => row.table_name)).toContain("search_tasks");
    expect(tableRows.rows.map((row) => row.table_name)).toContain("claim_evidence");
    expect(tableRows.rows.map((row) => row.table_name)).toContain("note_revisions");
    expect(tableRows.rows.map((row) => row.table_name)).toContain("search_queries");
    expect(tableRows.rows.map((row) => row.table_name)).toContain("source_documents");
    expect(tableRows.rows.map((row) => row.table_name)).toContain("provider_calls");
    const columnRows = await client.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'search_notes'");
    expect(columnRows.rows.map((row) => row.column_name)).toContain("category");
  });

  it("upgrades existing Search Notes to the INBOX category", async () => {
    const legacy = new PGlite();
    try {
      for (const migration of ["0000_wandering_gorilla_man.sql", "0001_magenta_franklin_richards.sql"]) {
        const sql = await readFile(`packages/persistence/drizzle/${migration}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) await legacy.exec(statement);
      }
      await legacy.exec(`
        insert into search_tasks (id, owner_id, original_question, current_question) values
          ('30000000-0000-7000-8000-000000000001', '30000000-0000-7000-8000-000000000002', 'legacy', 'legacy');
        insert into search_runs (id, task_id, trigger, requested_mode, selected_mode, state, current_stage) values
          ('30000000-0000-7000-8000-000000000003', '30000000-0000-7000-8000-000000000001', 'INITIAL', 'QUICK', 'QUICK', 'COMPLETED', 'COMPLETED');
        insert into search_notes (id, owner_id, task_id, source_run_id, title, summary, mode, overall_confidence, is_saved, search_date) values
          ('30000000-0000-7000-8000-000000000004', '30000000-0000-7000-8000-000000000002', '30000000-0000-7000-8000-000000000001', '30000000-0000-7000-8000-000000000003', 'Legacy Note', 'Legacy summary', 'QUICK', 'HIGH', true, now());
      `);
      const sql = await readFile("packages/persistence/drizzle/0002_search_note_categories.sql", "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) await legacy.exec(statement);
      const rows = await legacy.query<{ category: string }>("select category from search_notes where title = 'Legacy Note'");
      expect(rows.rows[0]?.category).toBe("INBOX");
    } finally {
      await legacy.close();
    }
  }, 30_000);

  it("saves a Note idempotently and keeps My Notes separate", async () => {
    await persistBundle(db, { ...quickPythonDictBundle, savedNote: { ...quickPythonDictBundle.savedNote, isSaved: false } });
    const once = await saveNoteFromRun(db, quickPythonDictBundle.savedNote.id, quickPythonDictBundle.savedNote.ownerId, "2026-08-12T09:00:00.000Z", "AI_DATA");
    const twice = await saveNoteFromRun(db, quickPythonDictBundle.savedNote.id, quickPythonDictBundle.savedNote.ownerId, "2026-08-12T09:01:00.000Z", "LIFE");
    expect(once.id).toBe(twice.id);
    expect(twice.category).toBe("AI_DATA");
    const edited = await updateMyNotes(db, once.id, once.ownerId, "personal, not evidence", "2026-08-12T09:02:00.000Z");
    expect(edited.myNotes).toBe("personal, not evidence");
  });

  it("updates favorite and category idempotently without changing evidence revisions", async () => {
    await persistBundle(db, quickPythonDictBundle);
    const patch = { isFavorite: true, category: "LIFE" as const };
    const once = await updateNoteFields(db, quickPythonDictBundle.savedNote.id, quickPythonDictBundle.savedNote.ownerId, patch, "2026-08-12T09:03:00.000Z");
    const twice = await updateNoteFields(db, quickPythonDictBundle.savedNote.id, quickPythonDictBundle.savedNote.ownerId, patch, "2026-08-12T09:04:00.000Z");
    expect(twice).toMatchObject({ id: once.id, isFavorite: true, category: "LIFE" });
    await updateNoteFields(db, quickPythonDictBundle.savedNote.id, quickPythonDictBundle.savedNote.ownerId, { isFavorite: false }, "2026-08-12T09:04:30.000Z");
    const unfavorited = await updateNoteFields(db, quickPythonDictBundle.savedNote.id, quickPythonDictBundle.savedNote.ownerId, { isFavorite: false }, "2026-08-12T09:04:40.000Z");
    expect(unfavorited.isFavorite).toBe(false);
    expect(await db.select().from(schema.noteRevisions)).toHaveLength(1);
    expect(await db.select().from(schema.claimEvidence)).toHaveLength(quickPythonDictBundle.claimEvidence.length);
    expect(await db.select().from(schema.claimTrustSummaries)).toHaveLength(quickPythonDictBundle.trustSummaries.length);
  });

  it("does not allow another owner to update Note organization", async () => {
    await persistBundle(db, quickPythonDictBundle);
    await expect(updateNoteFields(db, quickPythonDictBundle.savedNote.id, crypto.randomUUID(), { isFavorite: true }, "2026-08-12T09:05:00.000Z")).rejects.toThrow("not found");
    expect((await readNote(db, quickPythonDictBundle.savedNote.id, quickPythonDictBundle.savedNote.ownerId)).isFavorite).toBe(false);
  });

  it("persists and reads the Quick fixture through validated mappings", async () => {
    await persistBundle(db, quickPythonDictBundle);
    const note = await readNote(db, quickPythonDictBundle.savedNote.id, quickPythonDictBundle.savedNote.ownerId);
    expect(note).toEqual(quickPythonDictBundle.savedNote);
  });

  it("enforces unique Claim-Evidence relationships", async () => {
    await persistBundle(db, quickPythonDictBundle);
    const link = quickPythonDictBundle.claimEvidence[0]!;
    await expect(
      db.insert(schema.claimEvidence).values({
        ...link,
        id: "20000000-0000-7000-8000-000000000001"
      })
    ).rejects.toThrow();
  });

  it("soft-deletes a Note without deleting its SearchRun or Claims", async () => {
    await persistBundle(db, quickPythonDictBundle);
    await softDeleteNote(db, quickPythonDictBundle.savedNote.id, quickPythonDictBundle.savedNote.ownerId, "2026-08-12T09:00:00.000Z");
    await expect(readNote(db, quickPythonDictBundle.savedNote.id, quickPythonDictBundle.savedNote.ownerId)).rejects.toThrow("not found");
    const runs = await db.select().from(schema.searchRuns).where(eq(schema.searchRuns.id, quickPythonDictBundle.run.id));
    const claims = await db.select().from(schema.claims).where(eq(schema.claims.runId, quickPythonDictBundle.run.id));
    expect(runs).toHaveLength(1);
    expect(claims).toHaveLength(2);
  });

  it("rebuilds a runtime snapshot from a durable checkpoint and keeps events idempotent", async () => {
    const now = "2026-08-12T08:00:00.000Z";
    const checkpoint: DurableRunCheckpoint = {
      version: 1,
      question: "durable question",
      requestedMode: "QUICK",
      updatedAt: now,
      response: {
        taskId: crypto.randomUUID(), runId: crypto.randomUUID(), runtimeMode: "replay", provider: "replay",
        status: "QUEUED", currentStage: "CREATED", events: [], bundle: null, queries: [], retrievalAttempts: [],
        excludedSources: [], error: null, availableActions: ["RETRY", "EDIT_QUERY"]
      }
    };
    await createDurableRun(db, { ownerId: quickPythonDictBundle.task.ownerId, checkpoint });
    const event = { id: crypto.randomUUID(), runId: checkpoint.response.runId, sequence: 1, eventType: "RUN_CREATED" as const, fromState: null, toState: "CREATED" as const, summary: "created", payloadSummary: {}, createdAt: now };
    await appendDurableRunEvent(db, event);
    await appendDurableRunEvent(db, event);
    const running = { ...checkpoint, updatedAt: "2026-08-12T08:00:01.000Z", response: { ...checkpoint.response, status: "RUNNING" as const, events: [event], availableActions: ["CANCEL" as const] } };
    await writeDurableRunCheckpoint(db, running);
    const stored = await readDurableRun(db, checkpoint.response.runId);
    expect(stored?.checkpoint.response).toEqual(running.response);
    const events = await db.select().from(schema.runEvents).where(eq(schema.runEvents.runId, checkpoint.response.runId));
    expect(events).toHaveLength(1);
  });

  it("detects stale non-terminal runs but excludes terminal runs", async () => {
    const base = {
      version: 1 as const,
      question: "stale",
      requestedMode: "QUICK" as const,
      updatedAt: "2026-08-12T08:00:00.000Z",
      response: {
        taskId: crypto.randomUUID(), runId: crypto.randomUUID(), runtimeMode: "replay" as const, provider: "replay",
        status: "RUNNING" as const, currentStage: "RETRIEVING" as const, events: [], bundle: null, queries: [], retrievalAttempts: [],
        excludedSources: [], error: null, availableActions: ["CANCEL" as const]
      }
    };
    await createDurableRun(db, { ownerId: quickPythonDictBundle.task.ownerId, checkpoint: base });
    await writeDurableRunCheckpoint(db, base);
    const stale = await listStaleDurableRuns(db, "2026-08-12T08:01:00.000Z");
    expect(stale.map((run) => run.runId)).toContain(base.response.runId);
    await writeDurableRunCheckpoint(db, { ...base, response: { ...base.response, status: "FAILED", currentStage: "FAILED", error: { code: "PROCESS_INTERRUPTED", stage: "RETRIEVING", retryable: true, publicMessage: "interrupted", retainedObjectCounts: {} }, availableActions: ["RETRY", "EDIT_QUERY"] } });
    expect(await listStaleDurableRuns(db, "2026-08-12T08:01:00.000Z")).toHaveLength(0);
  });

  it("lists only explicitly saved Notes from the repository", async () => {
    await persistBundle(db, { ...quickPythonDictBundle, savedNote: { ...quickPythonDictBundle.savedNote, isSaved: false } });
    expect(await listSavedNotes(db, quickPythonDictBundle.task.ownerId)).toHaveLength(0);
    await saveNoteFromRun(db, quickPythonDictBundle.savedNote.id, quickPythonDictBundle.task.ownerId, "2026-08-12T09:00:00.000Z");
    expect(await listSavedNotes(db, quickPythonDictBundle.task.ownerId)).toHaveLength(1);
  });
});
