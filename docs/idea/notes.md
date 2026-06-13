# Autopilot — a loop you can stay the engineer of

> Status: solidified via grilling session (2026-06-13). This replaces the original ramble
> (still in git history). Source context that anchors this idea:
> Addy Osmani — *Loop Engineering*; MindStudio — *What is Loop Engineering*; Cursor forum thread.

---

## 1. One-liner

**Autopilot is an autonomous build loop that runs ahead of you — but lets you stay the engineer.**
A "pilot" agent makes the consequential decisions on your behalf, records every one of them as a
forkable node, and keeps your understanding in sync via a visible *comprehension-debt meter*. At any
point you can **pivot a single decision the pilot made and watch the loop re-react** — re-deciding and
re-implementing only what that change affects.

## 2. Thesis (why this exists)

Addy Osmani's conclusion about loop engineering: *"Build the loop. Stay the engineer."* The three
problems that get **worse** as a loop gets smoother are (1) verification falls on you, (2) comprehension
debt grows faster, (3) cognitive surrender. Every existing loop tool (Codex, Claude Code, the Cursor
multi-agent vision) optimizes for **throughput**.

Autopilot is autonomy-first too — but its differentiator is that it's deliberately engineered so the
human **stays in command without babysitting**: transparent onboarding into what the pilot decided, a
literal debt meter for comprehension, and **git-for-decisions branching** so you can explore "what if I'd
chosen differently?" without hand-editing anything.

## 3. Glossary (the project's own vocabulary)

- **Pilot** — the agent that acts *as the user*, making decisions from the user's `PROFILE.md`.
- **Mission** — the top-level unit of work: one feature / change. Runs the full pipeline end-to-end.
- **Decision Node** — a *consequential* choice the pilot made: `{question, options, choice, rationale,
  cited-evidence, depends-on[]}`. The atom of the whole system.
- **Decision DAG** — the dependency graph of decision nodes. The single core data structure; powers
  both pivot-reaction and serial/parallel scheduling.
- **Profile** — `PROFILE.md`, the user's taste / constraints / non-negotiables, captured by grilling the
  human **once** upfront. The pilot's source of judgment.
- **Escalation** — the grounded rule for when the loop pauses for the human instead of deciding.
- **Branch / Pivot** — forking a decision node, overriding it, and re-running the loop forward.
- **Comprehension-Debt Meter** — a live score of unreviewed decisions, weighted by blast-radius.
- **Lesson** — an in-depth, on-demand explanation of a decision; the way you "pay down" debt.

## 4. How a Mission runs

```
rough idea
   │
   ▼
[once per project] grill the HUMAN  ──►  PROFILE.md   (+ glossary/PROJECT.md)
   │
   ▼
PLAN ──► the pilot answers its own grilling FROM the profile
   │        every consequential answer → Decision Node (with depends-on edges + cited evidence)
   │        grounded escalation: pause only when (high blast-radius) AND (uncovered OR checker disagrees)
   ▼
ARCHITECTURE  →  PRD + ADRs  →  Issues
   │
   ▼
IMPLEMENT (per issue)  ──► same plan→decide cycle, then code
   │        DAG drives Amdahl scheduling: dependent issues serial, independent issues parallel (worktrees)
   ▼
HANDOFF doc per issue (deviations, self-made decisions, tradeoffs) for the next sprint + the human
   │
   ▼
everything lands in the ONBOARDING FEED + updates the DEBT METER
```

At any time the human can **pivot any Decision Node** → see §7.

## 5. The Pilot's judgment (grounded, never hallucinated)

> **Governing principle (applies to all of §5–§6 and §15):** separate the LLM's role (produce grounded,
> citable *evidence*) from the *verdict* (a deterministic rule or explicit human consent). The model may
> observe and cite; it is never the thing that decides whether it was safe to decide.

- The pilot decides **from `PROFILE.md`** + codebase + ADRs. Branch-overrides by the human update the
  profile — **branching is the teaching signal**, not just exploration (see §15.4 for how, without drift).
- **Escalation is evidence-based, never a self-reported confidence number** (those are hallucinations).
  Escalate only when **all three grounded signals** point to risk:
  1. **Blast-radius** — does it touch a *one-way door*? The pilot only **cites which surfaces a decision
     touches**; a deterministic policy assigns the tier (see §15.1). The model never rates the risk itself.
  2. **Coverage** — is there explicit, grep-citable support in `PROFILE.md` / ADRs / glossary?
  3. **Maker/Checker** — a *separate* verifier sub-agent (different prompt/model) independently
     re-derives the decision. Maker ≠ checker. Disagreement = genuine ambiguity. Verification intensity is
     **risk-proportional** to the blast-radius tier (see §15.2) — we don't pay full price on cheap calls.
  - **Rule:** escalate when `high-blast-radius AND (uncovered OR checker-disagrees)`. Otherwise decide and
    keep running. Every escalation shows its evidence. Default posture: the pilot should almost always be
    able to decide if it reads/thinks hard enough.

## 6. The Decision DAG (the spine)

- Only **consequential** decisions are logged (the pilot self-classifies). Micro-choices stay invisible to
  keep the tree small enough to branch and teach.
- **Edges are multi-source, not just self-declared** (declared edges fail silently — see §15.3):
  1. *Declared* — the pilot cites prior nodes/profile/files it relied on (a fast hint, captured at decision
     time, not reconstructed).
  2. *Derived* — computed from the real artifact/import/file-overlap graph (ground truth: if M's code
     touches files N created, `N→M` exists whether or not the pilot said so).
  3. *Checked* — a completeness pass on high-tier nodes cross-checks declared vs. reality.
