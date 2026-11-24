'use strict';

globalThis.MNC_CATALOG_SCHEMA = Object.freeze({
  promoId:'LE26P',
  families:['Character','Critic','Movie','Item','Archive','Member','Meme','Moment','Location','Byline','Award','Reaction','Artifact'],
  classifications:['Regular','Secret'],
  statuses:['Draft','In design','Proof','Ready'],
  rarities:['Unassigned','Common','Uncommon','Rare','Ultra Rare','Special'],
  timing:['On reveal','After matchup','End of round','Passive','Before final scoring'],
  characterGroups:{
    Creature:['Monster','Animal','Ghost','Alien'],
    Hero:[], Villain:[], Redshirt:[], Sidekick:[]
  },
  itemTypes:['Meme','Weapon','Shield','Other','Hot Take','Trash','Unit','Award'],
  optionalColumns:{
    collections:['Collection code'],
    cards:['Credit type','Episode badge','Concept credit','Actor credit','Type icon'],
    characters:['Sidekick partner']
  },
  sheets:{
    collections:['Collection name','Release date','Regular target','Character target','Critic target','Movie target','Item target',
      'Collection ID','Set name','Set glyph','Edition','Secret target','Regular logged','Secret logged'],
    cards:['Card ID','Set card number','Collection ID','Family','Name','Artist','Artwork filename','Classification',
      'Status','Rarity','Rule name','Rule text','Timing','Episode','Film','Picked by','Subtype','Quote','Notes','Catalog check'],
    characters:['Name','Card ID','Episode','Category','Type','Subtype','Skill','Quote','Character check']
  }
});
