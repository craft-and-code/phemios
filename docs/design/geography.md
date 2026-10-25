# Offline country exploration

The globe uses d3-geo orthographic canvas projection and explicit pointer/keyboard rotation and zoom. It redraws on interaction, finite inertia and resize, rather than maintaining an idle animation. A released drag uses recent pointer speed for bounded angular momentum with exponential friction independent of display refresh rate. Holding before release removes momentum. New gestures, zoom, keyboard navigation, explicit country focus, Reset, page hiding and unmount retire the fling; reduced-motion preferences suppress it. Longitude wraps and latitude remains bounded. The canvas drawing buffer is reused until its dimensions change. The browser scheduling adapter preserves the Window receiver when starting or cancelling a frame, including interruption by another gesture in WebKit. Countries can also be selected through ordinary accessible buttons; unknown artist origins remain separate.

Borders: Natural Earth, Admin 0 Countries 1:110m, version 5.1.2, public domain. The bundled derivative retains French names, ISO identifiers and polygon rings rounded to three decimal places. It is a visualization aid; small countries may require the text selector. Natural Earth describes de facto boundaries.

Source: https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_admin_0_countries.geojson
Terms: https://www.naturalearthdata.com/about/terms-of-use/

D3 clips complete country polygons at the 90-degree horizon instead of joining only visible vertices with a straight chord. Cached cloned rings use D3 spherical winding, retaining polygon holes and leaving the bundled input unchanged. Projection/inverse, hemisphere rejection, polygon holes, antimeridian picking, a horizon-crossing regression and several rotations of the bundled Russia geometry have independent behavior tests. See the [D3 projection contract](https://d3js.org/d3-geo/projection).

The globe and accessible country choices occupy a sticky left column, with results on the right. Below 700 px of usable catalogue width they stack, with a smaller 240 px globe above results. Its caption and optional instructions remain below the globe; zoom/reset controls have independent centred 32 px hit targets. Only the accessible Tous selector resets country selection. Changing result counts or an empty result cannot collapse the globe panel. Command/Control additive selection remains available.

Browser acceptance covers rotation, controls, stable empty-result height and both responsive layouts. Native bundle launch succeeds; a computer-control failure prevented completion of authenticated native detail acceptance in this refinement. Other-platform native rendering remains separate acceptance.

The shared globe panel suppresses text selection across its descendants. This does not disable country picking, explicit rotation, zoom or accessible controls.
