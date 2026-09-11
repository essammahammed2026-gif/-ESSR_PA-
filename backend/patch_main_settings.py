def patch():
    with open('/home/essam/Projects/ESSR_PA/backend/main.py', 'r') as f:
        content = f.read()
    
    if "from settings_api import router as settings_router" not in content:
        content = content.replace("from fastapi import FastAPI", "from fastapi import FastAPI\nfrom settings_api import router as settings_router")
        content = content.replace("app = FastAPI()", "app = FastAPI()\napp.include_router(settings_router)")
        
        with open('/home/essam/Projects/ESSR_PA/backend/main.py', 'w') as f:
            f.write(content)

patch()
