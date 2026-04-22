"""partition_key_path / partition_key_value selection."""

import pytest

from app.config import settings
from app.providers.storage.partitioning import (
    is_project_partitioned,
    partition_key_path,
    partition_key_value,
)


def test_id_strategy_uses_id_path_for_all() -> None:
    settings.cosmos_partition_strategy = "id"
    try:
        assert partition_key_path("discoveries") == "/id"
        assert partition_key_path("engagements") == "/id"
        assert partition_key_path("audit") == "/id"
        assert is_project_partitioned("discoveries") is False
    finally:
        settings.cosmos_partition_strategy = "id"


def test_project_id_strategy_uses_project_id_for_partitioned_only() -> None:
    settings.cosmos_partition_strategy = "project_id"
    try:
        assert partition_key_path("discoveries") == "/project_id"
        assert partition_key_path("evidence") == "/project_id"
        # opt-outs
        assert partition_key_path("engagements") == "/id"
        assert partition_key_path("audit") == "/id"
        assert is_project_partitioned("discoveries") is True
        assert is_project_partitioned("engagements") is False
    finally:
        settings.cosmos_partition_strategy = "id"


def test_partition_key_value_uses_project_id_when_partitioned() -> None:
    settings.cosmos_partition_strategy = "project_id"
    try:
        item = {"id": "abc", "project_id": "proj-1"}
        assert partition_key_value("discoveries", item) == "proj-1"
        # not partitioned -> falls back to id
        assert partition_key_value("engagements", item) == "abc"
    finally:
        settings.cosmos_partition_strategy = "id"


def test_partition_key_value_raises_when_project_id_missing() -> None:
    settings.cosmos_partition_strategy = "project_id"
    try:
        with pytest.raises(ValueError, match="project_id"):
            partition_key_value("discoveries", {"id": "abc"})
    finally:
        settings.cosmos_partition_strategy = "id"
