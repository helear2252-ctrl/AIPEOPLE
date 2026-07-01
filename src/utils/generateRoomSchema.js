import baseSchema from '../data/roomSchema';
export function generateRoomSchema(requirements){return {...structuredClone(baseSchema),projectName:requirements.projectName||'AI Interior Concept',style:requirements.style,dimensions:{width:+requirements.roomWidth,depth:+requirements.roomDepth,height:+requirements.ceilingHeight},source:'AI-assisted procedural planning'};}
