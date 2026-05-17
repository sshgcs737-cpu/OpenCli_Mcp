import * as Cesium from 'cesium';

// 控制实体移动
export function controlEntityMovement(viewer: any, entityId: string) {
  if (!viewer) return null;
  let entity = viewer.entities.getById(entityId);
  if (!entity) {
    console.error("Entity with ID", entityId, "not found!");
    return null;
  }

  interface FlagState {
    moveUp: boolean;
    moveDown: boolean;
    moveLeft: boolean;
    moveRight: boolean;
    moveHigher: boolean;
    moveLower: boolean;
    [key: string]: boolean; // 添加索引签名
    [key: number]: boolean; // 添加索引签名
  }

  let flag: FlagState = {
    moveUp: false,
    moveDown: false,
    moveLeft: false,
    moveRight: false,
    moveHigher: false,
    moveLower: false,
  };

  let lastUpdateTime = performance.now();

  function setFlagStatus(event: KeyboardEvent, value: boolean) {
    let key = event.keyCode;
    flag[key] = value;

    switch (key) {
      case 37:
        flag.moveLeft = value;
        break; // 左箭头
      case 38:
        flag.moveUp = value;
        break; // 上箭头
      case 39:
        flag.moveRight = value;
        break; // 右箭头
      case 40:
        flag.moveDown = value;
        break; // 下箭头
      case 74:
        flag.moveHigher = value;
        break; // J 上升
      case 75:
        flag.moveLower = value;
        break; // K 下降
    }
  }

  // 使用命名函数而非匿名函数，以便后续能够移除事件监听
  const handleKeyDown = (e: KeyboardEvent) => {
    const key = e.keyCode;
    // 只要是无人机控制相关的按键，就阻止默认的浏览器行为（如页面滚动）
    // 实际的移动逻辑还是会由 onTick 中的 _isControlled 标志位来判断
    if (key === 37 || key === 38 || key === 39 || key === 40 || key === 74 || key === 75) {
      e.preventDefault();
    }
    setFlagStatus(e, true);
  };
  const handleKeyUp = (e: KeyboardEvent) => setFlagStatus(e, false);

  // 添加事件监听器
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  // 创建场景更新监听器函数
  const clockTickHandler = viewer.clock.onTick.addEventListener(() => {
    let now = performance.now();
    let deltaTime = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;

    if (deltaTime <= 0) return;

    // 检查实体是否仍然存在且处于控制状态
    if (!entity || !entity._isControlled) {
      return;
    }

    let position = entity.position.getValue(viewer.clock.currentTime);
    if (!position) {
      console.error("无法获取实体位置，移动失败");
      return;
    }

    let cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(position);
    let latitude = Cesium.Math.toDegrees(cartographic.latitude);
    let longitude = Cesium.Math.toDegrees(cartographic.longitude);
    let height = cartographic.height;

    const latMetersPerDegree = 111000;
    const lonMetersPerDegree =
      111000 * Math.cos(Cesium.Math.toRadians(latitude));

    let distance = entity.speed * deltaTime;
    let heightChange = entity.verticalSpeed * deltaTime;

    if (flag.moveLeft) longitude -= distance / lonMetersPerDegree;
    if (flag.moveRight) longitude += distance / lonMetersPerDegree;
    if (flag.moveUp) latitude += distance / latMetersPerDegree;
    if (flag.moveDown) latitude -= distance / latMetersPerDegree;
    if (flag.moveHigher) height += heightChange;
    if (flag.moveLower) height -= heightChange;

    latitude = Cesium.Math.clamp(latitude, -90, 90);
    longitude = Cesium.Math.clamp(longitude, -180, 180);
    height = Math.max(height, -20);

    let newPosition = Cesium.Cartesian3.fromDegrees(
      longitude,
      latitude,
      height
    );
    if (!newPosition) {
      console.error("新计算的位置无效！");
      return;
    }

    let heading = Math.atan2(
      Number(flag.moveRight) - Number(flag.moveLeft),
      Number(flag.moveUp) - Number(flag.moveDown)
    );
    let newOrientation = Cesium.Transforms.headingPitchRollQuaternion(
      newPosition,
      new Cesium.HeadingPitchRoll(heading, 0, 0)
    );

    entity.position = new Cesium.ConstantPositionProperty(newPosition);
    entity.orientation = new Cesium.ConstantProperty(newOrientation);

    // 无人机通信范围现在是独立实体，因此不会自动跟随
    // 检查是否存在对应的范围实体（通过实体引用）
    if ((entity as any)._rangeEntity) {
      // 无需额外操作，范围实体使用了回调函数自动获取无人机位置
      // 仅确保场景重绘以更新视觉效果
      viewer.scene.requestRender();
    }

    viewer.scene.requestRender();
  });

  // 返回一个用于移除控制的函数
  return function removeControl() {
    // 移除键盘事件监听器
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    
    // 移除时钟事件监听器
    if (clockTickHandler) {
      viewer.clock.onTick.removeEventListener(clockTickHandler);
    }
    
    // 重置移动标志
    Object.keys(flag).forEach(key => {
      flag[key as keyof FlagState] = false;
    });
    
  };
}
