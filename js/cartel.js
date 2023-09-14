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
        image_section.setAttribute("class", `crop-image ${window.utils.normalize_string(notice["Type d'objet"]).replace("'", "_")}` )

        var src = `/ui/plug-in/integration/carte-instrument-musee/img/nobg-${window.utils.normalize_string(notice["Type d'objet"]).replace("'", "_")}.svg`
        
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
            type_icon.setAttribute("src", `/ui/plug-in/integration/carte-instrument-musee/img/${window.utils.normalize_string(notice["Type d'objet"]).replace("'", "_")}.svg`)
            type_icon.setAttribute("alt", notice["Type d'objet"])
            title_section.appendChild(type_icon)

        let title = document.createElement("h3")
            title.setAttribute("class", "notice-title")
            title.textContent = notice["Titre"]
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
            button.setAttribute("data-search", window.utils.normalize_string(term).replace("'", "_"))
            button.textContent = term
            $(button).click(function(){
                console.log($("#seeker"))
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
            button.setAttribute("data-search", window.utils.normalize_string(notice["Collection d'origine"]).replace("'", "_"))
            button.textContent = notice["Collection d'origine"]
            collection.appendChild(button)
            text_section.appendChild(collection)
        }


        /* Conteneur des boutons de liens et d'écoute */
        var link_container = document.createElement("div")
        text_section.appendChild(link_container)

        /* Construction de l'url de la recherche par catégorie (tout voir) */
        let name_system = window["object_type"].filter(type => { return notice["Type d'objet"] == type.label})
        if (name_system.length){

            let facet = `FacetFilter:'{"_201":"${name_system[0].name_system}"}`
            let city = notice.Ville
            let query_category_link = `https://collectionsdumusee.philharmoniedeparis.fr/search.aspx?SC=MUSEE&QUERY=${city}#/Search/(query:(${facet}',ForceSearch:!t,InitialSearch:!f,Page:0,PageRange:3,QueryString:${city},ResultSize:50,ScenarioCode:MUSEE,ScenarioDisplayMode:display-mosaic,SearchGridFieldsShownOnResultsDTO:!(),SearchLabel:'',SearchTerms:${city},SortField:!n,SortOrder:0,TemplateParams:(Scenario:'',Scope:MUSEE,Size:!n,Source:'',Support:'',UseCompact:!f),UseSpellChecking:!n),sst:4)`

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
        let titre_sans_inventaire = window.utils.normalize_string(notice["Titre"].match(regex)[1]).replace(/_/gm, "-").replace(/,|"/gm, "")
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

            let norm_title = window.utils.normalize_string(notice["Titre"]).replace("'", "_").replace(/"|\/|\.|\(|\)/gm, "")
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
        $(".popup-container")[0].setAttribute("style","pointer-events: none;")
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
window.utils["createCartel"] = createCartel
