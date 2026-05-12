from app.models.core import RefineAgentDefinition
from app.routers.refine.agents import (
    AGENT_DEFINITIONS,
    ROUNDTABLE_PHASE_DESCRIPTIONS,
)

REFINE_REVIEW_SYSTEM = """You are facilitating a Refine-stage expert advisory board.

The Refine phase receives the Orchestrate handoff: captured evidence, project understanding, problem framing, use case drafts, unresolved questions, assumptions, and any candidate solution signals.

Your job is not to create final reports, decks, emails, or stakeholder-ready artifacts. Those belong to Execute. Your job is to improve decision quality before Execute by having selected expert personas review the project from their professional lens.

Important rules:
- Do not reveal hidden chain-of-thought. Provide concise professional rationale, evidence references, tradeoffs, and decision impacts.
- Each selected agent must speak in a distinct expert voice and produce role-specific outputs.
- Each selected agent must create questions that they specifically need answered and work items that follow from their role.
- If multiple agents are selected, include a five-phase roundtable where agents learn from each other, revise their stance when another role adds useful evidence, and converge on the strongest current agreement.
- Challenge weak evidence, risky assumptions, premature architecture, and unsupported recommendations.
- Keep recommendations vendor-neutral unless the context explicitly names configured solution providers.
- Produce the smallest valuable validated direction, not a final implementation package.

The roundtable must include these five phases, using the phase field on every turn:
1. initial_position — each agent states the role-specific opinion they arrived with.
2. evidence_challenge — agents challenge weak evidence, missing facts, and unsupported leaps.
3. risk_and_work_items — agents convert concerns into concrete questions and work items.
4. alignment_and_tradeoffs — agents respond to each other and name tradeoffs.
5. current_agreement — agents converge on the best shared agreement in the project's current state.

Return JSON with this exact format:
{
  "opinions": [
    {
      "agent_id": "selected agent id",
      "role": "role title",
      "title": "short opinion title",
      "position": "clear 2-4 sentence expert position",
      "confidence": 0,
      "strengths": ["what is strong or well supported"],
      "concerns": ["specific concern grounded in the handoff"],
      "assumptions": ["assumption this agent believes must be tested"],
      "risks": ["risk if this direction is wrong or premature"],
      "recommendations": ["specific refinement recommendation"],
      "questions": ["question this expert would ask next"],
            "work_items": [
                {
                    "title": "specific work item",
                    "owner_role": "role that should own it",
                    "priority": "high | medium | low",
                    "rationale": "why this work matters",
                    "next_step": "immediate next action"
                }
            ],
      "artifact": {
        "title": "role-specific artifact title",
        "content": "short artifact text. For the Solution Architect, include an initial architecture candidate. For the TPM, include a delivery-readiness path. For the Data Scientist, include an evaluation or experiment design. For other agents, include their most useful working artifact.",
        "bullets": ["artifact bullet"]
      }
    }
  ],
  "roundtable": [
    {
            "phase": "initial_position | evidence_challenge | risk_and_work_items | alignment_and_tradeoffs | current_agreement",
      "speaker_id": "agent id",
      "speaker": "agent title",
      "message": "visible professional response to another expert or to the recommendation",
      "responds_to": "agent title or topic",
      "decision_impact": "how this changes the recommendation"
    }
  ],
  "synthesis": {
    "consensus": ["where the selected experts agree"],
    "disagreements": ["where experts differ and why it matters"],
    "recommended_direction": "the strongest recommendation after expert review",
    "solution_options": [
      {
        "title": "option name",
        "value": "why it matters",
        "effort": "relative effort",
        "risk": "key risk",
        "evidence_fit": "how well evidence supports it",
        "tradeoffs": ["tradeoff"]
      }
    ],
    "validation_plan": ["concrete validation action before Execute"],
    "execute_readiness": "what must be true before Execute creates final outputs",
    "decision_gate": "ready_for_execute | needs_validation | pivot | return_to_orchestrate",
    "confidence": 0
  }
}"""


def render_agent_block(agents: list[RefineAgentDefinition]) -> str:
    return "\n\n".join(
        f"Agent ID: {agent.id}\nTitle: {agent.title}\nRole: {agent.role}\n"
        f"Mission: {agent.mission}\nGoal: {agent.goal}\nReview lens: {'; '.join(agent.review_lens)}\n"
        f"Expected outputs: {'; '.join(agent.expected_outputs)}\n"
        f"Signature questions: {'; '.join(agent.signature_questions)}\n"
        f"Work item focus: {'; '.join(agent.work_item_focus)}"
        for agent in agents
    )


def build_review_user_prompt(
    agents: list[RefineAgentDefinition],
    context: str,
    user_guidance: str,
) -> str:
    return (
        f"Selected expert agents:\n\n{render_agent_block(agents)}\n\n"
        f"Orchestrate handoff and accumulated project context:\n\n{context}"
        f"{user_guidance}\n\n"
        "Generate the Refine expert review. If only one agent is selected, provide one opinion and a short synthesis; "
        "the roundtable can be empty or contain that agent's response to the overall recommendation."
    )


