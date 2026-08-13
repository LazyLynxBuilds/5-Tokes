const assert=require('assert');const {createDeck,validBook,validRun,canPartitionAll,minimumRemainingScore,validateMeldLayout}=require('./game');
const deck=createDeck();assert.equal(deck.length,116);const c=(s,r,id=`${s}${r}`)=>({id,suit:s,rank:r,joker:false});const j=id=>({id,joker:true,suit:null,rank:null});
assert(validBook([c('joint',9,'a'),c('leaf',9,'b'),j('j')],5));assert(validRun([c('bong',4,'a'),c('bong',5,'b'),j('j'),c('bong',7,'c')],3));
const hand=[c('joint',8,'a'),c('leaf',8,'b'),c('bong',8,'c'),c('joint',3,'d')];assert(canPartitionAll(hand.slice(0,3),5));assert.equal(minimumRemainingScore(hand,5),3);assert(validateMeldLayout(hand,'d',[['a','b','c']],5));
console.log('all game tests passed');
