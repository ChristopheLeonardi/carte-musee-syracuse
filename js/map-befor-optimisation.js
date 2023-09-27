/* Lien github : https://github.com/ChristopheLeonardi/carte-musee-syracuse */

// Chargement des données
var promises = []
function wait_for_data(promises) {
    get_data(promises)
    typeof window["data"] !== "undefined" ? mapMusee(window["data"]) : setTimeout(wait_for_data, 250);   
}

function get_data(promises) {
  const controller = new AbortController();
  try {
    if (promises == undefined) { var promises = [] }

    // Mettez à jour l'URL du fichier CSV compressé au format gzip
    promises.push(
      fetch('/ui/plug-in/integration/carte-instrument-musee/data/data-carte-collections_2023-07-20.csv.gz')
        .then(response => {
          if (!response.ok) {
            throw new Error(`Erreur HTTP : ${response.status}`);
          }
          return response.arrayBuffer(); // Utilisez arrayBuffer pour récupérer les données brutes
        })
        .then(arrayBuffer => {
          // Décompressez le contenu avec pako
          const inflatedData = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });

          // Parsez le contenu décompressé en CSV avec d3
          return d3.csvParse(inflatedData);
        })
    );

    // Liste des URL des fichiers JSON gzip
    const jsonUrls = [
      '/ui/plug-in/integration/carte-instrument-musee/data/amerique.json.gz',
      '/ui/plug-in/integration/carte-instrument-musee/data/reste.json.gz',
      '/ui/plug-in/integration/carte-instrument-musee/data/config.json.gz',
    ];

    // Utilisez une boucle pour charger et décompresser les fichiers JSON
    for (const url of jsonUrls) {
      promises.push(
        fetch(url)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Erreur HTTP : ${response.status}`);
            }
            return response.arrayBuffer(); // Utilisez arrayBuffer pour récupérer les données brutes
          })
          .then(arrayBuffer => {
            // Décompressez le contenu avec pako
            const inflatedData = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });

            // Parsez le contenu décompressé en tant qu'objet JSON
            return JSON.parse(inflatedData);
          })
      );
    }

    setTimeout(() => controller.abort(), 1000);
    Promise.all(promises, { signal: controller.signal })
      .then(data => {
        window["data"] = data;
      })
      .catch(error => {
        console.error('Erreur lors du chargement des fichiers gzip :', error);
      });
  } catch (err) {
    console.log(err);
  }
}

// Vérification que tous les modules sont chargés
function isLibrariesLoaded() {
  return typeof L !== 'undefined' 
      && typeof L.map === 'function'
      && typeof L.markerClusterGroup === 'function'
}
function onLibrariesLoaded(attempt_count) {
  if (isLibrariesLoaded()) {
    wait_for_data(promises)
  } else {
    // Rechargement de la page après 4 tentatives avec message d'erreur
    if (attempt_count >= 4) { 
      let message = document.createElement("p")
      message.setAttribute("class", "reload-error")
      message.textContent = "Nous rencontrons un problème, la page va être rechargée."
      document.getElementById("mapMuseeContainer").appendChild(message)
      setTimeout(function () {
        location.reload() 
      }, 1500); 
    }

    setTimeout(function () {
      console.log('Tentative de rechargement de Leaflet...');
      onLibrariesLoaded(attempt_count + 1);
    }, 1000);
  }
} 

$(document).ready(function() {
  $(".loader").show()

  var attempt_count = 0
  onLibrariesLoaded(attempt_count);
})

function mapMusee(data){
  console.log(data)

  const instruments_data = data[0]
  let countries_data = [{ "data" : data[1], "name" : "amerique" },{ "data" : data[2], "name" : "reste" }]

  window["initial_view"] = { latlng : [20, 155], zoom : 2 } // Default map view setting

  window["continent_infos"]  = data[3].continents_infos
  window["object_type"] = data[3].object_type
  window["c_data"] = createDataObject(instruments_data) 

  /* Initialize Map */
  const map = L.map('mapMusee', { 
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: 'topleft'
      },
      //worldCopyJump: true,
      scrollWheelZoom: true, 
      //maxBoundsViscosity: 0.8,
      minZoom :  1.5,
      maxZoom: 12,
  }).setView(window.initial_view.latlng, window.initial_view.zoom);

  window["map"] = map
  //map.setMaxBounds([ [-65, -180], [180, 360] ])

  L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)

  // Create markers for each continent
  createContinentMarkers(c_data)

  /* Create Countries layers */
  window["countries_layers"] = []
  window["topojson_data"] = []
  
  createCountriesLayers(countries_data)

  // Remove Duplicate countries
  window["topojson_data"] = removeDuplicateObject(window["topojson_data"].flat(), "ISO_A2_EH")
  window["country_markers"] = L.layerGroup().addTo(map)


  /* Reset map when reach primary zoom level */
  map.on('moveend', function() {
      if(map.getZoom() <= 2.5) {
          window.continents_popups.forEach(popup => { map.openPopup(popup) })

          resetMarkers()
          resetclusters()
      }

  })

  /* Center on popup when open */
  map.on('popupopen', function(e) {
      var px = map.project(e.target._popup._latlng); // find the pixel location on the map where the popup anchor is
      px.y -= e.target._popup._container.clientHeight/2; // find the height of the popup container, divide by 2, subtract from the Y axis of marker location
      map.panTo(map.unproject(px),{animate: true}); // pan to new center
  });


  /* Filters */
  createOptionsLocalisation(c_data)
  populatefilters(c_data)


  $(".loader").hide();

  filtersActions()

  // Ouvrir et fermer le menu des filtres
  $("#open-close-filter").click(e => {
    $("#mapFilter, #open-close-filter, #mapMusee").toggleClass("open")
    onkeyup = e => {
      if ((e.keyCode == 27) && $("#mapFilter, #open-close-filter, #mapMusee").hasClass("open")){
        $("#mapFilter, #open-close-filter").removeClass("open")
      }
    };
  })
}

const createContinentMarkers = c_data => {

  // Remove old popups
  if (window["continents_popups"]){
      window["continents_popups"].forEach(popup => {
          map.removeLayer(popup)
      })
  }

  window["continents_popups"] = []
  Object.keys(c_data.continents).map(key => {

      var popup = new L.popup({closeButton: false, closeOnClick:false, autoClose:false})
                      .setLatLng(c_data.continents[key].latlng)
                      .setContent(createPopupContinent(c_data.continents[key], popup))
                      .openOn(map)

      map.addLayer(popup)
      window["continents_popups"].push(popup)
  })
}

const createCountriesLayers = data => {
  data.map( dataset => {
      let topo = topojson.feature(dataset.data, dataset.data.objects[dataset.name])
      window["countries_layers"].push(L.geoJson(topo, { onEachFeature: onEachTopojson, style: style }).addTo(map))
  })
}

/* PROCESS DATA */
const createDataObject = instruments_data => {
  // Get number by continent 
  const c_data = { "pays" : [], "continents" : {}, "count_by_type" : {}, "raw_data" : instruments_data, "convert_iso_name" : {}}

  const continents = [...new Set(instruments_data.map(item => item.Continent))]
  continents.map(continent => { 
      if (continent == ""){ continent = "unknown"}
      c_data.continents[continent] = { 
          "count" : 0, 
          "name_en" : window.continent_infos[continent].name_en,
          "name" : continent,
          "latlng" : window.continent_infos[continent].latlng, 
          "zoom_level": window.continent_infos[continent].zoom_level } })

  window["object_type"].map(type => {
      c_data.count_by_type[type.label] = 0
  })

  instruments_data.map(item => {
      if (item.Continent == ""){ item.Continent = "unknown"}
      // Décompte des notices par continent
      c_data.continents[item.Continent].count = c_data.continents[item.Continent].count ? c_data.continents[item.Continent].count + 1 : 1
      
      // Liste des pays par continents
      if (typeof c_data.continents[item.Continent]["liste_pays"] == 'undefined') {
          c_data.continents[item.Continent]["liste_pays"] = []
      }

      if(!c_data.continents[item.Continent]["liste_pays"].includes(item["Code ISO-2"])){
          c_data.continents[item.Continent].liste_pays.push(item["Code ISO-2"])
      }
      
      // Liste des notices par continents par pays
      if (typeof c_data.continents[item.Continent]["notices"] == 'undefined') {
          c_data.continents[item.Continent]["notices"] = []
      }

      if (typeof c_data.continents[item.Continent]["notices"][item["Code ISO-2"]] == 'undefined') {
          c_data.continents[item.Continent].notices[item["Code ISO-2"]] = {}
          c_data.continents[item.Continent].notices[item["Code ISO-2"]]["count"] = 0
          c_data.continents[item.Continent].notices[item["Code ISO-2"]]["cities"] = []
      }
      if (typeof c_data.continents[item.Continent]["notices"][item["Code ISO-2"]]["cities"][item.Ville] == 'undefined') {
          c_data.continents[item.Continent].notices[item["Code ISO-2"]]["cities"][item.Ville] = {}
          c_data.continents[item.Continent].notices[item["Code ISO-2"]]["cities"][item.Ville]["count"] = 0
          c_data.continents[item.Continent].notices[item["Code ISO-2"]]["cities"][item.Ville]["notices"] = []
      }

      //c_data.continents[item.Continent].notices[item["Code ISO-2"]].push(item)
      c_data.continents[item.Continent].notices[item["Code ISO-2"]]["count"] = ( c_data.continents[item.Continent].notices[item["Code ISO-2"]]["count"] || 0) + 1 
      c_data.continents[item.Continent].notices[item["Code ISO-2"]]["cities"][item.Ville]["count"] = ( c_data.continents[item.Continent].notices[item["Code ISO-2"]]["cities"][item.Ville]["count"] || 0) + 1 
      c_data.continents[item.Continent].notices[item["Code ISO-2"]]["cities"][item.Ville]["notices"].push(item)

      // Liste totale des pays
      if(!c_data.pays.includes(item["Code ISO-2"])){
          c_data.pays.push(item["Code ISO-2"])
      }

      // Coreespondance code / nom pays
      c_data.convert_iso_name[item["Code ISO-2"]] = item["Pays"]

      c_data.count_by_type[item["Type d'objet"]] += 1      
  })
  console.log(c_data)
  return c_data
}


/* MAP CONFIG */

const calculateCenterGPS = coordinates => {
  if (coordinates.length === 0) {
    return null
  }

  var totalLat = 0
  var totalLon = 0

  for (var i = 0; i < coordinates.length; i++) {
    totalLat += coordinates[i][0]
    totalLon += coordinates[i][1]
  }

  var centerLat = totalLat / coordinates.length
  var centerLon = totalLon / coordinates.length

  return [centerLat, centerLon]
}

const normalize_string = str => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/gm, "_").toLowerCase()
}

const removeDuplicateObject = (arr, key) => {
  const unique = [];
  for (const item of arr) {
      const isDuplicate = unique.find((obj) => obj[key] === item[key]);
      if (!isDuplicate) { unique.push(item) }
  }
  return unique
}

/* Popup des Continents */
const createPopupContinent = (countries_to_display, popup) => {

  let popupContent = document.createElement('div')
  popupContent.setAttribute("class", 'continent-popup')
  popupContent.setAttribute("data-continent", normalize_string(countries_to_display.name_en))

  let title = document.createElement('h4')
  title.textContent = countries_to_display.name
  popupContent.appendChild(title)

  let number = document.createElement('p')
  number.textContent = `${countries_to_display.count} Objets`
  popupContent.appendChild(number)

  $(popupContent).hover( 
    e => { hoverCountryEffect(e, 0.6) },
    e => { hoverCountryEffect(e, 0) }
  )
  $(popupContent).click( 
    e => {
      // Open all popup before closing the selected one
      window.continents_popups.forEach(c_popup => { 
        map.openPopup(c_popup) 
      })
      resetclusters()
      resetMarkers()

      // Set view
      window["map"].setView(countries_to_display.latlng, countries_to_display.zoom_level)

      // Unhighlight countries
      hoverCountryEffect(e, 0)
   
      createMarkersCountry(countries_to_display, false)
    }

  )
  return popupContent
}

const hoverCountryEffect = (e, opacity) => {

  // Get name depending on DOM element
  var continent_name = $(e.target).attr("data-continent") || $(e.target).parent().attr("data-continent")
  let svg_countries = []

  if (e.layerID){
    var path = `path.${e.layerID.toLowerCase()}`
    if($(path).length == 0 ) { return }
    
    var element = document.getElementById("mapMusee").getElementsByClassName(e.layerID.toLowerCase())
    svg_countries.push(Array.from(element))
  }
  else{
    window["c_data"].pays.map(country => {
      if (country === ""){ return }

      var path = `path.${continent_name.toLowerCase()}.${country.toLowerCase()}`
      if($(path).length == 0 ) { return }
      
      var element = document.getElementById("mapMusee").getElementsByClassName(`${continent_name.toLowerCase()} ${country.toLowerCase()}`)      
      svg_countries.push(Array.from(element))
    })
  }
  svg_countries = svg_countries.flat()
  svg_countries.map(elt=> { 
    $(elt).css({"opacity" : opacity, "fill-opacity" : opacity, "stroke-opacity":0.8, "stroke-color": "#001B3B"}) })
}

// Correct map origins for america
const enableAnteMeridian = lng => {
  return lng < -20 ? lng +=360 : lng
}

const createMarkersNeighbors = (neighbor, bounds=false) => {

  // Harmonize data
  var countries_to_display = neighbor
  countries_to_display = [... Object.keys(countries_to_display).map(key => {return {"code":key, "obj":countries_to_display[key]}})]

  // Remove old markers
  resetMarkers()

  // Reset Layers state of markers
  resetLayerState()

  countries_to_display.map(country => {
    var topo = window["topojson_data"].filter(item => {return item.ISO_A2_EH == country.code })[0]
    if (typeof topo == "undefined"){ return }
    country["LABEL_Y"] = topo.LABEL_Y
    country["LABEL_X"] = topo.LABEL_X
    country["NAME_FR"] = topo.NAME_FR
    country["name_native"] = topo.name_native

    if (country.LABEL_Y === null && country.LABEL_X === null) { return }
    var latlng = [
      country.LABEL_Y,
      enableAnteMeridian(country.LABEL_X)
    ]

    if (neighbor){
      if (!bounds.contains(latlng)) {
        latlng = calculateNewLatLng(latlng, bounds.pad(-0.95))
      }
      var html =  `<div class="neighbor-marker" id="${country.code}">
                    <img src="/ui/plug-in/integration/carte-instrument-musee/img/boussole.svg" alt=""/>
                    <div>
                      <h3><span>${country.NAME_FR}</span> (${country.name_native})</h3>
                      <p>${country.obj.count} Objets</p>
                    </div>
                  </div>`
      var icon = L.divIcon({ 
        html: html,
        className: `continent-marker neighbor`
      })
    }
    createSingleMarker(latlng, icon).addTo(window["country_markers"])
  })
}
/* Marqueurs des Pays */
const createMarkersCountry = (continent_obj, bounds=false) => {

  // Harmonize data
  var countries_to_display = continent_obj.notices
  countries_to_display =[... Object.keys(countries_to_display).map(key => {return {"code":key, "obj":countries_to_display[key]}})]

  // Remove old markers
  resetMarkers()

  // Reset Layers
  resetLayerState()

  var countries_cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    iconCreateFunction: function(cluster) {
      return L.divIcon(cluster_icon(cluster))
    }
  })


  countries_to_display.map(country => {
    var topo = window["topojson_data"].filter(item => {return item.ISO_A2_EH == country.code })[0]
    if (typeof topo == "undefined"){ return }
    country["LABEL_Y"] = topo.LABEL_Y
    country["LABEL_X"] = topo.LABEL_X
    country["NAME_FR"] = topo.NAME_FR
    country["name_native"] = topo.name_native

    if (country.LABEL_Y === null && country.LABEL_X === null) { return }
    var latlng = [
      country.LABEL_Y,
      enableAnteMeridian(country.LABEL_X)
    ]


    var html = `<p class="country-marker" id="glob-${country.code}">${country.obj.count}</p>`
    var icon = L.divIcon({ 
      html: html,
      className: `continent-marker`
    })
    

    var marker = createSingleMarker(latlng, icon)
    countries_cluster.addLayer(marker)

  })
  window["countries_cluster"] = [countries_cluster]
  map.addLayer(countries_cluster)


  let unknown_countries = countries_to_display.filter(country => { return country.code == ""})[0]
  if(unknown_countries){
    let unknown_countries_notices = unknown_countries.obj.cities[""].notices
    let continent_infos = window.continent_infos[unknown_countries_notices[0].Continent]
  
    var html = `<div class="country-marker unknown">
                  <p>Sans Localisation</p><p>${unknown_countries.obj.count} Objet(s)</p>
                </div>`
                
    var icon = L.divIcon({ 
      html: html,
      className: `unknown-marker`
    })
    
    var marker = createSingleMarker(continent_infos.latlng, icon, unknown_countries_notices)
    countries_cluster.addLayer(marker)
  }


}
const resetLayerState = () => {
  window.countries_layers.map(group_layers => {
    Object.keys(group_layers._layers).forEach(function(key, index) { group_layers._layers[key].has_markers = false })
  })

}
const cluster_icon = cluster => {
  var count  = 0
  var temp = []
  cluster.getAllChildMarkers().map(country => {
    temp.push(country)
    let regex = /<[^>]*>(\d+)\s*[^<]*<\/[^>]*>/
    let number = country.options.icon.options.html.match(regex)
    if (number) { count += parseInt(number[1]) }
  })

  return { html: `<p class="country-marker">${count}</p>`, className: `continent-marker`}
}
const createSingleMarker = (latlng, icon, notices = false) => {
  var marker = L.marker(latlng, {icon: icon, bubblingMouseEvents: true, riseOnHover:true} )
      .on('click', function(e) {
        window.continents_popups.forEach(popup => { map.closePopup(popup) })
        let selected_country = e.target._icon.firstChild.id || `glob-${e.target._icon.firstChild.id}` || undefined
        selected_country = selected_country.replace("glob-", "")

        // Construct Neighbor
        window.countries_layers.map(layers => { 
          layers.eachLayer(layer => {

            if(layer.feature.properties.ISO_A2_EH != selected_country){ return }

            window["map"].fitBounds(layer._bounds) 
            var neighbor_list = getNeighbor(layer)
            createMarkersNeighbors(neighbor_list, layer._bounds)
          })
        })
        
        // Construct self culster
        var layer_id = getSelfLayer(e.target)
        if (layer_id) { 
          createCitiesMarkers(layer_id) 
        } 
        else{
          marker.bindPopup(createMarkerPopup(notices)).openPopup();
        }
      })
      .on("mouseover", function(e) { markerHover(e, 0.6) })
      .on("mouseout", function(e) { markerHover(e, 0) })
  return marker
}

const getSelfLayer = elt => {
  if ($(elt.options.icon.options.html).attr("id") == undefined) { return }
  let self_id = $(elt.options.icon.options.html).attr("id")
  self_id = self_id.replace("glob-", "")
  var self_layer = {}
  window.countries_layers.map(group_layers => {
    Object.keys(group_layers._layers).forEach(function(key, index) {
      if (group_layers._layers[key].layerID != self_id) { return }
      self_layer = group_layers._layers[key]
    })
  })
  return self_layer     
}

const markerHover = (e, opacity) => {

  let selected_country = e.target._icon.firstChild.id || `glob-${e.target._icon.firstChild.id}`|| undefined
  selected_country = selected_country.replace("glob-", "")
  window.countries_layers.map(layers => { 
    layers.eachLayer(layer => {
      if(layer.feature.properties.ISO_A2_EH != selected_country){ return }
      hoverCountryEffect(layer, opacity)
    })
  })
  
}

// Fonction pour calculer les nouvelles coordonnées du marqueur
const calculateNewLatLng = (latlng, bounds) => {
  var lat = latlng[0];
  var lng = latlng[1];

  // Vérifier les limites verticales (latitudes)
  if (lat < bounds.getSouth()) {
    lat = bounds.getSouth();
  } else if (lat > bounds.getNorth()) {
    lat = bounds.getNorth();
  }


  // Vérifier les limites horizontales (longitudes)
  if (lng < bounds.getWest()) {
    lng = bounds.getWest();
  } else if (lng > bounds.getEast()) {
    lng = bounds.getEast();
  }

  return L.latLng(lat, lng);
}

const onEachTopojson = (features, layer) => {

  // Add id to layer 
  var topojson_data = []
  let props = layer.feature.properties
  layer["has_markers"] = false
  layer.layerID = props.ISO_A2_EH == -99 ? props.ISO_A3 == -99 ? normalize_string(props.NAME_EN) : props.ISO_A2 : props.ISO_A2_EH 
  topojson_data.push(props)

  // Remove Duplicate countries and store layers
  window["topojson_data"].push(topojson_data)


  

  layer.on({
    click: (e) => {
      // Vérifie la présence d'instrument dans le pays
      if(!window["c_data"].pays.includes(layer.layerID)){ return }
      if(L.markerClusterGroup == undefined) { return }

      if((map.getZoom() >= 4) && (layer.has_markers == true)) { return }
      window.continents_popups.forEach(popup => { map.closePopup(popup) })

      var country_bounds =  e.target._bounds
      Object.keys(country_bounds).map(key => { country_bounds[key].lng = enableAnteMeridian(country_bounds[key].lng) })
      window["map"].fitBounds(country_bounds) 
      var neighbor_list = getNeighbor(e.target)

      createMarkersNeighbors(neighbor_list, e.target._bounds)
      createCitiesMarkers(e.target)
    } 
  })
  layer.on( "mouseover", e => { 

    // Vérifie la présence d'instrument dans le pays
    if(!window["c_data"].pays.includes(layer.layerID)){ return }

    if(layer.has_markers == true) { return }
    $(`.neighbor-marker#${e.target.layerID}`).toggleClass("hovered")
    $(e.target._path).css({ opacity: 0.6, fillOpacity: 0.6 })
    createTooltipName(e) 
  })

  layer.on( "mouseout", e => { 
    $(`.neighbor-marker#${e.target.layerID}`).toggleClass("hovered")
    $(e.target._path).css({ opacity: 0, fillOpacity: 0 }) 
    $("#tooltip").remove()
  })
}

