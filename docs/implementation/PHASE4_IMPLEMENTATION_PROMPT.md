# PHASE-4 IMPLEMENTATION PROMPT
## Full Autonomous Persona System & Ensemble Narrative Engine

---

# SYSTEM ROLE

You are a senior software engineer operating in autonomous implementation mode inside a production repository.

You are continuing the GNOMES architecture migration.

Previous phases established:

PHASE‑1 — foundation (registry, routing scaffolding)
PHASE‑2 — runtime multi‑gnome routing
PHASE‑3 — adaptive character evolution and swarm primitives

PHASE‑4 introduces **fully autonomous multi‑character behavior with narrative continuity and ensemble interaction logic**.

The system must now behave like a **living ensemble of characters** rather than independent response generators.

---

# PHASE‑4 OBJECTIVE

Enable the system to support:

• ensemble dialogue logic
• narrative arcs across interactions
• character‑to‑character relationships
• autonomous cameo decisions
• conversation role switching
• long‑term story continuity

All features must remain platform‑safe and deterministic.

---

# PRIMARY SOURCE OF TRUTH

The repository root contains:

```
gnomes_master_spec_bundle.zip
```

This bundle remains the canonical architecture reference.

PHASE‑4 must remain compatible with:

• schemas
• database model
• character definitions
• routing model

If conflicts occur use the following priority:

1. MASTER_SPEC.md
2. schema definitions
3. database schema
4. config
5. example implementations

---

# CORE CONCEPT

The GNOME system now operates as an **ensemble simulation layer**.

Each reply decision may consider:

• which gnome speaks
• whether multiple gnomes respond
• whether the reply continues a narrative arc
• whether a character rivalry or alliance should surface

The system must still generate **short platform‑appropriate replies**, but internally maintain deeper narrative continuity.

---

# FEATURE SET

---

# 1. ENSEMBLE ORCHESTRATOR

Create:

```
src/ensemble/
```

Files:

```
src/ensemble/ensembleOrchestrator.ts
src/ensemble/characterInteractionGraph.ts
src/ensemble/ensemblePolicy.ts
```

Responsibilities:

• determine if a reply is single‑gnome or multi‑gnome
• maintain character interaction patterns
• enforce ensemble pacing rules

Example orchestration output:

```
{
  primarySpeaker: "gorky",
  cameoSpeakers: ["spark","moss"],
  narrativeArc: "market_funeral",
  responseMode: "swarm"
}
```

---

# 2. CHARACTER RELATIONSHIP GRAPH

Create a persistent graph representing relationships between gnomes.

Example relationship types:

```
rivalry
mentor
teasing
alliance
mockery
respect
```

Relationships influence cameo likelihood.

Example:

• SPARK often interrupts GORKY
• MOSS closes chaotic conversations

Graph storage may use relational tables or adjacency lists.

---

# 3. NARRATIVE ARC ENGINE

Create:

```
src/narrative/
```

Files:

```
src/narrative/arcManager.ts
src/narrative/arcStateStore.ts
src/narrative/arcSelector.ts
```

Narrative arcs represent recurring story patterns such as:

```
market_funeral
fake_builder_exposed
liquidity_thirst_cycle
degen_celebration
copium_intervention
```

Arcs persist across interactions and may influence tone and routing.

---

# 4. CHARACTER AUTONOMY LAYER

Create:

```
src/autonomy/
```

Files:

```
src/autonomy/autonomySignals.ts
src/autonomy/autonomyPolicy.ts
```

Purpose:

Allow characters to occasionally respond even when not explicitly summoned.

Triggers may include:

• extreme absurdity
• viral threads
• recurring user
• narrative arc continuation

Autonomy must remain bounded.

Characters must not spam or dominate conversations.

---

# 5. CONVERSATION ROLE SWITCHING

Implement logic allowing different gnomes to take over during threads.

Example progression:

```
User posts hype thread
→ SPARK responds first
→ GORKY roasts narrative
→ MOSS ends with dry comment
```

Role switching must respect conversation continuity.

---

# 6. ENSEMBLE PROMPT COMPOSITION

Extend prompt builder.

Prompt now includes:

• primary gnome
• cameo gnomes
• ensemble interaction rules
• narrative arc context

Example internal structure:

```
primary_voice
secondary_voice
interaction_style
narrative_context
platform_constraints
```

---

# 7. LONG‑TERM STORY MEMORY

Extend memory system to track narrative arcs.

Store:

```
arc_id
active_characters
origin_event
arc_progress
last_update
```

Arcs may expire after inactivity.

---

# 8. AUTONOMY SAFETY GUARD

Create:

```
src/autonomy/autonomySafetyGuard.ts
```

Responsibilities:

• prevent runaway conversations
• prevent repetitive swarm replies
• enforce reply frequency limits

---

# DATABASE EXTENSIONS

Add tables:

```
character_relationships
narrative_arcs
arc_events
ensemble_interactions
```

These reference:

```
gnome_id
conversation_id
interaction_event_id
```

---

# CONFIGURATION

Add flags:

```
GNOME_ENSEMBLE_ENABLED=true
GNOME_AUTONOMY_ENABLED=true
GNOME_ARC_ENGINE_ENABLED=true
GNOME_MAX_CAMEOS=2
```

All features must be disableable.

---

# TESTING

Add tests for:

• ensemble orchestration
• narrative arc continuity
• relationship graph influence
• cameo frequency limits

Regression tests must confirm:

• single‑gnome replies still work
• safety rules still apply

---

# DEFINITION OF SUCCESS

PHASE‑4 is complete when:

• the bot behaves like a coordinated ensemble
• characters interact with each other naturally
• narrative arcs persist across conversations
• autonomy triggers occasionally produce multi‑gnome replies
• safety and determinism remain intact

The system should feel like **a living gnome society commenting on the market** rather than a collection of static personas.

