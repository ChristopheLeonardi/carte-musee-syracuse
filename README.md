# carte-musee-syracuse

#TODO : 
- Add plugin subgroup & responsiveMarker to libraries

- Change getScript : 
    /* BEGIN script carte des instruments du musée */
    /* Références d'utilisation : test-carte-musee (ATT MAJ) */

    const carte_instruments_musee = {
        lib_url: [
            `/ui/plug-in/integration/libraries/d3js/d3.v7.min.js`,
            `/ui/plug-in/integration/libraries/topojson/topojson.js`,
            `/ui/plug-in/integration/libraries/accessible-slick/slick.min.js`,
            `/ui/plug-in/integration/libraries/leaflet-1.9.3/leaflet.js`,
            `/ui/plug-in/integration/libraries/Leaflet.markercluster-1.4.1/dist/leaflet.markercluster.js`,
            `/ui/plug-in/integration/libraries/leaflet.fullscreen-master/Control.FullScreen.js`,
            `/ui/plug-in/integration/libraries/pako/pako.min.js`,
            //`/ui/plug-in/integration/libraries/custom-scrollbar/custom_scrollbar.js`,
            `/ui/plug-in/integration/libraries/selectize/selectize.min.js`,

            `/ui/plug-in/integration/carte-instrument-musee/js/map.js`,
            `/ui/plug-in/integration/libraries/subgroup/src/subgroup.js`,
            `/ui/plug-in/integration/libraries/responsivePopup/leaflet.responsive.popup.js`,

            //`/ui/plug-in/integration/carte-instrument-musee/js/map_config.js`,
            //`/ui/plug-in/integration/carte-instrument-musee/js/cartel.js`,
            //`/ui/plug-in/integration/carte-instrument-musee/js/filters.js`,
        ],
        css_url: [
            `/ui/plug-in/integration/libraries/accessible-slick/accessible-slick-theme.min.css`,
            `/ui/plug-in/integration/libraries/accessible-slick/slick.min.css`,
            `/ui/plug-in/integration/libraries/leaflet-1.9.3/leaflet.css`,
            `/ui/plug-in/integration/libraries/Leaflet.markercluster-1.4.1/dist/MarkerCluster.css`,
            `/ui/plug-in/integration/libraries/Leaflet.markercluster-1.4.1/dist/MarkerCluster.Default.css`,
            `/ui/plug-in/integration/libraries/leaflet.fullscreen-master/Control.FullScreen.css`,
            //`/ui/plug-in/integration/libraries/custom-scrollbar/custom_scrollbar.css`,
            `/ui/plug-in/integration/libraries/selectize/selectize.default.css`,
            `/ui/plug-in/integration/libraries/selectize/selectize.css`,

            `/ui/plug-in/integration/libraries/responsivePopup/leaflet.responsive.popup.css`,
            `/ui/plug-in/integration/carte-instrument-musee/css/map.css`,
        ],
        tagId: "#mapMuseeContainer"
    }
    loadScriptsReturnPromise(carte_instruments_musee)


    /* END script carte des instruments du musée */