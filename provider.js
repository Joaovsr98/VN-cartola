// Boundary for a future authorized provider. No network or Cartola credentials in this MVP.
export class ManualScoreProvider {
 constructor(store){this.store=store;}
 scores(leagueId){return this.store.scores(leagueId);}
 status(){return {mode:'manual',live:false,label:'Dados demonstrativos / lançamento manual'};}
}
