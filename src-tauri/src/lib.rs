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

fn find_server_working_dir() -> PathBuf {
    if Path::new("server.js").exists() {
        return PathBuf::from(".");
    }
    if Path::new("../server.js").exists() {
        return PathBuf::from("..");
    }
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            if exe_dir.join("server.js").exists() {
                return exe_dir.to_path_buf();
            }
            if let Some(parent) = exe_dir.parent() {
                if parent.join("server.js").exists() {
                    return parent.to_path_buf();
                }
                if let Some(grandparent) = parent.parent() {
                    if grandparent.join("server.js").exists() {
                        return grandparent.to_path_buf();
                    }
                    if let Some(great_grandparent) = grandparent.parent() {
                        if great_grandparent.join("server.js").exists() {
                            return great_grandparent.to_path_buf();
                        }
                    }
                }
            }
        }
    }
    PathBuf::from(".")
}

fn start_backend_server() -> Option<Child> {
    if is_port_in_use(5000) {
        log::info!("Backend server is already responding on port 5000.");
        return None;
    }

    let work_dir = find_server_working_dir();
    let server_path = work_dir.join("server.js");

    log::info!("Starting Node.js backend: {:?} (workdir: {:?})", server_path, work_dir);

    let mut cmd = Command::new("node");
    cmd.arg("server.js").current_dir(&work_dir);

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    match cmd.spawn() {
        Ok(child) => {
            log::info!("Node.js backend started successfully with PID: {}", child.id());
            Some(child)
        }
        Err(err) => {
            log::warn!("Could not automatically start node server.js ({}). Please verify Node is in PATH.", err);
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
