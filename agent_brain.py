"""Backend-only planning adapters for NOVA Agent Runtime."""
from __future__ import annotations

import os
from abc import ABC, abstractmethod


class AgentBrainAdapter(ABC):
    name = "base"

    @abstractmethod
    def chooseIntent(self, userMessage: str) -> str: ...

    @abstractmethod
    def createSteps(self, intent: str, userMessage: str) -> list[str]: ...

    @abstractmethod
    def chooseTools(self, intent: str) -> list[str]: ...

    def planTask(self, userMessage: str) -> dict:
        intent = self.chooseIntent(userMessage)
        return {"intent": intent, "brain": self.name, "steps": self.createSteps(intent, userMessage), "tools": self.chooseTools(intent)}

    def summarizeResult(self, result: dict) -> str:
        return result.get("summary", "Task output is ready.")


class LocalMockBrainAdapter(AgentBrainAdapter):
    name = "localMock"
    def chooseIntent(self, text: str) -> str:
        value = text.lower()
        if any(x in value for x in ("3d", "室內", "咖啡廳", "interior")): return "interior_render"
        if any(x in value for x in ("訂票", "威秀", "booking", "cinema")): return "browser_booking"
        if any(x in value for x in ("網站", "服飾店", "website", "web site")): return "website_builder"
        return "default"

    def createSteps(self, intent: str, _message: str) -> list[str]:
        return {
            "interior_render": ["Analyze interior request", "Generate visual prompt", "Select render provider", "Render cafe concept", "Enhance light and material", "Prepare multi-view preview", "Preview ready"],
            "browser_booking": ["Open browser workspace", "Identify official site", "Search sessions", "Select session", "Choose tickets", "Select seats", "Stop before payment"],
            "website_builder": ["Define brand direction", "Build header", "Compose hero", "Add categories", "Generate products", "Build lookbook and footer", "Write project files"],
            "default": ["Understand request", "Create plan", "Select tools", "Prepare output"],
        }[intent]

    def chooseTools(self, intent: str) -> list[str]:
        return {"interior_render": ["InteriorRenderTool"], "browser_booking": ["BrowserAutomationTool"], "website_builder": ["WebsiteBuilderTool", "FileWorkspaceTool"], "default": ["FileWorkspaceTool"]}[intent]


class _ProxyAdapter(LocalMockBrainAdapter):
    env_key = ""
    def planTask(self, userMessage: str) -> dict:
        if not os.getenv(self.env_key):
            intent = self.chooseIntent(userMessage)
            return {"intent": intent, "brain": self.name, "status": "backend_proxy_required", "steps": self.createSteps(intent, userMessage), "tools": self.chooseTools(intent)}
        raise NotImplementedError("Configure a server-side model proxy before enabling this adapter")


class CodexBrainAdapter(_ProxyAdapter):
    name, env_key = "codex", "OPENAI_API_KEY"


class GeminiBrainAdapter(_ProxyAdapter):
    name, env_key = "gemini", "GEMINI_API_KEY"


def get_brain(name: str) -> AgentBrainAdapter:
    return {"codex": CodexBrainAdapter, "gemini": GeminiBrainAdapter}.get(name, LocalMockBrainAdapter)()
