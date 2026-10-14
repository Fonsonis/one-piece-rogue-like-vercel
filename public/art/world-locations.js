globalThis.WorldLocations=Object.fromEntries(SAGAS.map(saga=>[saga.id,saga.islands.map((island,index)=>island.location||GameContent.data.WorldLocations?.[saga.id]?.[index]||{id:`${saga.id}-${index}`,place:island.name,zone:'',kind:'Isla',description:''})]));
for(const saga of SAGAS)saga.islands.forEach((island,index)=>{island.location=WorldLocations[saga.id][index];});
