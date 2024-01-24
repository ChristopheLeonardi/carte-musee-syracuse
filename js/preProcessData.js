

/**
 * Attend le chargement des données avant de lancer la fonction `generalMapMusee`.
 * La fonction vérifie périodiquement si les données sont chargées et, une fois chargées,
 * appelle la fonction `generalMapMusee` pour initialiser la carte.
 *
 * @param {Promise[]} promises - Un tableau de promesses représentant les requêtes de données.
 */
var promises = []
function wait_for_data(promises) {
    get_data(promises)
    typeof window["data"] !== "undefined" ? generalMapMusee(window["data"]) : setTimeout(wait_for_data, 250);   
}

$(document).ready(function() {
    $(".loader").show()
    wait_for_data(promises);
    
});

/**
 * Charge et décompresse des fichiers JSON gzip à partir d'URLs spécifiées.
 * Utilise `fetch` pour charger chaque fichier et `pako.inflate` pour décompresser les données.
 * Une fois les données chargées et décompressées, elles sont stockées dans la variable globale `window["data"]`.
 * La fonction gère également un délai d'attente pour les requêtes et capture les erreurs potentielles lors du chargement.
 *
 * @param {Promise[]} promises - Un tableau de promesses pour gérer les requêtes asynchrones.
 *                               Si `promises` n'est pas défini, un nouveau tableau est créé.
 */
function get_data(promises) {
    const controller = new AbortController();
    try {
      if (promises == undefined) { var promises = [] }
      
      // Liste des URL des fichiers JSON gzip
      const jsonUrls = [
        '/ui/plug-in/integration/carte-instrument-musee2/data/sortedData.json.gz',
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

  /**
 * Crée un objet de données structuré à partir de données brutes sur des instruments, des informations sur les continents et des données de pays.
 * Cette fonction organise les données d'instruments par continent et pays, comptabilise les types d'objets,
 * et construit une structure de données détaillée pour une utilisation ultérieure dans l'affichage de la carte.
 *
 * @param {Object[]} instruments_data - Tableau d'objets représentant les données des instruments.
 * @param {Object} continent_infos - Objet contenant des informations sur les continents, telles que les noms et les coordonnées.
 * @param {Object[]} data_countries - Tableau d'objets contenant des informations sur les pays, y compris les codes ISO et les coordonnées.
 * @returns {Object} Un objet structuré contenant les données organisées par continents et pays, ainsi que d'autres métadonnées utiles.
 */
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