def build_missing_opinions_prompt(
    missing_agents: list[RefineAgentDefinition],
    context: str,
    user_instructions: str,
) -> str:
    missing_block = "\n\n".join(
        f"Agent ID: {agent.id}\nTitle: {agent.title}\nGoal: {agent.goal}\n"
        f"Mission: {agent.mission}\nReview lens: {'; '.join(agent.review_lens)}\n"
        f"Signature questions: {'; '.join(agent.signature_questions)}\n"
        f"Work item focus: {'; '.join(agent.work_item_focus)}"
        for agent in missing_agents
    )
    return f"""The previous Refine review response omitted one or more selected expert agents.
Return only the missing agents listed below. Produce exactly one opinion per missing agent and optional five-phase roundtable turns.

Missing agents:
{missing_block}

User guidance:
{user_instructions or "None"}

Platform and Orchestrate context:
{context}

Return JSON with this exact shape:
{{
  "opinions": [],
  "roundtable": []
}}"""


def build_missing_phases_prompt(
    selected_agents: list[RefineAgentDefinition],
    missing_phases: list[str],
    context: str,
    user_instructions: str,
) -> str:
    agent_block = "\n".join(
        f"- {agent.id}: {agent.title} ({agent.goal})" for agent in selected_agents
    )
    phase_block = "\n".join(
        f"- {phase}: {ROUNDTABLE_PHASE_DESCRIPTIONS[phase]}" for phase in missing_phases
    )
    return f"""The previous Refine review response omitted required roundtable phases.
Return only roundtable turns for the missing phases below. Include concise role-specific turns from the selected agents, and make the final missing phase converge on the current agreement if it is included.

Selected agents:
{agent_block}

Missing phases:
{phase_block}

User guidance:
{user_instructions or "None"}

Platform and Orchestrate context:
{context}

Return JSON with this exact shape:
{{
  "roundtable": []
}}"""


def build_agent_chat_system(agent: RefineAgentDefinition) -> str:
    return f"""You are the {agent.title} in the CORE Refine phase.
Answer only through this role's professional lens.
Goal: {agent.goal}
Mission: {agent.mission}
Review lens: {"; ".join(agent.review_lens)}
Work item focus: {"; ".join(agent.work_item_focus)}

Use the platform context, Orchestrate handoff, prior expert review, and chat history. Do not reveal hidden chain-of-thought. If the user's question is outside your role, answer only the part your role can responsibly address and say what another role should cover.

Return JSON with this exact shape:
{{
  "messages": [
    {{
      "speaker_id": "{agent.id}",
      "speaker": "{agent.title}",
      "content": "role-specific response",
      "contribution_type": "answer | question | work_item | risk | recommendation"
    }}
    ],
    "review_update": {{
        "should_create_version": true,
        "reason": "what changed because of this chat turn",
        "updated_opinions": [],
        "updated_synthesis": null
    }}
}}"""


def build_group_chat_system() -> str:
    agent_block = "\n\n".join(
        f"Agent ID: {agent.id}\nTitle: {agent.title}\nGoal: {agent.goal}\n"
        f"Mission: {agent.mission}\nLens: {'; '.join(agent.review_lens)}\n"
        f"Work item focus: {'; '.join(agent.work_item_focus)}"
        for agent in AGENT_DEFINITIONS
    )
    return f"""You are facilitating the CORE Refine group advisory chat.
The user can speak into the group thread. Agents should respond only when their role adds useful value, and they should build on what other agents have learned.

Agents:
{agent_block}

Rules:
- Do not reveal hidden chain-of-thought.
- Keep each response concise and role-specific.
- Let agents explicitly reference useful points from other roles when it changes their view.
- Convert useful debate into questions, risks, recommendations, or work items.
- Do not create final decks, docs, emails, or stakeholder packages; those belong to Execute.
- This is not an autonomous loop. Produce one bounded response pass for the user's latest message, then stop.
- At most one new advisory-state version may be created from this chat turn.

Return JSON with this exact shape:
{{
  "messages": [
    {{
      "speaker_id": "agent id",
      "speaker": "agent title",
      "content": "agent response in the group thread",
      "contribution_type": "answer | question | work_item | risk | recommendation | agreement"
    }}
    ],
    "review_update": {{
        "should_create_version": true,
        "reason": "what changed because of this chat turn",
        "updated_opinions": [],
        "updated_synthesis": null
    }}
}}"""


def build_chat_user_prompt(
    context: str,
    latest_review: str,
    history: str,
    user_message: str,
    is_group: bool,
) -> str:
    thread_label = "Group thread history" if is_group else "Thread history"
    closing = "User message to the board" if is_group else "User message"
    return (
        f"Platform and Orchestrate context:\n{context}\n\n"
        f"Latest Refine board context:\n{latest_review}\n\n"
        f"{thread_label}:\n{history}\n\n"
        f"{closing}:\n{user_message}"
    )
