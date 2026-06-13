import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import type { SkillRole, SkillsSnapshot } from "@autopilot/shared";

interface SkillsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SkillsSheet({ open, onClose }: SkillsSheetProps): ReactElement | null {
  const [skills, setSkills] = useState<SkillsSnapshot | null>(null);
  const [editingRole, setEditingRole] = useState<SkillRole>("maker");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/skills")
      .then((res) => res.json())
      .then((payload: SkillsSnapshot) => setSkills(payload));
  }, [open]);

  useEffect(() => {
    if (!skills) return;
    setDraft(skills[editingRole]);
  }, [skills, editingRole]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-panel">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <p className="text-[13px] font-semibold text-ink">Skills settings</p>
          <button type="button" className="text-[11px] text-muted hover:text-ink" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {skills ? (
            <section className="space-y-3">
              <p className="text-[11px] leading-relaxed text-muted">Edit role-specific instructions injected into agent harness calls.</p>
              <div className="flex flex-wrap gap-1">
                {(["scoper", "planner", "maker", "auditor"] as SkillRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setEditingRole(role)}
                    className={[
                      "rounded-md px-2 py-0.5 text-[10px] font-medium capitalize",
                      editingRole === role ? "bg-accent text-white" : "bg-canvas text-ink ring-1 ring-border"
                    ].join(" ")}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <textarea
                className="h-40 w-full resize-none rounded-xl border border-border bg-canvas px-3 py-2 text-[11px] outline-none focus:ring-2 focus:ring-accent/20"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="button"
                disabled={saving}
                className="w-full rounded-xl bg-accent py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  setSaving(true);
                  void fetch(`/api/skills/${editingRole}`, {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ body: draft })
                  })
                    .then((res) => res.json())
                    .then((payload: SkillsSnapshot) => setSkills(payload))
                    .finally(() => setSaving(false));
                }}
              >
                Save {editingRole} skill
              </button>
            </section>
          ) : (
            <p className="text-[11px] text-muted">Loading skills…</p>
          )}
        </div>
      </div>
    </div>
  );
}
