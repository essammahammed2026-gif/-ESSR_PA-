def patch():
    with open('/home/essam/Projects/ESSR_PA/frontend/src/app/flipbook/page.tsx', 'r') as f:
        content = f.read()
    
    # 1. Add state
    state_anchor = 'const [addFlyleaves, setAddFlyleaves] = useState(false);'
    state_new = 'const [addFlyleaves, setAddFlyleaves] = useState(false);\n  const [pageRange, setPageRange] = useState("");'
    content = content.replace(state_anchor, state_new)
    
    # 2. Add to handleGenerate
    form_anchor = 'formData.append("export_mode", "Standalone Base64 (Single HTML File)");'
    form_new = 'formData.append("export_mode", "Standalone Base64 (Single HTML File)");\n    formData.append("page_range", pageRange);'
    content = content.replace(form_anchor, form_new, 1) # Only first occurrence (create)
    
    # 3. Add to UI
    ui_anchor = '<div>\n              <label className="block text-sm font-medium mb-1 flex justify-between">'
    ui_new = """<div>
              <label className="block text-sm font-medium mb-1">Page Range</label>
              <input 
                type="text" 
                placeholder="e.g. 1-10 or leave blank for All" 
                value={pageRange} 
                onChange={(e) => setPageRange(e.target.value)} 
                disabled={!!taskId}
                className="w-full text-sm border p-2 rounded-md dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 mb-4" 
              />
            </div>
            
            """ + ui_anchor
    
    content = content.replace(ui_anchor, ui_new)
    
    with open('/home/essam/Projects/ESSR_PA/frontend/src/app/flipbook/page.tsx', 'w') as f:
        f.write(content)

patch()