const createTooltipName = e => {
  $("#tooltip").remove()
  if(map.getZoom() >= 4) { return }
  var name_fr = e.target.feature.properties.NAME_FR
  var name_natve = e.target.feature.properties.name_native
  
  var tooltip = document.createElement("p")
  tooltip.setAttribute("id", "tooltip")
  tooltip.innerHTML = `${name_fr} <i>(${name_natve})</i>`
  $("#mapMusee").append(tooltip)
  var y = window.scrollY
  $("#tooltip").css("left", `${e.originalEvent.layerX - 80}px`)
  $("#tooltip").css("top", `${e.originalEvent.layerY - 80}px`)
}

const createCitiesMarkers = layer => {
  if(layer == undefined) { return }
  resetclusters();

  layer["has_markers"] = true;

  var cities = getNoticeData(layer);
  var country_center = [layer.feature.properties.LABEL_Y, layer.feature.properties.LABEL_X];

  var markers = L.markerClusterGroup({
    showCoverageOnHover: false,
    iconCreateFunction: function(cluster) {
      return L.divIcon(cluster_icon(cluster))
    }
  });

  var unknownObjectsCount = 0; // Compteur pour le nombre total d'objets pour les localisations inconnues
  var unknownCitiesNames = []; // Tableau pour stocker les noms des localisations inconnues

  window["clusters_cities_cluster"] = [] // Sauvegarde des clusters connus
  window["unknown_marker"] = [] // Sauvegarde des clusters inconnus
  var markers_to_add = []

  Object.keys(cities).map(key => {

    if (cities[key].notices == undefined) { return }

    let is_known = cities[key].notices[0]["Coordonnées"].split(",") != '' ? true : false;

    if (!is_known) {
      unknownObjectsCount += cities[key].count; // Ajoute le nombre d'objets pour cette localisation inconnue au compteur total
      unknownCitiesNames.push(key); // Ajoute le nom de la localisation inconnue au tableau des noms

    } 

    else {

      // Marqueurs pour les localisations connues
      var coord = cities[key].notices[0]["Coordonnées"].split(",");
      var latlng = [parseFloat(coord[0]), enableAnteMeridian(parseFloat(coord[1]))];
      var name = key;
      var html = `<div class="city-marker known" data-ville="${normalize_string(name)}">
                  <p>${name}</p><p>${cities[name].count} Objet(s)</p>
                </div>`;

      var icon = L.divIcon({
        html: html,
        className: "city-container"
      });

      // Create markers
      var marker = L.marker(latlng, { icon: icon, bubblingMouseEvents: true, riseOnHover: true })
        .bindPopup(createMarkerPopup(cities[name].notices)).openPopup();
      markers_to_add.push(marker)
      window.clusters_cities_cluster.push(marker)
    }
  });

  // S'il n'y a qu'un marqueur dans le pays, ajout direct à la carte, sinon création d'un cluster
  markers_to_add.length == 1 ? map.addLayer(markers_to_add[0]) : markers_to_add.map(marker => { markers.addLayer(marker)})

  // Crée un seul marqueur pour toutes les localisations inconnues combinées
  if (unknownCitiesNames.length > 0) {
    var latlng = [parseFloat(country_center[0]), enableAnteMeridian(parseFloat(country_center[1]))];

    var html = `<div class="marker-cluster-medium">
                  <div class="city-marker unknown" data-ville="${normalize_string('?')}">
                    <p>Sans Localisation</p>
                    <p>${unknownObjectsCount} Objet(s)</p>
                  </div>
                </div>`;

    var icon = L.divIcon({
      html: html,
      className: "city-container"
    });

    var unknown_marker = L.marker(latlng, { icon: icon, bubblingMouseEvents: true, riseOnHover: true })
      .bindPopup(createMarkerPopup(cities[""].notices)).openPopup();
    unknown_marker.setZIndexOffset(-1000)
    unknown_marker.on("mouseover", function (e) {
        e.target.setZIndexOffset(10000)
    })
    unknown_marker.on("mouseout", function (e) {
        e.target.setZIndexOffset(-10000)
    })
    
    map.addLayer(unknown_marker);
    window.unknown_marker.push(unknown_marker)


  }
  
  map.addLayer(markers);
  window["clusters_cities_cluster"] = markers 
  window["solo_city_cluster"] = markers_to_add 

  // Sauvegarder la référence du groupe de marqueurs unknown_markers dans la variable globale clusters_cities_markers
  window["clusters_cities_markers"] = unknown_marker;
};

