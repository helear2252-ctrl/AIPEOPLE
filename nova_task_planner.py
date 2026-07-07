from nova_agent_types import AgentPlan, Intent


class NovaTaskPlanner:
    def detect_intent(self, message: str) -> str:
        value = message.lower()
        rules = (
            (Intent.INTERIOR_DESIGN, ("interior", "interior design", "cafe", "coffee", "render", "3d", "室內", "室内", "咖啡", "設計", "设计", "空間", "空间")),
            (Intent.BROWSER_BOOKING, ("booking", "cinema", "vieshow", "ticket", "seat")),
            (Intent.WEBSITE_BUILDER, ("website", "web site", "landing page", "storefront")),
            (Intent.CODE_BUILDER, ("code", "debug", "api", "bug", "test")),
            (Intent.RESEARCH, ("research", "compare", "source")),
            (Intent.FILE_WORKSPACE, ("workspace", "folder", "file")),
        )
        for intent, terms in rules:
            if any(term in value for term in terms):
                return intent.value
        return Intent.GENERAL_ASSISTANT.value

    def create_plan(self, message: str, intent: str, tools: list[str]) -> AgentPlan:
        steps = {
            "interior_design": [
                "Understand interior design brief",
                "Check professional design asset package",
                "Validate available render assets",
                "Prepare presentation payload",
                "Display professional proposal in Workbench",
            ],
            "browser_booking": ["Search movie", "Select theater", "Select showtime", "Select seat", "Stop before payment"],
            "website_builder": ["Define site direction", "Build page structure", "Generate project files", "Prepare preview", "Wait for save or export"],
            "code_builder": ["Understand requirements", "Inspect workspace", "Implement code", "Run tests"],
            "research": ["Define research scope", "Collect sources", "Compare evidence", "Synthesize findings"],
            "file_workspace": ["Inspect workspace", "Plan safe operations", "Apply changes", "Verify artifacts"],
            "general_assistant": ["Understand request", "Create approach", "Produce response", "Review result"],
        }[intent]
        return AgentPlan(intent, steps, tools, message)
