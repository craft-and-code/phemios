use super::composite_template_derive::impl_composite_template;
use syn::parse_quote;

#[test]
fn template_sources_and_children_keep_their_bindings() {
    for attr in [
        quote::quote!(#[template(string = "<interface/>")]),
        quote::quote!(#[template(resource = "/example/widget.ui")]),
        quote::quote!(#[template(file = "widget.ui")]),
    ] {
        let input = syn::parse2(quote::quote! {
            #attr
            struct Widget {
                #[template_child] label: TemplateChild<Label>,
                #[template_child(id = "play-button")] button: TemplateChild<Button>,
                unrelated: u32,
            }
        })
        .unwrap();
        let output = impl_composite_template(&input);
        syn::parse2::<syn::ItemImpl>(output.clone()).unwrap();
        let text = output.to_string();
        assert!(!text.contains("compile_error"));
        assert_eq!(text.matches("bind_template_child_with_offset").count(), 2);
        assert!(text.contains("play-button"));
        assert!(text.contains("label"));
        assert!(!text.contains("unrelated"));
    }
}

#[test]
fn duplicate_child_arguments_produce_a_compile_error() {
    let input = parse_quote! {
        #[template(string = "<interface/>")]
        struct Widget { #[template_child(id = "a", id = "b")] label: Child }
    };
    let text = impl_composite_template(&input).to_string();
    assert!(text.contains("compile_error"));
    assert!(text.contains("each argument must be specified only once"));
}

#[test]
fn invalid_child_attribute_produces_a_compile_error() {
    let input = parse_quote! {
        #[template(string = "<interface/>")]
        struct Widget { #[template_child(unknown = "x")] label: Child }
    };
    let text = impl_composite_template(&input).to_string();
    assert!(text.contains("compile_error"));
    assert!(text.contains("expected"));
}
