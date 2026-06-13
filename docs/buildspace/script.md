# Buildspace Video Script — Autopilot

> Spoken-style answers for the Buildspace 1 & 2 submissions. Read these aloud to camera.
> Written solo-friendly: "Member 1" = you. If you have a second builder, fill the Member 2
> block; otherwise frame it as a second *track* of the same project and cut the duplicate.
> Grounded in the real repo state on 2026-06-13: pnpm monorepo, demo fixture,
> 13 passing tests, and a working demoable Autopilot loop.

---

## BUILDSPACE 1 — Team Introduction + Early Progress

### Product introduction (to camera)

"We're building **Autopilot** — an autonomous build loop that runs ahead of you, but lets you
stay the engineer.

Everyone's racing to make coding agents *faster*. The problem is, the smoother the loop gets,
the worse three things become: you stop verifying, your understanding of your own codebase
rots — that's *comprehension debt* — and you slide into just accepting whatever the agent
spits out. Autopilot is autonomy-first like the rest, but it's engineered so you stay in
command without babysitting it."

**What is your product called?**
Autopilot.

**What problem does it solve?**
When you hand a real feature to an autonomous coding loop, your comprehension of the code rots
and you slide into accepting whatever it produces. Existing tools optimize throughput and leave
you unable to answer "why was it built this way?" — and give you no cheap way to explore "what
if that decision had gone differently?" Autopilot keeps you the engineer.

**Who is it for?**
Builders and engineers running autonomous coding loops — Cursor, Codex, Claude Code users — who
are shipping real features, not toy demos, and refuse to lose the plot on their own codebase.

**Why did you choose this idea?**
It comes straight out of Addy Osmani's *Loop Engineering* — his conclusion is "Build the loop,
stay the engineer." Every tool nails the first half. Nobody operationalizes the second half. We
wanted to build the thing that makes "stay the engineer" a real, mechanical feature, not advice.

**What makes it unique?**
Three things existing loops don't have:
1. **Grounded escalation** — the agent only pauses to ask you on real *evidence*, not a
   hallucinated confidence score. A deterministic rule classifies blast-radius; the model never
   rates its own risk.
2. **A comprehension-debt meter** — every consequential decision is a visible, blast-radius-
   weighted number you choose when to pay down, by opening a node and saving a lesson.
3. **Git-for-decisions branching** — fork any decision the agent made, override it, and the loop
   re-runs *only the affected subtree* while reusing the independent decisions, so you compare two
   coherent versions side by side. The default demo is graph-level; real git worktrees are an
   opt-in path.

---

### Task delegation / planning

**What is each member responsible for?**
The work splits cleanly along the architecture:
- **Engine / brains** — the deterministic core: the decision graph, the blast-radius classifier,
  the escalation gate, the profile store, the debt meter. This is the trust anchor and gets the
  heaviest test coverage.
- **Agents + MCP boundary** — the `AgentRunner` that wraps the Cursor SDK and the Autopilot MCP
  server that exposes engine operations (log decision, escalate, save handoff) to the agents.
- **Dashboard / surface** — the Vite + React SPA: the live decision feed, the decision-DAG
  visualizer (React Flow), the debt meter, and the branch/compare view, streaming over WebSocket.

**What are your goals before Buildspace 2?**
Have the full demo run live, end to end: give Autopilot a rough feature, watch decisions stream
into the dashboard with the DAG drawing itself, hit exactly one well-justified escalation, ship
working code, then **pivot a load-bearing decision (JWT → sessions)** and watch the decision graph
show what gets invalidated versus reused while the debt meter drops. Live Cursor SDK runs remain an
optional `--live` path; the primary demo is deterministic so it is reliable on camera.

---

### Progress

**What have you completed?**
The whole spine is built and demoable:
- A pnpm monorepo with `engine`, `mcp`, `dashboard`, `cli`, `shared`, plus a Fastify fixture service.
- The trust core implemented with **13 passing tests**: decision store/graph, blast-radius classifier,
  escalation gate, profile store, debt meter, edge deriver, knowledge store, and the resumable loop.
- A working **end-to-end `LoopEngine`**: it starts a mission, runs stepped agent turns, logs each
  consequential decision, runs it through the grounded gate, emits live dashboard events, pauses on
  the JWT-vs-sessions decision, resumes on human answer, pivots with invalidate/reuse, and saves
  lessons.

**What are you currently working on?**
Polishing the demo path and deciding how far to push live Cursor SDK runs beyond the deterministic
scripted pilot.

**What has gone well?**
The deterministic core came together fast and is fully tested — the part we were most worried
about (trustworthy escalation) is solid. The end-to-end loop already runs a full mission today.

**What has been difficult?**
The hard part is philosophical-turned-mechanical: keeping the LLM *out of the verdict*. The model
produces evidence; a deterministic rule or explicit human consent makes the call. Getting the
escalation truth table right — tier × profile-coverage × auditor flag — and making DAG edges
trustworthy (filesystem ground truth, not just what the agent claimed) took real care.

**What is your next goal?**
The live pivot demo: override a decision and watch only the dependent subtree re-run while the
independent layout decision is reused.

---

### Member 1 update (you)

