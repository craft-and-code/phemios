use glib::subclass::prelude::*;

#[repr(C)]
struct EmptyInterface {
    parent: glib::gobject_ffi::GTypeInterface,
}

// SAFETY: repr(C) retains GTypeInterface as the first and only field, as required
// by ObjectInterface. No custom vtable fields or pointer operations are added.
#[glib::object_interface]
unsafe impl ObjectInterface for EmptyInterface {
    const NAME: &'static str = "PhemiosMacroEmptyInterface";
}

#[test]
fn interface_registration_preserves_the_generated_default_prerequisites() {
    let first = EmptyInterface::type_();
    assert_eq!(first.name(), "PhemiosMacroEmptyInterface");
    assert!(first.is_a(glib::Type::INTERFACE));
    assert_eq!(first, EmptyInterface::type_());
}
