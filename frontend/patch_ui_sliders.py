def patch():
    with open('/home/essam/Projects/ESSR_PA/frontend/src/app/contour/page.tsx', 'r') as f:
        content = f.read()

    # Offset Slider
    old_offset = """              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium">Offset (Bleed/Choke)</label>
                <span className="text-xs text-blue-500 font-mono">{offsetVal} mm</span>
              </div>
              <input 
                type="range" min="-10" max="10" step="0.5" 
                value={offsetVal} onChange={(e) => setOffsetVal(e.target.value)} 
                className="w-full accent-pink-500"
              />"""
    new_offset = """              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Offset (Bleed/Choke) mm</label>
                <input 
                  type="number" min="-10" max="10" step="0.5" 
                  value={offsetVal} onChange={(e) => setOffsetVal(e.target.value)} 
                  className="w-20 text-sm border p-1 rounded-md text-right dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <input 
                type="range" min="-10" max="10" step="0.5" 
                value={offsetVal} onChange={(e) => setOffsetVal(e.target.value)} 
                className="w-full accent-pink-500"
              />"""
    content = content.replace(old_offset, new_offset)

    # Edge Smoothing Slider
    old_smooth = """              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium">Edge Smoothing</label>
                <span className="text-xs text-blue-500 font-mono">{smoothing}</span>
              </div>
              <input 
                type="range" min="0" max="15" step="1" 
                value={smoothing} onChange={(e) => setSmoothing(e.target.value)} 
                className="w-full accent-pink-500"
              />"""
    new_smooth = """              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Edge Smoothing</label>
                <input 
                  type="number" min="0" max="15" step="1" 
                  value={smoothing} onChange={(e) => setSmoothing(e.target.value)} 
                  className="w-20 text-sm border p-1 rounded-md text-right dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <input 
                type="range" min="0" max="15" step="1" 
                value={smoothing} onChange={(e) => setSmoothing(e.target.value)} 
                className="w-full accent-pink-500"
              />"""
    content = content.replace(old_smooth, new_smooth)

    # Tolerance Slider
    old_thresh = """                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium">Tolerance</label>
                  <span className="text-xs text-blue-500 font-mono">{threshold}</span>
                </div>
                <input 
                  type="range" min="0" max="100" step="1" 
                  value={threshold} onChange={(e) => setThreshold(e.target.value)} 
                  className="w-full accent-pink-500"
                />"""
    new_thresh = """                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Tolerance</label>
                  <input 
                    type="number" min="0" max="100" step="1" 
                    value={threshold} onChange={(e) => setThreshold(e.target.value)} 
                    className="w-20 text-sm border p-1 rounded-md text-right dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <input 
                  type="range" min="0" max="100" step="1" 
                  value={threshold} onChange={(e) => setThreshold(e.target.value)} 
                  className="w-full accent-pink-500"
                />"""
    content = content.replace(old_thresh, new_thresh)

    with open('/home/essam/Projects/ESSR_PA/frontend/src/app/contour/page.tsx', 'w') as f:
        f.write(content)

patch()
