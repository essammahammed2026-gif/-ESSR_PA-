def patch():
    with open('/home/essam/Projects/ESSR_PA/frontend/src/app/contour/page.tsx', 'r') as f:
        content = f.read()

    # Define the NumberControl component
    number_control = """const NumberControl = ({ label, value, min, max, step, onChange }: any) => {
  const handleDec = () => onChange(String(Math.max(Number(min), Number(value) - Number(step))));
  const handleInc = () => onChange(String(Math.min(Number(max), Number(value) + Number(step))));
  
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center space-x-1">
          <button onClick={handleDec} className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold">-</button>
          <input 
            type="number" min={min} max={max} step={step} 
            value={value} onChange={(e) => onChange(e.target.value)} 
            className="w-14 text-sm border p-0.5 rounded-md text-center dark:bg-gray-800 dark:border-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button onClick={handleInc} className="w-6 h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 font-bold">+</button>
        </div>
      </div>
      <input 
        type="range" min={min} max={max} step={step} 
        value={value} onChange={(e) => onChange(e.target.value)} 
        className="w-full accent-pink-500"
      />
    </div>
  );
};

export default function ContourStudio() {"""
    
    content = content.replace("export default function ContourStudio() {", number_control)

    # Replace Offset
    import re
    
    offset_regex = r'<div>\s*<div className="flex justify-between items-center mb-2">\s*<label className="text-sm font-medium">Offset \(Bleed/Choke\) mm</label>.*?accent-pink-500"\s*/>\s*</div>'
    content = re.sub(offset_regex, '<NumberControl label="Offset (mm)" value={offsetVal} min="-10" max="10" step="0.5" onChange={setOffsetVal} />', content, flags=re.DOTALL)
    
    smooth_regex = r'<div>\s*<div className="flex justify-between items-center mb-2">\s*<label className="text-sm font-medium">Edge Smoothing</label>.*?<p className="text-xs text-gray-500 mt-1">0 = Sharp, 15 = Highly Rounded</p>\s*</div>'
    content = re.sub(smooth_regex, '<NumberControl label="Edge Smoothing (0-15)" value={smoothing} min="0" max="15" step="1" onChange={setSmoothing} />', content, flags=re.DOTALL)
    
    thresh_regex = r'<div>\s*<div className="flex justify-between items-center mb-2">\s*<label className="text-sm font-medium">Tolerance</label>.*?accent-pink-500"\s*/>\s*</div>'
    content = re.sub(thresh_regex, '<NumberControl label="Tolerance" value={threshold} min="0" max="100" step="1" onChange={setThreshold} />', content, flags=re.DOTALL)
    
    with open('/home/essam/Projects/ESSR_PA/frontend/src/app/contour/page.tsx', 'w') as f:
        f.write(content)

patch()
