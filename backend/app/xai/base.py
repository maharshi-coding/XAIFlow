"""Adapters normalize library-specific attribution objects for the application."""

from abc import ABC, abstractmethod

ATTRIBUTION_NOTICE = "Feature attribution explains model behavior under the assumptions of the selected explanation method. It does not establish causation."


class ExplainerAdapter(ABC):
    @abstractmethod
    def supports(self, model_type: str) -> bool: ...

    @abstractmethod
    def explain_local(self, model, background, sample, feature_names, **kwargs) -> dict: ...

    def explain_global(self, model, background, samples, feature_names, **kwargs):
        raise ValueError("This explanation method does not provide global attribution.")