const defineIcon = (url) => {
  return L.icon({
      iconUrl: url,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, 0]
  })
}

const createMarkerPopup = notices => {

  var container = document.createElement("div")
  container.setAttribute("class", "popup-container")

  // Création de la rosace des catégories
  var cats = [... new Set(notices.map(notice => { return notice["Type d'objet"]}))]
  var angle_unit = 360 / cats.length * Math.PI / 180
  var angle = -90 * Math.PI / 180
  var rayon = 100

  cats.map(cat => {

    // Ajout de close s'il n'y a q'une seule catégorie
    var pos_x = cats.length > 1 ? 0 + rayon * Math.cos(angle) - 35 : 0   
    var pos_y = 0 + rayon / 1.5 * Math.sin(angle)
    angle += angle_unit

    var cat_notices = notices.filter(notice => { return  notice["Type d'objet"] == cat})

    let button_cat = document.createElement("button")
    button_cat.setAttribute("class", `cat_button ${normalize_string(cat).replace("'", "_")}`)
    button_cat.setAttribute("style", `transform: translate(${pos_x}px, ${pos_y}px); transform-origin: 50% 50%;`)
    button_cat.setAttribute("title", "Voir une sélection des éléments")

    $(button_cat).on("click", function(e){
      createCartel(e, cat_notices)
      //$(".popup-container")[0].setAttribute("style","pointer-events: all;")
    })
  
    let item_number = document.createElement("p")
    item_number.innerHTML = cat_notices.length
    button_cat.appendChild(item_number)
    
    container.appendChild(button_cat)
  })

  var city_container = document.createElement("div")
  city_container.setAttribute("class", "city-center")
  city_container.setAttribute("style", `transform: translate(-54px, -9px); `)
  city_container.setAttribute("title", "Voir une sélection des éléments")


  var name_element = document.createElement("p")
  name_element.textContent = notices[0].Ville == "" ? `Sans localisation` : notices[0].Ville
  city_container.appendChild(name_element)

  var total_number = document.createElement("p")
  total_number.textContent = notices.length + " Objet(s)"
  city_container.appendChild(total_number)
  $(city_container).on("click", function(e){
    createCartel(e, notices)  
    //$(".popup-container")[0].setAttribute("style","pointer-events: all;")
  })

  container.appendChild(city_container)

  return container

}

