class ComputerUseAdapter:
    name="ComputerUseAdapter"
    def status(self): return {"adapter":self.name,"status":"placeholder","safeBoundary":"controlled_actions_only"}
    def run(self, action, emit): emit("computer_action_started",{"tool":self.name,"visibleAction":action}); return {**self.status(),"status":"waiting_for_user"},[]

