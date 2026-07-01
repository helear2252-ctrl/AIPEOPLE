import {agentSteps} from '../data/agentSteps';
import {generateRoomSchema} from './generateRoomSchema';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function runInteriorAgents(requirements,store){
 store.startGeneration();
 const outputs={};
 for(let i=0;i<agentSteps.length;i++){
  const step=agentSteps[i]; store.beginStep(i);
  for(const log of step.logs){store.appendLog(log,step.agent);await wait(240);}
  if(step.id==='requirement-analysis')outputs.designBrief={...requirements,referenceImages:requirements.referenceImages||[]};
  if(step.id==='layout-planning')outputs.layoutPlan={walls:3,zones:['living','kitchen','dining'],openings:['entry','living-window'],circulation:{minimumClearance:.85},furniturePlacement:'resolved'};
  if(step.id==='draft-generation'){store.setDraftReady(true);outputs.draft={type:'proposal-board',views:['plan','elevation-a','elevation-b','isometric']};}
  if(step.id==='schema-conversion'){outputs.roomSchema=generateRoomSchema(requirements);store.setRoomSchema(outputs.roomSchema);}
  if(step.id==='material-assignment')outputs.materials={theme:store.materialTheme,assigned:true};
  if(step.id==='lighting-design')outputs.lighting={modes:['day','night'],active:store.lightMode};
  if(step.id==='three-scene-build')outputs.scene={source:'Room Schema',procedural:true,objects:store.roomSchema.furniture.length};
  if(step.id==='viewer-ready'){outputs.qa={intersections:'passed',circulation:'passed',orbitControls:'ready',mobile:'ready'};store.setViewerReady(true);}
  store.completeStep(i,outputs[Object.keys(outputs).at(-1)]);await wait(180);
 }
}