const getNoticeData = layer => {
  // Get french name of continent
  let continent_fr = Object.keys(window.continent_infos).filter(key => {
    return window.continent_infos[key].name_en == layer.feature.properties.CONTINENT
  })[0]

  // Get notices data for country by cities
  var continent = window["c_data"].continents[continent_fr] 
  return continent.notices[layer.layerID].cities
}

const randomizeCoord = (country_center, superficie) => {
  var fraction = 0.1
  var degFactor = 0.555
  var section = Math.sqrt(superficie / Math.PI) * fraction
  var amplitude = section / degFactor * fraction
  return [
    parseFloat(country_center[0]) + amplitude * (Math.random() * 2 - 1) / 4,
    enableAnteMeridian(parseFloat(country_center[1])) + amplitude * (Math.random() * 2 - 1) / 4
  ]
}
const getNeighbor = country => {

  if (country.feature.properties.borders_iso_a2 === null) { return }
  var iso_borders_iso_a2 = country.feature.properties.borders_iso_a2.split(",")
  var neighbor_obj = {}

  iso_borders_iso_a2.map( neighbor => {
    window["topojson_data"].map(country => { 
      if (country.ISO_A2_EH != neighbor) { return }

      // Get french name of continent
      let continent_fr = Object.keys(window.continent_infos).filter(key => {
          return window.continent_infos[key].name_en == country.CONTINENT
      })

      try{
        // Check if there's some notice
        if (typeof window.c_data.continents[continent_fr[0]].notices[country.ISO_A2_EH] == 'undefined') { return }

        neighbor_obj[country.ISO_A2_EH] = window.c_data.continents[continent_fr[0]].notices[country.ISO_A2_EH]
        neighbor_obj[country.ISO_A2_EH]["LABEL_X"] = country.LABEL_X
        neighbor_obj[country.ISO_A2_EH]["LABEL_Y"] = country.LABEL_Y
        neighbor_obj[country.ISO_A2_EH]["NAME_FR"] = country.NAME_FR
        neighbor_obj[country.ISO_A2_EH]["name_native"] = country.name_native
      }
      catch (e) {}
    
    })
  })
  return neighbor_obj
}

