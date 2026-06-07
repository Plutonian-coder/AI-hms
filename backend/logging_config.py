"""
HMS Logging Configuration — 12-Factor Compliant (Factor XI).

All logs are emitted as structured event streams to stdout/stderr.
No file-based logging. Container orchestrators capture these streams.
"""
import logging
import sys


def setup_logging():
    """Configure root logger to emit structured logs to stdout."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
        stream=sys.stdout,
        force=True,
    )
    # Quiet noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
