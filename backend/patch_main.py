import re

def patch():
    with open('/home/essam/Projects/ESSR_PA/backend/main.py', 'r') as f:
        content = f.read()
    
    # 1. Add page_range to create_flipbook signature
    sig_old = 'bg_texture: str = Form("Dark Mode"),\n    sound_enabled: bool = Form(False),\n):'
    sig_new = 'bg_texture: str = Form("Dark Mode"),\n    sound_enabled: bool = Form(False),\n    page_range: str = Form(""),\n):'
    content = content.replace(sig_old, sig_new)
    
    # 2. Add parser logic and pass target_indices to generate_flipbook_task
    parser_logic = """
    target_indices = None
    if page_range and page_range.lower() != "all":
        try:
            target_indices = []
            for part in page_range.split(","):
                part = part.strip()
                if "-" in part:
                    start, end = part.split("-")
                    target_indices.extend(range(int(start) - 1, int(end)))
                else:
                    target_indices.append(int(part) - 1)
        except Exception:
            target_indices = None

    background_tasks.add_task("""
    
    content = content.replace('    background_tasks.add_task(', parser_logic)
    
    # 3. Update the call to generate_flipbook_task to use the parsed target_indices
    call_old = 'eco_mode=eco_mode,\n        target_indices=None,\n        direction=direction,'
    call_new = 'eco_mode=eco_mode,\n        target_indices=target_indices,\n        direction=direction,'
    content = content.replace(call_old, call_new)
    
    with open('/home/essam/Projects/ESSR_PA/backend/main.py', 'w') as f:
        f.write(content)

patch()