const style = features => {
  return {
      fillColor: "#001B3B",
      opacity: 0,
      fillOpacity: 0,
      className: `${normalize_string(features.properties.CONTINENT)} ${normalize_string(features.properties.ISO_A2_EH)}`,
  }
}
const resetMarkers = () => {
    for (var layer in window.country_markers._layers){
      window.country_markers.removeLayer(layer)
    }
}
const resetclusters = () => {

  if (window.clusters_cities_cluster != undefined) {
    map.removeLayer(window.clusters_cities_cluster)
  }

  if (window.solo_city_cluster != undefined) {
    window.solo_city_cluster.map(marker => {
      map.removeLayer(marker)
    })  
  }

  if (window.countries_cluster != undefined) {
    window.countries_cluster.map(cluster=> {
      if (map.hasLayer(cluster)){ map.removeLayer(cluster) }
    })
  }

  if (window.clusters_cities_markers != undefined) { 
    map.removeLayer(window.clusters_cities_markers)
  }

  if (window.unknown_marker != undefined) { 
    map.removeLayer(window.unknown_marker)
  }

}

/* CARTELS */

const createCartel = (e, notices) => {

  // Randomize and take max 10 notices primary incontournables
  var item_to_show = 10
  var incontournables = notices.filter(notice => { return notice["Incontournable"] != ""})
  var rand_notices = shuffleArray(notices).filter(notice => { return notice["Incontournable"] == ""})

  if ( incontournables.length < item_to_show ){
      let manquant = item_to_show - incontournables.length
      rand_notices =  rand_notices.slice(0, manquant)
      rand_notices.map(notice => { incontournables.push(notice)})
  } 
  
  var parent = $(e.target).parent(".popup-container")[0] || $(e.target).parent().parent(".popup-container")[0] || e

  // Remove existing cartel
  if($("#cartel-container").length){ $("#cartel-container").remove() }

  // Create cartel
  var cartel_slider = document.createElement("div")
  cartel_slider.setAttribute("id", "cartel-container")
  cartel_slider.setAttribute("class", "single-item")

  incontournables.map(notice => {
      let container = document.createElement("div")
      container.setAttribute("class", "notice-slide")

      let image_section = document.createElement("div")
      image_section.setAttribute("class", `crop-image ${normalize_string(notice["Type d'objet"]).replace("'", "_")}` )

      var src = `/ui/plug-in/integration/carte-instrument-musee/img/nobg-${normalize_string(notice["Type d'objet"]).replace("'", "_")}.svg`
      
      if(notice["URL Photographie"].length){
          let blurry_img = document.createElement("img")
              blurry_img.setAttribute("class", "blur")
              blurry_img.setAttribute("src", notice["URL Photographie"])
              blurry_img.setAttribute("alt", notice["Titre"])
              image_section.appendChild(blurry_img)

          src = notice["URL Photographie"]

      }
      let img = document.createElement("img")
      img.setAttribute("src", src)
      img.setAttribute("alt", notice["Titre"])
      image_section.appendChild(img)

      if (notice.Incontournable != ""){
          let bandeau_incontournable = document.createElement("p")
          bandeau_incontournable.setAttribute("class", "incontournable")
          bandeau_incontournable.textContent = "Incontournable"
          image_section.appendChild(bandeau_incontournable)
      }

      container.appendChild(image_section)

      let text_section  = document.createElement("div")
          text_section.setAttribute("class", "cartel-textes")

      let title_section = document.createElement("div")
          title_section.setAttribute("class", "title-container")
          text_section.appendChild(title_section)

      let type_icon = document.createElement("img")
          type_icon.setAttribute("class", "type-icon")
          type_icon.setAttribute("src", `/ui/plug-in/integration/carte-instrument-musee/img/${normalize_string(notice["Type d'objet"]).replace("'", "_")}.svg`)
          type_icon.setAttribute("alt", notice["Type d'objet"])
          title_section.appendChild(type_icon)

      let title = document.createElement("h3")
          title.setAttribute("class", "notice-title")
          title.textContent = notice["Titre"].length > 30 ? notice["Titre"].substring(0, 30) + "..." : notice["Titre"]
          title_section.appendChild(title)

      let details_section = document.createElement("div")
          text_section.appendChild(details_section)

      let hierarchy = document.createElement("div")
          hierarchy.setAttribute("class", "notice-hierarchy")

      let hierarchy_content = [notice["Instrument niveau 1"], notice["Instrument niveau 2"], notice["Instrument niveau 3"]]
      hierarchy_content.map(term => {
          if (term == "") {return}
          let button = document.createElement("button")
          button.setAttribute("class", "text-btn")
          button.setAttribute("type", "button")
          button.setAttribute("data-search", normalize_string(term).replace("'", "_"))
          button.textContent = term
          $(button).click(function(){
              document.getElementById("seeker").value = `"${term}"`
              $("#search").click()
          })
          hierarchy.appendChild(button)
          
      })
      details_section.appendChild(hierarchy)


      let date = document.createElement("h4")
          date.setAttribute("class", "notice-date")
          date.textContent = "" // ATT data
          details_section.appendChild(date)

      let author = document.createElement("h3")
          author.setAttribute("class", "author")
          author.textContent = notice["Facteur ou auteur"]
          text_section.appendChild(author)

      if (notice["Collection d'origine"]){

          let collection = document.createElement("p")
          collection.setAttribute("class", "collection")
          collection.textContent = "Collection d'origine : "

          let button = document.createElement("button")
          button.setAttribute("class", "text-btn")
          button.setAttribute("type", "button")
          button.setAttribute("data-search", normalize_string(notice["Collection d'origine"]).replace("'", "_"))
          button.textContent = notice["Collection d'origine"]
          collection.appendChild(button)
          text_section.appendChild(collection)
      }


      /* Conteneur des boutons de liens et d'écoute */
      var link_container = document.createElement("div")
      text_section.appendChild(link_container)

      /* Construction de l'url de la recherche par catégorie (tout voir) */
      let category = window["object_type"].filter(type => { return notice["Type d'objet"] == type.label})
      if (category.length){

          let facet = `FacetFilter:'{"_201":"${category[0].name_system}"}`
          let city = notice.Ville

          /* 14/09/2023 la query ne fonctionne plus */
          //let query_category_link = `https://collectionsdumusee.philharmoniedeparis.fr/search.aspx?SC=MUSEE&QUERY=${city}#/Search/(query:(${facet}',ForceSearch:!t,InitialSearch:!f,Page:0,PageRange:3,QueryString:${city},ResultSize:50,ScenarioCode:MUSEE,ScenarioDisplayMode:display-mosaic,SearchGridFieldsShownOnResultsDTO:!(),SearchLabel:'',SearchTerms:${city},SortField:!n,SortOrder:0,TemplateParams:(Scenario:'',Scope:MUSEE,Size:!n,Source:'',Support:'',UseCompact:!f),UseSpellChecking:!n),sst:4)`

          /* 14/09/2023 test nouvelle query */
          let query_category_link = `https://collectionsdumusee.philharmoniedeparis.fr/search.aspx?SC=MUSEE&QUERY=+${category[0].name_system}+${city}`

          let category_search_link = document.createElement("a")
                  category_search_link.setAttribute("class", "btn btn-default btn-link")
                  category_search_link.setAttribute("href", query_category_link)
                  category_search_link.setAttribute("alt", "Voir le résultat de recherche (nouvel onglet)")
                  category_search_link.setAttribute("target", "_blank")
                  category_search_link.textContent = "Tout voir"
                  link_container.appendChild(category_search_link)
      }

      // Construction de l'url de la notice à partir du nom et du numéro de notice (formaté avec leading 0)
      let regex =  /^(.*?) \/ /
      let titre_sans_inventaire = normalize_string(notice["Titre"].match(regex)[1]).replace(/_/gm, "-").replace(/,|"/gm, "")
      let notice_number = notice["Numéro de notice"].toString().padStart(7, '0')
      if (titre_sans_inventaire && titre_sans_inventaire.length > 1) {

          let query_notice_url = `https://collectionsdumusee.philharmoniedeparis.fr/collectionsdumusee/doc/MUSEE/${notice_number}/${titre_sans_inventaire}`

          let notice_link = document.createElement("a")
              notice_link.setAttribute("class", "btn btn-default btn-link")
              notice_link.setAttribute("href", query_notice_url)
              notice_link.setAttribute("alt", "Aller sur la page de la notice (nouvel onglet)")
              notice_link.setAttribute("target", "_blank")
              notice_link.textContent = "Voir la notice"
              link_container.appendChild(notice_link)
      }

      if (notice["URL Enregistrement"]){

          let norm_title = normalize_string(notice["Titre"]).replace("'", "_").replace(/"|\/|\.|\(|\)/gm, "")
          let audio_button = document.createElement("div")
          audio_button.setAttribute("class","htmlAudioButton")
          audio_button.setAttribute("id", `audio${norm_title}`)
          link_container.appendChild(audio_button)
          
          createAudioButton(notice["URL Enregistrement"], "extrait audio", audio_button)
      }  
      container.appendChild(text_section)

      cartel_slider.appendChild(container)    
  })
  parent.appendChild(cartel_slider)

  if($("#close-slider").length) { $("#close-slider").toggle() }

  $('.single-item').slick({
      arrowsPlacement: 'beforeSlides',
      prevArrow: '<button type="button" class="custom-prev-button widget" id="prevButton"><img src="/ui/plug-in/integration/carte-instrument-musee/img/chevron.svg" alt="Instrument précédente" class="chevron-left" aria-hidden="true"/><span class="sr-only">Entrée précédente</span></button>',
      nextArrow: '<button type="button" class="custom-next-button widget" id="nextButton"><img src="/ui/plug-in/integration/carte-instrument-musee/img/chevron.svg" alt="Instrument suivante" class="chevron-right" aria-hidden="true"/><span class="sr-only">Entrée suivante</span></button>',
  
  });

  createCloseButton()

  // Ajout comportement fermeture lors de l'appuie sur la touche esc
  onkeyup = e => {
    if (e.keyCode == 27){
      $("#close-slider").click()
    }
  };



}
const createCloseButton = () => {
  if($("#close-slider").length) { return }

  let button = document.createElement("button")
  button.setAttribute("id", "close-slider")
  button.setAttribute("type", "button")
  button.setAttribute("aria-label", "Fermer le diaporama")
  button.textContent = "X"
  button.setAttribute("title", "Fermer le slider")
  $(button).on("click", function(e) {
      $('.single-item').remove()
      $("#close-slider").toggle()
      //$(".popup-container")[0].setAttribute("style","pointer-events: none;")
  })

  $(".popup-container")[0].appendChild(button)
}
const shuffleArray = array => {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
  return array
}

/* Button audio creation */
const createAudioButton = (audioSource, text, player_element) => {
  let idPlayer = $(player_element).attr("id")
  let container = document.createElement('div')
  container.setAttribute("class", "audio-player")

  let button = document.createElement('button')
  button.setAttribute('class', `play-pause${idPlayer} btn btn-default`)
  button.textContent = "extrait audio"

  let audio = document.createElement('audio')
  audio.setAttribute('id', `player-${idPlayer}`)
  audio.setAttribute('preload', 'auto')

  let source = document.createElement('source')
  source.setAttribute('src', audioSource)
  source.setAttribute('type', 'audio/mp3')

  audio.appendChild(source)
  container.appendChild(button)
  container.appendChild(audio)
  player_element.appendChild(container)

  audioPlay(button)
}

/* Player audio control and features */
/* To launch : call  audioPlay(idPlayer) */
const audioPlay = (playBtn) => {
  $(playBtn).click(function() {
      var player = $(this).next('audio')[0]
      if (player.paused === false) {

          player.pause();
          //$(this).addClass('isPlaying')
          $(this)[0].classList.remove('isPlaying')

          this.textContent = "extrait audio"

      } else {
          Array.from($('audio')).forEach(p => {
              $(p).prev('button')[0].classList.remove('isPlaying')
              $(p).prev('button').text("extrait audio")
              p.pause()
          })

          player.play();
          this.textContent = "Arrêter l'écoute"
          $(this).addClass('isPlaying')
          player.addEventListener('timeupdate', (event) => {
              progressBar(this, player);

          })
      }
  })

}

/* Compute play time into css gradient to make a progress bar */
const progressBar = (elt, player) => {
  var colors = ["rgba(196,239,255,1)", "rgba(179,214,253,1)"]
  var currentTime = player.currentTime
  var totalTime = player.duration
  var progressWidth = currentTime * 100 / totalTime
  elt.style.background = `linear-gradient(90deg, ${colors[0]} 0%, ${colors[0]} ${progressWidth}%, ${colors[1]} ${progressWidth}%, ${colors[1]} 100%)`

}

/* FILTERS */


const populatefilters = data => {

  populateObjectTypes(data)
  displayResultNumber(data)

}

const filtersActions = () => {

/* ********************************************************************************************** */
/* Fonctionnement : */ 
/* Les marqueurs et décomptes sont déclenchés par la fonction createContinentMarkers.  */
/* Lui passer une valuer modifiée de c_data permet de mettre à jour les informations sur la carte. */
/* populateFilters met à jour les informations sur les filtres. */
/* ********************************************************************************************** */

/* Générer un set reccord et un set norm, switch set on checkbox */
/* Générer un objet avec méthodes pour épurer code variables globales */
  window["saved_initial_data"] = window.c_data
  window["current_select_data"] = window.c_data
  window["type_data"] = window.c_data
  window["record_data"] = window.c_data

  // Create first display of localisation
  populateLocalisation(window.c_data)

  /* Filter by recorded instruments */
  $("#with-records").change(e => {

      window.continents_popups.forEach(popup => { map.removeLayer(popup) })

      if (e.target.checked){ 
          
          let filtered_data = window.type_data.raw_data.filter(notice => { return notice["URL Enregistrement"] != ""})

          let processed_filtered_data = createDataObject(filtered_data)

          window.c_data = processed_filtered_data // update markers
          window.record_data = processed_filtered_data // record data

          populatefilters(processed_filtered_data)
          createContinentMarkers(processed_filtered_data)
          populateLocalisation(processed_filtered_data)
      }
      else{

          window.c_data = window.current_select_data
          window.record_data = window.current_select_data
          populatefilters(window.c_data)
          createContinentMarkers(window.c_data)
          populateLocalisation(window.c_data)
      }
      
  })

  /* Filter by Type */
  $("#types-filter").change(e => {

      /* Si clic sur catégories et click reccorded,  grisé se met à jour + all cat ne se met pas a jour*/
      window.continents_popups.forEach(popup => { map.removeLayer(popup) })

      let selected_type = document.querySelector('input[name="types"]:checked').value

      if (selected_type == "all"){
          var processed_filtered_data = window.record_data
          populateLocalisation(processed_filtered_data)
      }
      else{
          
          let filtered_data = window.record_data.raw_data.filter(notice => { 
              return normalize_string(notice["Type d'objet"]).replace(/'/gm, "_") == selected_type
          })

          let notices_to_check = filtered_data.concat(window.record_data.raw_data)
          let notices_to_keep = notices_to_check.filter((a, i, aa) => aa.indexOf(a) === i && aa.lastIndexOf(a) !== i)


          var processed_filtered_data = createDataObject(notices_to_keep)

          window.type_data = processed_filtered_data
      }


      //window.prev_filter_data = filtered_data
      
      window.c_data = processed_filtered_data
      createContinentMarkers(processed_filtered_data)
      populateLocalisation(processed_filtered_data)
      map.setView(window.initial_view.latlng, window.initial_view.zoom);

  })

  /* Filter Localisation */
  window.selectizeItem.on('change', function() {

      /* Fonctionne à la première impression de l'écran, mais plus après utilisation de filtres (destroy and create problem ?) */

      var value = selectizeItem[0].selectize.getValue();

      // if value is a country
      if (value.length == 2){
          window["countries_layers"].map(obj => {
              Object.keys(obj._layers).filter(key => {
                  if (( obj._layers[key].layerID != value) || (obj._layers[key].layerID == undefined)) { return }
                  obj._layers[key].fire("click")
              })
          })
      }

      // else value is a continent
      else{
          let continent_infos = Object.keys(window.continent_infos).map(key => { 
              let norm_continent = normalize_string(window.continent_infos[key].norm_name)
              let norm_value =  normalize_string(value).replace(/^0/, "")
              if (norm_continent == norm_value) {
                  return window.continent_infos[key]
              }
          }).filter( Boolean )[0]
          if (! continent_infos) { return }
          window.continents_popups.map(popup => { 
              let continent = popup._content.attributes["data-continent"].value
              if (normalize_string(continent) == normalize_string(continent_infos.name_en)){
                  map.setView(window.initial_view.latlng, window.initial_view.zoom);
              }
          })
      }
  });
  /* Search Plain text */
  searchBox()

  /* Reset Filters */
  $("#reset-button").on("click", e => {

      // Reset data
      window.c_data = window.saved_initial_data
      window.type_data = window.c_data
      window.record_data = window.c_data

      // Reset recorded
      $("#with-records").prop( "checked", false )

      // Reset Location
      window.selectizeItem[0].selectize.clear();

      // Reset Types
      $("#all-types").prop( "checked", true )

      // Reset Filters Values and map markers
      populatefilters(window.c_data)
      createContinentMarkers(window.c_data)
      map.setView(window.initial_view.latlng, window.initial_view.zoom);
  })

  /* Access button */
  $("#access-button").on("click", e => {

    /* Mise en attente d'une v2 (problématique du nombre de colonnes du tableau + formatage des données pour leurs affichage */
    //accessTable(window.c_data)

    let search = document.getElementById("seeker").value
    let terms = (search.length > 0 || search == undefined) ? `+${search}` : ""

    let cat = $("#types-filter input[checked=true]").val() || ""
    let type = cat != "" ? `+${window.object_type.filter(type => { return type.type == cat})[0].name_system}` : ""

    let country_code = $("#loc-select")[0].selectize.items[0]
    let localisation = country_code != undefined ? `+${window.c_data.convert_iso_name[country_code]}` : ""

    let query_category_link = `https://collectionsdumusee.philharmoniedeparis.fr/search.aspx?SC=MUSEE&QUERY=${terms + type + localisation}`

    window.open(query_category_link, "_blank");

  })

}

const displayResultNumber = data => {
  var count = 0
  Object.keys(data.continents).map(continent => { count += data.continents[continent].count })
  document.getElementById("nb-items").textContent = `${count} Object(s)`
}

const populateLocalisation = data => {
  var array_continent = createSelectizeDOM(data)
  window.selectizeItem[0].selectize.clearOptions();
  window.selectizeItem[0].selectize.addOption(array_continent);
}

const createOptionsLocalisation = data => {
  var array_continent = createSelectizeDOM(data)
  window.selectizeItem = $("#loc-select").selectize({
      maxItems: 1,
      valueField: 'id',
      labelField: 'name_fr',
      searchField: ["name_fr", "name_native"],
      options: array_continent.flat(),
      create: false,
      render: {
          item: (item, escape) => { return (selectizeOptionDOM(item, escape))},
          option: (item, escape) =>{ return (selectizeOptionDOM(item, escape))},
      },
  });
}
const createSelectizeDOM = data => {
  var array_continent = []
  Object.keys(data.continents).map(continent => {
      var array_options = []
      // Add leading 0 as marker for bold optgroup
      if (continent == "unknown") { return }
      
      let key_value = `0${continent}`
      let option = {
          "id" : normalize_string(key_value),
          "name_fr" : key_value,
          "count": data.continents[continent].count
      }
      array_options.push(option)

      Object.keys(data.continents[continent].notices).map(country_code => {

          if (country_code == ""){ return }

          var detail_country = window["topojson_data"].filter(item => { return item.ISO_A2_EH == country_code })[0]
          let option = {
              "id" : country_code == "" ? `${continent}-99` : country_code,
              "name_fr" : detail_country.NAME_FR,
              "name_native" : detail_country.name_native,
              "count" : data.continents[continent].notices[country_code].count,
          }
          array_options.push(option)

      })
      array_options = array_options.sort((a, b) => { return (a.name_fr < b.name_fr) ? -1 : (a.name_fr > b.name_fr) ? 1 : 0 });
      array_continent.push(array_options)

  })
  return array_continent
}

const selectizeOptionDOM = (item, escape) => {
  let html = `<div class="option">
                  <span class="name_fr">${item.name_fr ? item.name_fr[0] == "0" ? "<b>" + escape(item.name_fr).replace(/^0|^_/, "") + "</b>" : escape(item.name_fr).replace(/^0|^_/, "") : " "}</span>
                  <span class="name_native">${item.name_native ? "<i>(" + escape(item.name_native) + ")</i>" : " "}</span>
                  <span class="count">${item.count ? escape(item.count) : ""}</span>
              </div>`
  return html
}

const populateObjectTypes = data => {
  var types = window["object_type"]
  var parent = document.getElementById("types-filter")

  $(`#types-filter .radio`).remove();

  types.map(type => {
      if (type.name == "all") { 
          let radio_container = document.createElement("div")
          radio_container.setAttribute("class", "radio checked all-types")

          let label = document.createElement("label")
          label.setAttribute("for", "all-types")
          label.textContent = "Toutes les catégories"
          radio_container.appendChild(label)

          let input = document.createElement("input")
          input.setAttribute("type", "radio")
          input.setAttribute("class", "radio checked")
          input.setAttribute("name", "types")
          input.setAttribute("id", "all-types")
          input.setAttribute("value", "all")
          input.setAttribute("checked", "")
          radio_container.appendChild(input)
          parent.appendChild(radio_container)
          
          return 
      }
      /* TODO : Fait le ménage !!! */

      let container = document.createElement("div")
      container.setAttribute("class", `radio ${type.type}`)

      let radio_container = document.createElement("div")
      
      let icon = document.createElement("img")
      icon.setAttribute("class", "type-icon")
      icon.setAttribute("src", `/ui/plug-in/integration/carte-instrument-musee/${type.icon}`) 
      
      icon.setAttribute("alt", "")
      radio_container.appendChild(icon)


      let label = document.createElement("label")
      label.setAttribute("for", type.type)
      label.textContent = type.label
      radio_container.appendChild(label)

      let input = document.createElement("input")
      input.setAttribute("type", "radio")
      input.setAttribute("class", "radio")
      input.setAttribute("name", "types")
      input.setAttribute("id", type.type)
      input.setAttribute("value", type.type)
      radio_container.appendChild(input)

      let is_disables = data.count_by_type[type.label] == 0 ? true : false
      if(is_disables) {
          input.disabled = true
          $(container).addClass("disabled")
          icon.setAttribute("src", `/ui/plug-in/integration/carte-instrument-musee/${type.disabled_icon}`)
      }
      else {
          input.disabled = false
          $(container).removeClass("disabled")
      }

      container.appendChild(radio_container)

      let count = document.createElement("p")
      count.setAttribute("class", "type-count")
      count.textContent = data.count_by_type[type.label]
      container.appendChild(count)

      parent.appendChild(container)
  })

  var radio_buttons = $("#types-filter > div")
  radio_buttons.on("click", function(e) {
      radio_buttons.map(index => { 
          radio_buttons[index].removeAttribute("checked") 
          radio_buttons[index].classList.remove("checked") 
          radio_buttons[index].removeAttribute("style")
      })

      e.target.setAttribute("checked", "true")

      $(this).addClass("checked")
      let current_type = window.object_type.filter(type => { return type.type == e.target.value})[0]

      if (current_type == undefined) { return }
      this.setAttribute("style", `background-color: ${current_type.color}`)
      
  })
}

const searchBox = () => {

  /* SEEKER FUNCTION */
  if (!RegExp.escape) {
      RegExp.escape = function(s) {
          return s.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&")
      }
  }

  $('.search-bar').submit(function(e) { e.preventDefault() })
  $('#search').click(function(e) {

      var filterQuery = filterSearch()
      var processed_filtered_data = createDataObject(filterQuery.filtered)

      // Set filtered data for other filters
      window.c_data = processed_filtered_data
      window.current_select_data = processed_filtered_data
      window.type_data = processed_filtered_data
      window.record_data = processed_filtered_data

      // Unset recorded instrument
      document.getElementById("with-records").checked = false;

      populatefilters(processed_filtered_data)
      createContinentMarkers(processed_filtered_data)
      map.setView(window.initial_view.latlng, window.initial_view.zoom);


  })

}
const filterSearch = () => {
  const data = window.saved_initial_data.raw_data
  var searchTerms = document.getElementById("seeker").value.replace(/\s$/gmi, "")

  // Traitement de la recherche avec prise en charge de la recherche exacte ("lorem")
  let queryReg = []
  var regexQuote = new RegExp(/\"(.*?)\"/, 'gm')

  if (regexQuote.test(searchTerms)) {
      queryReg = searchTerms.match(regexQuote).map(q => q.replace(/\"/gm, ''))

  } else {
      searchTerms.toLowerCase().split(' ').map(q => queryReg.push(`(?=.*${q})`))
  }

  var filtered = []

  /* Data filter method */
  var filtered = []

  const filterIt = (arr, query) => {
      return arr.filter(obj => Object.keys(obj).some(key => {
          return new RegExp(query, "mgi").test(obj[key])
      }))
  }
  queryReg.map(query => { 
      filtered.push(filterIt(data, query)) 
  })

  // Prise en charge de la recherche avec mots multiples dans tous les champs de data
  if (queryReg.length > 1) {
      const findDuplicates = arr => arr.filter((item, index) => arr.indexOf(item) !== index)
      filtered = findDuplicates(filtered.flat())
  }
  return { "filtered": filtered.flat(), "query": queryReg }
}

/* Tableau accessible Mise en attente sur une V2 */

/* const accessTable = data => {
  console.log(data)

  // Create modal
  if ($("#access-modal").length) {
      $("#access-modal").show()
      return
  }
  var modal = document.createElement("section")
  modal.setAttribute("id", "access-modal")

  var closeButton = document.createElement("button")
  closeButton.setAttribute("class", "btn btn-default close")
  closeButton.textContent = "Fermer le tableau"
  $(closeButton).click(e => {
      $("#access-modal").remove()
  })
  modal.appendChild(closeButton)

  var container = document.createElement("section")
  let title = document.createElement("h3")
  title.textContent =  "Liste des collections du musée"
  Object.keys(data.continents).map(continent => {

    Object.keys(data.continents[continent].notices).map(country_code => {

      if  (country_code == "") { country_code = "Sans Localisation"}
      let country_name = window.c_data.convert_iso_name[country_code] || country_code

      var table = document.createElement("table")
      var caption = document.createElement("caption")
      caption.textContent = `${continent} | ${country_name}`
    
      table.appendChild(caption)
      container.appendChild(table)

      //Add a header
      var header = document.createElement("thead")

      var typeHeader = document.createElement("th")
      typeHeader.setAttribute("scope", "col")
      typeHeader.textContent = "Type d'établissement"

      var nomHeader = document.createElement("th")
      nomHeader.setAttribute("scope", "col")
      nomHeader.textContent = "Nom"

      var adressHeader = document.createElement("th")
      adressHeader.setAttribute("scope", "col")
      adressHeader.textContent = "Adresse"

      var telHeader = document.createElement("th")
      telHeader.setAttribute("scope", "col")
      telHeader.textContent = "Téléphone"

      var mailHeader = document.createElement("th")
      mailHeader.setAttribute("scope", "col")
      mailHeader.textContent = "Mail"

      var webHeader = document.createElement("th")
      webHeader.setAttribute("scope", "col")
      webHeader.textContent = "Site internet"

      header.appendChild(typeHeader)
      header.appendChild(nomHeader)
      header.appendChild(adressHeader)
      header.appendChild(telHeader)
      header.appendChild(mailHeader)
      header.appendChild(webHeader)

      table.appendChild(header)

    })
  })
  modal.appendChild(container)

  //Add a header
  var header = document.createElement("thead")

  var typeHeader = document.createElement("th")
  typeHeader.setAttribute("scope", "col")
  typeHeader.textContent = "Type d'établissement"

  var nomHeader = document.createElement("th")
  nomHeader.setAttribute("scope", "col")
  nomHeader.textContent = "Nom"

  var adressHeader = document.createElement("th")
  adressHeader.setAttribute("scope", "col")
  adressHeader.textContent = "Adresse"

  var telHeader = document.createElement("th")
  telHeader.setAttribute("scope", "col")
  telHeader.textContent = "Téléphone"

  var mailHeader = document.createElement("th")
  mailHeader.setAttribute("scope", "col")
  mailHeader.textContent = "Mail"

  var webHeader = document.createElement("th")
  webHeader.setAttribute("scope", "col")
  webHeader.textContent = "Site internet"

  header.appendChild(typeHeader)
  header.appendChild(nomHeader)
  header.appendChild(adressHeader)
  header.appendChild(telHeader)
  header.appendChild(mailHeader)
  header.appendChild(webHeader)

  table.appendChild(header)

  //Add a body

  document.getElementById("mapMusee").appendChild(modal)

  var body = document.createElement("tbody")
  data.sort((a, b) => (a.type_equipement_ou_lieu > b.type_equipement_ou_lieu) ? 1 : ((b.type_equipement_ou_lieu > a.type_equipement_ou_lieu) ? -1 : 0))

  data.map(item => {

      var type = document.createElement("tr")
      type.setAttribute("scope", "row")

      var typeItem = document.createElement("td")
      typeItem.textContent = item.type_equipement_ou_lieu
      type.appendChild(typeItem)

      var nom = document.createElement("td")
      nom.textContent = item.nom
      type.appendChild(nom)

      var adress = document.createElement("td")
      adress.textContent = item.adresse_postale
      type.appendChild(adress)

      var tel = document.createElement("td")
      tel.textContent = item.telephone
      type.appendChild(tel)

      var mail = document.createElement("td")
      mail.textContent = item.email
      type.appendChild(mail)

      var web = document.createElement("td")
      var webButton = document.createElement("a")
      webButton.setAttribute("class", "btn btn-default")
      webButton.setAttribute("alt", "Nouvel onglet")
      webButton.setAttribute("href", item.lien)
      webButton.setAttribute("target", "_blank")
      webButton.textContent = "Aller sur le site"

      web.appendChild(webButton)
      type.appendChild(web)

      body.appendChild(type)

  })

  //table.appendChild(body)
  modal.appendChild(table)

} */