**What are you personally building?**
The engine's deterministic core — the decision graph and the grounded escalation gate. It's the
trust anchor of the whole product: if this is wrong, nothing downstream can be trusted.

**What are you most excited about?**
The pivot. Forking a single decision and watching the loop re-react — re-deciding and
re-implementing *only* what that change touched — is the moment that makes people's jaws drop.

**What will be the hardest part?**
Dependency-aware re-execution: figuring out exactly which decisions a pivot invalidates without
either churning unrelated code or silently missing an edge. We solve it conservatively — re-run
too much rather than too little — and self-correct by diffing produced artifacts.

**Do you think your team can win?**
Yes. Most projects are a throughput wrapper. We're building the thing the whole industry is about
to need — and the spine already runs.

### Member 2 update (fill or cut)

**What are you personally building?**
[The dashboard surface / the agent + MCP boundary — pick the track this person owns.]

**What are you most excited about?**
[e.g. watching the decision DAG draw itself live as the loop runs.]

**What will be the hardest part?**
[e.g. real-time streaming and keeping the visualizer in sync with engine state.]

**Do you think your team can win?**
[Their honest take.]

---

### Footage / B-roll shotlist (Buildspace 1)

- [ ] **Product introduction** — to-camera, the intro paragraph above.
- [ ] **Task delegation** — whiteboard or screen with the 3-track split; point at modules.
- [ ] **Member 1 update** — to-camera.
- [ ] **Member 2 update** — to-camera (or second track).
- [ ] **Team update** — the Progress section, delivered together.
- [ ] **Product showcase** — screen-record `vitest run` going green; run a mission via the CLI.
- [ ] **Coding timelapse** — sped-up screen capture of an editing session in `packages/engine`.
- [ ] **Development B-roll** — terminal scrolling, the DAG/feed, hands on keyboard, close-ups.

---

## BUILDSPACE 2 — Challenges

### Member 1 challenge update

**What challenge are you facing?**
Making escalation trustworthy without making it annoying. If the agent pauses too often it's a
nagging approval treadmill; if it pauses too little it's a black box. The whole bet rides on
grounding the *when-to-ask* in real evidence instead of a vibe.

**What has slowed you down?**
Edge fidelity in the decision DAG. Self-declared dependencies fail silently — the agent forgets
to mention an edge — so a pivot can miss code it should have re-run. We had to derive edges from
the real filesystem/import graph as ground truth on top of what the agent declares.

**Have you changed your plan?**
We tightened scope: v1 is one mission, end to end, implemented serially. Parallel "Amdahl"
scheduling across worktrees and cloud runtime are explicitly out of scope — they'd be a great
demo but they're not what proves the thesis.

**How will you solve this problem?**
Conservative, self-correcting re-execution: when a dependency is uncertain, re-run it anyway —
re-derivation is idempotent, so over-including costs compute, not correctness. After each pivot we
diff produced artifacts; a "reused" file that *would* have changed reveals a missing edge and we
add it. The graph sharpens every pivot.

**Can you still finish on time?**
Yes — the spine and the full loop already run with passing tests. What's left is wiring the live
UI and the SDK agents, which is integration work, not unsolved research.

### Member 2 challenge update (fill or cut)

**What challenge are you facing?**
[e.g. streaming engine state to the dashboard in real time without it going stale.]

**What has slowed you down?**
[Their honest blocker.]

**Have you changed your plan?**
[Any pivot in their track.]

**How will you solve this problem?**
[Their approach.]

**Can you still finish on time?**
[Their honest call.]

---

### End-of-day reflection (team)

**What did you accomplish today?**
Got the entire deterministic core and the end-to-end loop engine running green — start a mission,
log decisions, gate them, checkpoint, escalate, resume, pivot, save a lesson.

**What still needs to be finished?**
Further polish on live Cursor SDK maker/auditor agents beyond the deterministic pilot, and richer
visual design for the JWT → sessions pivot compare.

**Are you ahead or behind schedule?**
On track — arguably ahead on the risky part. We front-loaded the trust anchor (the part that
could've sunk us) and it's done and tested.

**Do you think you'll finish tomorrow?**
The core demo, yes. The stretch — running a second mission in parallel to show scheduling — is a
bonus we'll attempt only if the main flow is locked.

**Why should your team win?**
Because everyone else is making the loop faster, and we're the only ones making it *yours*. We
took a real, named problem — comprehension debt and cognitive surrender — and turned it into
mechanical features: grounded escalation, a debt meter, and git-for-decisions branching. And it's
not a mockup — the engine runs today.

**Team prediction.**
We finish the core demo and land the pivot moment live. That's the clip that wins it.

---

### Footage / B-roll shotlist (Buildspace 2)

- [ ] **Member 1 challenge update** — to-camera, escalation-trust challenge.
- [ ] **Member 2 challenge update** — to-camera (or second track).
- [ ] **Product showcase / demo** — live mission run: decisions appearing, one escalation, a pivot.
- [ ] **Problem-solving B-roll** — debugging the gate/DAG; tests turning red→green; whiteboarding.
- [ ] **Team reflection** — the end-of-day answers, delivered together.
- [ ] **Team prediction** — the one-liner above, to camera.
- [ ] **End-of-day B-roll** — desk wind-down, screens, late-night work shots.
