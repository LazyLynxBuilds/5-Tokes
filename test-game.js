const assert=require('assert');
const {createDeck,validBook,validRun,findPartitionAll,canPartitionAll,goOutDiscardIds,minimumRemainingScore,validateMeldLayout,GameRoom,bestBotDiscard,chooseBotDrawSource}=require('./game');
const deck=createDeck();assert.equal(deck.length,116);
const c=(s,r,id=`${s}${r}`)=>({id,suit:s,rank:r,joker:false});const j=id=>({id,joker:true,suit:null,rank:null});
assert(validBook([c('joint',9,'a'),c('leaf',9,'b'),j('j')],5));
assert(validRun([c('bong',4,'a'),c('bong',5,'b'),j('j'),c('bong',7,'c')],3));
const hand=[c('joint',8,'a'),c('leaf',8,'b'),c('bong',8,'c'),c('joint',3,'d')];
assert(canPartitionAll(hand.slice(0,3),5));assert(findPartitionAll(hand.slice(0,3),5));assert.deepEqual(goOutDiscardIds(hand,5),['d']);assert.equal(minimumRemainingScore(hand,5),3);assert(validateMeldLayout(hand,'d',[['a','b','c']],5));
// Server exposes Go Out only in the discard stage and can auto-build a legal reveal layout.
const g=new GameRoom('OUT42','s1','One','t1');g.addPlayer('s2','Two','t2');g.started=true;g.roundRank=5;g.turnIndex=0;g.turnStage='discard';g.players[0].hand=hand.map(x=>({...x}));g.players[1].hand=[c('leaf',4,'z')];g.drawPile=[c('leaf',10,'draw')];g.discardPile=[c('bong',6,'top')];
let st=g.stateFor(g.players[0].id);assert.equal(st.canGoOut,true);assert.deepEqual(st.goOutDiscardIds,['d']);g.goOut(g.players[0].id,'d',[['a']]);assert.equal(g.roundEnding,true);assert.equal(g.outMelds.length,1);assert.equal(g.outMelds[0].length,3);
// Forfeit should end a two-player game and allow the winner to leave afterward.
const r=new GameRoom('ABCDE','s1','One','t1');const p2=r.addPlayer('s2','Two','t2');r.start(r.players[0].id);r.forfeit(p2.id);assert.equal(r.started,false);assert.equal(r.winnerIds.length,1);assert.equal(r.leave(r.players[0].id),true);

// Avatars are stored with player state and hand order can be rearranged without changing cards.
const aroom=new GameRoom('AV666','s1','Royal Roller','tok1','grinderqueen');const ap2=aroom.addPlayer('s2','Cloud King','tok2','bonglord');
assert.equal(aroom.stateFor(aroom.players[0].id).you.avatarKey,'grinderqueen');assert.equal(aroom.stateFor(aroom.players[0].id).players[1].avatarKey,'bonglord');
aroom.players[0].hand=[c('joint',3,'r1'),c('leaf',9,'r2'),c('bong',5,'r3')];aroom.reorderHand(aroom.players[0].id,['r2','r3','r1']);assert.deepEqual(aroom.players[0].hand.map(x=>x.id),['r2','r3','r1']);
console.log('all game tests passed');


// Computer-player mode: bots can join/start, prefer useful discards, and never appear as leaderboard profiles.
const cpuRoom=new GameRoom('CPU69','human-socket','Human','human-token','maryjane','profile_human_cpu_12345');
const cpu=cpuRoom.addComputerPlayer();
assert.equal(cpu.isBot,true);assert.equal(cpu.profileId,null);assert.equal(cpu.avatarKey,'highstakes');
cpuRoom.start(cpuRoom.players[0].id);assert.equal(cpuRoom.players.length,2);assert.equal(cpuRoom.players[1].isBot,true);
const botHand=[c('joint',8,'b1'),c('leaf',8,'b2'),c('bong',8,'b3'),c('lighter',13,'b4')];
const botDiscard=bestBotDiscard(botHand,5);assert.equal(botDiscard.card.id,'b4');assert.equal(botDiscard.penalty,0);
assert.equal(chooseBotDrawSource(botHand,j('cpu-joker'),5),'discard');
const stepRoom=new GameRoom('CPU70','hs','Human','ht');const stepCpu=stepRoom.addComputerPlayer();stepRoom.started=true;stepRoom.roundRank=5;stepRoom.turnIndex=1;stepRoom.turnStage='draw';stepCpu.hand=[c('joint',8,'s1'),c('leaf',8,'s2'),c('lighter',13,'s4')];stepRoom.drawPile=[c('bong',4,'deck1')];stepRoom.discardPile=[c('bong',8,'s3')];
let cpuAction=stepRoom.computerStep();assert.equal(cpuAction.stage,'draw');assert.equal(cpuAction.source,'discard');assert.equal(stepRoom.turnStage,'discard');
cpuAction=stepRoom.computerStep();assert.equal(cpuAction.stage,'goOut');assert.equal(stepRoom.outPlayerId,stepCpu.id);assert.equal(stepRoom.roundEnding,true);
cpuRoom.started=false;cpuRoom.turnStage='gameover';cpuRoom.players[0].score=42;cpuRoom.players[1].score=18;cpuRoom.winnerIds=[cpuRoom.players[1].id];
const cpuSnap=cpuRoom.leaderboardSnapshot();assert.equal(cpuSnap.participants.length,1);assert.equal(cpuSnap.participants[0].name,'Human');assert.equal(cpuSnap.winnerProfileIds.length,0);
console.log('computer player tests passed');

// Leaderboard snapshots include stable profile IDs and record winners once.
const fs=require('fs'),os=require('os'),path=require('path');
const {LeaderboardStore}=require('./leaderboardStore');
const lbFile=path.join(os.tmpdir(),`five-tokes-lb-${Date.now()}.json`);
const lr=new GameRoom('LB123','s1','Champ','tok1','kingkush','profile_champ_12345');const loser=lr.addPlayer('s2','Runner Up','tok2','maryjane','profile_runner_12345');
lr.start(lr.players[0].id);lr.players[0].score=18;lr.players[1].score=44;lr.started=false;lr.turnStage='gameover';lr.winnerIds=[lr.players[0].id];
const snap=lr.leaderboardSnapshot();assert.equal(snap.winnerProfileIds[0],'profile_champ_12345');assert.equal(snap.participants.length,2);
const store=new LeaderboardStore(lbFile);assert.equal(store.recordGame(snap),true);assert.equal(store.recordGame(snap),false);const rows=store.entries();assert.equal(rows[0].name,'Champ');assert.equal(rows[0].wins,1);assert.equal(rows[0].goldenNuggets,1);assert.equal(rows[0].bestScore,18);try{fs.unlinkSync(lbFile)}catch{}
console.log('leaderboard tests passed');
