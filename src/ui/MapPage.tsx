import { Compass, MapPin, Minus, Plus, Scan } from 'lucide-react'

export default function MapPage(){
  return <div className="full-map"><div className="map-terrain"><div className="map-region region-a"/><div className="map-region region-b"/><div className="map-region region-c"/><div className="map-route"/><span className="map-location capital"><MapPin size={17}/> 首都</span><span className="map-location north"><MapPin size={17}/> 北境</span><span className="map-location port"><MapPin size={17}/> 旧港</span></div><div className="map-title"><div className="eyebrow">WORLD ATLAS</div><h1>世界地图</h1><span>地点与区域的空间视图</span></div><div className="map-compass"><Compass size={21}/><span>N</span></div><div className="map-zoom"><button title="放大"><Plus size={17}/></button><button title="缩小"><Minus size={17}/></button><button title="适应屏幕"><Scan size={17}/></button></div><div className="map-notice">地图文件及地点交互接口已预留</div></div>
}
