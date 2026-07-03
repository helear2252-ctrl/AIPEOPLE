from dataclasses import dataclass

@dataclass(frozen=True)
class SafetyDecision:
    allowed: bool; status: str; reason: str=""; action: str=""
    @property
    def requiresUserConfirmation(self): return not self.allowed
    def to_dict(self): return {"allowed":self.allowed,"reason":self.reason,"requiresUserConfirmation":not self.allowed,"safeAlternative":"Stop before the protected action and wait for the user.","action":self.action}

class NovaSafetyGuard:
    PROTECTED_ACTIONS={"payment":("付款","payment","pay now"),"login":("登入","login","sign in"),"credit_card":("信用卡","credit card","card number"),"order":("送出訂單","submit order"),"delete_file":("刪除檔案","delete file","remove file"),"destructive_git":("git reset --hard","git clean","push --force","git push -f"),"commit_push":("git commit","git push"),"send_email":("寄 email","send email","send mail"),"submit_form":("送出表單","submit form","external form"),"protected_files":("assets/avatar","index.html","nova.html",".env"),"private_files":("私人檔案","private file"),"unknown_shell":("unknown shell","未知 shell"),"install_large_software":("安裝大型軟體","install large software"),"api_key":("api key","openai_api_key")}
    def inspect(self,text="",action=""):
        value=f"{text} {action}".lower()
        for name,phrases in self.PROTECTED_ACTIONS.items():
            if any(p.lower() in value for p in phrases): return SafetyDecision(False,"waiting_for_user",f"User confirmation required before {name}.",name)
        return SafetyDecision(True,"allowed")
    def before_tool(self,tool_name): return SafetyDecision(True,"allowed",action=tool_name)
    def after_observation(self,result):
        if result.get("currentStep")=="review_before_payment" or result.get("safetyMode")=="stop_before_payment": return SafetyDecision(False,"waiting_for_user","Payment, login, verification, and card entry require user confirmation.","payment")
        return self.inspect(action=str(result.get("nextAction","")))
