import shutil, subprocess
from pathlib import Path

class CodexAdapter:
    name="CodexAdapter"; blocked=("push --force","reset --hard","git clean","git commit","git push")
    def detect_codex_cli(self): return shutil.which("codex")
    def status(self): return {"adapter":self.name,"status":"available" if self.detect_codex_cli() else "unavailable","reason":"" if self.detect_codex_cli() else "codex_cli_not_found"}
    def inspect_project(self, root): return {"files":[str(p.relative_to(root)) for p in Path(root).glob("*") if p.is_file()]}
    def read_selected_files(self, root, names): return {n:(Path(root)/n).read_text(encoding="utf-8") for n in names}
    def propose_patch(self, request): return {**self.status(),"request":request,"status":"placeholder" if not self.detect_codex_cli() else "available"}
    def run_command_safely(self, command, root):
        if any(x in command.lower() for x in self.blocked): return {"status":"waiting_for_user","reason":"protected_git_action"}
        return {"status":"completed","stdout":subprocess.run(command,cwd=root,shell=False,capture_output=True,text=True,timeout=60).stdout}
    def run_tests(self, command, root): return self.run_command_safely(command,root)
    def summarize_diff(self): return {"status":"placeholder","summary":"Diff summary requires an approved invocation."}

