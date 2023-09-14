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
      //map.closePopup(e.currentTarget._leaflet_id)


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
      // Check if there's instruments in country
      if(!window["c_data"].pays.includes(layer.layerID)){ return }

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

    // Check if there's instruments in country
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
  var unknown_markers = L.markerClusterGroup({
    showCoverageOnHover: false,
    iconCreateFunction: function(cluster) {
      return L.divIcon(cluster_icon(cluster))
    }
  });

  var unknownObjectsCount = 0; // Compteur pour le nombre total d'objets pour les localisations inconnues
  var unknownCitiesNames = []; // Tableau pour stocker les noms des localisations inconnues

  Object.keys(cities).map(key => {

    if (cities[key].notices == undefined) { return; }

    let is_known = cities[key].notices[0]["Coordonnées"].split(",") != '' ? true : false;

    if (!is_known) {
      unknownObjectsCount += cities[key].count; // Ajoute le nombre d'objets pour cette localisation inconnue au compteur total
      unknownCitiesNames.push(key); // Ajoute le nom de la localisation inconnue au tableau des noms
    } else {
      // Marqueurs pour les localisations connues (pas de changements par rapport à votre code d'origine)
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
      markers.addLayer(marker);
    }
  });

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

    var marker = L.marker(latlng, { icon: icon, bubblingMouseEvents: true, riseOnHover: true })
      .bindPopup(createMarkerPopup(cities[""].notices)).openPopup();
    marker.setZIndexOffset(-1000)
    marker.on("mouseover", function (e) {
        e.target.setZIndexOffset(10000)
    })
    marker.on("mouseout", function (e) {
        e.target.setZIndexOffset(-10000)
    })
    unknown_markers.addLayer(marker);
  }

  // Ajouter d'abord le groupe de marqueurs inconnus, puis le groupe de marqueurs connus
  map.addLayer(unknown_markers);
  map.addLayer(markers);

  // Sauvegarder la référence du groupe de marqueurs unknown_markers dans la variable globale clusters_cities_markers
  window["clusters_cities_markers"] = unknown_markers;
  window["clusters_cities_cluster"] = [markers];
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

  var cats = [... new Set(notices.map(notice => { return notice["Type d'objet"]}))]
  var angle_unit = 360 / cats.length * Math.PI / 180
  var angle = -90 * Math.PI / 180
  var rayon = 100
  cats.map(cat => {
    var pos_x = 0 + rayon * Math.cos(angle) - 35
    var pos_y = 0 + rayon / 1.5 * Math.sin(angle)
    angle += angle_unit
    var cat_notices = notices.filter(notice => { return  notice["Type d'objet"] == cat})
    let button_cat = document.createElement("button")

    button_cat.setAttribute("class", `cat_button ${normalize_string(cat).replace("'", "_")}`)
    button_cat.setAttribute("style", `transform: translate(${pos_x}px, ${pos_y}px); transform-origin: 50% 50%;`)
    button_cat.setAttribute("title", "Voir une sélection des éléments")

    $(button_cat).on("click", function(e){
      window.utils.createCartel(e, cat_notices)
      $(".popup-container")[0].setAttribute("style","pointer-events: all;")
      //$("#mapMusee .leaflet-popup-close-button").show()
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
    window.utils.createCartel(e, notices)  
    $(".popup-container")[0].setAttribute("style","pointer-events: all;")
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
      className: `${window.utils.normalize_string(features.properties.CONTINENT)} ${window.utils.normalize_string(features.properties.ISO_A2_EH)}`,
  }
}
const resetMarkers = () => {
    for (var layer in window.country_markers._layers){
      window.country_markers.removeLayer(layer)
    }
}
const resetclusters = () => {

  if (typeof window.clusters_cities_cluster != "undefined") {
    window.clusters_cities_cluster.map(cluster=> {
      if (map.hasLayer(cluster)){ map.removeLayer(cluster) }
    })
  }

  if (typeof window.countries_cluster != "undefined") {
    window.countries_cluster.map(cluster=> {
      if (map.hasLayer(cluster)){ map.removeLayer(cluster) }
    })
  }

  if (typeof window.clusters_cities_markers != "undefined") { 
    map.removeLayer(window.clusters_cities_markers)
  }

}

window["utils"] = {
  "calculateCenterGPS" : calculateCenterGPS,
  "normalize_string" : normalize_string,
  "removeDuplicateObject" : removeDuplicateObject,
  "createPopupContinent" : createPopupContinent,
  "onEachTopojson" : onEachTopojson,
  "style" : style,
  "calculateNewLatLng": calculateNewLatLng,
  "resetMarkers": resetMarkers,
  "resetclusters": resetclusters
}