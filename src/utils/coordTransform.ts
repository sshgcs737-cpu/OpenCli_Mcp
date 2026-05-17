import * as Cesium from 'cesium';

// 场景默认中心（原点）
const ORIGIN_LON = 121.12783051473023;
const ORIGIN_LAT = 23.828398440342344;

const originCartesian3 = Cesium.Cartesian3.fromDegrees(ORIGIN_LON, ORIGIN_LAT, 0);
const enuToFixedMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(originCartesian3);
const fixedToEnuMatrix = Cesium.Matrix4.inverse(enuToFixedMatrix, new Cesium.Matrix4());

/** 将经纬度+高度转换为相对于原点的 ENU 坐标(米) */
export function geoToENU(lon: number, lat: number, alt: number): { x: number; y: number; h: number } {
  const cartesian = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
  const local = Cesium.Matrix4.multiplyByPoint(fixedToEnuMatrix, cartesian, new Cesium.Cartesian3());
  return { x: local.x, y: local.y, h: local.z };
}

/** 将 ECEF Cartesian3 转换为相对于原点的 ENU 坐标(米) */
export function cartesianToENU(cartesian: Cesium.Cartesian3): { x: number; y: number; h: number } {
  const local = Cesium.Matrix4.multiplyByPoint(fixedToEnuMatrix, cartesian, new Cesium.Cartesian3());
  return { x: local.x, y: local.y, h: local.z };
}

/** 格式化米制坐标值 */
export function formatCoord(val: number): string {
  if (Math.abs(val) >= 1000) {
    return `${(val / 1000).toFixed(2)}km`;
  }
  return `${val.toFixed(1)}m`;
}

/** 将 geo 对象 {lon, lat, alt} 格式化为 XYZ 字符串 */
export function geoToXYHText(lon: number, lat: number, alt: number): string {
  const enu = geoToENU(lon, lat, alt);
  return `X: ${formatCoord(enu.x)}  Y: ${formatCoord(enu.y)}  Z: ${formatCoord(enu.h)}`;
}

export { originCartesian3, fixedToEnuMatrix, enuToFixedMatrix };
