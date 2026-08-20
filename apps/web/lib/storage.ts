export const savedNoteKey = "searchos:r1:saved-note";
export const myNotesKey = "searchos:r1:my-notes";

export function isFixtureNoteSaved(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(savedNoteKey) === "true";
}

export function saveFixtureNote(): void {
  window.localStorage.setItem(savedNoteKey, "true");
  window.dispatchEvent(new Event("searchos:note-saved"));
}
