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
      fetch('/ui/plug-in/integration/carte-instrument-musee/data/data-carte2_2023-11-06.csv.gz')
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
      //'/ui/plug-in/integration/carte-instrument-musee/data/amerique.json.gz',
      //'/ui/plug-in/integration/carte-instrument-musee/data/reste.json.gz',
      '/ui/plug-in/integration/carte-instrument-musee/data/config.json.gz',
      '/ui/plug-in/integration/carte-instrument-musee/data/countries_codes_and_coordinates.json.gz',
      '/ui/plug-in/integration/carte-instrument-musee/data/output-topo.json.gz',
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
  
});

/* PROCESS DATA */
/* !!!!! TIMESPENDER !!!!! */
/* WAIT FOR DIRECT EXPORT */
const createDataObject = (instruments_data, continent_infos, data_countries) => {
  const c_data = {
      pays: new Set(),
      continents: {},
      count_by_type: {},
      raw_data: instruments_data,
      convert_iso_name: {},
  };

  const countryInfosMap = new Map(data_countries.map(country => [country["Alpha-2 code"], country]));

  instruments_data.forEach(item => {
      const continent = item.Continent || "unknown";
      if (!c_data.continents[continent]) {
          c_data.continents[continent] = {
              count: 0,
              name_en: continent_infos[continent].name_en,
              name: continent,
              latlng: continent_infos[continent].latlng,
              zoom_level: continent_infos[continent].zoom_level,
              liste_pays: new Set(),
              notices: {},
              raw_data: []
          };
      }

      const continentData = c_data.continents[continent];
      continentData.count++;
      continentData.liste_pays.add(item["Code ISO-2"]);
      continentData.raw_data.push(item);

      const countryInfo = countryInfosMap.get(item["Code ISO-2"]) || null;
      if (!continentData.notices[item["Code ISO-2"]]) {
          continentData.notices[item["Code ISO-2"]] = {
              count: 0,
              cities: {},
              latlng: countryInfo ? [countryInfo["Latitude (average)"], countryInfo["Longitude (average)"]] : null,
              name_fr: item.Pays
          };
      }

      const countryData = continentData.notices[item["Code ISO-2"]];
      countryData.count++;

      if (!countryData.cities[item.Ville]) {
          countryData.cities[item.Ville] = {
              count: 0,
              notices: []
          };
      }

      const cityData = countryData.cities[item.Ville];
      cityData.count++;
      cityData.notices.push(item);

      c_data.pays.add(item["Code ISO-2"]);
      c_data.convert_iso_name[item["Code ISO-2"]] = item["Pays"];
      c_data.count_by_type[item["Type d'objet"]] = (c_data.count_by_type[item["Type d'objet"]] || 0) + 1;
  });

  c_data.pays = Array.from(c_data.pays);
  Object.keys(c_data.continents).forEach(continent => {
      c_data.continents[continent].liste_pays = Array.from(c_data.continents[continent].liste_pays);
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

function generalMapMusee(data, initial_data = false){
    console.log(data)
    console.time("generalMap")
    const continent_infos  = data[1].continents_infos
    const object_type = data[1].object_type
    const data_countries = data[2]

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
    window["object_type"] = data[1].object_type
    window["topojson_data"] = []
    window["data_countries"] =  data[2]
    window["object_type_data"] =  data[1]
    window["output_topo_data"] =  data[3]
    window["initial_data"] = initial_data || data[0]


    // Création des layers des pays, comportement au hover et clique
    let countries_data = [{ "data" : data[3], "name" : "world" }]
    createCountriesLayers(countries_data)

    // Création des clusters
    window.groups = createCluster(sortedData, data_countries)

    
    // Création des Boutons continents
    createContinentMarkers(sortedData)

    // Comportement des filtres
    handleFilters()

    // Set initial count
    document.getElementById("nb-items").textContent = window.sortedData.raw_data.length + " Objet(s)"

    // Ouvrir et fermer le menu des filtres
    $("#open-close-filter").click(e => {
      $("#mapFilter, #open-close-filter, #mapMusee").toggleClass("open")
      onkeyup = e => {
        if ((e.keyCode == 27) && $("#mapFilter, #open-close-filter, #mapMusee").hasClass("open")){
          $("#mapFilter, #open-close-filter").removeClass("open")
        }
      };
    })

    // Filters 
    createOptionsLocalisation(window.sortedData)
    populateObjectTypes(window.sortedData)
    displayResultNumber(window.sortedData)
    console.timeEnd("generalMap")

    // Comportement au dezoom
window.mapMusee.on('moveend', function() {
  if(window.mapMusee.getZoom() <= 2.5) {
    // Regroupez les opérations de suppression de layers pour minimiser les appels de fonction
    const allLayersToRemove = [
      ...Object.values(window.groups.countriesGroup), 
      ...Object.values(window.unknown_markers.countries),
      ...window.neighbors,
      ...Object.values(window.groups.continentGroup),
      ...Object.values(window.unknown_markers.continents)
    ];

    allLayersToRemove.forEach(layer => window.mapMusee.removeLayer(layer));

    // Ajout en masse de tous les popups de continents
    window.continents_popups.forEach(popup => window.mapMusee.addLayer(popup));

    // Optimisation de la sélection jQuery
    const selectedCountryElement = selectizeItem[0].selectize;
    const selectedCountry = selectedCountryElement.getValue();
    if(selectedCountry) {
      const countryPath = `path.${selectedCountry.toLowerCase()}`;
      const $countryPath = $(countryPath);
      $countryPath.css({ opacity: 0, fillOpacity: 0 }).removeClass("selected");
      selectedCountryElement.setValue("empty");
    }

    updateCountObjects();
  }


});

    // Ajoute un écouteur d'événements pour détecter les changements de mode plein écran
    document.addEventListener('fullscreenchange', onFullScreenChange);

    // Responsive map
    responsiveMap()

    // Création du bouton Réinitialiser les filtres
    createResetButton(window.mapMusee)

    // Hide loader
    $(".loader").hide();
}

function responsiveMap(){
  setResponsiveHeight()
  addEventListener("resize", () => {
      setResponsiveHeight()
  });
}
function setResponsiveHeight(){
  var margin = 40
  var titleHeight = $('.map-title').outerHeight(true)
  var filters = document.getElementById("mapFilter")
  var mapContainer = document.getElementById("mapMusee")

  var windowHeight = window.innerHeight
  var mapElementsHeight = windowHeight - titleHeight - margin
  filters.style.height = mapElementsHeight + "px"
  mapContainer.style.height = mapElementsHeight + "px"
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
          scrollWheelZoom: true, 
          minZoom :  2, // Note pour le futur: un bug dans leaflet fait qu'une valeur de minZoom non Int fait disparaitre les marqueurs uniques.
          maxZoom: 12,
      }).setView(initialView.latlng, initialView.zoom);
    
      L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)
      window.fullScreenControl = L.control.fullscreen({ /* options */ });
      map.addControl(window.fullScreenControl);
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
    window.topojson_data.push(topojson_data.flat()[0])

   
    if (!window.sortedData.pays.includes(layer.layerID)) { return false }
    layer.on({
      click: (e) => {
        if(!hasNotices(layer)) { return }
        displayCountryMarkers(e)
        
       } 
    })
    layer.on( "mouseover", e => { 
      if(!hasNotices(layer)) { return }
      $(e.target._path).css({ opacity: 0.6, fillOpacity: 0.6 })
    })
  
    layer.on( "mouseout", e => { 
      if(!hasNotices(layer)) { return }
      $(e.target._path).css({ opacity: 0, fillOpacity: 0 })
    })
}
function hasNotices(layer){
  var selectedCountry = layer.layerID
  var isRecordChecked = document.getElementById("with-records").checked;
  var typeFilter = document.querySelector('input[name="types"]:checked').value;

  function recordFilterFunction(notice) {
    return isRecordChecked ? notice["URL Enregistrement"] : true;
  }

  function typeFilterFunction(notice) {
      return typeFilter !== "all" ? normalize_string(notice["Type d'objet"]) === typeFilter : true;
  }

  function combinedFilter(notice) {
      return recordFilterFunction(notice) && typeFilterFunction(notice);
  }
  var countryNotice = window.sortedData.raw_data.filter(notice => { return notice["Code ISO-2"] == selectedCountry})
  var count = countryNotice.filter(notice => combinedFilter(notice)).length
  return count == 0 ? false : true
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
    let regex = /<[^>]*>(\d+)\s*[^<]*<\/[^>]*>/
    let number = parseInt(country.options.icon.options.html.match(regex)[1])
    if (number) { count += number }
  })

  return { html: `<p class="country-marker marker-count">${count}</p>`, className: `continent-marker`}
}

