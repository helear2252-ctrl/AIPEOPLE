from pathlib import Path

class NovaWorkspace:
    def __init__(self, root: Path|None=None):
        self.root=(root or Path(__file__).resolve().parent).resolve(); self.generated_projects=self.root/"generated_projects"
        self.generated_projects.mkdir(exist_ok=True)
    def resolve(self, relative_path: str)->Path:
        target=(self.root/relative_path).resolve()
        if target != self.root and self.root not in target.parents: raise ValueError("Workspace path escapes NOVA root")
        return target
    def describe_files(self, files:list[str])->list[dict]: return [{"path":p,"exists":self.resolve(p).is_file()} for p in files]
