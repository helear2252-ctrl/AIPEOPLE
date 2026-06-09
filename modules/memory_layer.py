import os
import json

class MemoryLayer:
    """
    Unified Memory Layer V1 for NOVA AI.
    Implements Short-Term Memory (dialogue context, active task, current analysis theme,
    recent user query, recent response) and Long-Term Memory reservation interfaces.
    """
    def __init__(self, store_path: str = None):
        if store_path is None:
            # Get path relative to this file: config/memory_store.json
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.store_path = os.path.join(base_dir, "config", "memory_store.json")
        else:
            self.store_path = store_path
            
        self.sessions = {}
        self.demo_mode = True  # Default V1 Demo Mode is active
        self.db_type = "JSON Local File"
        
        # Ensure memory store exists
        self._init_store()
        
    def _init_store(self):
        """
        Initializes the config file and directory if they do not exist.
        Must not raise errors if file operations fail.
        """
        try:
            os.makedirs(os.path.dirname(self.store_path), exist_ok=True)
            if not os.path.exists(self.store_path):
                default_data = {
                    "user_preferences": {
                        "learning_language": "Python",
                        "project_name": "NOVA AI",
                        "digital_secretary_style": "Efficient, Professional, Courteous",
                        "avatar_preference": "Simulation 2D Photorealistic",
                        "preferred_analysis": "Stock Analysis & Market Intelligence",
                        "spec_preference": "Complete Project Specifications"
                    },
                    "project_preferences": {
                        "active_project": "NOVA AI"
                    },
                    "learning_progress": {
                        "python_status": "Intermediate Level"
                    },
                    "common_settings": {
                        "offline_simulation": "Enabled"
                    },
                    "common_analysis_modes": {
                        "stock_mode": "Briefing outline"
                    },
                    "digital_human_settings": {
                        "gender": "Female",
                        "age": 28
                    },
                    "common_ai_providers": {
                        "default": "Gemini 3.5 Flash"
                    }
                }
                with open(self.store_path, "w", encoding="utf-8") as f:
                    json.dump(default_data, f, indent=4, ensure_ascii=False)
        except Exception:
            # Never raise errors during file access or initialization to satisfy requirement:
            # "不得因記憶檔案缺失造成錯誤"
            pass

    def get_ltm_data(self) -> dict:
        """
        Reads the long term memory store. Returns empty dict on error.
        """
        try:
            if os.path.exists(self.store_path):
                with open(self.store_path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    def save_ltm_data(self, data: dict) -> bool:
        """
        Saves the long term memory store. Returns False on error.
        """
        try:
            os.makedirs(os.path.dirname(self.store_path), exist_ok=True)
            with open(self.store_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
            return True
        except Exception:
            return False

    def get_history(self, session_id: str) -> list:
        """
        Get chat history for a session.
        """
        session = self._get_session(session_id)
        return session.get("history", [])

    def add_message(self, session_id: str, role: str, content: str):
        """
        Adds a message and updates short-term session states.
        """
        session = self._get_session(session_id)
        session["history"].append({
            "role": role,
            "content": content
        })
        
        # Update short term memory fields
        if role == "user":
            session["recent_user_question"] = content
            # Try to infer task or topic from user input
            lower_content = content.lower()
            if "python" in lower_content:
                session["current_analysis_theme"] = "Python Development"
                session["current_task"] = "Learning Python / developing code"
            elif "stock" in lower_content or "market" in lower_content or "price" in lower_content:
                session["current_analysis_theme"] = "Financial Markets"
                session["current_task"] = "Stock analysis"
            elif "nova" in lower_content:
                session["current_analysis_theme"] = "NOVA AI Configuration"
                session["current_task"] = "System administration"
        elif role == "secretary":
            session["recent_nova_response"] = content

    def clear_session(self, session_id: str):
        """
        Reset Short-Term memory.
        """
        if session_id in self.sessions:
            self.sessions[session_id] = {
                "history": [],
                "current_task": "None",
                "current_analysis_theme": "None",
                "recent_user_question": "None",
                "recent_nova_response": "None"
            }

    def _get_session(self, session_id: str) -> dict:
        """
        Retrieve or initialize session dictionary.
        """
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "history": [],
                "current_task": "None",
                "current_analysis_theme": "None",
                "recent_user_question": "None",
                "recent_nova_response": "None"
            }
        return self.sessions[session_id]

    def get_stm_status(self, session_id: str) -> dict:
        """
        Returns short-term memory metrics and status.
        """
        session = self._get_session(session_id)
        return {
            "history_count": len(session["history"]),
            "current_task": session["current_task"],
            "current_analysis_theme": session["current_analysis_theme"],
            "recent_user_question": session["recent_user_question"],
            "recent_nova_response": session["recent_nova_response"]
        }

    def query_memory(self, session_id: str, query: str) -> dict:
        """
        Queries Short-Term Memory and Long-Term Memory to check if there is enough information
        to answer the query.
        Returns:
            dict containing:
                - "found": bool
                - "answer": str (the retrieved information)
                - "source": str ("Short-Term Memory" or "Long-Term Memory")
        """
        lower_query = query.lower()
        
        # Check Long-Term Memory first for preferences
        ltm = self.get_ltm_data()
        user_prefs = ltm.get("user_preferences", {})
        
        # Check specific hardcoded examples and keywords
        if "python" in lower_query and ("learn" in lower_query or "study" in lower_query):
            if "learning_language" in user_prefs:
                return {
                    "found": True,
                    "answer": f"According to my long-term memory, you are currently learning {user_prefs['learning_language']}.",
                    "source": "Long-Term Memory"
                }
        if "project" in lower_query or "developing" in lower_query or "spec" in lower_query:
            if "project_name" in user_prefs:
                return {
                    "found": True,
                    "answer": f"I recall that you are developing the {user_prefs['project_name']} project and prefer {user_prefs.get('spec_preference', 'complete specifications')}.",
                    "source": "Long-Term Memory"
                }
        if "style" in lower_query or "avatar" in lower_query or "persona" in lower_query or "human" in lower_query:
            ans = []
            if "digital_secretary_style" in user_prefs:
                ans.append(f"prefer a '{user_prefs['digital_secretary_style']}' digital secretary style")
            if "avatar_preference" in user_prefs:
                ans.append(f"prefer a '{user_prefs['avatar_preference']}' digital human avatar")
            if ans:
                return {
                    "found": True,
                    "answer": f"My memory logs indicate that you " + " and ".join(ans) + ".",
                    "source": "Long-Term Memory"
                }
        if "stock" in lower_query or "finance" in lower_query or "market" in lower_query:
            if "preferred_analysis" in user_prefs:
                return {
                    "found": True,
                    "answer": f"I have logged that your preferred analysis focus is {user_prefs['preferred_analysis']}.",
                    "source": "Long-Term Memory"
                }
                
        # General check for preferences
        for key, val in user_prefs.items():
            clean_key = key.replace("_", " ")
            if clean_key in lower_query:
                return {
                    "found": True,
                    "answer": f"My records show that your preference for {clean_key} is set to: {val}.",
                    "source": "Long-Term Memory"
                }
                
        # Check Short-Term Memory session states
        session = self._get_session(session_id)
        if "current task" in lower_query or "what am i doing" in lower_query or "my task" in lower_query:
            if session["current_task"] != "None":
                return {
                    "found": True,
                    "answer": f"Your current active task in this session is: {session['current_task']}.",
                    "source": "Short-Term Memory"
                }
        if "analysis theme" in lower_query or "what are we analyzing" in lower_query or "theme" in lower_query:
            if session["current_analysis_theme"] != "None":
                return {
                    "found": True,
                    "answer": f"Our current analysis focus for this session is: {session['current_analysis_theme']}.",
                    "source": "Short-Term Memory"
                }

        return {
            "found": False,
            "answer": "",
            "source": ""
        }

    def get_db_interface(self) -> dict:
        """
        Returns a dictionary representing interfaces for future DB upgrades.
        """
        return {
            "SQLite": "sqlite3.connect('config/memory.db')",
            "PostgreSQL": "psycopg2.connect(dsn)",
            "ChromaDB": "chromadb.Client()",
            "FAISS": "faiss.IndexFlatL2(dimension)",
            "Pinecone": "pinecone.Index('memory')",
            "Weaviate": "weaviate.Client(url)"
        }