function createContinentCluster(country_code, parentGroup, countryMarkers, continent_name, sortedData){

  // Skip si le marqueur existe déjà
  if (countryMarkers[country_code] && country_code != "") { return }
  var continentNotices = sortedData.continents[continent_name].notices

  var latlng = continentNotices[country_code].latlng
  if (latlng) { 
    var  countryCenter = [continentNotices[country_code].latlng[0], enableAnteMeridian(continentNotices[country_code].latlng[1])]
    var html = `<p class="country-marker marker-count" id="glob-${country_code}" data-continent="${continent_name}">${continentNotices[country_code].count}</p>`
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



  if(continentNotices[country_code].cities[""] && (country_code == "" || !latlng)){
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
    if (city == "" && country_code_obj.latlng){

      var latlng =[country_code_obj.latlng[0], enableAnteMeridian(country_code_obj.latlng[1])];
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
        var popup =  L.responsivePopup({ autoPanPadding: [10,10] }).setContent(createMarkerPopup(cityData.notices))
        var marker = L.marker([latitude, longitude], { icon: icon, bubblingMouseEvents: true, riseOnHover: true })
          .bindPopup(popup).openPopup();
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
  var popup =  L.responsivePopup({ autoPanPadding: [10,10] }).setContent(createMarkerPopup(notices))
  var unknownMarker = L.marker( latlng, {icon: icon, bubblingMouseEvents: true, riseOnHover: true }) 
    .bindPopup(popup).openPopup();
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
  $(popupContent).click(e => {
    var continentName = $(e.target).attr("data-continent") || $(e.target).parent().attr("data-continent");
  
    // Fonction pour ajouter ou retirer des couches
    const toggleLayers = (action, layersGroup) => {
      Object.keys(layersGroup).forEach(key => {
        if (action === 'add') {
          window.mapMusee.addLayer(layersGroup[key]);
        } else if (action === 'remove') {
          window.mapMusee.removeLayer(layersGroup[key]);
        }
      });
    };
  
    // Ajouter tous les popups de continents sauf celui sélectionné
    window.continents_popups.forEach(popup => {
      if (popup.continent_name !== continentName) {
        window.mapMusee.addLayer(popup);
      } else {
        window.mapMusee.removeLayer(popup);
      }
    });
  
    // Gérer les couches de groupes et marqueurs
    toggleLayers('remove', window.groups.continentGroup);
    toggleLayers('remove', window.unknown_markers.continents);
  
    // Ajouter le groupe du continent sélectionné
    if (window.groups.continentGroup[continentName]) {
      window.mapMusee.addLayer(window.groups.continentGroup[continentName]);
    }
  
    // Ajouter le marqueur unknown si nécessaire
    const unknownContinentMarker = window.unknown_markers.continents[continentName];
    if (unknownContinentMarker && unknownContinentMarker._popup._content.innerHTML !== "0") {
      window.mapMusee.addLayer(unknownContinentMarker);
    }
  
    // Définir la vue de la carte et mettre à jour le compteur
    const continentObject = window.sortedData.continents[continentName];
    window.mapMusee.setView(continentObject.latlng, continentObject.zoom_level);
    hoverCountryEffect(e, continentObject.liste_pays, 0);
  
    var selectedContinentKey = `0${normalize_string(continentName)}`;
    selectizeItem[0].selectize.setValue(selectedContinentKey);
    updateCountObjects();
  });
  
  return popupContent
}
/**
 * Modifie l'effet de survol sur les pays.
 * 
 * @param {Event} e - L'événement déclencheur.
 * @param {Array} countries_to_display - Les codes des pays à afficher.
 * @param {number} opacity - L'opacité à appliquer.
 */
const hoverCountryEffect = (e, countries_to_display, opacity) => {
  const continent_name = $(e.target).attr("data-continent") || $(e.target).parent().attr("data-continent");
  const normalize_continent_name = continent_name ? normalize_string(continent_name) : "";
  let svg_countries = [];

  if (e.layerID) {
      const path = `path.${e.layerID.toLowerCase()}`;
      if ($(path).length === 0) { return; }

      const elements = document.getElementById("mapMusee").getElementsByClassName(e.layerID.toLowerCase());
      svg_countries = Array.from(elements);
  } else {
      countries_to_display.forEach(country_code => {
          if (country_code !== "") {
              const elements = document.getElementById("mapMusee").getElementsByClassName(`${normalize_continent_name.toLowerCase()} ${country_code.toLowerCase()}`);
              svg_countries.push(...Array.from(elements));
          }
      });
  }

  svg_countries.forEach(elt => {
      $(elt).css({"opacity": opacity, "fill-opacity": opacity, "transition": "0.2s ease-in-out opacity"});
  });
};

/**
 * Affiche les marqueurs pour un pays sélectionné et gère l'affichage des layers sur la carte.
 *
 * @param {Event} e - L'événement déclencheur contenant les informations sur le pays sélectionné.
 */
function displayCountryMarkers(e) {
  const selectedCountry = e.target.layerID || e.target._icon.firstChild.id.replace("glob-", "");

  // Fonction pour retirer les layers de la carte
  const removeLayers = (layerCollection) => {
      Object.keys(layerCollection).forEach(key => {
          if (window.mapMusee.hasLayer(layerCollection[key])) {
              window.mapMusee.removeLayer(layerCollection[key]);
          }
      });
  };

  // Retirer les layers inutiles
  [window.continents_popups, window.groups.continentGroup, window.unknown_markers.continents, window.groups.countriesGroup, window.unknown_markers.countries].forEach(removeLayers);

  // Ajouter les layers nécessaires
  if (window.groups.countriesGroup[selectedCountry]) {
      window.mapMusee.addLayer(window.groups.countriesGroup[selectedCountry]);
  }

  const unknownCountryMarker = window.unknown_markers.countries[selectedCountry];
  if (unknownCountryMarker && unknownCountryMarker.data.isDisplayed) {
      window.mapMusee.addLayer(unknownCountryMarker);
  }

  // Mise en évidence et traitement des layers de pays
  let isCountryLayerFound = false;
  window.countries_layers.forEach(country_layer => {
      Object.values(country_layer._layers).forEach(layer => {
          const $path = $(layer._path);
          if (layer.layerID === selectedCountry && !isCountryLayerFound) {
              window.mapMusee.fitBounds(layer._bounds);
              $path.addClass("selected");
              createMarkersNeighbors(layer.feature.properties.borders_iso_a2.split(","), layer._bounds);
              isCountryLayerFound = true;
          } else if (isCountryLayerFound) {
              $path.removeClass("selected");
          }
      });
  });

  selectizeItem[0].selectize.setValue(selectedCountry);
  updateCountObjects();
}


/**
 * Crée et affiche des marqueurs pour les pays voisins.
 *
 * @param {Array<string>} neighbors - Les codes des pays voisins à afficher.
 * @param {L.LatLngBounds} [bounds=false] - Les limites géographiques pour ajuster la position des marqueurs.
 */
const createMarkersNeighbors = (neighbors, bounds = false) => {
  if (neighbors[0] === "") { return; }

  const combinedFilter = getFiltersSettings();

  // Supprimer les anciens marqueurs voisins
  window.neighbors.forEach(neighbor => window.mapMusee.removeLayer(neighbor));
  window.neighbors = [];

  neighbors.forEach(country_code => {
      const layerKey = Object.keys(window.countries_layers[0]._layers).find(key => 
          window.countries_layers[0]._layers[key].feature.properties.ISO_A2_EH === country_code
      );

      if (!layerKey) { return; }

      const country = window.countries_layers[0]._layers[layerKey].feature.properties;
      if (!country.LABEL_Y || !country.LABEL_X) { return; }

      let latlng = [country.LABEL_Y, enableAnteMeridian(country.LABEL_X)];
      if (bounds && !bounds.contains(latlng)) {
          latlng = calculateNewLatLng(latlng, bounds.pad(-0.95));
      }

      let objectCount = 0;
      try {
          const continentName = country.CONTINENT;
          const cities = window.sortedData.continents[continentName].notices[country_code].cities;
          objectCount = Object.values(cities).reduce((count, city) => 
              count + city.notices.filter(combinedFilter).length, 0);
      } catch {
          return;
      }

      const html = `<div class="neighbor-marker" id="${country_code}">
                      <img src="/ui/plug-in/integration/carte-instrument-musee/img/boussole.svg" alt=""/>
                      <div>
                        <h3><span>${country.NAME_FR}</span> (${country.name_native})</h3>
                        <p class="marker-count" data-continent="${country.CONTINENT}" data-country_code="${country_code}">${objectCount} Objet(s)</p>
                      </div>
                    </div>`;
      const icon = L.divIcon({ html: html, className: `continent-marker neighbor` });
      const marker = L.marker(latlng, { icon: icon }).on("click", displayCountryMarkers);
      
      window.neighbors.push(marker);
      window.mapMusee.addLayer(marker);
  });
};

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
/**
 * Crée une popup pour un marqueur avec des informations sur les notices associées.
 *
 * @param {Array} notices - Un tableau de notices à afficher dans la popup.
 * @returns {HTMLElement} Le conteneur de la popup.
 */
const createMarkerPopup = notices => {
  const container = document.createElement("div");
  container.className = "popup-container";

  if (!notices || notices.length === 0) {
      container.textContent = "0";
      return container;
  }

  // Création de la rosace des catégories
  const categories = [...new Set(notices.map(notice => notice["Type d'objet"]))];
  const angleUnit = 360 / categories.length * Math.PI / 180;
  let angle = -90 * Math.PI / 180;
  const radius = 100;

  categories.forEach(category => {
      const catNotices = notices.filter(notice => notice["Type d'objet"] === category);
      const catInfo = window.object_type.find(obj => obj.label === category);
      const catNamePluriel = catInfo ? catInfo.label_pluriel.replace("Oe", "Œ") : "";

      const posX = categories.length > 1 ? radius * Math.cos(angle) - 35 : 0;
      const posY = radius / 1.5 * Math.sin(angle);
      angle += angleUnit;

      const buttonCat = document.createElement("button");
      buttonCat.className = `cat_button ${normalize_string(category).replace("'", "_")}`;
      buttonCat.style.transform = `translate(${posX}px, ${posY}px)`;
      buttonCat.title = `Voir une sélection des ${catNamePluriel}`;

      buttonCat.onclick = e => createCartel(e, catNotices);

      const itemNumber = document.createElement("p");
      itemNumber.textContent = catNotices.length;
      buttonCat.appendChild(itemNumber);
      container.appendChild(buttonCat);
  });

  const cityContainer = createCityContainer(notices);
  container.appendChild(cityContainer);

  return container;
};

/**
* Crée un conteneur pour les informations de la ville.
*
* @param {Array} notices - Un tableau de notices à utiliser pour les informations de la ville.
* @returns {HTMLElement} Le conteneur des informations de la ville.
*/
function createCityContainer(notices) {
  const cityContainer = document.createElement("div");
  cityContainer.className = "city-center";
  cityContainer.style.transform = "translate(-54px, -9px)";
  cityContainer.title = "Voir une sélection des éléments";

  const nameElement = document.createElement("p");
  nameElement.textContent = notices[0].Ville || `${notices[0].Pays} (Sans localisation)`;
  cityContainer.appendChild(nameElement);

  const totalNumber = document.createElement("p");
  totalNumber.textContent = `${notices.length} Objet(s)`;
  cityContainer.appendChild(totalNumber);

  cityContainer.onclick = e => createCartel(e, notices);

  return cityContainer;
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
    applyFilters()
  });

  $("#types-filter").change(e => {
    applyFilters()
  })

  /* Filter Localisation */
  $(document).on('mousedown', '.selectize-dropdown-content [data-value]', function(e) {
    var value = $(this).attr('data-value');
    var continentSelected = false;

    // Regrouper les opérations de suppression des couches
    const removeAllLayers = () => {
      // Retirer tous les popups, groupes et marqueurs
      [window.continents_popups, window.groups.continentGroup, window.unknown_markers.continents,
      window.groups.countriesGroup, window.unknown_markers.countries].forEach(group => {
        Object.keys(group).forEach(key => window.mapMusee.removeLayer(group[key]));
      });

      // Retirer tous les marqueurs voisins
      window.neighbors.forEach(neighbor => window.mapMusee.removeLayer(neighbor));

      // Déselectionner pays
      $('path').css({ opacity: 0, fillOpacity: 0 }).removeClass("selected");
    };

    window.continents_popups.forEach(continentpopup => {
      if (normalize_string(continentpopup.continent_name) === normalize_string(value.replace("0", ""))) {
        removeAllLayers();
        window.mapMusee.addLayer(continentpopup);
        continentpopup._content.click();
        continentSelected = true;
      }
    });

    if (!continentSelected) {
      Object.keys(window.countries_layers[0]._layers).forEach(key => {
        var layer = window.countries_layers[0]._layers[key];
        if (layer.layerID === value) {
          layer.fire('click');
        }
      });
    }
  });


  searchBox()

}
function applyFilters(){

  var combinedFilter = getFiltersSettings()

  // Cluster des continents
  window.countryMarkers.forEach(marker => {
    var continent_name = marker.data.notices[0].Continent
    var hasNotices = marker.data.notices.some(combinedFilter);
    if (hasNotices) {
        var filteredNotices = marker.data.notices.filter(combinedFilter)
        window.groups.continentGroup[continent_name].addLayer(marker);
        updateMarkerContent(marker, filteredNotices.length, "continent");
    } else {
        window.groups.continentGroup[continent_name].removeLayer(marker);
    }
    });

// Marqueurs inconnus des continents
Object.keys(window.unknown_markers.continents).forEach(continent => {
  var popup = window.unknown_markers.continents[continent];
  var hasNotices = popup.data.notices.some(combinedFilter);
  var filteredNotices = popup.data.notices.filter(combinedFilter);
  updateMarkerPopup(popup, filteredNotices);
  if (hasNotices) {
      window.mapMusee.addLayer(popup);
      //updateMarkerPopup(popup, filteredNotices);
      updateMarkerContent(popup, filteredNotices.length, "city");
  } else {
      window.mapMusee.removeLayer(popup);
      setUnknownMarkerDisplayStatus(popup, popup.data.city, false);
  }
});

// Vérifiez la visibilité des groupes de continents et ajustez les marqueurs inconnus
Object.keys(window.groups.continentGroup).forEach(continent => {
  var group = window.groups.continentGroup[continent];
  var isGroupVisible = window.mapMusee.hasLayer(group);
  var popup = window.unknown_markers.continents[continent];

  if (!isGroupVisible && popup) {
      setUnknownMarkerDisplayStatus(popup, popup.data.city, false);
      window.mapMusee.removeLayer(popup);
  }
});

  // Cluster des pays
  window.markers.forEach(marker => {
    var country_code = marker.data.notices[0]["Code ISO-2"];
    var hasNotices = marker.data.notices.some(combinedFilter);

    if (hasNotices) {
        var filteredNotices = marker.data.notices.filter(combinedFilter)
        window.groups.countriesGroup[country_code].addLayer(marker);
        updateMarkerPopup(marker, filteredNotices);
        updateMarkerContent(marker, filteredNotices.length, "city");
    } else {
        window.groups.countriesGroup[country_code].removeLayer(marker);
    }
  });

  // Update Neighbors count
  window.neighbors.map(neighbor => {
    // Récupération de la valeur de la balise marker-count et mise à jour
    var htmlString = neighbor.options.icon.options.html
    var htmlDoc = new DOMParser().parseFromString(htmlString, "text/html")
    var popupCountElement = htmlDoc.querySelector('.marker-count') 

    var continent = popupCountElement.getAttribute("data-continent")
    var country_code = popupCountElement.getAttribute("data-country_code")

    var objectCount = 0
    var cities = window.sortedData.continents[continent].notices[country_code].cities
    Object.keys(cities).map(city => {
      objectCount += cities[city].notices.filter(combinedFilter).length
    })

    popupCountElement.textContent = popupCountElement.textContent.replace(/\d{1,5}/, objectCount)
    var updatedHtml = new XMLSerializer().serializeToString(htmlDoc)

    var newIcon = L.divIcon({
      html: updatedHtml,
      className: `continent-marker neighbor`
    })
    neighbor.setIcon(newIcon);

  })
  // mise à jour des compteurs
  updateCountObjects()
}


function setUnknownMarkerDisplayStatus(marker, country_code, isDisplayed) {
  let unknownID = window.unknown_markers.continents[country_code];
  if (unknownID && unknownID.hasOwnProperty('_leaflet_id') && unknownID._leaflet_id === marker._leaflet_id) {
      unknownID.data.isDisplayed = isDisplayed;
  }
}


function updateMarkerPopup(marker, filteredNotices) {
  var newPopupContent = createMarkerPopup(filteredNotices)
  if (filteredNotices.length == 0){
    marker.setPopupContent(newPopupContent);
    marker.bindPopup(newPopupContent)

  }
  if (marker.hasOwnProperty("_popup") && marker.getPopup().isOpen()) {
      marker.setPopupContent(newPopupContent);
  } else {
      marker.bindPopup(newPopupContent);
  }
}

function updateMarkerContent(marker, count, type = false, className = false) {

  // Récupération de la valeur de la balise marker-count et mise à jour
  var htmlString = marker.options.icon.options.html
  var htmlDoc = new DOMParser().parseFromString(htmlString, "text/html")
  var popupCountElement = htmlDoc.querySelector('.marker-count')

  popupCountElement.textContent = popupCountElement.textContent.replace(/\d{1,5}/, count)
  var updatedHtml = new XMLSerializer().serializeToString(htmlDoc)

  if(!className){
      className = "city-container"
    if (!marker.data.known){
      className = "unknown-marker"
    }
    if (type == "continent"){
      className = "continent-marker"
    }
  }

  var newIcon = L.divIcon({
    html: updatedHtml,
    className: className
  })

 
  marker.setIcon(newIcon);
}

function updateCountObjects(){
  var selectedCountry = document.querySelector("#loc-select [selected='selected']").value
  var isRecordChecked = document.getElementById("with-records").checked;
  var typeFilter = document.querySelector('input[name="types"]:checked').value;

  function recordFilterFunction(notice) {
      return isRecordChecked ? notice["URL Enregistrement"] : true;
  }

  function typeFilterFunction(notice) {
      return typeFilter !== "all" ? normalize_string(notice["Type d'objet"]) === typeFilter : true;
  }

  function combinedFilter(notice) {
      return recordFilterFunction(notice) && typeFilterFunction(notice);
  }

  var continentsCount = {};
  Object.keys(window.sortedData.continents).map(continent => {
    continentsCount[continent] = window.sortedData.continents[continent].raw_data.reduce((count, notice) => {
      return combinedFilter(notice) ? count + 1 : count;
    }, 0);
  });

  var selectize = selectizeItem[0].selectize;

  Object.keys(selectize.options).forEach(optionKey => {
      var option = selectize.options[optionKey];
      var selectCountry = window.sortedData.raw_data.filter(notice => notice["Code ISO-2"] === option.id);
      var count = selectCountry.filter(notice => combinedFilter(notice)).length || "0";

      var newOption = {...option, count: count};
      selectize.updateOption(optionKey, newOption);
  });

  Object.keys(continentsCount).forEach(continent => {
      var continentKey = `0${normalize_string(continent)}`;
      if (selectize.options[continentKey]) {
          var continentOption = selectize.options[continentKey];
          var newContinentOption = {...continentOption, count: continentsCount[continent]};
          selectize.updateOption(continentKey, newContinentOption);
      }
  });

selectize.refreshOptions(false);
  var typesElements = document.querySelectorAll('input[name="types"]')
  Array.from(typesElements).map(typeElement => {
    if (typeElement.value == "all") { return }
    var countLabel = $(typeElement).parent().parent().children().last()

    var typeKey = typeElement.value

    if(selectedCountry.startsWith("0")){
      var continent_name = Object.keys(window.sortedData.continents).filter(continent => { 
        if(normalize_string(continent) == selectedCountry.replace("0", "")){
          return continent
        }
      })[0]
      var continentNotice = window.sortedData.continents[continent_name].raw_data
      var count = continentNotice.filter(recordFilterFunction).filter(notice => { return normalize_string(notice["Type d'objet"]).replace("'", "_") == typeKey}).length
      countLabel.text(count)
    }
    else if(selectedCountry && selectedCountry != "empty"){
      var countryNotice = window.sortedData.raw_data.filter(notice => { return notice["Code ISO-2"] == selectedCountry})
      var count = countryNotice.filter(recordFilterFunction).filter(notice => { return normalize_string(notice["Type d'objet"]).replace("'", "_") == typeKey}).length
      countLabel.text(count)
    }
    else if(selectedCountry == "empty" || selectedCountry == ""){
      var countryNotice = window.sortedData.raw_data
      var count = countryNotice.filter(recordFilterFunction).filter(notice => { return normalize_string(notice["Type d'objet"]).replace("'", "_") == typeKey}).length
      countLabel.text(count)
    }

    
  })

  var totalCount = 0;
  if(selectedCountry && selectedCountry != "empty"){
    var typesElements = document.querySelectorAll('input[name="types"]')
    Array.from(typesElements).map(typeElement => {
      if (typeElement.value == "all") { return }

      var countLabel = $(typeElement).parent().parent().children().last()
      totalCount += parseInt(countLabel.text())
    })
  }else{
    window.continents_popups.forEach(popup => {
      totalCount += continentsCount[popup.continent_name];
      popup._content.innerHTML = popup._content.innerHTML.replace(/<p>\d{1,5}/, "<p>" + continentsCount[popup.continent_name]);
    });
  }
  document.getElementById("nb-items").textContent = totalCount + " Objet(s)";

}

function getFiltersSettings(){
  var recordFilter = document.getElementById("with-records").checked
  var typeFilter = document.querySelector('input[name="types"]:checked').value || "all"

  function recordFilterFunction(notice) {
    return recordFilter ? notice["URL Enregistrement"] : true;
  }

  function typeFilterFunction(notice) {
      return typeFilter !== "all" ? normalize_string(notice["Type d'objet"]).replace("'", "_") === typeFilter : true;
  }

  function combinedFilter(notice) {
      return recordFilterFunction(notice) && typeFilterFunction(notice);
  }
  return combinedFilter
}

const displayResultNumber = data => {
  var count = 0
  Object.keys(data.continents).map(continent => { count += data.continents[continent].count })
  document.getElementById("nb-items").textContent = `${count} Objet(s)`
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

          var detail_country = window.topojson_data.filter(item => { return item.ISO_A2_EH == country_code })[0]
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
  array_continent.unshift([{
    "id" : "empty",
    "name_fr" : "Localisation",
    "name_native" : "",
    "count" : "",
  }])
  return array_continent
}

const selectizeOptionDOM = (item, escape) => {

  if (item.name_fr[0] == "0"){
    var name_fr = "<b>" + escape(item.name_fr).replace(/^0|^_/, "") + "</b>"
  }
  else if (item.name_fr == "empty"){
    var name_fr = escape(item.name_fr)
  }
  else {
    var name_fr = escape(item.name_fr).replace(/^0|^_/, "")
  }
  
  let html = `<div class="option">
                  <span class="name_fr">${item.name_fr ? name_fr : " "}</span>
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
      label.textContent = type.label_pluriel.replace("Oe", "Œ")
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

function onFullScreenChange() {
    // Déplacement des éléments du DOM pour afficher les filtres avec l'option plein écran
    var mapElement = document.getElementById('mapMusee');
    var filterElement = document.getElementById('mapFilter');
    var buttonElement = document.getElementById('open-close-filter');
    var parentContainer = document.getElementById('mapElementContainer');
  
    // Vérifie si la carte est en mode plein écran
    if (document.fullscreenElement === mapElement) {
        // Si oui, déplace les éléments de filtre en dehors du conteneur de la carte
        mapElement.appendChild(filterElement)
        mapElement.appendChild(buttonElement)
    } else {
        // Si non, remet les éléments de filtre dans le conteneur de la carte
        parentContainer.insertBefore(filterElement, mapElement)
        parentContainer.insertBefore(buttonElement, mapElement)
    }
    $(filterElement).toggleClass("fullscreen-filters")
    $(buttonElement).toggleClass("fullscreen-filters")
}

const searchBox = () => {

  /* SEEKER FUNCTION */
  if (!RegExp.escape) {
      RegExp.escape = function(s) {
          return s.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&")
      }
  }

  $('.search-bar').submit(function(e) { e.preventDefault() })
  $('#search').click(function(e) { filterSearch() })
}

const filterSearch = () => {  

  
  // Reset location
  selectizeItem[0].selectize.setValue("empty")
  var filtersSettings = getFiltersSettings()

  const data = window.initial_data.raw_data
  var searchTerms = document.getElementById("seeker").value.replace(/\s$/gmi, "")

  // Reset search for button reset
  if (searchTerms == "resetMap"){
      filteredSortedData = sortedData
      document.getElementById("all-types").checked = true
      document.getElementById("with-records").checked = false
      document.getElementById("seeker").value = ""
      searchTerms = ""
  }

  // Traitement de la recherche avec prise en charge de la recherche exacte ("lorem")
  let queryReg = []
  var regexQuote = new RegExp(/\"(.*?)\"/, 'gm')

  if (regexQuote.test(searchTerms)) {
      queryReg = searchTerms.match(regexQuote).map(q => q.replace(/\"/gm, ''))

  } else {
      searchTerms.toLowerCase().split(' ').map(q => queryReg.push(`(?=.*${q})`))
  }

  /* Data filter method */
  var filtered = []

  const filterIt = (arr, query) => {
      return arr.filter(obj => Object.keys(obj).some(key => {
        if (key !== 'Enregistrement') {   
            return new RegExp(query, "mgi").test(obj[key]);
        }
        return false;
      }))
  }
  queryReg.map(query => { 
      filtered.push(filterIt(data, query)) 
  })

  // Prise en charge de la recherche avec mots multiples dans tous les champs de data
  if (queryReg.length > 1) {
      const findDuplicates = arr => arr.filter((item, index) => arr.indexOf(item) !== index)
      filtered = findDuplicates(filtered.flat()).filter(notice => filtersSettings(notice))
  } 

  var filterQuery = { "filtered": filtered.flat(), "query": queryReg }

  if (window.mapMusee == undefined) { return }

  window.mapMusee.removeControl(window.fullScreenControl);
  window.mapMusee.off()
  window.mapMusee.remove()
  window.mapMusee = undefined

  var dataObjectFiltered = createDataObject(filterQuery.filtered, window.object_type_data.continents_infos, window.data_countries)
  
  var newData = [ 
    dataObjectFiltered,
    window.object_type_data,
    window.data_countries,
    window.output_topo_data
  ]
  
  generalMapMusee(newData, window.initial_data)

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

/**
 * Fonction de création du bouton reset de la carte
 * @param {Object}map - Variable contenant l'objet carte
 */
function createResetButton(map) {

  // Création d'un bouton réinitialisant la carte
  var resetButton = document.createElement("button")
  resetButton.id= "reset-button"
  resetButton.setAttribute("class", "leaflet-bar leaflet-control")
  resetButton.setAttribute("type", "button")
  resetButton.setAttribute("title", "Réinitialiser la carte")

  let img = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 328.32 335.24">
          <path d="m272.68,41.69c.7-1.2,1.18-2.62,2.13-3.58,8.06-8.17,16.25-16.22,24.3-24.4,5.24-5.33,11.3-7.22,18.38-4.58,6.45,2.41,9.87,8.12,9.88,16.08.03,28.45.04,56.89,0,85.34-.02,10.53-6.48,17.03-17.06,17.05-28.33.07-56.65.05-84.98,0-8.13-.01-13.87-3.55-16.35-10.11-2.69-7.13-.63-13.12,4.68-18.33,8.01-7.85,15.92-15.82,24.7-24.56-8.3-5.21-15.85-10.72-24.06-14.95-35.34-18.23-70.78-15.72-104.47,3.32-42.34,23.92-62.85,61.49-61.73,110.1,1.25,54.33,43.92,102.97,97.48,112.19,59.06,10.17,113.16-20.46,134.68-76.25,4.25-11.02,11.61-14.93,23.31-12.42,4.14.89,8.32,1.63,12.44,2.59,9.48,2.2,14.53,10.57,11.35,19.58-22.19,62.8-65.85,101.96-131.34,113.81-84.9,15.36-166.14-36.91-189.75-119.88C-19.69,121.46,37.59,25.09,129.83,4.28c51.97-11.73,97.68,1,138.54,33.99.87.7,1.74,1.42,2.62,2.11.18.14.44.2.66.29.34.34.69.69,1.03,1.03Z"/>
      </svg>`,
      'application/xml');

  resetButton.appendChild(resetButton.ownerDocument.importNode(img.documentElement, true))

  $(resetButton).on("click", e => {
      document.getElementById("seeker").value = "resetMap"
      $("#search").click()        
  })

  // Ajoutez le bouton à la carte
  var resetControl = L.control({ position: 'topleft' });
  resetControl.onAdd = function() {
      return resetButton;
  };
  resetControl.addTo(map);

} 
