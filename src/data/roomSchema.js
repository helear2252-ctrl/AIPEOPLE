const roomSchema={
 projectName:'AI Interior Concept',source:'AI-generated draft',dimensions:{width:7.2,depth:6.4,height:3},style:'warm minimal luxury',
 zones:[{id:'living',label:'Living Room',bounds:[-.5,.1,3.3,3],description:'Main sofa and coffee table area'},{id:'kitchen',label:'Kitchen',bounds:[-3.3,-3,3.3,-.65],description:'Cabinet wall and island'},{id:'dining',label:'Dining',bounds:[-3.2,.65,-.7,3],description:'Dining table near entrance'}],
 walls:[{id:'back-wall',position:[0,1.5,-3.2],scale:[7.2,3,.16],material:'warmWhiteWall'},{id:'left-wall',position:[-3.6,1.5,0],scale:[.16,3,6.4],material:'warmWhiteWall'},{id:'right-wall',position:[3.6,1.5,-.6],scale:[.16,3,5],material:'warmWhiteWall'}],
 floors:[{id:'main-floor',position:[0,-.08,0],scale:[7.2,.16,6.4],material:'lightWood'}],ceilings:[],
 windows:[{id:'living-window',position:[3.48,1.65,1.25],scale:[.08,2.15,2.7],material:'glassWindow'}],doors:[{id:'entry',position:[-3.48,1.1,2.3],scale:[.1,2.2,1.05]}],
 furniture:[
  {id:'sofa-main',type:'sofa',label:'Modular Sofa',position:[1.35,.38,1.25],rotation:[0,0,0],scale:[2.55,.76,.95],material:'softFabric',zone:'living',hotspotText:'Warm modular sofa aligned to preserve the kitchen sightline.'},
  {id:'coffee-table',type:'coffeeTable',label:'Stone Coffee Table',position:[1.2,.24,2.25],rotation:[0,0,0],scale:[1.35,.18,.72],material:'marble',zone:'living',hotspotText:'Low sculptural table anchors the soft seating composition.'},
  {id:'rug',type:'rug',label:'Textured Rug',position:[1.2,.015,1.75],rotation:[0,0,0],scale:[3.5,.02,2.5],material:'rug',zone:'living',hotspotText:'Large woven rug defines the living zone.'},
  {id:'tv-console',type:'console',label:'Media Console',position:[2.85,.32,-.05],rotation:[0,Math.PI/2,0],scale:[2.1,.5,.38],material:'wood',zone:'living',hotspotText:'Floating media storage in warm oak veneer.'},
  {id:'kitchen-island',type:'island',label:'Kitchen Island',position:[.25,.48,-1.25],rotation:[0,0,0],scale:[2.35,.95,.92],material:'marble',zone:'kitchen',hotspotText:'Central island with waterfall stone countertop.'},
  {id:'cabinet-wall',type:'cabinet',label:'Full Height Cabinet',position:[-1.6,1.22,-3.02],rotation:[0,0,0],scale:[3.15,2.44,.42],material:'matteBeige',zone:'kitchen',hotspotText:'Full-height storage with integrated appliances.'},
  {id:'dining-table',type:'diningTable',label:'Dining Table',position:[-2.15,.38,2.15],rotation:[0,.1,0],scale:[1.55,.16,.9],material:'wood',zone:'dining',hotspotText:'Round-edged dining table close to natural light.'},
  {id:'dining-chairs',type:'chairs',label:'Dining Chairs',position:[-2.15,.42,2.15],rotation:[0,.1,0],scale:[1,1,1],material:'darkMetal',zone:'dining',hotspotText:'Four slim dining chairs maintain generous circulation.'},
  {id:'bar-stools',type:'stools',label:'Bar Stools',position:[.25,.42,-.55],rotation:[0,0,0],scale:[1,1,1],material:'darkMetal',zone:'kitchen',hotspotText:'Two counter stools support casual dining.'},
 ],
 materials:{floor:'lightWood',wall:'warmWhiteWall',cabinet:'matteBeige',countertop:'marble',metal:'darkMetal',sofa:'softFabric'},
 lights:[{id:'day-key',type:'directional',position:[4,7,5],intensity:2.2},{id:'pendant-1',type:'point',position:[-.45,2.45,-1.2],intensity:1.2},{id:'pendant-2',type:'point',position:[.85,2.45,-1.2],intensity:1.2}],
 cameraPresets:[{id:'overview',label:'Overview',position:[6,5,8],target:[0,1,0]},{id:'living',label:'Living',position:[3.5,2.2,4.2],target:[1,.8,1.4]},{id:'kitchen',label:'Kitchen',position:[2.8,2.4,-4.8],target:[0,.9,-1.8]},{id:'dining',label:'Dining',position:[-3.8,2.2,4.4],target:[-2,.8,2.2]},{id:'top',label:'Top View',position:[0,9,.1],target:[0,0,0]}],
 cameras:[],hotspots:[]
};
export default roomSchema;
