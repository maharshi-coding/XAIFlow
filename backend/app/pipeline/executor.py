"""Stable import for callers that use the DAG worker as an executor."""

from .engine import execute_pipeline, PipelineExecutionError

__all__ = ["execute_pipeline", "PipelineExecutionError"]
