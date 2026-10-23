// Compile the real GTK API on Linux; no widget/display needs to be instantiated.
use gtk::{glib, subclass::prelude::*};
mod imp {
    use super::*;
    #[derive(Default, gtk::CompositeTemplate)]
    #[template(
        string = "<interface><template class='PhemiosMacroFixture' parent='GtkBox'><child><object class='GtkLabel' id='label'/></child></template></interface>"
    )]
    pub struct Widget {
        #[template_child]
        pub label: gtk::TemplateChild<gtk::Label>,
    }
    #[glib::object_subclass]
    impl ObjectSubclass for Widget {
        const NAME: &'static str = "PhemiosMacroFixture";
        type Type = super::Widget;
        type ParentType = gtk::Box;
        fn class_init(klass: &mut Self::Class) {
            Self::bind_template(klass);
        }
        fn instance_init(obj: &glib::subclass::InitializingObject<Self>) {
            obj.init_template();
        }
    }
    impl ObjectImpl for Widget {}
    impl WidgetImpl for Widget {}
    impl ContainerImpl for Widget {}
    impl BoxImpl for Widget {}
}
glib::wrapper! { pub struct Widget(ObjectSubclass<imp::Widget>) @extends gtk::Box, gtk::Container, gtk::Widget; }
#[test]
fn composite_template_implements_the_real_gtk_contract() {
    fn requires_template<T: gtk::subclass::widget::CompositeTemplate>() {}
    requires_template::<imp::Widget>();
}
