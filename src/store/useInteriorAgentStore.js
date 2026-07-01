import {create} from 'zustand';
import roomSchema from '../data/roomSchema';
import {agentSteps,agentRoster} from '../data/agentSteps';
const initialAgents=Object.fromEntries(agentRoster.map(name=>[name,{status:'idle',output:null}]));
export const useInteriorAgentStore=create((set,get)=>({
 currentStep:-1,progress:0,isGenerating:false,isDraftReady:false,isSchemaReady:false,isViewerReady:false,activeAgent:null,logs:[],roomSchema,selectedHotspot:null,materialTheme:'warm minimal',lightMode:'day',activeCameraPreset:'overview',agents:initialAgents,runToken:0,
 startGeneration:()=>set(s=>({currentStep:0,progress:2,isGenerating:true,isDraftReady:false,isSchemaReady:false,isViewerReady:false,logs:[],selectedHotspot:null,agents:initialAgents,runToken:s.runToken+1})),
 beginStep:(index)=>set(s=>({currentStep:index,activeAgent:agentSteps[index].agent,agents:{...s.agents,[agentSteps[index].agent]:{status:'running',output:null}}})),
 completeStep:(index,output)=>set(s=>{const agents={...s.agents,[agentSteps[index].agent]:{status:'completed',output}};if(agentSteps[index].id==='viewer-ready')agents['QA Agent']={status:'completed',output:{checks:'passed'}};return {progress:Math.round(((index+1)/agentSteps.length)*100),agents}}),
 appendLog:(message,agent)=>set(s=>({logs:[...s.logs,{id:`${Date.now()}-${s.logs.length}`,time:new Date().toLocaleTimeString([],{hour12:false}),agent:agent||s.activeAgent,message}].slice(-70)})),
 setRoomSchema:(schema)=>set({roomSchema:schema,isSchemaReady:true}),setDraftReady:(v=true)=>set({isDraftReady:v}),setViewerReady:(v=true)=>set({isViewerReady:v,isGenerating:!v}),selectHotspot:(item)=>set({selectedHotspot:item}),setMaterialTheme:(v)=>set({materialTheme:v}),setLightMode:(v)=>set({lightMode:v}),setCameraPreset:(v)=>set({activeCameraPreset:v}),
 resetWorkflow:()=>set(s=>({...s,currentStep:-1,progress:0,isGenerating:false,isDraftReady:false,isSchemaReady:false,isViewerReady:false,activeAgent:null,logs:[],selectedHotspot:null,agents:initialAgents,runToken:s.runToken+1})),
}));
// Expose to postMessage bridge (interior-main.jsx)
if (typeof window !== 'undefined') window.__interiorStore = useInteriorAgentStore;
