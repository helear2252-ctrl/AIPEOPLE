import {useInteriorAgentStore} from '../store/useInteriorAgentStore';
export default function CameraPresetBar(){const {roomSchema,activeCameraPreset,setCameraPreset}=useInteriorAgentStore();return <div className="camera-bar">{roomSchema.cameraPresets.map(p=><button key={p.id} className={activeCameraPreset===p.id?'active':''} onClick={()=>setCameraPreset(p.id)}>{p.label}</button>)}</div>}
