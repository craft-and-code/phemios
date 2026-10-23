/** Compiler refusals, asserted semantically rather than by compiler-version snapshots. */
export const diagnosticCases = [
  {
    name: "flags unknown value attribute",
    source: '#[glib::flags(name = "BadFlags")]\nenum Bad { #[flags_value(unknown)] A = 1 }',
    message: "unknown",
  },
  {
    name: "flags missing discriminant",
    source: '#[glib::flags(name = "BadFlags")]\nenum Bad { A }',
    message: "explicit discriminant",
  },
  {
    name: "enum on struct",
    source: '#[derive(glib::Enum)]\n#[enum_type(name = "BadEnum")]\nstruct Bad;',
    message: "only supports enums",
  },
  {
    name: "enum missing name",
    source: "#[derive(glib::Enum)]\nenum Bad { A }",
    message: "requires",
  },
  {
    name: "boxed missing name",
    source: "#[derive(Clone, glib::Boxed)]\nstruct Bad(i32);",
    message: "boxed_type",
  },
  {
    name: "shared boxed missing name",
    source: "#[derive(Clone, glib::SharedBoxed)]\nstruct Bad(std::sync::Arc<i32>);",
    message: "shared_boxed_type",
  },
  {
    name: "error domain missing name",
    source: "#[derive(Debug, Copy, Clone, glib::ErrorDomain)]\nenum Bad { A }",
    message: "error_domain",
  },
  {
    name: "object subclass invalid placement",
    source: "#[glib::object_subclass]\nstruct Bad;",
    message: "impl",
  },
  {
    name: "object interface invalid placement",
    source: "#[glib::object_interface]\nstruct Bad;",
    message: "impl",
  },
  {
    name: "derived properties invalid placement",
    source: "#[glib::derived_properties]\nstruct Bad;",
    message: "impl",
  },
  {
    name: "GTK missing template",
    source: "#[derive(gtk3_macros::CompositeTemplate)]\nstruct Bad;",
    message: "Missing 'template' attribute",
  },
  {
    name: "GTK malformed template",
    source: "#[derive(gtk3_macros::CompositeTemplate)]\n#[template(resource = 10)]\nstruct Bad;",
    message: "expected string literal",
  },
  {
    name: "GTK unsupported enum",
    source:
      '#[derive(gtk3_macros::CompositeTemplate)]\n#[template(string = "<interface/>")]\nenum Bad { A }',
    message: "only supports structs",
  },
];
