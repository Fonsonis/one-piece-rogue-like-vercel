/* Researched display metadata. Saga/index save keys and battle rules stay unchanged. */
(()=>{
const catalog={
  "eastblue": [
    {
      "id": "eastblue-0",
      "place": "Isla Yotsuba",
      "zone": "Shells Town",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Shells_Town",
      "description": "Puerto de tejados rojos dominado por la base de la Marina."
    },
    {
      "id": "eastblue-1",
      "place": "Islas Organ",
      "zone": "Orange Town",
      "kind": "Archipiélago",
      "source": "https://onepiece.fandom.com/wiki/Organ_Islands",
      "description": "Casas de colores y una plaza junto al puerto."
    },
    {
      "id": "eastblue-2",
      "place": "Islas Gecko",
      "zone": "Villa Syrup",
      "kind": "Archipiélago",
      "source": "https://onepiece.fandom.com/wiki/Gecko_Islands",
      "description": "Acantilados verdes, caminos rurales y la mansión de Kaya."
    },
    {
      "id": "eastblue-3",
      "place": "Baratie",
      "zone": "Restaurante flotante",
      "kind": "Barco",
      "source": "https://onepiece.fandom.com/wiki/Baratie",
      "description": "El restaurante de Zeff navega sobre su propio casco."
    },
    {
      "id": "eastblue-4",
      "place": "Islas Conomi",
      "zone": "Arlong Park",
      "kind": "Archipiélago",
      "source": "https://onepiece.fandom.com/wiki/Conomi_Islands",
      "description": "Una pagoda junto al agua y huertos de mandarinas."
    },
    {
      "id": "eastblue-5",
      "place": "Islas Polestar",
      "zone": "Loguetown",
      "kind": "Archipiélago",
      "source": "https://onepiece.fandom.com/wiki/Loguetown",
      "description": "Una ciudad portuaria alrededor de la plaza de ejecución."
    }
  ],
  "alabasta": [
    {
      "id": "alabasta-0",
      "place": "Isla Cactus",
      "zone": "Whisky Peak",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Cactus_Island",
      "description": "Las montañas con forma de cactus vigilan el pueblo."
    },
    {
      "id": "alabasta-1",
      "place": "Little Garden",
      "zone": "Selva prehistórica",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Little_Garden",
      "description": "Vegetación gigantesca, volcanes y huellas de dinosaurios."
    },
    {
      "id": "alabasta-2",
      "place": "Isla Drum",
      "zone": "Castillo de Drum",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Drum_Island",
      "description": "Pilares de roca nevados sostienen el castillo."
    },
    {
      "id": "alabasta-3",
      "place": "Isla Sandy",
      "zone": "Rainbase",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Arabasta",
      "description": "Una ciudad oasis con el casino Rain Dinners."
    },
    {
      "id": "alabasta-4",
      "place": "Isla Sandy",
      "zone": "Alubarna",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Alubarna",
      "description": "El palacio real se alza sobre una meseta del desierto."
    }
  ],
  "skypiea": [
    {
      "id": "skypiea-0",
      "place": "Jaya",
      "zone": "Mock Town",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Jaya",
      "description": "Tabernas piratas y muelles en una costa tropical."
    },
    {
      "id": "skypiea-1",
      "place": "Isla Angel",
      "zone": "Angel Beach",
      "kind": "Isla del cielo",
      "source": "https://onepiece.fandom.com/wiki/Angel_Island",
      "description": "Una playa de nubes y casas con formas de concha."
    },
    {
      "id": "skypiea-2",
      "place": "Upper Yard",
      "zone": "Shandora",
      "kind": "Isla del cielo",
      "source": "https://onepiece.fandom.com/wiki/Shandora",
      "description": "Ruinas cubiertas de selva y una campana dorada."
    },
    {
      "id": "skypiea-3",
      "place": "Upper Yard",
      "zone": "Santuario de Dios",
      "kind": "Isla del cielo",
      "source": "https://onepiece.fandom.com/wiki/Upper_Yard",
      "description": "El Giant Jack asciende entre las nubes del santuario."
    }
  ],
  "water7": [
    {
      "id": "water7-0",
      "place": "Water 7",
      "zone": "Ciudad del agua",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Water_7",
      "description": "Canales, astilleros y una gran fuente central."
    },
    {
      "id": "water7-1",
      "place": "Puffing Tom",
      "zone": "Tren marino",
      "kind": "Transporte",
      "source": "https://onepiece.fandom.com/wiki/Puffing_Tom",
      "description": "El tren conecta las ciudades del mar por sus vías."
    },
    {
      "id": "water7-2",
      "place": "Enies Lobby",
      "zone": "Isla Judicial",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Enies_Lobby",
      "description": "Una fortaleza rodeada por un abismo y cascadas."
    },
    {
      "id": "water7-3",
      "place": "Enies Lobby",
      "zone": "Torre de la Justicia",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Tower_of_Justice",
      "description": "La torre y el puente dominan el recinto judicial."
    }
  ],
  "thriller": [
    {
      "id": "thriller-0",
      "place": "Thriller Bark",
      "zone": "Bosque de los Muertos",
      "kind": "Barco-isla",
      "source": "https://onepiece.fandom.com/wiki/Thriller_Bark",
      "description": "La niebla envuelve el bosque del enorme barco."
    },
    {
      "id": "thriller-1",
      "place": "Thriller Bark",
      "zone": "Mansión de Hogback",
      "kind": "Barco-isla",
      "source": "https://onepiece.fandom.com/wiki/Thriller_Bark",
      "description": "Una mansión gótica escondida entre árboles retorcidos."
    },
    {
      "id": "thriller-2",
      "place": "Thriller Bark",
      "zone": "Wonder Garden",
      "kind": "Barco-isla",
      "source": "https://onepiece.fandom.com/wiki/Thriller_Bark",
      "description": "El jardín de Perona conecta las construcciones del barco."
    },
    {
      "id": "thriller-3",
      "place": "Thriller Bark",
      "zone": "Mast Mansion",
      "kind": "Barco-isla",
      "source": "https://onepiece.fandom.com/wiki/Thriller_Bark",
      "description": "Una torre gótica ocupa el mástil de Thriller Bark."
    }
  ],
  "marineford": [
    {
      "id": "marineford-0",
      "place": "Amazon Lily",
      "zone": "Reino Kuja",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Amazon_Lily",
      "description": "Una isla de selva y arquitectura rodeada de serpientes."
    },
    {
      "id": "marineford-1",
      "place": "Impel Down",
      "zone": "Niveles 1–3",
      "kind": "Prisión",
      "source": "https://onepiece.fandom.com/wiki/Impel_Down",
      "description": "La fortaleza marítima esconde niveles bajo el agua."
    },
    {
      "id": "marineford-2",
      "place": "Impel Down",
      "zone": "Niveles 4–6",
      "kind": "Prisión",
      "source": "https://onepiece.fandom.com/wiki/Impel_Down",
      "description": "Fuego y hielo distinguen las profundidades de la prisión."
    },
    {
      "id": "marineford-3",
      "place": "Marineford",
      "zone": "Bahía",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Marineford",
      "description": "Una bahía en media luna protege la sede de la Marina."
    },
    {
      "id": "marineford-4",
      "place": "Marineford",
      "zone": "Plaza de ejecución",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Marineford",
      "description": "La plaza de piedra se abre frente al cuartel general."
    }
  ],
  "gyojin": [
    {
      "id": "gyojin-0",
      "place": "Isla Gyojin",
      "zone": "Bosque Marino",
      "kind": "Isla submarina",
      "source": "https://onepiece.fandom.com/wiki/Sea_Forest",
      "description": "Corales y restos de barcos bajo la luz de la burbuja."
    },
    {
      "id": "gyojin-1",
      "place": "Isla Gyojin",
      "zone": "Distrito Gyojin",
      "kind": "Isla submarina",
      "source": "https://onepiece.fandom.com/wiki/Fish-Man_District",
      "description": "Un barrio de edificios marinos y caminos de coral."
    },
    {
      "id": "gyojin-2",
      "place": "Isla Gyojin",
      "zone": "Palacio Ryugu",
      "kind": "Isla submarina",
      "source": "https://onepiece.fandom.com/wiki/Ryugu_Palace",
      "description": "Un palacio de dragones entre corales y conchas."
    },
    {
      "id": "gyojin-3",
      "place": "Isla Gyojin",
      "zone": "Plaza Gyoncorde",
      "kind": "Isla submarina",
      "source": "https://onepiece.fandom.com/wiki/Gyoncorde_Plaza",
      "description": "La gran plaza reúne los caminos del reino submarino."
    }
  ],
  "dressrosa": [
    {
      "id": "dressrosa-0",
      "place": "Punk Hazard",
      "zone": "Laboratorio de Caesar",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Punk_Hazard",
      "description": "Fuego y hielo parten la isla alrededor del laboratorio."
    },
    {
      "id": "dressrosa-1",
      "place": "Dressrosa",
      "zone": "Acacia",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Acacia",
      "description": "Un puerto de tejados mediterráneos y flores."
    },
    {
      "id": "dressrosa-2",
      "place": "Dressrosa",
      "zone": "Coliseo Corrida",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Corrida_Colosseum",
      "description": "Un anfiteatro circular junto a las calles de la ciudad."
    },
    {
      "id": "dressrosa-3",
      "place": "Dressrosa",
      "zone": "Palacio Real",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Dressrosa",
      "description": "El palacio corona una alta formación rocosa."
    },
    {
      "id": "dressrosa-4",
      "place": "Dressrosa",
      "zone": "Colina de las Flores",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Flower_Hill",
      "description": "Girasoles amarillos cubren la colina elevada."
    },
    {
      "id": "dressrosa-5",
      "place": "Dressrosa",
      "zone": "Puerto oriental",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Dressrosa",
      "description": "Muelles de madera al pie de los acantilados."
    }
  ],
  "wholecake": [
    {
      "id": "wholecake-0",
      "place": "Whole Cake Island",
      "zone": "Bosque Seductor",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Whole_Cake_Island",
      "description": "Árboles con rostro y dulces forman un bosque vivo."
    },
    {
      "id": "wholecake-1",
      "place": "Whole Cake Island",
      "zone": "Sweet City",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Whole_Cake_Island",
      "description": "Una ciudad construida con pasteles y golosinas."
    },
    {
      "id": "wholecake-2",
      "place": "Whole Cake Island",
      "zone": "Whole Cake Chateau",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Whole_Cake_Chateau",
      "description": "El enorme castillo de tarta domina la ciudad."
    },
    {
      "id": "wholecake-3",
      "place": "Whole Cake Island",
      "zone": "Azotea del Chateau",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Whole_Cake_Chateau",
      "description": "El jardín de té ocupa la parte alta del castillo."
    },
    {
      "id": "wholecake-4",
      "place": "Isla Cacao",
      "zone": "Chocolat Town",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Cacao_Island",
      "description": "Casas de chocolate y árboles de cacao junto al mar."
    },
    {
      "id": "wholecake-5",
      "place": "Isla Cacao",
      "zone": "Puerto de Chocolat Town",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Cacao_Island",
      "description": "El puerto de chocolate abre la salida al mar."
    }
  ],
  "wano": [
    {
      "id": "wano-0",
      "place": "País de Wano",
      "zone": "Kuri",
      "kind": "Región",
      "source": "https://onepiece.fandom.com/wiki/Kuri",
      "description": "Campos, pueblos y un gran torii entre montañas."
    },
    {
      "id": "wano-1",
      "place": "País de Wano",
      "zone": "Udon",
      "kind": "Región",
      "source": "https://onepiece.fandom.com/wiki/Udon",
      "description": "La cantera y la prisión dominan el terreno árido."
    },
    {
      "id": "wano-2",
      "place": "País de Wano",
      "zone": "Capital de las Flores",
      "kind": "Región",
      "source": "https://onepiece.fandom.com/wiki/Flower_Capital",
      "description": "Tejados, cerezos y faroles alrededor del castillo."
    },
    {
      "id": "wano-3",
      "place": "Onigashima",
      "zone": "Entrada de la isla",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Onigashima",
      "description": "Una gigantesca calavera con cuernos emerge del mar."
    },
    {
      "id": "wano-4",
      "place": "Onigashima",
      "zone": "Cúpula del Cráneo",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Onigashima",
      "description": "El castillo se integra en la boca de la calavera."
    },
    {
      "id": "wano-5",
      "place": "Onigashima",
      "zone": "Live Floor",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Onigashima",
      "description": "El gran salón se extiende dentro de la cúpula."
    },
    {
      "id": "wano-6",
      "place": "Onigashima",
      "zone": "Azotea de la cúpula",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Onigashima",
      "description": "La plataforma superior queda entre los grandes cuernos."
    }
  ],
  "egghead": [
    {
      "id": "egghead-0",
      "place": "Egghead",
      "zone": "Labophase",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Egghead",
      "description": "El laboratorio se eleva sobre una plataforma de nubes."
    },
    {
      "id": "egghead-1",
      "place": "Egghead",
      "zone": "Fabriophase",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Egghead",
      "description": "Cúpulas, fábricas y cohetes en la ciudad del futuro."
    },
    {
      "id": "egghead-2",
      "place": "Egghead",
      "zone": "Punk Records",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Egghead",
      "description": "La estructura superior conserva el conocimiento de Vegapunk."
    },
    {
      "id": "egghead-3",
      "place": "Egghead",
      "zone": "Costa de la isla",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Egghead",
      "description": "Los laboratorios costeros miran al cerco de la Marina."
    },
    {
      "id": "egghead-4",
      "place": "Egghead",
      "zone": "Fabriophase · plaza",
      "kind": "Isla",
      "source": "https://onepiece.fandom.com/wiki/Egghead",
      "description": "Una plaza futurista entre las construcciones de la isla."
    },
    {
      "id": "egghead-5",
      "place": "Mary Geoise",
      "zone": "Castillo Pangaea · Trono Vacío",
      "kind": "Ciudad",
      "source": "https://onepiece.fandom.com/wiki/Empty_Throne",
      "description": "El castillo se alza sobre la cima de la Red Line."
    }
  ]
};
for(const saga of SAGAS){
 const places=catalog[saga.id];
 if(!places||places.length!==saga.islands.length)throw Error('World catalog mismatch: '+saga.id);
 saga.islands.forEach((island,index)=>{island.location=Object.freeze(places[index]);island.name=places[index].place+' · '+places[index].zone;});
}
globalThis.WorldLocations=Object.freeze(catalog);
})();
