const crypto = require('crypto');
const SUITS = ['joint', 'grinder', 'leaf', 'bong', 'lighter'];
const RANKS = [3,4,5,6,7,8,9,10,11,12,13];

function cardId(prefix, suit, rank, copy) { return `${prefix}-${suit || 'joker'}-${rank || 'J'}-${copy}`; }
function createDeck() {
  const deck=[];
  for (const suit of SUITS) for (const rank of RANKS) for (let copy=1;copy<=2;copy++) deck.push({id:cardId('c',suit,rank,copy),suit,rank,joker:false});
  for (let i=1;i<=6;i++) deck.push({id:cardId('j',null,null,i),suit:null,rank:null,joker:true});
  return deck;
}
function shuffle(cards){const a=[...cards];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function isWild(card,roundRank){return card.joker||card.rank===roundRank;}
function scoreCard(card,roundRank){if(card.joker)return 50;if(card.rank===roundRank)return 20;return card.rank;}
function validBook(cards,roundRank){if(cards.length<3)return false;const n=cards.filter(c=>!isWild(c,roundRank));return !n.length||n.every(c=>c.rank===n[0].rank);}
function validRun(cards,roundRank){
  if(cards.length<3)return false; const n=cards.filter(c=>!isWild(c,roundRank)); if(!n.length)return true;
  const suit=n[0].suit;if(!n.every(c=>c.suit===suit))return false;const ranks=n.map(c=>c.rank).sort((a,b)=>a-b);
  for(let i=1;i<ranks.length;i++)if(ranks[i]===ranks[i-1])return false;
  const gaps=(ranks[ranks.length-1]-ranks[0]+1)-ranks.length,w=cards.length-n.length;if(gaps>w)return false;
  return w-gaps <= (ranks[0]-3)+(13-ranks[ranks.length-1]);
}
function validMeld(cards,roundRank){return validBook(cards,roundRank)||validRun(cards,roundRank);}
function findPartitionAll(cards,roundRank){
  if(!cards.length)return [];if(cards.length<3)return null;const n=cards.length,full=(1<<n)-1,meldMasks=[];
  for(let mask=1;mask<=full;mask++){const group=[];for(let i=0;i<n;i++)if(mask&(1<<i))group.push(cards[i]);if(group.length>=3&&validMeld(group,roundRank))meldMasks.push(mask);}
  const by=Array.from({length:n},()=>[]);for(const m of meldMasks)for(let i=0;i<n;i++)if(m&(1<<i))by[i].push(m);const memo=new Map();
  function dfs(mask){
    if(!mask)return [];
    if(memo.has(mask))return memo.get(mask);
    let first=0;while(!(mask&(1<<first)))first++;
    for(const m of by[first])if((m&mask)===m){const rest=dfs(mask^m);if(rest){const group=[];for(let i=0;i<n;i++)if(m&(1<<i))group.push(cards[i]);const result=[group,...rest];memo.set(mask,result);return result;}}
    memo.set(mask,null);return null;
  }
  return dfs(full);
}
function canPartitionAll(cards,roundRank){return findPartitionAll(cards,roundRank)!==null;}
function goOutDiscardIds(hand,roundRank){
  if(!Array.isArray(hand)||hand.length<4)return [];
  const ids=[];for(const card of hand){const remaining=hand.filter(c=>c.id!==card.id);if(findPartitionAll(remaining,roundRank))ids.push(card.id);}
  return ids;
}
function minimumRemainingScore(cards,roundRank){
  const n=cards.length;if(!n)return 0;const full=(1<<n)-1,meldMasks=[];
  for(let mask=1;mask<=full;mask++){const group=[];for(let i=0;i<n;i++)if(mask&(1<<i))group.push(cards[i]);if(group.length>=3&&validMeld(group,roundRank))meldMasks.push(mask);}
  const scoreMask=new Array(full+1).fill(0);for(let mask=1;mask<=full;mask++){const lsb=mask&-mask,idx=Math.log2(lsb)|0;scoreMask[mask]=scoreMask[mask^lsb]+scoreCard(cards[idx],roundRank);}
  const memo=new Map();function solve(mask){if(!mask)return 0;if(memo.has(mask))return memo.get(mask);let best=scoreMask[mask];for(const m of meldMasks)if((m&mask)===m)best=Math.min(best,solve(mask^m));memo.set(mask,best);return best;}return solve(full);
}
function publicCard(card){return card?{...card}:null;}
function validateMeldLayout(hand,discardId,meldIdGroups,roundRank){
  if(!Array.isArray(meldIdGroups)||!meldIdGroups.length)return false;
  const remaining=hand.filter(c=>c.id!==discardId),byId=new Map(remaining.map(c=>[c.id,c])),seen=new Set();
  for(const ids of meldIdGroups){if(!Array.isArray(ids)||ids.length<3)return false;const cards=[];for(const id of ids){if(seen.has(id)||!byId.has(id))return false;seen.add(id);cards.push(byId.get(id));}if(!validMeld(cards,roundRank))return false;}
  return seen.size===remaining.length;
}
function newPlayer(name,socketId,token,avatarKey='jahbuddy',profileId=null){return {id:crypto.randomUUID(),profileId:profileId||crypto.randomUUID(),sessionToken:token||crypto.randomUUID(),socketId,name,avatarKey,hand:[],score:0,connected:true,finalDone:false,roundPenalty:null};}


class GameRoom{
  constructor(code,hostSocketId,hostName,sessionToken,avatarKey='jahbuddy',profileId=null){const p=newPlayer(hostName,hostSocketId,sessionToken,avatarKey,profileId);this.code=code;this.players=[p];this.hostId=p.id;this.started=false;this.roundRank=3;this.dealerIndex=0;this.turnIndex=0;this.turnStage='draw';this.drawPile=[];this.discardPile=[];this.outPlayerId=null;this.roundEnding=false;this.winnerIds=[];this.outMelds=[];this.message='Waiting for players.';this.lastActivity=Date.now();this.gameId=null;this.gameParticipants=[];this.forfeitedParticipants=[];}
  touch(){this.lastActivity=Date.now();}
  addPlayer(socketId,name,token,avatarKey='jahbuddy',profileId=null){if(this.started)throw new Error('Game already started.');if(this.players.length>=7)throw new Error('Room is full (7 players max).');const p=newPlayer(name,socketId,token,avatarKey,profileId);this.players.push(p);this.touch();return p;}
  reconnect(sessionToken,socketId){const p=this.players.find(x=>x.sessionToken===sessionToken);if(!p)throw new Error('Saved seat not found.');p.socketId=socketId;p.connected=true;this.touch();return p;}
  disconnect(playerId){const p=this.players.find(x=>x.id===playerId);if(p){p.connected=false;p.socketId=null;this.touch();}}
  leave(playerId){
    if(this.started)throw new Error('A game is active. Use Forfeit Game to leave.');
    const idx=this.players.findIndex(p=>p.id===playerId);if(idx<0)throw new Error('Player not found.');
    this.players.splice(idx,1);
    if(this.hostId===playerId)this.hostId=this.players[0]?.id||null;
    if(this.players.length){this.dealerIndex=Math.min(this.dealerIndex,this.players.length-1);this.turnIndex=Math.min(this.turnIndex,this.players.length-1);this.message='Waiting for players.';}
    this.touch();return this.players.length===0;
  }
  forfeit(playerId){
    if(!this.started)throw new Error('No active game to forfeit.');
    const idx=this.players.findIndex(p=>p.id===playerId);if(idx<0)throw new Error('Player not found.');
    const currentId=this.currentPlayer()?.id, dealerId=this.players[this.dealerIndex]?.id, wasCurrent=currentId===playerId;
    const forfeiter=this.players[idx],name=forfeiter.name;this.forfeitedParticipants.push({id:forfeiter.id,profileId:forfeiter.profileId,name:forfeiter.name,avatarKey:forfeiter.avatarKey,score:null,forfeit:true});this.players.splice(idx,1);
    if(this.hostId===playerId)this.hostId=this.players[0]?.id||null;
    if(!this.players.length){this.started=false;this.turnStage='gameover';this.winnerIds=[];this.message=`${name} forfeited. Room is empty.`;this.touch();return true;}
    if(this.players.length===1){this.started=false;this.turnStage='gameover';this.winnerIds=[this.players[0].id];this.message=`${name} forfeited. ${this.players[0].name} wins by forfeit.`;this.turnIndex=0;this.dealerIndex=0;this.touch();return false;}
    const currentNew=this.players.findIndex(p=>p.id===currentId);
    this.turnIndex=wasCurrent?Math.min(idx,this.players.length-1):(currentNew>=0?currentNew:0);
    if(wasCurrent&&idx>=this.players.length)this.turnIndex=0;
    const dealerNew=this.players.findIndex(p=>p.id===dealerId);this.dealerIndex=dealerNew>=0?dealerNew:Math.min(this.dealerIndex,this.players.length-1);
    this.turnStage='draw';this.message=`${name} forfeited the game.`;
    if(this.roundEnding){const pending=this.players.filter(p=>p.id!==this.outPlayerId&&!p.finalDone);if(!pending.length)this.finishRound();}
    this.touch();return false;
  }
  start(requester){if(requester!==this.hostId)throw new Error('Only the host can start.');if(this.players.length<2)throw new Error('At least 2 players are required.');this.players=this.players.filter(p=>p.connected);if(this.players.length<2)throw new Error('At least 2 connected players are required.');this.hostId=this.players.some(p=>p.id===this.hostId)?this.hostId:this.players[0].id;this.gameId=crypto.randomUUID();this.gameParticipants=this.players.map(p=>({id:p.id,profileId:p.profileId,name:p.name,avatarKey:p.avatarKey}));this.forfeitedParticipants=[];this.started=true;this.roundRank=3;this.dealerIndex=0;this.winnerIds=[];this.players.forEach(p=>{p.score=0;p.roundPenalty=null;});this.startRound();}
  rematch(requester){if(requester!==this.hostId)throw new Error('Only the host can start a rematch.');if(this.started)throw new Error('The current game is still running.');this.start(requester);}
  startRound(){const deck=shuffle(createDeck());this.players.forEach(p=>{p.hand=[];p.finalDone=false;p.roundPenalty=null;});for(let c=0;c<this.roundRank;c++)for(const p of this.players)p.hand.push(deck.pop());this.drawPile=deck;this.discardPile=[this.drawPile.pop()];this.turnIndex=(this.dealerIndex+1)%this.players.length;this.turnStage='draw';this.outPlayerId=null;this.outMelds=[];this.roundEnding=false;this.message=`Round ${this.roundRank-2}: ${this.roundRank}s are wild.`;this.touch();}
  currentPlayer(){return this.players[this.turnIndex];}
  ensureTurn(id,stage){if(!this.started)throw new Error('Game has not started.');if(this.currentPlayer()?.id!==id)throw new Error('It is not your turn.');if(stage&&this.turnStage!==stage)throw new Error(`You must ${stage} first.`);}
  replenishDraw(){if(this.drawPile.length)return;if(this.discardPile.length<=1)throw new Error('No cards available to draw.');const top=this.discardPile.pop();this.drawPile=shuffle(this.discardPile);this.discardPile=[top];}
  draw(id,source){this.ensureTurn(id,'draw');const p=this.currentPlayer();let card;if(source==='discard'){if(!this.discardPile.length)throw new Error('Discard pile is empty.');card=this.discardPile.pop();}else{this.replenishDraw();card=this.drawPile.pop();}p.hand.push(card);this.turnStage='discard';this.touch();return card;}
  reorderHand(id,orderedIds){const p=this.players.find(x=>x.id===id);if(!p)throw new Error('Player not found.');if(!Array.isArray(orderedIds)||orderedIds.length!==p.hand.length)throw new Error('Invalid hand order.');const byId=new Map(p.hand.map(c=>[c.id,c]));const seen=new Set();const next=[];for(const cid of orderedIds){if(seen.has(cid)||!byId.has(cid))throw new Error('Invalid hand order.');seen.add(cid);next.push(byId.get(cid));}p.hand=next;this.touch();}
  discard(id,cardIdToDiscard){this.ensureTurn(id,'discard');const p=this.currentPlayer(),idx=p.hand.findIndex(c=>c.id===cardIdToDiscard);if(idx<0)throw new Error('Card not found in your hand.');const [card]=p.hand.splice(idx,1);this.discardPile.push(card);if(this.roundEnding&&id!==this.outPlayerId){p.finalDone=true;p.roundPenalty=minimumRemainingScore(p.hand,this.roundRank);}this.touch();this.advanceTurn();}
  goOut(id,discardId,melds){this.ensureTurn(id,'discard');if(this.roundEnding)throw new Error('Someone has already gone out.');const p=this.currentPlayer(),idx=p.hand.findIndex(c=>c.id===discardId);if(idx<0)throw new Error('Choose a card to discard.');const remaining=p.hand.filter(c=>c.id!==discardId);let finalGroups=null;if(melds&&melds.length&&validateMeldLayout(p.hand,discardId,melds,this.roundRank)){const before=new Map(p.hand.map(c=>[c.id,c]));finalGroups=melds.map(g=>g.map(cid=>before.get(cid)).filter(Boolean));}else finalGroups=findPartitionAll(remaining,this.roundRank);if(!finalGroups)throw new Error('The remaining cards cannot all be arranged into valid books/runs.');this.outMelds=finalGroups.map(g=>g.map(publicCard));const [card]=p.hand.splice(idx,1);this.discardPile.push(card);p.roundPenalty=0;p.finalDone=true;this.outPlayerId=id;this.roundEnding=true;this.message=`${p.name} went out! Everyone else gets one final turn.`;this.touch();this.advanceTurn();}
  advanceTurn(){if(this.roundEnding){const pending=this.players.filter(p=>p.id!==this.outPlayerId&&!p.finalDone);if(!pending.length)return this.finishRound();let next=this.turnIndex;for(let k=0;k<this.players.length;k++){next=(next+1)%this.players.length;if(this.players[next].id!==this.outPlayerId&&!this.players[next].finalDone)break;}this.turnIndex=next;this.turnStage='draw';return;}this.turnIndex=(this.turnIndex+1)%this.players.length;this.turnStage='draw';}
  finishRound(){for(const p of this.players){if(p.id===this.outPlayerId)p.roundPenalty=0;else if(p.roundPenalty==null)p.roundPenalty=minimumRemainingScore(p.hand,this.roundRank);p.score+=p.roundPenalty;}if(this.roundRank===13){const min=Math.min(...this.players.map(p=>p.score));this.winnerIds=this.players.filter(p=>p.score===min).map(p=>p.id);this.message=`Game over. Lowest score wins: ${min}.`;this.started=false;this.turnStage='gameover';this.touch();return;}this.roundRank++;this.dealerIndex=(this.dealerIndex+1)%this.players.length;this.startRound();}
  leaderboardSnapshot(){
    if(this.started||!this.gameId||!this.winnerIds.length)return null;
    const currentById=new Map(this.players.map(p=>[p.id,p]));
    const forfeitedById=new Map(this.forfeitedParticipants.map(p=>[p.id,p]));
    const endedByForfeit=/wins by forfeit/i.test(this.message||'');
    const participants=this.gameParticipants.map(base=>{
      const cur=currentById.get(base.id),forfeit=forfeitedById.get(base.id);
      return {...base,score:endedByForfeit?null:(cur&&Number.isFinite(cur.score)?cur.score:null),forfeit:!!forfeit};
    });
    const winnerProfileIds=this.winnerIds.map(id=>currentById.get(id)?.profileId||this.gameParticipants.find(p=>p.id===id)?.profileId).filter(Boolean);
    return {gameId:this.gameId,participants,winnerProfileIds,completedAt:Date.now()};
  }
  stateFor(id){const me=this.players.find(p=>p.id===id),currentId=this.currentPlayer()?.id;const goOutIds=me&&this.started&&currentId===id&&this.turnStage==='discard'&&!this.roundEnding?goOutDiscardIds(me.hand,this.roundRank):[];return {code:this.code,gameId:this.gameId,hostId:this.hostId,started:this.started,roundRank:this.roundRank,roundNumber:this.roundRank-2,dealerIndex:this.dealerIndex,turnIndex:this.turnIndex,turnStage:this.turnStage,currentPlayerId:currentId,outPlayerId:this.outPlayerId,roundEnding:this.roundEnding,discardTop:publicCard(this.discardPile[this.discardPile.length-1]),drawCount:this.drawPile.length,message:this.message,winnerIds:this.winnerIds,outMelds:this.outMelds,canRematch:!this.started&&this.winnerIds.length>0,canGoOut:goOutIds.length>0,goOutDiscardIds:goOutIds,you:me?{id:me.id,profileId:me.profileId,name:me.name,avatarKey:me.avatarKey,hand:me.hand.map(publicCard),score:me.score,roundPenalty:me.roundPenalty}:null,players:this.players.map((p,i)=>({id:p.id,profileId:p.profileId,name:p.name,avatarKey:p.avatarKey,score:p.score,cardCount:p.hand.length,connected:p.connected,dealer:i===this.dealerIndex,finalDone:p.finalDone,winner:this.winnerIds.includes(p.id)}))};}
}
module.exports={GameRoom,createDeck,isWild,scoreCard,validBook,validRun,validMeld,findPartitionAll,canPartitionAll,goOutDiscardIds,minimumRemainingScore,validateMeldLayout};
