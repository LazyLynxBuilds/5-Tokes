const fs=require('fs');
const path=require('path');

class LeaderboardStore{
  constructor(filePath){
    this.filePath=filePath||path.join(__dirname,'data','leaderboard.json');
    this.data={version:1,players:{},games:{}};
    this.load();
  }
  load(){
    try{
      if(fs.existsSync(this.filePath)){
        const parsed=JSON.parse(fs.readFileSync(this.filePath,'utf8'));
        if(parsed&&parsed.players&&parsed.games)this.data=parsed;
      }
    }catch(e){console.error('[leaderboard] failed to load:',e.message);}
  }
  save(){
    try{
      fs.mkdirSync(path.dirname(this.filePath),{recursive:true});
      const tmp=`${this.filePath}.tmp`;
      fs.writeFileSync(tmp,JSON.stringify(this.data,null,2));
      fs.renameSync(tmp,this.filePath);
    }catch(e){console.error('[leaderboard] failed to save:',e.message);}
  }
  hasGame(gameId){return !!(gameId&&this.data.games[gameId]);}
  recordGame({gameId,participants=[],winnerProfileIds=[],completedAt=Date.now()}){
    if(!gameId||this.hasGame(gameId))return false;
    const winners=new Set(winnerProfileIds.filter(Boolean));
    for(const part of participants){
      if(!part||!part.profileId)continue;
      const key=part.profileId;
      const old=this.data.players[key]||{
        profileId:key,name:part.name||'Player',avatarKey:part.avatarKey||'jahbuddy',games:0,wins:0,goldenNuggets:0,forfeits:0,
        completedScores:0,totalScore:0,bestScore:null,lastPlayedAt:0
      };
      old.name=part.name||old.name;
      old.avatarKey=part.avatarKey||old.avatarKey;
      old.games=(old.games||0)+1;
      if(winners.has(key)){old.wins=(old.wins||0)+1;old.goldenNuggets=(old.goldenNuggets||0)+1;}
      if(part.forfeit)old.forfeits=(old.forfeits||0)+1;
      if(Number.isFinite(part.score)){
        old.completedScores=(old.completedScores||0)+1;
        old.totalScore=(old.totalScore||0)+part.score;
        old.bestScore=old.bestScore==null?part.score:Math.min(old.bestScore,part.score);
      }
      old.lastPlayedAt=completedAt;
      this.data.players[key]=old;
    }
    this.data.games[gameId]={completedAt,winnerProfileIds:[...winners]};
    const gameIds=Object.keys(this.data.games);
    if(gameIds.length>1000){
      gameIds.sort((a,b)=>(this.data.games[a].completedAt||0)-(this.data.games[b].completedAt||0));
      for(const id of gameIds.slice(0,gameIds.length-1000))delete this.data.games[id];
    }
    this.save();return true;
  }
  entries(limit=100){
    const rows=Object.values(this.data.players).map(p=>({
      profileId:p.profileId,name:p.name,avatarKey:p.avatarKey,games:p.games||0,wins:p.wins||0,goldenNuggets:p.goldenNuggets||0,forfeits:p.forfeits||0,
      bestScore:p.bestScore,averageScore:p.completedScores?Math.round((p.totalScore/p.completedScores)*10)/10:null,lastPlayedAt:p.lastPlayedAt||0
    }));
    rows.sort((a,b)=>b.wins-a.wins||(a.averageScore??Infinity)-(b.averageScore??Infinity)||b.games-a.games||a.name.localeCompare(b.name));
    return rows.slice(0,Math.max(1,Math.min(500,Number(limit)||100))).map((r,i)=>({...r,rank:i+1}));
  }
}
module.exports={LeaderboardStore};
