//! USB model facts from usb.ids (Apple 05ac); compatibility follows podkit/libgpod, not a guess.
use serde_json::Value;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct Ipod {
    pub name: &'static str,
    pub icon: &'static str,
    pub supported: bool,
}
fn model(id: u64) -> Option<Ipod> {
    let (name, icon, supported) = match id {
        0x1201 => ("iPod 3G", "ipod", true),
        0x1202 => ("iPod 2G", "ipod", true),
        0x1203 => ("iPod 4G", "ipod", true),
        0x1204 => ("iPod Photo", "ipod", true),
        0x1205 => ("iPod mini", "ipod-nano", true),
        0x1209 => ("iPod Video", "ipod", true),
        0x120a => ("iPod nano", "ipod-nano", true),
        0x1260 => ("iPod nano 2G", "ipod-nano", true),
        0x1261 => ("iPod classic", "ipod", true),
        0x1262 => ("iPod nano 3G", "ipod", true),
        0x1263 => ("iPod nano 4G", "ipod-nano", true),
        0x1265 => ("iPod nano 5G", "ipod-nano", true),
        0x1266 => ("iPod nano 6G", "ipod-square", false),
        0x1267 => ("iPod nano 7G", "ipod-touch", false),
        0x1300 => ("iPod shuffle", "ipod-shuffle", true),
        0x1301 => ("iPod shuffle 2G", "ipod-shuffle", true),
        0x1302 => ("iPod shuffle 3G", "ipod-shuffle", false),
        0x1303 => ("iPod shuffle 4G", "ipod-shuffle", false),
        _ => return None,
    };
    Some(Ipod {
        name,
        icon,
        supported,
    })
}
fn contains_disk(node: &Value, disk: &str) -> bool {
    node["BSD Name"].as_str() == Some(disk)
        || node["IORegistryEntryChildren"]
            .as_array()
            .is_some_and(|rows| rows.iter().any(|child| contains_disk(child, disk)))
}
/// Match the exact mounted BSD disk beneath its USB device, including multiple connected iPods.
pub(super) fn identify(tree: &Value, disk: &str) -> Option<Ipod> {
    let devices = tree.as_array()?;
    let mut found = None;
    for device in devices {
        if contains_disk(device, disk) {
            if found.is_some() || device["idVendor"].as_u64() != Some(0x05ac) {
                return None;
            }
            found = Some(model(device["idProduct"].as_u64()?)?);
        }
    }
    found
}
#[cfg(test)]
#[path = "volumes_ipod_tests.rs"]
mod tests;
