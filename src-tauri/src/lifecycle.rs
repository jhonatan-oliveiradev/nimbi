#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TrayCommand {
    Show,
    Hide,
    Quit,
}

pub fn tray_command(id: &str) -> Option<TrayCommand> {
    match id {
        "nimbi-show" => Some(TrayCommand::Show),
        "nimbi-hide" => Some(TrayCommand::Hide),
        "nimbi-quit" => Some(TrayCommand::Quit),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_tray_commands() {
        assert_eq!(tray_command("nimbi-show"), Some(TrayCommand::Show));
        assert_eq!(tray_command("nimbi-hide"), Some(TrayCommand::Hide));
        assert_eq!(tray_command("nimbi-quit"), Some(TrayCommand::Quit));
    }

    #[test]
    fn ignores_unknown_tray_commands() {
        assert_eq!(tray_command("anything-else"), None);
    }
}
