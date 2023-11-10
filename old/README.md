# carte-musee-syracuse

## Référenciel de traitement des topojson

Utilisation de mapshapper.com

## Commandes de console utiles : 

remove properties : -filter-fields names,fields
split out region :  explode
merge layers : merge-layer target=layer1,layer2
change coord of layer : -affine shift=360.0
add prop from csv : join file.csv keys=layer,csv fields=col
merge all pol on layer (loose data): dissolve
merge all pol on layer (keep data): dissolve fields=prop1,prop2
add prop : each prop=value
