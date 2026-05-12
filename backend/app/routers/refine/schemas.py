from pydantic import BaseModel, Field


class RefineReviewRequest(BaseModel):
    discovery_id: str
    agent_ids: list[str] = Field(default_factory=list)
    user_instructions: str = ""
    trigger_source: str = "manual"


class RefineChatRequest(BaseModel):
    discovery_id: str
    thread_type: str = "group"
    message: str
    agent_id: str = ""
