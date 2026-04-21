"""Optional OpenTelemetry / Application Insights wiring.

No-ops gracefully when neither `APPLICATIONINSIGHTS_CONNECTION_STRING` nor
`OTEL_EXPORTER_OTLP_ENDPOINT` is set, so local development pulls zero
extra weight.
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def _has_app_insights() -> bool:
    return bool(os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING"))


def _has_otlp() -> bool:
    return bool(os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))


def configure_telemetry(app: Any) -> None:
    """Attach tracing / metrics exporters to the FastAPI app when configured."""
    if _has_app_insights():
        try:
            from azure.monitor.opentelemetry import configure_azure_monitor

            configure_azure_monitor()
            logger.info("Telemetry: Azure Monitor exporter enabled")
        except Exception:  # noqa: BLE001
            logger.warning("Telemetry: Azure Monitor configure failed", exc_info=True)
    elif _has_otlp():
        try:
            from opentelemetry import trace
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
                OTLPSpanExporter,
            )
            from opentelemetry.sdk.resources import Resource
            from opentelemetry.sdk.trace import TracerProvider
            from opentelemetry.sdk.trace.export import BatchSpanProcessor

            provider = TracerProvider(
                resource=Resource.create({"service.name": "core-discovery-api"})
            )
            provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
            trace.set_tracer_provider(provider)
            logger.info("Telemetry: OTLP exporter enabled")
        except Exception:  # noqa: BLE001
            logger.warning("Telemetry: OTLP configure failed", exc_info=True)
    else:
        return
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app)
    except Exception:  # noqa: BLE001
        logger.warning("Telemetry: FastAPI instrumentation failed", exc_info=True)
    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

        HTTPXClientInstrumentor().instrument()
    except Exception:  # noqa: BLE001
        logger.debug("Telemetry: HTTPX instrumentation skipped", exc_info=True)


def get_tracer():
    """Return a tracer if telemetry is configured, otherwise a no-op shim."""
    try:
        from opentelemetry import trace

        return trace.get_tracer("core")
    except Exception:  # noqa: BLE001

        class _Noop:
            def start_as_current_span(self, _name: str, **_kwargs):
                from contextlib import contextmanager

                @contextmanager
                def _cm():
                    class _Span:
                        def set_attribute(self, *_a, **_k) -> None:
                            return None

                    yield _Span()

                return _cm()

        return _Noop()
