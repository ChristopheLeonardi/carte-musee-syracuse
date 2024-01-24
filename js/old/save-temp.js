
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