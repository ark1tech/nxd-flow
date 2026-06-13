# Buildspace Video Script — Autopilot

> Read these aloud to camera. Plain language for a general CS audience.
> Member 1 = backend / logic. Member 2 = UI / demo.

---

## BUILDSPACE 1 — Team Introduction + Early Progress

### Product introduction (to camera)

"We're building **Autopilot** — an AI coding assistant that runs ahead of you, but still keeps you
in charge.

Everyone's trying to make coding bots *faster*. The catch is: the smoother they get, the less you
understand your own code, and the easier it is to just accept whatever they output. We built
Autopilot so you get speed *without* losing control or context."

**What is your product called?**
Autopilot.

**What problem does it solve?**
AI can write code for you, but it often leaves you unable to explain *why* things were built that
way — or what would have happened if it had chosen differently. Autopilot records the important
choices, shows you what you haven't reviewed yet, and lets you rewind and try another path without
starting over.

**Who is it for?**
Software engineers who use AI coding tools (like Cursor or Claude) on real projects — not just
small demos — and want to stay responsible for their codebase.

**Why did you choose this idea?**
The advice is always "use AI, but stay the engineer." Most tools only help with the first part.
We wanted to build the second part into the product itself.

**What makes it unique?**
Three things:

1. **Smart pauses** — the bot only asks you when a choice is actually risky and it lacks clear
  guidance. It doesn't nag you on every line, and it doesn't hide big decisions either.
2. **A "what I don't understand yet" score** — a number that goes down as you review the choices
  the bot made. Like a todo list for your understanding of the project.
3. **Branching on decisions** — change one past choice (e.g. "use sessions instead of JWT") and
  the system re-runs only what depended on that choice. You can compare two versions side by side.

---

### Task delegation / planning

**What is each member responsible for?**

- **Member 1** — The brain: tracking decisions, deciding when to ask the human, scoring
comprehension debt, and handling pivots correctly.
- **Member 2** — What you see: the web dashboard, live updates, the decision map, and the demo
flow for the camera.
- **Together** — Connecting the AI agent to the engine and making the whole loop runnable end to end.

**What are your goals before Buildspace 2?**
Run the full demo live: describe a feature → watch decisions appear on screen → bot pauses once
on a real auth choice → code ships → we change that auth choice and show what gets re-done vs
what stays the same → comprehension score drops when we review a decision.

---

### Progress

**What have you completed?**

- The core app structure (backend, UI, shared types, CLI).
- The logic layer with automated tests — decision tracking, risk rules, when-to-ask logic, user
preferences, debt score, and the main loop.
- An end-to-end demo: start a mission, log decisions, pause on escalation, answer it, pivot, save
a lesson. It works today.

**What are you currently working on?**
Polishing the demo so it's smooth on camera, and optionally hooking up live AI runs vs our
reliable scripted demo.

**What has gone well?**
The hardest part — knowing when to trust the bot vs when to ask the human — is built and tested.
The full loop already runs.

**What has been difficult?**
Making sure the AI suggests things but doesn't *decide* whether they're safe. Rules and human
answers make the final call. Also: tracking which decisions depend on which, so a pivot doesn't
miss related code.

**What is your next goal?**
The pivot moment on camera: change one decision and show only the affected work getting redone.

---

### Member 1 update

**What are you personally building?**
The backend logic — especially the decision tracker and the rules for when the bot should stop
and ask a human. If this is wrong, the whole product can't be trusted.

**What are you most excited about?**
The pivot. Change one decision and watch the system redo only what actually depended on it.
That's the wow moment.

**What will be the hardest part?**
Knowing exactly which past decisions and code to redo when you change one choice — without redoing
everything or missing something important.

**Do you think your team can win?**
Yes. Most teams ship a faster chatbot. We're solving "stay in control" — and it already runs.

### Member 2 update

**What are you personally building?**
The dashboard — the screen people actually use. Live feed of what the bot is doing, a visual map
of decisions, the comprehension score, buttons to answer escalations and trigger pivots, and a
file viewer to see what code changed.

