fn main() {
  tauri_build::try_build(
    tauri_build::Attributes::new()
      // Custom app commands default to every webview. Generate explicit ACL
      // permissions instead, then grant them only to credentials.html.
      .app_manifest(tauri_build::AppManifest::new().commands(&[
        "get_live_profile_status",
        "save_live_profile",
        "test_live_profile",
        "activate_live_profile",
        "clear_live_profile",
        "open_credentials_panel",
      ])),
  )
  .expect("failed to generate Siftory desktop capability manifests");
}
