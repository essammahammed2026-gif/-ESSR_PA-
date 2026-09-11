import sys

def patch():
    with open('/home/essam/Projects/ESSR_PA/backend/engines/contour_engine.py', 'r') as f:
        content = f.read()

    # Change except ImportError: to except Exception as e:
    target = """        except ImportError:
            print("rembg not installed, falling back to Alpha mode")"""
    new = """        except Exception as e:
            print(f"AI Subject Isolation failed: {e}, falling back to Alpha mode")"""
    
    content = content.replace(target, new)
    
    with open('/home/essam/Projects/ESSR_PA/backend/engines/contour_engine.py', 'w') as f:
        f.write(content)

patch()