**What are you most excited about?**
Watching the decision map build itself in real time. You see each choice appear, the bot pauses
when it should, and after a pivot you instantly see what changed vs what stayed.

**What will be the hardest part?**
Keeping the UI accurate while everything is moving fast — no stale screens, no flicker — and
making the pivot comparison easy to understand at a glance. Plus making the demo reliable every
time we film it.

**Do you think your team can win?**
Yes. A lot of teams demo in a terminal or on slides. We have a real UI that shows the idea — and
the pivot compare is memorable if we nail it on camera.

---

### Footage / B-roll shotlist (Buildspace 1)

- [ ] **Product introduction** — to-camera, intro paragraph above.
- [ ] **Task delegation** — whiteboard: Member 1 = logic, Member 2 = UI.
- [ ] **Member 1 update** — to-camera.
- [ ] **Member 2 update** — to-camera.
- [ ] **Team update** — Progress section, together.
- [ ] **Product showcase** — tests passing; run a mission in the app.
- [ ] **Coding timelapse** — sped-up coding session.
- [ ] **Development B-roll** — terminal, dashboard, keyboard, screens.

---

## BUILDSPACE 2 — Challenges

### Member 1 challenge update

**What challenge are you facing?**
The bot needs to ask humans rarely but at the right times. Too many questions = annoying. Too few
= dangerous. We're betting on clear rules instead of "the model felt confident."

**What has slowed you down?**
The bot doesn't always say which earlier choices a new choice depends on. We had to infer
dependencies from the actual code and files, not just trust what the bot claimed.

**Have you changed your plan?**
We narrowed scope: one feature, end to end, step by step. Parallel missions and cloud hosting are
out for now — they don't prove the core idea.

**How will you solve this problem?**
When we're unsure if something depends on a changed decision, we redo it anyway — safer to redo
too much than miss something. After each pivot we compare outputs to catch anything we missed.

**Can you still finish on time?**
Yes. The core loop works and tests pass. What's left is polish and connecting live AI runs — not
unsolved research.

### Member 2 challenge update

**What challenge are you facing?**
The dashboard has to tell the story *while* the bot is working — not after. If the map or the
score lags even for a second, the "transparent AI" pitch breaks.

**What has slowed you down?**
The pivot comparison screen. People need to instantly see: what changed, what stayed, and the
actual code difference — not just a list of IDs.

**Have you changed your plan?**
We prioritized a reliable scripted demo for the camera first. Live AI runs are optional for now —
a flaky bot on stage would hurt the trust story.

**How will you solve this problem?**
Push full state updates to the UI on every step. Highlight changed decisions, fade unchanged ones,
auto-open the screen when the bot needs an answer. Rehearse one fixed demo path (auth feature,
JWT → sessions pivot).

**Can you still finish on time?**
Yes. Streaming, the map, escalations, and pivot compare already work. Leftover work is visual
polish, not rebuilding from scratch.

---

### End-of-day reflection (team)

**What did you accomplish today?**
Core logic and the full loop are running — missions, decisions, pauses, pivots, lessons.

**What still needs to be finished?**
Polish on live AI integration and a cleaner pivot comparison view for the demo.

**Are you ahead or behind schedule?**
On track — maybe ahead on the risky backend work.

**Do you think you'll finish tomorrow?**
Yes for the core demo. Running two missions in parallel would be a bonus if we have time.

**Why should your team win?**
Everyone else is racing to make AI code faster. We're the only team making it *yours* — visible
choices, a comprehension score, and branching on decisions. And it's not vaporware; it runs today.

**Team prediction.**
We land the live pivot on camera. That's the clip people remember.

---

### Footage / B-roll shotlist (Buildspace 2)

- [ ] **Member 1 challenge update** — to-camera.
- [ ] **Member 2 challenge update** — to-camera.
- [ ] **Product show**
- [ ] 
- [ ] 
- [ ] 
- [ ] **case / demo** — full mission: decisions, one pause, one pivot.
- [ ] **Problem-solving B-roll** — debugging, tests, whiteboard.
- [ ] **Team reflection** — end-of-day answers together.
- [ ] **Team prediction** — to camera.
- [ ] **End-of-day B-roll** — wind-down shots.