/* Lien github : https://github.com/ChristopheLeonardi/carte-musee-syracuse */

// Chargement des données
var promises = []
function wait_for_data(promises) {
    get_data(promises)
    typeof window["data"] !== "undefined" ? generalMapMusee(window["data"]) : setTimeout(wait_for_data, 250);   
}

function get_data(promises) {
  const controller = new AbortController();
  try {
    if (promises == undefined) { var promises = [] }
    /* Test d'optimisation, charger directement fichier json sortedData */
    // Mettez à jour l'URL du fichier CSV compressé au format gzip
    /* promises.push(
      fetch('/ui/plug-in/integration/carte-instrument-musee/data/data-carte_2023-11-06.csv.gz')
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
          return d3.tsvParse(inflatedData);
          //return d3.csvParse(inflatedData);

        })
    ); */

    // Liste des URL des fichiers JSON gzip
    const jsonUrls = [
      '/ui/plug-in/integration/carte-instrument-musee/data/sortedData.json.gz',
      '/ui/plug-in/integration/carte-instrument-musee/data/amerique.json.gz',
      '/ui/plug-in/integration/carte-instrument-musee/data/reste.json.gz',
      '/ui/plug-in/integration/carte-instrument-musee/data/config.json.gz',
      '/ui/plug-in/integration/carte-instrument-musee/data/countries_codes_and_coordinates.json.gz',
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

    setTimeout(() => controller.abort(), 2000);
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

$(document).ready(function() {
  $(".loader").show()
  wait_for_data(promises);
  $(".loader").hide();
});

/* PROCESS DATA */
/* !!!!! TIMESPENDER !!!!! */
/* WAIT FOR DIRECT EXPORT */
const createDataObject = (instruments_data, continent_infos, data_countries) => {
    const c_data = {
      pays: [],
      continents: {},
      count_by_type: {},
      raw_data: instruments_data,
      convert_iso_name: {},
    };
    // Group instruments_data by Continent
    instruments_data.forEach((item) => {
      const continent = item.Continent || "unknown";
      c_data.continents[continent] = c_data.continents[continent] || {
        count: 0,
        name_en: continent_infos[continent].name_en,
        name: continent,
        latlng: continent_infos[continent].latlng,
        zoom_level: continent_infos[continent].zoom_level,
        liste_pays: [],
        notices: {},
      };
  
      const continentData = c_data.continents[continent];
  
      continentData.count += 1;
      if (!continentData.liste_pays.includes(item["Code ISO-2"])) {
        continentData.liste_pays.push(item["Code ISO-2"]);
      }
      var countryinfos = data_countries.filter(country => {return country["Alpha-2 code"] == item["Code ISO-2"]})
      const countryInfos = countryinfos.length > 0 ? countryinfos[0] : null;
      const countryData = continentData.notices[item["Code ISO-2"]] || {
        count: 0,
        cities: {},
        latlng: countryInfos ? [countryInfos["Latitude (average)"], countryInfos["Longitude (average)"]] : null,
        name_fr: item.Pays
      };
  
      countryData.count += 1;
  
      const cityData =
        countryData.cities[item.Ville] || {
          count: 0,
          notices: [],
        };
  
      cityData.count += 1;
      cityData.notices.push(item);
  
      countryData.cities[item.Ville] = cityData;
      continentData.notices[item["Code ISO-2"]] = countryData;
  
      if (!c_data.pays.includes(item["Code ISO-2"])) {
        c_data.pays.push(item["Code ISO-2"]);
      }
  
      c_data.convert_iso_name[item["Code ISO-2"]] = item["Pays"];
  
      c_data.count_by_type[item["Type d'objet"]] =
        (c_data.count_by_type[item["Type d'objet"]] || 0) + 1;
    });
    return c_data;
};
function download(content, fileName, contentType) {
  var a = document.createElement("a");
  var file = new Blob([content], {type: contentType});
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
}

function generalMapMusee(data){
    console.log(data)

    const continent_infos  = data[3].continents_infos
    const object_type = data[3].object_type
    const data_countries = data[4]

    /* Export sortedData */
    
    /* const instruments_data = data[0]
    const sortedData = createDataObject(instruments_data, continent_infos, data_countries) 
    console.log(sortedData)
    download(JSON.stringify(sortedData), 'sortedData.json', 'text/plain');  */
   

    const sortedData = data[0] 
    window["sortedData"] = data[0] 

    // Création de la carte
    const initialView = { latlng : [20, 155], zoom : 2 }
    window["mapMusee"] = createMap(initialView)
    window["countries_layers"] = []
    window["groups"] = []
    window["markers"] = []
    window["countryMarkers"] = []
    window["unknown_markers"] = {
      "continents": {},
      "countries": {}
    }
    window["continents_popups"] = []
    window["neighbors"] = []
    window["object_type"] = data[3].object_type


    // Création des layers des pays, comportement au hover et clique
    let countries_data = [{ "data" : data[1], "name" : "amerique" },{ "data" : data[2], "name" : "reste" }]
    createCountriesLayers(countries_data)

    // Création des clusters
    window.groups = createCluster(sortedData, data_countries)

    
    // Création des Boutons continents
    createContinentMarkers(sortedData)

    // Comportement des filtres
    handleFilters()

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

const createMap = (initialView) => {
    var map = L.map('mapMusee', { 
        fullscreenControl: true,
        fullscreenControlOptions: {
          position: 'topleft'
        },
        scrollWheelZoom: true, 
        minZoom :  1.5,
        maxZoom: 12,
    }).setView(initialView.latlng, initialView.zoom);
  
    L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    return map
}

const createCountriesLayers = (data) => {
    data.map( dataset => {
        let topo = topojson.feature(dataset.data, dataset.data.objects[dataset.name])
        window.countries_layers.push(L.geoJson(topo, { onEachFeature: onEachTopojson, style: style }).addTo(window.mapMusee))
    })
}

const style = features => {
    return {
        fillColor: "#001B3B",
        opacity: 0,
        fillOpacity: 0,
        className: `${normalize_string(features.properties.CONTINENT)} ${normalize_string(features.properties.ISO_A2_EH)}`,
    }
  }
const onEachTopojson = (features, layer) => {

    // Add id to layer 
    var topojson_data = []
    let props = layer.feature.properties
    layer["has_markers"] = false
    layer.layerID = props.ISO_A2_EH == -99 ? props.ISO_A3 == -99 ? normalize_string(props.NAME_EN) : props.ISO_A2 : props.ISO_A2_EH 
    layer.continent = props.CONTINENT

    topojson_data.push(props)

    if(!window.sortedData.pays.includes(layer.layerID)) { return }
    layer.on({
      click: (e) => {
        displayCountryMarkers(e)
       } 
    })
    layer.on( "mouseover", e => { 
      $(e.target._path).css({ opacity: 0.6, fillOpacity: 0.6 })
    })
  
    layer.on( "mouseout", e => { 
      $(e.target._path).css({ opacity: 0, fillOpacity: 0 })
    })
  }

function createCluster(sortedData, data_countries) {
  var parentGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    iconCreateFunction: function(cluster) {
      return L.divIcon(cluster_icon(cluster))
      },
    chunkedLoading: true,
    chunkInterval: 50, // Temps en ms entre le traitement des lots
    chunkDelay: 10,    // Délai supplémentaire pour maintenir la réactivité
    maxClusterRadius: 50 // Augmenter pour moins de clusters, diminuer pour plus de précision
  })

  var continentGroupObject = {};
  var countryGroupObject = {};

  Object.keys(sortedData.continents).forEach(continent_name => {
    var continentGroup = L.featureGroup.subGroup(parentGroup);
    continentGroupObject[continent_name] = continentGroup;

    var continentNotices = sortedData.continents[continent_name].notices;
    Object.keys(continentNotices).forEach(country_code => {

      createContinentCluster(country_code, continentGroup, countryGroupObject, continent_name, sortedData);

      createCountriesCluster(continentNotices[country_code], country_code, countryGroupObject, data_countries);
    });

  });

  parentGroup.on('clustermouseover', function(event) {
    getHoverCountryCluster(event, 0.6)

  })
  parentGroup.on('clustermouseout', function(event) {
    getHoverCountryCluster(event, 0)

  })

  window.mapMusee.addLayer(parentGroup);

  var overlayMaps = { ...continentGroupObject, ...countryGroupObject };
  L.control.layers(null, overlayMaps).addTo(window.mapMusee);

  return {"continentGroup" : continentGroupObject, "countriesGroup" : countryGroupObject}
}
function getHoverCountryCluster(event, opacity){
  var selected_countries = []
  var markers = event.layer._markers
  if (markers){
    getMarkersIds(markers, selected_countries)
  }

  var childClusters = event.layer.options.icon._childClusters
  if(childClusters){
    childClusters.map(cluster => {
      let markers = cluster._markers
      if (markers){
        getMarkersIds(markers, selected_countries)
      }
    })
  }
  hoverCountryEffect(event, selected_countries, opacity)
}

function getMarkersIds(markers, selected_countries){
  markers.map(marker => { 
    let id = $(marker.options.icon.options.html)
    if (id.attr("id")) { 
      selected_countries.push(id.attr("id").replace("glob-", ""))
    }
  })
}
const cluster_icon = cluster => {
  var count  = 0
  cluster.getAllChildMarkers().map(country => {
    /* let regex = /<[^>]*>(\d+)\s*[^<]*<\/[^>]*>/
    console.log(country)
    let number = country.options.icon.options.html.match(regex) */
    if (country.data.count) { count += country.data.count }
  })

  return { html: `<p class="country-marker">${count}</p>`, className: `continent-marker`}
}

function createContinentCluster(country_code, parentGroup, countryMarkers, continent_name, sortedData){

  // Skip si le marqueur existe déjà
  if (countryMarkers[country_code] && country_code != "") { return }
  var continentNotices = sortedData.continents[continent_name].notices

  var latlng = continentNotices[country_code].latlng
  if (latlng) { 
    var  countryCenter = [continentNotices[country_code].latlng[0], enableAnteMeridian(continentNotices[country_code].latlng[1])]
    var html = `<p class="country-marker" id="glob-${country_code}" data-continent="${continent_name}">${continentNotices[country_code].count}</p>`
    var icon = L.divIcon({ 
      html: html,
      className: `continent-marker`
    })

    var notices = []
    Object.keys(continentNotices[country_code].cities).map(city => { 
      notices.push(continentNotices[country_code].cities[city].notices) 
    })


    var markerData = {
      "notices": notices.flat(), 
      "count": continentNotices[country_code].count, 
      "country_code" : country_code,
      "type" : "country",
      "isDisplayed": true
    }

    var countryMarker = L.marker( countryCenter, {icon: icon})
    countryMarker["data"] = markerData
    
    countryMarker.on('mouseover', function(event) {
      hoverCountryEffect(event, [country_code], 0.6)
    })
  
    countryMarker.on('mouseout', function(event) {
      hoverCountryEffect(event, [country_code], 0)
    })

    countryMarker.on("click", function(e){
      displayCountryMarkers(e)
    })
    window.countryMarkers.push(countryMarker)
    countryMarkers[country_code] = countryMarker; // Stocker le marqueur du pays
    parentGroup.addLayer(countryMarker); // Ajouter le marqueur du pays au groupe parent
  }



  if(country_code == "" || !latlng){
    var latlng = sortedData.continents[continent_name].latlng

    let markerData = continentNotices[country_code].cities[""].notices
    var countryMarker = createUnknownMarker(latlng, continent_name, continentNotices[country_code].count, markerData)
    countryMarker["type"] = "country"
    window.unknown_markers.continents[continent_name] = countryMarker 
  }


}

function createCountriesCluster(country_code_obj, country_code, countryGroupObject){
  if (!country_code_obj.cities) { return }

  // Nouveau cluster pour le pays
  var countryCluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    iconCreateFunction: function(cluster) {
      return L.divIcon(cluster_icon(cluster))
      },
    chunkedLoading: true,
    chunkInterval: 50, // Temps en ms entre le traitement des lots
    chunkDelay: 10,    // Délai supplémentaire pour maintenir la réactivité

  }); 

  // Stocker le cluster de chaque pays
  countryGroupObject[country_code] = countryCluster; 


  Object.keys(country_code_obj.cities).forEach(city => {

    var cityData = country_code_obj.cities[city];
    var markerData = {
      "notices": cityData.notices, 
      "count": cityData.count, 
      "city" : city,
      "type" : "city",
      "known" : true,
      "isDisplayed": true

    }

    // Création marqueur unknown
    if (city == ""){
      var latlng = country_code_obj.latlng;
      var cityMarker = createUnknownMarker(latlng, country_code_obj.name_fr, country_code_obj.cities[city].count, cityData.notices)
      cityMarker.data["type"] = "city"
      window.unknown_markers.countries[country_code] = cityMarker
      window.markers.push(cityMarker) 

    }

    if (cityData.notices[0]["Coordonnées"] != ""){
      let marker = createMarker(city, cityData);
      marker["data"] = markerData

      // Ajouter le marqueur au cluster du pays
      countryCluster.addLayer(marker);
      window.markers.push(marker) 
    }
    
  });
}
function createMarker(city, cityData) {
        let latitude = parseFloat(cityData.notices[0]["Coordonnées"].split(",")[0])
        let longitude =  enableAnteMeridian(parseFloat(cityData.notices[0]["Coordonnées"].split(",")[1]))
        var html = `<div class="city-marker known" data-ville="${normalize_string(city)}">
                    <p>${city}</p><p class="marker-count">${cityData.count} Objet(s)</p>
                  </div>`;

        var icon = L.divIcon({
          html: html,
          className: "city-container"
        });
    
        //let marker = L.marker([latitude, longitude], {icon: icon}).bindPopup(popup, {maxWidth : 340}).openPopup()
        var marker = L.marker([latitude, longitude], { icon: icon, bubblingMouseEvents: true, riseOnHover: true })
          .bindPopup(createMarkerPopup(cityData.notices)).openPopup();
        return marker
}

