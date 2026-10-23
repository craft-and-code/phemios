// Mirror the published private Options input so the exact Linux module can be
// tested on a Unix host without selecting that host's real power backend.
#[derive(Default)]
pub(crate) struct Options {
    pub(crate) display: bool,
    pub(crate) idle: bool,
    pub(crate) sleep: bool,
    pub(crate) reason: String,
    pub(crate) app_name: String,
    pub(crate) app_reverse_domain: String,
}
