use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Spawn bundled FastAPI backend sidecar
            let sidecar_command = app.shell().sidecar("flint-backend");
            match sidecar_command {
                Ok(cmd) => {
                    match cmd.spawn() {
                        Ok((_rx, _child)) => {
                            println!("[Tauri] FastAPI sidecar spawned successfully.");
                        }
                        Err(e) => {
                            eprintln!("[Tauri] Failed to spawn sidecar: {}", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[Tauri] Could not configure sidecar command: {}", e);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