function createUnknownMarker(latlng, label, count, notices){
  var html = `<div class="country-marker unknown">
                <p class="continent_unknown_country">${label} : </p>
                <p>Sans Localisation</p><p class="marker-count">${count} Objet(s)</p>
              </div>`
  var icon = L.divIcon({ 
    html: html,
    className: `unknown-marker`
  })
  var unknownMarker = L.marker( latlng, {icon: icon, bubblingMouseEvents: true, riseOnHover: true }) 
    .bindPopup(createMarkerPopup(notices)).openPopup();
  var markerData = {
    "notices": notices, 
    "count": count, 
    "city" : label,
    "known" : false,
    "isDisplayed": true

  }
  unknownMarker["data"] = markerData

  return unknownMarker
}
// Correct map origins for america
const enableAnteMeridian = input => {
  let lng = parseFloat(input)
  return lng < -20 ? lng +=360 : lng
}

function createContinentMarkers(sortedData) {
  // Remove old popups
  window.continents_popups.forEach(popup => {
      window.mapMusee.removeLayer(popup)
  })

  Object.keys(sortedData.continents).map(key => {

      var popup = new L.popup({closeButton: false, closeOnClick:false, autoClose:false})
                      .setLatLng(sortedData.continents[key].latlng)
                      .setContent(createPopupContinent(sortedData.continents[key]))
                      .openOn(window.mapMusee)

      popup["continent_name"] = key
      window.mapMusee.addLayer(popup)
      window.continents_popups.push(popup)
  })
}

