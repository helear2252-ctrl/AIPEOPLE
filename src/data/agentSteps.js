export const agentSteps = [
  {id:'requirement-analysis',agent:'Requirement Agent',label:'Requirements',logs:['Reading spatial requirements...','Normalizing room dimensions and constraints...','Design brief structured successfully.']},
  {id:'layout-planning',agent:'Layout Planning Agent',label:'Layout',logs:['Mapping living and kitchen zones...','Calculating circulation clearances...','Furniture placement plan resolved.']},
  {id:'draft-generation',agent:'Draft Drawing Agent',label:'Draft board',logs:['Creating architectural draft board...','Drawing elevations and dimension lines...','Material legend and isometric study ready.']},
  {id:'schema-conversion',agent:'Room Schema Agent',label:'Room schema',logs:['Extracting furniture coordinates...','Converting 2D draft into Room Schema...','Schema validation passed.']},
  {id:'material-assignment',agent:'Material Agent',label:'Materials',logs:['Assigning warm minimal material palette...','Balancing wood, stone and fabric finishes...','Material library linked to schema.']},
  {id:'lighting-design',agent:'Lighting Agent',label:'Lighting',logs:['Evaluating daylight openings...','Creating warm ambient lighting rig...','Day and night scenes configured.']},
  {id:'three-scene-build',agent:'3D Scene Builder Agent',label:'3D build',logs:['Building procedural 3D room shell...','Instancing schema-driven furniture...','Contact shadows and environment ready.']},
  {id:'viewer-ready',agent:'Viewer Control Agent',label:'Viewer ready',logs:['Initializing OrbitControls...','QA Agent: checking intersections, cameras and mobile input...','Interactive viewer ready.']},
];
export const agentRoster=['Requirement Agent','Layout Planning Agent','Draft Drawing Agent','Room Schema Agent','3D Scene Builder Agent','Material Agent','Lighting Agent','Viewer Control Agent','QA Agent'];
