"""Synthesis write-back targets.

Adapters that push generated artifacts *out* of CORE Framework into
external systems. Today: EngagementRepo (file-based markdown into a connected
engagement-repo repo clone). Future: Microsoft Graph (push readout to SharePoint).

Write-back is opt-in per project via ``project.metadata.engagement-repo.write_enabled``
(default false) and never destroys hand-authored content — it writes into a
dedicated ``synthesis/`` subfolder under the resolved repo path.
"""

from app.synthesis.writers.base import WriteBackResult, WriteBackTarget
from app.synthesis.writers.vertex import VertexWriteBack

__all__ = ["VertexWriteBack", "WriteBackResult", "WriteBackTarget"]