/* Popup des Continents */
const createPopupContinent = (continent_object) => {

  let popupContent = document.createElement('div')
  popupContent.setAttribute("class", 'continent-popup')
  popupContent.setAttribute("data-continent", continent_object.name)

  let title = document.createElement('h4')
  title.textContent = continent_object.name
  popupContent.appendChild(title)

  let number = document.createElement('p')
  number.textContent = `${continent_object.count} Objets`
  popupContent.appendChild(number)

  $(popupContent).hover( 
    e => { hoverCountryEffect(e, continent_object.liste_pays, 0.6) },
    e => { hoverCountryEffect(e, continent_object.liste_pays, 0) }
  )
  $(popupContent).click( 
    e => {
      var continent_name = $(e.target).attr("data-continent") || $(e.target).parent().attr("data-continent")

      // Ajouter tous les popups de continents 
      window.continents_popups.forEach(popup => {
        window.mapMusee.addLayer(popup)
      })

      // Retirer le popup du continent sélectionné
      window.continents_popups.forEach(popup => {
        if (popup.continent_name != continent_name) { return }
        window.mapMusee.removeLayer(popup)
      })

      // Retirer tous les groupes de continents
      Object.keys(window.groups.continentGroup).map(continent_name => {
        window.mapMusee.removeLayer(window.groups.continentGroup[continent_name])
      })

      // Ajout du continent sélectionné
      window.mapMusee.addLayer(window.groups.continentGroup[continent_name])

      // Retirer tous les marqueurs continent unknown
      Object.keys(window.unknown_markers.continents).forEach(continent => {
        window.mapMusee.removeLayer(window.unknown_markers.continents[continent])
      })

      // Ajout du marqueur unknown du continent
      window.mapMusee.addLayer(window.unknown_markers.continents[continent_name])
      

      // Set view
      window.mapMusee.setView(continent_object.latlng, continent_object.zoom_level)

      // Unhighlight countries
      hoverCountryEffect(e, continent_object.liste_pays, 0)
   
    }

  )
  return popupContent
}
const hoverCountryEffect = (e, countries_to_display, opacity) => {

  // Get name depending on DOM element
  var continent_name = $(e.target).attr("data-continent") || $(e.target).parent().attr("data-continent")

  var normalize_continent_name = continent_name ? normalize_string(continent_name) : ""
  let svg_countries = []

  // Comportement pour survol des cluster
  if (e.layerID){
    var path = `path.${e.layerID.toLowerCase()}`
    if($(path).length == 0 ) { return }
    
    var element = document.getElementById("mapMusee").getElementsByClassName(e.layerID.toLowerCase())
    svg_countries.push(Array.from(element))
  }

  // Comportement au survol des boutons continents
  else{
    countries_to_display.map(country_code => {
      if (country_code == "") { return }
      var element = document.getElementById("mapMusee").getElementsByClassName(`${normalize_continent_name.toLowerCase()} ${country_code.toLowerCase()}`)
      svg_countries.push(Array.from(element))
    })

  }
  svg_countries = svg_countries.flat()
  svg_countries.map(elt=> { 
    $(elt).css({"opacity" : opacity, "fill-opacity" : opacity, "transition": "0.2s ease-in-out opacity"}) 
  })
}

