// Rules are fixed at creation until a versioned rules workflow is added.
export function validateLeague(input){
 const {name,season,start_round,end_round,knockout_start,knockout_size}=input||{};
 if(typeof name!=='string'||name.trim().length<3||name.trim().length>80||!Number.isInteger(season)||season<2027||season>2100||![start_round,end_round,knockout_start,knockout_size].every(Number.isInteger)||start_round<1||end_round>38||start_round>=knockout_start||![2,4,8,16,32].includes(knockout_size)||knockout_start+Math.log2(knockout_size)-1>end_round) throw Object.assign(Error('Regulamento inválido: confira nome, temporada, rodadas e tamanho da chave.'),{status:400});
 return {name:name.trim(),season,start_round,end_round,knockout_start,knockout_size};
}
