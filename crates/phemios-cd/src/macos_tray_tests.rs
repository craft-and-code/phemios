use super::*;
#[test]
fn empty_drive_ejection_has_a_fixed_system_command_with_an_explicit_selector() {
    let command = command("SDRW-08U7M-U").unwrap();
    assert_eq!(command.get_program(), "/usr/bin/drutil");
    assert_eq!(
        command.get_args().collect::<Vec<_>>(),
        ["-drive", "SDRW-08U7M-U", "tray", "eject"]
    );
}

fn hardware(registry: &str, vendor: &str, product: &str) -> Hardware {
    Hardware {
        source: super::super::physical::Source {
            path: format!("dr:{registry}"),
            name: format!("{vendor} {product}"),
            media: None,
        },
        vendor: Some(vendor.into()),
        product: Some(product.into()),
    }
}
#[test]
fn selection_is_bound_to_the_exact_present_registry_identity_not_the_first_drive() {
    let rows = [
        hardware("IOService:/First", "Other", "First Drive"),
        hardware("IOService:/Selected", "ASUS", "SDRW-08U7M-U"),
    ];
    assert_eq!(
        selector("IOService:/Selected", &rows).unwrap(),
        "SDRW-08U7M-U"
    );
    assert!(selector("IOService:/Removed", &rows).is_err());
    assert!(selector("/tmp/not-a-drive", &rows).is_err());
    assert!(selector("IOService:/Selected", &[]).is_err());
}
#[test]
fn ambiguous_product_or_vendor_cannot_eject_another_identical_reader() {
    let rows = [
        hardware("IOService:/Selected", "ASUS", "Same"),
        hardware("IOService:/Other", "ASUS", "Same"),
    ];
    assert!(selector("IOService:/Selected", &rows).is_err());
    let rows = [
        hardware("IOService:/Selected", "ASUS", "Same"),
        hardware("IOService:/Other", "Same", "Other"),
    ];
    assert_eq!(selector("IOService:/Selected", &rows).unwrap(), "ASUS");
    let rows = [
        hardware("IOService:/Selected", "ASUS", "Same"),
        hardware("IOService:/Selected", "ASUS", "Same"),
    ];
    assert!(selector("IOService:/Selected", &rows).is_err());
}
#[test]
fn system_selector_cannot_be_interpreted_as_an_index_bus_or_option() {
    for name in [
        "",
        "1",
        "+1",
        "0001",
        "1invalid",
        "+1invalid",
        "0invalid",
        "0",
        "USB",
        "external",
        "INTERNAL",
        "FireWire",
        "atapi",
        "scsi",
        "all",
        "default",
        "-drive",
        "Bad\nName",
        " Name",
        "Name ",
    ] {
        assert!(command(name).is_err(), "{name:?}");
        let rows = [hardware("IOService:/Selected", name, name)];
        assert!(selector("IOService:/Selected", &rows).is_err(), "{name:?}");
    }
    assert!(command(&"x".repeat(401)).is_err());
    // No shell interpolation; punctuation remains one explicit selector argument.
    let query = command("Writer; $(ignored)").unwrap();
    assert_eq!(query.get_args().nth(1).unwrap(), "Writer; $(ignored)");
}

#[test]
fn selector_collisions_follow_the_system_tools_case_insensitive_name_matching() {
    let rows = [
        hardware("IOService:/Selected", "ASUS", "Writer"),
        hardware("IOService:/Other", "asus", "writer"),
    ];
    assert!(selector("IOService:/Selected", &rows).is_err());
    let rows = [
        hardware("IOService:/Selected", "UniqueVendor", "Writer"),
        hardware("IOService:/Other", "writer", "Other"),
    ];
    assert_eq!(
        selector("IOService:/Selected", &rows).unwrap(),
        "UniqueVendor"
    );
}