function displayCountryMarkers(e){
  var selectedCountry = e.target.layerID || e.target._icon.firstChild.id.replace("glob-", "")

  // Retirer tous les popups de continents 
  window.continents_popups.forEach(popup => {
    window.mapMusee.removeLayer(popup)
  })

  // Retirer tous les groupes de continents
  Object.keys(window.groups.continentGroup).map(continent_name => {
    window.mapMusee.removeLayer(window.groups.continentGroup[continent_name])
  })

  // Retirer tous les marqueurs continent unknown
  Object.keys(window.unknown_markers.continents).forEach(continent => {
    window.mapMusee.removeLayer(window.unknown_markers.continents[continent])
  })

  // Retirer tous les marqueurs de pays
  Object.keys(window.groups.countriesGroup).map(country_code => {
    window.mapMusee.removeLayer(window.groups.countriesGroup[country_code])
  })

  // Ajout des marqueurs du pays
  window.mapMusee.addLayer(window.groups.countriesGroup[selectedCountry])

  // Retirer tous les marqueurs unknown
  Object.keys(window.unknown_markers.countries).map(country_code => {
    window.mapMusee.removeLayer(window.unknown_markers.countries[country_code])
  })

  // Ajout du markeur unknown
  if (window.unknown_markers.countries[selectedCountry] && window.unknown_markers.countries[selectedCountry].data.isDisplayed == true){
    window.mapMusee.addLayer(window.unknown_markers.countries[selectedCountry])
  }

  window.countries_layers.map(country_layer => {
    Object.keys(country_layer._layers).map(layer => {

      if (country_layer._layers[layer].layerID != selectedCountry){ 
        // Remove Highlight
        $(country_layer._layers[layer]._path).removeClass("selected")
        return 
      }

      // Centrer la vue sur le pays
      window.mapMusee.fitBounds(country_layer._layers[layer]._bounds)

      // Highlight country
      $(country_layer._layers[layer]._path).addClass("selected")

      // Création des marqueurs voisins
      var neighbor_list = country_layer._layers[layer].feature.properties.borders_iso_a2.split(",")
      createMarkersNeighbors(neighbor_list, country_layer._layers[layer]._bounds)

    })
  })



}

