import { NoteDetailClient } from "../../../components/note-detail-client";

export default async function NotePage({ params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  return <NoteDetailClient noteId={noteId} />;
}
