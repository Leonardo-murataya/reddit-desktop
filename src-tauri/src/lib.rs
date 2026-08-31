use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::RunEvent;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

fn is_port_in_use(port: u16) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    if let Ok(socket_addr) = addr.parse() {
        TcpStream::connect_timeout(&socket_addr, Duration::from_millis(300)).is_ok()
    } else {
        false
    }
}

// Búsqueda inteligente del binario de Node.js (preferencia al runtime embebido/portable)
fn find_node_executable() -> PathBuf {
    // 1. Verificar si hay un node.exe embebido junto al ejecutable instalado o en subcarpetas de recursos
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            let candidates = [
                exe_dir.join("bin").join("node.exe"),
                exe_dir.join("resources").join("bin").join("node.exe"),
                exe_dir.join("resources").join("_up_").join("bin").join("node.exe"),
                exe_dir.join("_up_").join("bin").join("node.exe"),
                exe_dir.join("node.exe"),
            ];

            for candidate in candidates {
                if candidate.exists() {
                    log::info!("Using bundled standalone Node.js: {:?}", candidate);
                    return candidate;
                }
            }

            // Subir niveles por si se ejecuta en modo dev
            let mut search_dir = exe_dir.to_path_buf();
            for _ in 0..5 {
                let dev_candidate = search_dir.join("bin").join("node.exe");
                if dev_candidate.exists() {
                    log::info!("Using local bin/node.exe: {:?}", dev_candidate);
                    return dev_candidate;
                }
                if let Some(parent) = search_dir.parent() {
                    search_dir = parent.to_path_buf();
                } else {
                    break;
                }
            }
        }
    }

    // 2. Comprobar ruta relativa local
    if Path::new("bin/node.exe").exists() {
        return PathBuf::from("bin/node.exe");
    }
    if Path::new("../bin/node.exe").exists() {
        return PathBuf::from("../bin/node.exe");
    }

    // 3. Fallback al comando 'node' del sistema si no se encontró el embebido
    PathBuf::from("node")
}

// Búsqueda inteligente de la carpeta y archivo de server.js
fn find_server_location() -> (PathBuf, PathBuf) {
    if Path::new("server.js").exists() {
        return (PathBuf::from("."), PathBuf::from("server.js"));
    }
    if Path::new("../server.js").exists() {
        return (PathBuf::from(".."), PathBuf::from("server.js"));
    }

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            let candidates = [
                exe_dir.join("server.js"),
                exe_dir.join("resources").join("server.js"),
                exe_dir.join("resources").join("_up_").join("server.js"),
                exe_dir.join("_up_").join("server.js"),
            ];

            for candidate in candidates {
                if candidate.exists() {
                    if let Some(parent) = candidate.parent() {
                        return (parent.to_path_buf(), PathBuf::from("server.js"));
                    }
                }
            }

            let mut search_dir = exe_dir.to_path_buf();
            for _ in 0..5 {
                let s_path = search_dir.join("server.js");
                if s_path.exists() {
                    return (search_dir, PathBuf::from("server.js"));
                }
                if let Some(parent) = search_dir.parent() {
                    search_dir = parent.to_path_buf();
                } else {
                    break;
                }
            }
        }
    }

    (PathBuf::from("."), PathBuf::from("server.js"))
}

fn start_backend_server() -> Option<Child> {
    const BACKEND_PORT: u16 = 31826;

    if is_port_in_use(BACKEND_PORT) {
        log::info!("Backend server is already responding on port {}.", BACKEND_PORT);
        return None;
    }

    let node_bin = find_node_executable();
    let (work_dir, server_file) = find_server_location();

    log::info!("Starting Node.js backend engine...");
    log::info!("Node executable: {:?}", node_bin);
    log::info!("Working directory: {:?}", work_dir);
    log::info!("Server target: {:?}", server_file);

    let mut cmd = Command::new(&node_bin);
    cmd.arg(&server_file)
       .current_dir(&work_dir)
       .env("PORT", BACKEND_PORT.to_string());

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    match cmd.spawn() {
        Ok(child) => {
            log::info!("Node.js backend engine started successfully with PID: {} on port {}", child.id(), BACKEND_PORT);
            Some(child)
        }
        Err(err) => {
            log::warn!("Could not automatically start backend server ({}). Please verify executable permissions.", err);
            None
        }
    }
}

fn stop_backend_server(child_mutex: &Arc<Mutex<Option<Child>>>) {
    if let Ok(mut lock) = child_mutex.lock() {
        if let Some(mut child) = lock.take() {
            let pid = child.id();
            log::info!("Stopping backend server process tree (PID: {})...", pid);

            #[cfg(target_os = "windows")]
            {
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                let mut kill_cmd = Command::new("taskkill");
                kill_cmd.args(["/F", "/T", "/PID", &pid.to_string()]);
                kill_cmd.creation_flags(CREATE_NO_WINDOW);
                let _ = kill_cmd.output();
            }

            let _ = child.kill();
            let _ = child.wait();
            log::info!("Backend process terminated.");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let server_child = Arc::new(Mutex::new(None));
    let server_child_setup = server_child.clone();
    let server_child_exit = server_child.clone();

    tauri::Builder::default()
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            if let Some(child) = start_backend_server() {
                if let Ok(mut lock) = server_child_setup.lock() {
                    *lock = Some(child);
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let RunEvent::Exit = event {
                stop_backend_server(&server_child_exit);
            }
        });
}
