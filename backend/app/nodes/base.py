"""All node implementations use the same execution and serialization contract."""

from abc import ABC, abstractmethod


class PipelineNode(ABC):
    def __init__(self, definition, parameters):
        self.definition = definition
        self.parameters = parameters

    def validate(self):
        if not isinstance(self.parameters, dict):
            raise ValueError("Node parameters must be an object.")

    @abstractmethod
    def execute(self, upstream, context): ...

    def serialize_output(self, output):
        return {"output_kind": type(output).__name__}