- This one graph powers **two** features: pivot-invalidation (§7) and serial/parallel scheduling (Amdahl).

## 7. Branching / pivots (the jaw-drop)

- Every Decision Node is a **checkpoint** = a git commit/tag + a snapshot of loop state (DAG + profile +
  artifacts up to N).
- **Pivot N** = spin up a new **git worktree** from N's checkpoint, apply the override, re-run forward in
  isolation. The original branch is untouched; the two can be compared **side by side** (plans *and*
  working code).
- **Dependency-aware re-execution:** pivoting N invalidates **only its transitive dependents** in the DAG;
  independent decisions and their code are reused. The pilot re-derives just the invalidated subtree
  (same grounded-escalation rules), re-implements only the affected code, and the dashboard shows a diff:
  *"here's what changed because of your pivot."*

## 8. Comprehension-debt meter (staying the engineer)

- Non-blocking. Every Decision Node has a `reviewed/understood` state.
- Dashboard shows a live **debt score** = unreviewed decisions weighted by blast-radius.
- You **pay it down on demand**: click a node → in-depth explanation / lesson, or branch it.
- Optional **debt ceiling**: if crossed, the loop escalates (asks you to catch up). Never blocks by default
  — it makes Addy's "comprehension debt" a literal, visible number you choose when to settle.

## 9. Lessons (the debt payment)

- **On-demand by default.** Clicking a Decision Node opens a **side-chat preloaded with that node's full
  context** (question, options, choice, rationale, cited evidence, resulting diff).
- You can interrogate it, then **Save as lesson** → `.autopilot/lessons/`.
- Lessons are **in-depth** (the underlying concept + why *this* fit your profile + the tradeoffs + what the
  alternative would've meant) — not a one-line summary.
- Project toggle to **auto-generate** lessons for every high-blast-radius decision.

## 10. Surface / architecture

Ride Cursor's existing loop primitives — don't fork the editor.

- **Local orchestrator (CLI/daemon)** — owns the loop, the DAG, worktrees, scheduling.
- **MCP server** — exposes `.autopilot/` state + operations (log decision, escalate, branch, pay-debt) to
  the agents.
- **Cursor primitives** — skills (`SKILL.md`), subagents (`.cursor/agents`), hooks, slash commands carry
  the actual plan/grill/implement/verify work (maker vs checker = different subagents).
- **Thin local web dashboard** — the onboarding feed, the decision-DAG visualizer, the debt meter, the
  branch/compare view. (The "webapp" is *just* the dashboard, not a re-hosted agent.)

## 11. On-disk layout (`.autopilot/` — the memory; the repo remembers, the model forgets)

```
.autopilot/
  pilot/PROFILE.md            # user taste/constraints (versioned; changes are attributed deltas — §15.4)
  pilot/profile-history/      # diffable, revertible profile changes + which override caused each
  policy/blast-radius.yml     # deterministic surface→tier rules (seeded by upfront grill, overridable — §15.1)
  glossary/PROJECT.md         # project vocabulary (was CONTEXT.md in mattpocock's skills)
  architecture/               # visualizers + architecture docs (human- and pilot-readable)
  decisions/                  # the Decision DAG: one node per file + edges (declared/derived/checked)
  missions/<id>/              # per-mission PRD, ADRs, issues, handoff docs
  lessons/                    # saved in-depth lessons
  state.json                  # debt meter, review states, branch index, verification budget/cache
```

## 12. The demo (full vision, run live)

1. Give Autopilot a rough feature idea. It grills *you* once → `PROFILE.md`.
2. Watch it autopilot the Mission: decisions stream into the feed, evidence attached, the DAG draws itself,
   it escalates *exactly once* on a real one-way-door call.
3. It ships working code for the feature.
4. **Pivot a load-bearing decision** (e.g. "JWT → sessions"). A new worktree grows the alternative; the
   dashboard diffs *only* what the pivot touched; both versions run.
5. Show the debt meter dropping as you open a node and save a lesson.
6. (Stretch) run a second Mission **in parallel** to show Amdahl scheduling.

## 13. Build order (we have time + compute; this is sequence, not scope-cutting)

1. **State + DAG + MCP** — `.autopilot/` schema, decision nodes, edges, checkpoints. Nothing works without
   the spine.
2. **Profile grill + pilot decision loop** — upfront grill → `PROFILE.md` → pilot makes & logs decisions.
3. **Grounded escalation** — blast-radius checklist, coverage grep, maker/checker subagents.
4. **Dashboard v1** — feed + DAG visualizer + debt meter.
5. **Implementation + handoff** — code-gen per issue, handoff docs.
6. **Branching/pivot** — worktree checkpoints + dependency-aware re-execution + compare view.
7. **Amdahl scheduling** — parallel missions/issues across worktrees.
8. **Lessons + side-chat**; **profile-learning from overrides**.

## 14. Open questions / risks to pressure-test next

## 16. Still genuinely open (next to grill)
- **"Consequential" classification** — the pilot deciding what's worth logging is itself a judgment call;
  likely needs its own grounding (e.g. anything touching a blast-radius surface is auto-consequential).
- **Cold-start profile** — the very first mission has a thin profile, so escalation will be noisier until it
  learns. Acceptable, but worth an explicit onboarding ramp.
```
