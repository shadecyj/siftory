import { quickPythonDictBundle, quickPythonDictInsufficientBundle, quickPythonDictPartialBundle } from "@searchos/fixtures";
import { RuntimeSearchWorkspace } from "../../../components/runtime-search-workspace";
import { SearchWorkspace } from "../../../components/search-workspace";
import { productName } from "../../../lib/brand";

export default async function SearchPage({ params, searchParams }: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ q?: string; run?: string; state?: string }>;
}) {
  const { taskId } = await params;
  const query = await searchParams;
  if (query.run) return <RuntimeSearchWorkspace taskId={taskId} runId={query.run} question={query.q?.trim() ?? `${productName} Quick Search`} />;
  const bundle = query.state === "partial"
    ? quickPythonDictPartialBundle
    : query.state === "insufficient"
      ? quickPythonDictInsufficientBundle
      : quickPythonDictBundle;
  return <SearchWorkspace bundle={bundle} question={query.q?.trim() || bundle.task.originalQuestion} />;
}
