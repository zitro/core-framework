# Design Thinking in CORE

CORE is opinionated: it borrows directly from design thinking and adapts the
discipline to enterprise discovery. This document explains the mapping, the
methods we promote in each phase, and how the platform encodes them.

## The mapping

| Design thinking stage | CORE phase | What we are doing |
| --------------------- | ---------- | ----------------- |
| Empathize             | Capture    | Listen first. Capture lived experience, not opinions. |
| Define                | Orient     | Frame the right problem before solving the wrong one. |
| Ideate / Prototype    | Refine     | Diverge on options, validate the riskiest assumptions cheaply. |
| Test / Deliver        | Execute    | Ship the smallest thing that proves value. |

The mapping is not perfect — design thinking was originally framed for product
design, while CORE serves enterprise transformation work. But the discipline is
the same: separate problem-finding from problem-solving, and validate
assumptions before committing resources.

## Methods we promote per phase

### Capture (Empathize)

- **Stakeholder interviews** with open, non-leading questions.
- **Direct observation** of the work as it actually happens.
- **Empathy mapping** — what users say, think, do, and feel.
- **Jobs-to-be-done** statements: when [situation], I want to [motivation], so I can [outcome].
- **Pain-point inventory** — explicit, sourced from quotes.

CORE's Discovery Coach generates Capture-phase questions tuned for these
methods. The Empathy Researcher agent specializes in mapping interview
transcripts into empathy maps.

### Orient (Define)

- **Affinity clustering** of evidence to surface patterns.
- **5 Whys** to push from symptom to root cause.
- **How Might We (HMW)** reframing: convert problems into solvable invitations.
- **Personas and journey maps** to make the abstract concrete.
- **Problem statements** in the form: [user] needs [need] because [insight].

CORE's HMW Framer agent converts pain points into HMW questions. The Problem
Analyst agent produces structured problem statements with traceable evidence.

### Refine (Ideate / Prototype)

- **Divergent ideation** — quantity before quality.
- **Crazy 8s** and other timeboxed sketching prompts.
- **Assumption mapping** — list assumptions, rank by risk and certainty.
- **Riskiest-assumption testing** before building.
- **Storyboards and lightweight prototypes** rather than full specs.

CORE's Ideation Facilitator agent runs divergent ideation against a HMW or
problem statement. The Assumption Tester agent surfaces and ranks assumptions.

### Execute (Test / Deliver)

- **Quick win** — smallest scoped delivery that proves value.
- **Success metrics** defined before the work starts.
- **Blocker register** with named owners.
- **Retros and learning loops** baked into delivery cadence.

The Solution Architect agent translates validated direction into a buildable
blueprint. The Discovery Narrator synthesizes the journey into a story for
sponsors.

## How the platform encodes design thinking

| Mechanism | Where it lives |
| --------- | -------------- |
| Phase prompts | `backend/app/agents/*.py` system prompts reference DT methods explicitly. |
| Evidence types | `backend/app/models/core.py` includes DT-native types: observation, quote, pain-point, JTBD, assumption, hypothesis. |
| Templates | `backend/app/templates/dt/` ships markdown templates for empathy map, persona, journey map, HMW board, assumption matrix. |
| Agents | Empathy Researcher, HMW Framer, Ideation Facilitator, Assumption Tester sit alongside the existing CORE agents. |
| UI | Each phase page surfaces a "DT Methods" panel that suggests relevant techniques and links to the right templates. |

## Principles we hold to

1. **Problem before solution.** Refuse to skip Capture or Orient even when the
   pressure is to start building.
2. **Evidence beats opinion.** Every claim should trace back to a quote, an
   observation, or a documented assumption.
3. **Assumptions are first-class.** Naming them is half the win; testing them
   cheaply is the other half.
4. **Diverge then converge.** Generate options before picking one.
5. **Smallest valuable thing.** Quick wins beat big plans.

## Further reading

- IDEO, *The Field Guide to Human-Centered Design*.
- Tim Brown, *Change by Design*.
- Erika Hall, *Just Enough Research*.
- Tom Kelley, *The Art of Innovation*.
- Strategyzer, *Testing Business Ideas* (assumption mapping).
