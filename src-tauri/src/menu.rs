//! Minimal macOS menus retain native editing and window shortcuts, without unused actions.
use tauri::menu::{AboutMetadata, MenuBuilder, SubmenuBuilder};

pub(crate) fn install(app: &tauri::App) -> tauri::Result<()> {
    let handle = app.handle();
    let application = SubmenuBuilder::new(handle, "Phémios")
        .about(Some(AboutMetadata {
            name: Some("Phémios".into()),
            version: Some(env!("CARGO_PKG_VERSION").into()),
            ..Default::default()
        }))
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;
    let edit = SubmenuBuilder::new(handle, "Édition")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let window = SubmenuBuilder::new(handle, "Fenêtre")
        .minimize()
        .maximize()
        .fullscreen()
        .separator()
        .close_window()
        .build()?;
    app.set_menu(
        MenuBuilder::new(handle)
            .items(&[&application, &edit, &window])
            .build()?,
    )?;
    Ok(())
}
