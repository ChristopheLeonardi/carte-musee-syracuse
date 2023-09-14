
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

            let processed_filtered_data = window.process_data.createDataObject(filtered_data)

            window.c_data = processed_filtered_data // update markers
            window.record_data = processed_filtered_data // record data

            populatefilters(processed_filtered_data)
            window.process_data.createContinentMarkers(processed_filtered_data)
            populateLocalisation(processed_filtered_data)
        }
        else{

            window.c_data = window.current_select_data
            window.record_data = window.current_select_data
            populatefilters(window.c_data)
            window.process_data.createContinentMarkers(window.c_data)
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
                return window.utils.normalize_string(notice["Type d'objet"]).replace(/'/gm, "_") == selected_type
            })

            let notices_to_check = filtered_data.concat(window.record_data.raw_data)
            let notices_to_keep = notices_to_check.filter((a, i, aa) => aa.indexOf(a) === i && aa.lastIndexOf(a) !== i)


            var processed_filtered_data = window.process_data.createDataObject(notices_to_keep)

            window.type_data = processed_filtered_data
        }


        //window.prev_filter_data = filtered_data
        
        window.c_data = processed_filtered_data
        window.process_data.createContinentMarkers(processed_filtered_data)
        populateLocalisation(processed_filtered_data)
        map.setView([20, 155], 2.25);

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

        /* !!! Impossibilité de déclencher le clic sur la popup du continent. !!! */

        // else value is a continent
        else{
            let continent_infos = Object.keys(window.continent_infos).map(key => { 
                let norm_continent = window.utils.normalize_string(window.continent_infos[key].norm_name)
                let norm_value =  window.utils.normalize_string(value).replace(/^0/, "")
                if (norm_continent == norm_value) {
                    return window.continent_infos[key]
                }
            }).filter( Boolean )[0]
            if (! continent_infos) { return }
            window.continents_popups.map(popup => { 
                let continent = popup._content.attributes["data-continent"].value
                if (window.utils.normalize_string(continent) == window.utils.normalize_string(continent_infos.name_en)){
                    map.setView([20, 155], 2.25);
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
        window.process_data.createContinentMarkers(window.c_data)
        map.setView([20, 155], 2.25);
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
            "id" : window.utils.normalize_string(key_value),
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
            input.setAttribute("checked", "true")
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
        if (e.target.checked){
            e.target.setAttribute("checked", "")
            $(this).addClass("checked")
            let current_type = window.object_type.filter(type => { return type.type == e.target.value})[0]
            this.setAttribute("style", `background-color: ${current_type.color}`)
        }
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
    //accessibilityButton(data, cats)

    $('#search').click(function(e) {

        var filterQuery = filterSearch()
        var processed_filtered_data = window.process_data.createDataObject(filterQuery.filtered)

        // Set filtered data for other filters
        window.c_data = processed_filtered_data
        window.current_select_data = processed_filtered_data
        window.type_data = processed_filtered_data
        window.record_data = processed_filtered_data

        // Unset recorded instrument
        document.getElementById("with-records").checked = false;

        populatefilters(processed_filtered_data)
        window.process_data.createContinentMarkers(processed_filtered_data)
        map.setView([20, 155], 2.25);


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

const accessTable = data => {

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

    var table = document.createElement("table")
    var caption = document.createElement("caption")
    caption.textContent = "Liste des institutions abonnées à Philharmonie à la demande"

    table.appendChild(caption)

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

    document.getElementById("mapContainer").appendChild(modal)

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

    table.appendChild(body)
    modal.appendChild(table)

}

window["filters"] = {
    "populatefilters" : populatefilters,
    "filtersActions" : filtersActions,
    "createOptionsLocalisation" : createOptionsLocalisation
}