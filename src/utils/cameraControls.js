export const getCameraPreset=(schema,id)=>schema.cameraPresets.find(p=>p.id===id)||schema.cameraPresets[0];
export const cameraControlConfig={enableRotate:true,enableZoom:true,enablePan:true,enableDamping:true,dampingFactor:.08,rotateSpeed:.55,zoomSpeed:.8,panSpeed:.5,minDistance:2,maxDistance:14,minPolarAngle:Math.PI/8,maxPolarAngle:Math.PI/2.05};
