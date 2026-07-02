from dataclasses import dataclass

@dataclass(frozen=True)
class SafetyDecision:
    allowed: bool; status: str; reason: str=""; action: str=""

class NovaSafetyGuard:
    PROTECTED_ACTIONS={
        "payment":("付款","payment","pay now","結帳"), "login":("登入","login","sign in"),
        "captcha":("驗證碼","captcha","verification code"), "credit_card":("信用卡","credit card","card number"),
        "delete_file":("刪除檔案","delete file","remove file"), "force_push":("force push","push --force","git push -f"),
        "send_email":("發送 email","send email","send mail"), "submit_form":("提交表單","submit form","external form")}
    def inspect(self, text:str="", action:str="")->SafetyDecision:
        value=f"{text} {action}".lower()
        for name, phrases in self.PROTECTED_ACTIONS.items():
            if any(p.lower() in value for p in phrases): return SafetyDecision(False,"waiting_for_user",f"User confirmation required before {name}.",name)
        return SafetyDecision(True,"allowed")
    def before_tool(self, tool_name:str)->SafetyDecision: return SafetyDecision(True,"allowed",action=tool_name)
    def after_observation(self, result:dict)->SafetyDecision:
        if result.get("currentStep")=="review_before_payment" or result.get("safetyMode")=="stop_before_payment":
            return SafetyDecision(False,"waiting_for_user","Payment, login, verification, and card entry require user confirmation.","payment")
        return self.inspect(action=str(result.get("nextAction","")))
