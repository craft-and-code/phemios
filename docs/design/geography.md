# Offline country exploration

The globe uses orthographic canvas projection and explicit pointer/keyboard rotation and zoom. It redraws on interaction and resize, rather than maintaining an idle animation. Countries can also be selected through ordinary accessible buttons; unknown artist origins remain separate.

Borders: Natural Earth, Admin 0 Countries 1:110m, version 5.1.2, public domain. The bundled derivative retains French names, ISO identifiers and polygon rings rounded to three decimal places. It is a visualization aid; small countries may require the text selector. Natural Earth describes de facto boundaries.

Source: https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_admin_0_countries.geojson
Terms: https://www.naturalearthdata.com/about/terms-of-use/

Projection/inverse, hemisphere rejection, polygon holes and antimeridian picking have independent behavior tests. Manual browser inspection covers rendering and keyboard rotation. Native rendering is verified again with the final application bundle.
