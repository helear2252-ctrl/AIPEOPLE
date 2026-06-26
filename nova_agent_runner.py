import os
import time
from datetime import datetime
from playwright.sync_api import sync_playwright

WHITELIST_SOURCES = [
    "Yahoo Finance", "Reuters", "CNBC", "MarketWatch", "SEC", "FRED", "IR Page"
]

def check_api_keys() -> tuple[bool, str]:
    openai_key = os.environ.get("OPENAI_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    
    if openai_key and gemini_key:
        return True, f"Both OpenAI (using GPT-4o-mini/GPT-4o) and Gemini keys detected. Defaulting to Gemini."
    elif gemini_key:
        return True, "Gemini API key detected."
    elif openai_key:
        return True, "OpenAI API key detected."
    else:
        return False, "Neither GEMINI_API_KEY nor OPENAI_API_KEY was found in the environment."

def run_agent_loop(task: str, session_id: str, manager):
    """
    Runs the agent loop.
    In Phase 1, it checks API keys, starts Playwright, takes a screenshot of Yahoo Finance,
    and updates status to missing_api_key if no keys are found, or completed if keys are found.
    """
    # Verify API Keys
    has_keys, api_message = check_api_keys()
    manager.add_log("System", f"API Key check: {api_message}", "info")
    
    # Establish output directory
    output_dir = os.path.join(os.path.expanduser("~"), "Desktop", "NOVA_Output")
    os.makedirs(output_dir, exist_ok=True)
    
    # We will save the run screenshot in the project directory so FastAPI can access it
    screenshot_filename = f"screenshot_{session_id}.png"
    screenshot_path = os.path.abspath(os.path.join(os.path.dirname(__file__), screenshot_filename))
    
    playwright = None
    browser = None
    try:
        manager.add_log("Playwright", "Launching dedicated Chromium browser...", "info")
        playwright = sync_playwright().start()
        
        # We start the browser with headless=False so it runs as a dedicated browser window.
        # But if in a container/headless server we fall back or use headless=True.
        # We'll try headed first, fallback to headless if it fails.
        try:
            browser = playwright.chromium.launch(headless=False)
        except Exception as e:
            manager.add_log("Playwright", f"Headed browser launch failed ({e}). Retrying headless.", "warning")
            browser = playwright.chromium.launch(headless=True)
            
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        
        # Open default white-listed page (Yahoo Finance)
        target_url = "https://finance.yahoo.com"
        manager.add_log("Playwright", f"Navigating to whitelisted source: {target_url}", "info")
        page.goto(target_url, timeout=30000)
        
        # Wait a moment for page to stabilize
        time.sleep(3)
        
        # Take screenshot
        page.screenshot(path=screenshot_path)
        manager.update_state(screenshot_path=screenshot_path)
        manager.add_log("Playwright", "Screenshot captured.", "info")
        
        # Place virtual cursor at some element or in the middle of page
        cursor_pos = {"x": 50.0, "y": 35.0, "action": "none"}
        manager.update_state(cursor=cursor_pos)
        
        # Check cancellation
        if manager.cancel_requested:
            manager.update_state(status="error", error_message="Task cancelled by user.")
            return
            
        if not has_keys:
            # If no API key, log the error, show missing_api_key, and terminate
            manager.add_log("Agent", "No valid API keys found. Real LLM Agent Loop aborted.", "error")
            manager.update_state(status="missing_api_key", error_message="Missing GEMINI_API_KEY or OPENAI_API_KEY.")
            return
            
        # If API keys exist: (In Phase 1, we simulate a basic run to completion)
        manager.add_log("Agent", "Phase 1 Mode: API keys detected. Simulating a basic navigation step.", "info")
        
        # Let's search or click on something to show coordinate tracking
        # For Yahoo Finance, search input selector is usually "#ybar-sbq" or "input[type='text']"
        search_box = page.locator("input[type='text']").first
        if search_box.is_visible():
            box = search_box.bounding_box()
            if box:
                # Convert coordinate to percentage (viewport is 1280x800)
                x_pct = ((box["x"] + box["width"] / 2) / 1280) * 100
                y_pct = ((box["y"] + box["height"] / 2) / 800) * 100
                
                # Move cursor to search box and perform a simulated type
                manager.update_state(cursor={"x": x_pct, "y": y_pct, "action": "type"})
                manager.add_log("Playwright", f"Typing query into search input at ({x_pct:.1f}%, {y_pct:.1f}%)", "info")
                
                # Input query and submit
                search_box.fill("AAPL")
                time.sleep(1)
                
                # Take updated screenshot
                page.screenshot(path=screenshot_path)
                manager.update_state(screenshot_path=screenshot_path)
        
        # Let's compile a basic report
        now_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_filename = f"nova_task_{now_str}.md"
        report_path = os.path.join(output_dir, report_filename)
        
        # Write markdown report
        model_used = "Gemini 2.5 Flash" if "Gemini" in api_message else "GPT-4o"
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(f"# NOVA Agent Report: {task}\n\n")
            f.write(f"- **Task ID**: {session_id}\n")
            f.write(f"- **Execution Time**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"- **Model**: {model_used}\n")
            f.write(f"- **Data Sources**: Yahoo Finance\n\n")
            f.write(f"## Steps Taken\n")
            f.write(f"1. Initialized browser context.\n")
            f.write(f"2. Navigated to finance.yahoo.com.\n")
            f.write(f"3. Captured initial viewport state and updated virtual cursor.\n")
            f.write(f"4. Located the search element and simulated input for 'AAPL'.\n")
            f.write(f"5. Generated report successfully.\n\n")
            f.write(f"## Result Summary\n")
            f.write(f"This is a Phase 1 simulation report indicating successful setup of the control loop.\n")
            
        manager.add_log("Agent", f"Output report written to {report_path}", "info")
        manager.update_state(status="completed", output_file=report_path)
        
    except Exception as e:
        manager.add_log("System", f"Runner failed with error: {e}", "error")
        manager.update_state(status="error", error_message=str(e))
    finally:
        if browser:
            try:
                browser.close()
            except:
                pass
        if playwright:
            try:
                playwright.stop()
            except:
                pass