const createMarkersNeighbors = (neighbors, bounds=false) => {

  if(neighbors[0] == "") { return }

  // Remove old neighbors
  window.neighbors.map(neighbor => {
    window.mapMusee.removeLayer(neighbor)
  })

  neighbors.map(country_code => {
    var key = Object.keys(window.countries_layers[0]._layers).filter(key => {
                return window.countries_layers[0]._layers[key].feature.properties.ISO_A2_EH == country_code
              })[0]
           || Object.keys(window.countries_layers[1]._layers).filter(key => {
                return window.countries_layers[1]._layers[key].feature.properties.ISO_A2_EH == country_code
              })[0]

    var country = window.countries_layers[1]._layers[key].feature.properties

    if (country.LABEL_Y === null || country.LABEL_X === null || typeof country == "undefined") { return }
    var latlng = [
      country.LABEL_Y,
      enableAnteMeridian(country.LABEL_X)
    ]

    if (!bounds.contains(latlng)) {
      latlng = calculateNewLatLng(latlng, bounds.pad(-0.95))
    }
    try {
      var objectCount = window.sortedData.continents[country.CONTINENT].notices[country_code].count || undefined
    }
    catch{
      return 
    }
    var html =  `<div class="neighbor-marker" id="${country_code}">
                  <img src="/ui/plug-in/integration/carte-instrument-musee/img/boussole.svg" alt=""/>
                  <div>
                    <h3><span>${country.NAME_FR}</span> (${country.name_native})</h3>
                    <p class="marker-count">${objectCount} Objet(s)</p>
                  </div>
                </div>`
    var icon = L.divIcon({ 
      html: html,
      className: `continent-marker neighbor`
    })
    var marker = L.marker( latlng, {icon: icon} )
    marker.on("click", function(e){
      displayCountryMarkers(e)
    })
    
    window.neighbors.push(marker)
    window.mapMusee.addLayer(marker)
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

const createMarkerPopup = notices => {
  if(!notices){ return }
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
    var cat_name_pluriel = window.object_type.filter(obj => { return obj.label == cat})[0].label_pluriel

    let button_cat = document.createElement("button")
    button_cat.setAttribute("class", `cat_button ${normalize_string(cat).replace("'", "_")}`)
    button_cat.setAttribute("style", `transform: translate(${pos_x}px, ${pos_y}px); transform-origin: 50% 50%;`)
    button_cat.setAttribute("title", `Voir une sélection des ${cat_name_pluriel.replace("Oe","Œ")}`)

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

  if (notices[0].Ville == "") {
    var textNode1 = document.createTextNode(notices[0].Pays);
    var brNode = document.createElement('br');
    var textNode2 = document.createTextNode('Sans localisation');

    name_element.appendChild(textNode1);
    name_element.appendChild(brNode);
    name_element.appendChild(textNode2);
  } else {
      name_element.textContent = notices[0].Ville;
  }
  
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
          title.textContent = notice["Titre"].length > 30 ? notice["Titre"].substring(0, 50) + "..." : notice["Titre"]
          title_section.appendChild(title)

      let details_section = document.createElement("div")
          text_section.appendChild(details_section)

      let hierarchy = document.createElement("div")
          hierarchy.setAttribute("class", "notice-hierarchy")

      let hierarchy_content = [notice["Instrument niveau 1"], notice["Instrument niveau 2"], notice["Instrument niveau 3"]]
      hierarchy_content.map(term => {
          if (term == "") {return}
          /* CL 06/11/23 Désactivation du bouton de recherche dans la hiérarchie */
          let button = document.createElement("p")
          button.setAttribute("class", "text-hierarchy")

          //let button = document.createElement("button")
          //button.setAttribute("class", "text-btn")
          //button.setAttribute("type", "button")
          //button.setAttribute("data-search", normalize_string(term).replace("'", "_"))
          button.textContent = term
          //$(button).click(function(){
          //    document.getElementById("seeker").value = `"${term}"`
          //    $("#search").click()
          //})
          hierarchy.appendChild(button)
          
      })
      details_section.appendChild(hierarchy)

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

      let lieu_creation = document.createElement("p")
      lieu_creation.setAttribute("class", "lieu-creation")
      lieu_creation.textContent = "Lieu de création : " + (notice["Ville"] != "" ? notice["Ville"] + ", " : "") 
                                                        + (notice["Pays"] != "" ? notice["Pays"] + ", " : "")
                                                        + (notice["Continent"] != "" ? notice["Continent"] : "")
      text_section.appendChild(lieu_creation)


      if (notice["Date de création"]){
        let date_creation = document.createElement("p")
        date_creation.setAttribute("class", "lieu-creation")
        date_creation.textContent = "Date de création : " + notice["Date de création"]
        text_section.appendChild(date_creation)
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
          //let query_category_link = `https://collectionsdumusee.philharmoniedeparis.fr/search.aspx?SC=MUSEE&QUERY=+${category[0].name_system}+${city}`

          /* 02/10/2023 CL Désacivation du bouton dans l'attente d'une query sans bruit */
          /* let category_search_link = document.createElement("a")
                  category_search_link.setAttribute("class", "btn btn-default btn-link")
                  category_search_link.setAttribute("href", query_category_link)
                  category_search_link.setAttribute("alt", "Voir le résultat de recherche (nouvel onglet)")
                  category_search_link.setAttribute("target", "_blank")
                  category_search_link.textContent = "Voir la sélection"
                  link_container.appendChild(category_search_link) */
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

  $("#cartel-container")[0].appendChild(button)
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

function handleFilters() {

  $("#with-records").click(e => {

      // Update marqueurs et cluster continents
      console.log(window.groups.continentGroup)

      window.countryMarkers.forEach(marker => {
          var country_code = marker.data.country_code;

          if (e.target.checked) {

              // Update cluster et marqueurs pays
              removeMarkerIfNoRecording(marker, country_code, window.groups.continentGroup, "continents");
              updateCountryMarkerBasedOnRecording(marker);

          } else {

              // Update cluster et marqueurs pays
              addMarkerIfNoRecording(marker, country_code, window.groups.continentGroup);
/*               updateMarkerPopup(marker, marker.data.notices);
              updateMarkerContent(marker, marker.data.notices.length); */

              // Update marqueurs et cluster continents


          }
      });
      window.markers.forEach(marker => {
          var country_code = marker.data.notices[0]["Code ISO-2"];

          if (e.target.checked) {

              // Update cluster et marqueurs pays
              removeMarkerIfNoRecording(marker, country_code, window.groups.countriesGroup, "countries");
              updateMarkerBasedOnRecording(marker);

          } else {

              // Update cluster et marqueurs pays
              addMarkerIfNoRecording(marker, country_code, window.groups.countriesGroup);
              updateMarkerPopup(marker, marker.data.notices);
              updateMarkerContent(marker, marker.data.notices.length);

              // Update marqueurs et cluster continents


          }
      });
  });
}

function removeMarkerIfNoRecording(marker, country_code, group, type) {
  var hasRecording = marker.data.notices.some(notice => notice["URL Enregistrement"] && notice["URL Enregistrement"] !== "");
  if (!hasRecording && group[country_code]) {
    group[country_code].removeLayer(marker);
    setUnknownMarkerDisplayStatus(marker, country_code, false, type);
  }
}

function addMarkerIfNoRecording(marker, country_code, group) {
  var hasRecording = marker.data.notices.some(notice => notice["URL Enregistrement"] && notice["URL Enregistrement"] !== "");
  if (!hasRecording && group[country_code]) {
    group[country_code].addLayer(marker);
  }
}

function setUnknownMarkerDisplayStatus(marker, country_code, isDisplayed, type) {
  let unknownID = window.unknown_markers[type][country_code];
  if (unknownID && unknownID.hasOwnProperty('_leaflet_id') && unknownID._leaflet_id === marker._leaflet_id) {
      unknownID.data.isDisplayed = isDisplayed;
  }
}

function updateMarkerBasedOnRecording(marker) {
  var filteredNotices = marker.data.notices.filter(notice => notice["URL Enregistrement"] && notice["URL Enregistrement"] !== "");
  if (filteredNotices.length > 0) {
      updateMarkerPopup(marker, filteredNotices);
      updateMarkerContent(marker, filteredNotices.length);
  }
}
function updateCountryMarkerBasedOnRecording(marker){
  var filteredNotices = marker.data.notices.filter(notice => notice["URL Enregistrement"] && notice["URL Enregistrement"] !== "");
  if (filteredNotices.length > 0) {

    var htmlString = marker.options.icon.options.html
    var htmlDoc = new DOMParser().parseFromString(htmlString, "text/html")
    var countElement = htmlDoc.querySelector('.country-marker')

    countElement.textContent = filteredNotices.length
    var updatedHtml = new XMLSerializer().serializeToString(htmlDoc)

    // Création de la nouvelle icone du marqueur
    var newIcon = L.divIcon({
      html: updatedHtml,
      className: "continent-marker"
    })
    marker.setIcon(newIcon);

  }
}
function updateMarkerPopup(marker, filteredNotices) {
  var newPopupContent = createMarkerPopup(filteredNotices)
  if (marker.hasOwnProperty("_popup") && marker.getPopup().isOpen()) {
      marker.setPopupContent(newPopupContent);
  } else {
      marker.bindPopup(newPopupContent);
  }
}

function updateMarkerContent(marker, count) {

  // Récupération de la valeur de la balise marker-count et mise à jour
  var htmlString = marker.options.icon.options.html
  var htmlDoc = new DOMParser().parseFromString(htmlString, "text/html")
  var popupCountElement = htmlDoc.querySelector('.marker-count')

  popupCountElement.textContent = `${count} Objet(s)`
  var updatedHtml = new XMLSerializer().serializeToString(htmlDoc)

  // Création de la nouvelle icone du marqueur
  var newIcon = L.divIcon({
    html: updatedHtml,
    className: marker.data.known ? "city-container" : "unknown-marker"
  })

 
  marker.setIcon(newIcon);
}